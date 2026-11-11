import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Router, type RequestHandler } from "express";
import multer from "multer";
import JSZip from "jszip";
import { z } from "zod";
import { registrarAuditoria } from "../audit.js";
import type { UsuarioSesion } from "../auth/session.js";
import { pool } from "../db.js";
import { ah, HttpError } from "../http.js";
import {
  eliminarArchivo,
  guardarArchivo,
  guardarBuffer,
  leerArchivo,
  servirArchivo,
  archivoDirectoSchema,
  verificarSubidaDirecta,
} from "../lib/almacen.js";
import { carpetaSubidas } from "../lib/carpetas.js";
import {
  carpetaConstruccionActual,
  estructuraPorId,
  normalizarCarpeta,
  type Estructura,
} from "../lib/estructura.js";
import { CAMPOS_DOCUMENTO, ORDEN_DOCUMENTOS } from "./proyectos.js";

const CARPETA = carpetaSubidas();

const EXTENSIONES = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".png", ".jpg", ".jpeg", ".txt",
]);

const TIPOS = ["Actas", "Informes", "Antecedentes", "Evidencias", "Documentación técnica", "Comunicaciones", "Otros"];
type EstadoDocumento = "Aprobado" | "En revisión" | "Borrador" | "Rechazado";
const ESTADOS: EstadoDocumento[] = ["Aprobado", "En revisión", "Borrador", "Rechazado"];
const MANIFIESTO = "_sei-documentos.json";
const LIMITE_PAQUETE = 100 * 1024 * 1024;
const LIMITE_ARCHIVO = 20 * 1024 * 1024;
const MAX_ENTRADAS = 200;

const MIME_POR_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt": "text/plain",
};

const fechaDocumentoSchema = z.string().refine((valor) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor.startsWith("0000-")) return false;
  const fecha = new Date(`${valor}T00:00:00.000Z`);
  return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}, "Indica una fecha real en formato YYYY-MM-DD");
const numeroDocumentoSchema = z.string().trim().max(80).nullable()
  .transform((valor) => valor || null);
const fechaDocumentoActualizacionSchema = z.union([fechaDocumentoSchema, z.literal(""), z.null()])
  .transform((valor) => valor || null);

const entradaManifiestoSchema = z.object({
  id: z.string().trim().min(1).optional(),
  archivo: z.string().min(1),
  tipo: z.string().trim().min(1).max(60).optional(),
  carpeta: z.string().trim().max(300).nullable().optional(),
  nombre: z.string().trim().max(200).optional(),
  version: z.string().trim().max(20).optional(),
  estado: z.enum(["Aprobado", "En revisión", "Borrador", "Rechazado"]).optional(),
  fecha: fechaDocumentoSchema.nullable().optional(),
  fechaDocumento: fechaDocumentoSchema.nullable().optional(),
  numeroDocumento: numeroDocumentoSchema.optional(),
  usuario: z.string().optional(),
});
type EntradaManifiesto = z.infer<typeof entradaManifiestoSchema>;

type DocumentoExistente = {
  id: string;
  nombre: string;
  tipo: string;
  carpeta: string | null;
  version: string;
  estado: string;
  fechaDocumento: string | null;
  numeroDocumento: string | null;
  archivoNombre: string | null;
  ruta: string | null;
};

function normalizarRuta(ruta: string): string {
  return ruta.replaceAll("\\", "/").replace(/^\.\//, "");
}

function sanearSegmento(valor: string): string {
  return (
    valor
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/[\u0000-\u001f]/g, "")
      .trim() || "archivo"
  );
}

function rutaUnica(base: string, usadas: Set<string>): string {
  if (!usadas.has(base.toLowerCase())) {
    usadas.add(base.toLowerCase());
    return base;
  }

  const extension = path.extname(base);
  const tallo = base.slice(0, base.length - extension.length);
  let indice = 2;
  while (usadas.has(`${tallo} (${indice})${extension}`.toLowerCase())) indice += 1;
  const ruta = `${tallo} (${indice})${extension}`;
  usadas.add(ruta.toLowerCase());
  return ruta;
}

// El ZIP exportado lleva una carpeta raíz con el código del proyecto de origen.
// Al importar en otro proyecto esa raíz no coincide, así que también se descarta
// cualquier primer nivel que no pertenezca a la plantilla del proyecto destino.
function sinRaizDePaquete(
  partes: string[],
  proyectoId: string,
  estructura: Estructura | null,
): string[] {
  const primera = partes[0]?.toLowerCase();
  if (!primera) return partes;
  if (primera === proyectoId.toLowerCase() || primera === estructura?.raiz.toLowerCase()) {
    return partes.slice(1);
  }
  const esNivelDePlantilla = estructura?.carpetas.some(
    (ruta) => ruta.split("/")[0].toLowerCase() === primera,
  );
  return partes.length > 1 && estructura && !esNivelDePlantilla ? partes.slice(1) : partes;
}

function tipoDeRuta(
  ruta: string,
  proyectoId: string,
  estructura: Estructura | null,
  respaldo: string,
): string {
  const partes = sinRaizDePaquete(ruta.split("/"), proyectoId, estructura);
  return partes.find((parte) => TIPOS.includes(parte)) ?? respaldo;
}

function carpetaDeCarga(valor: unknown, estructura: Estructura | null): string | null {
  if (valor == null || valor === "") return null;
  if (typeof valor !== "string") throw new HttpError(400, "La carpeta no es válida.");
  const ruta = valor.trim().replaceAll("\\", "/");
  if (!ruta) return null;
  const carpeta = normalizarCarpeta(ruta);
  // No convertir traversal, segmentos inválidos o rutas truncadas en carpetas válidas.
  if (!carpeta || carpeta !== ruta) throw new HttpError(400, `Carpeta no válida: ${ruta}`);
  if (!estructura) {
    throw new HttpError(400, "El proyecto no tiene una estructura documental definida.");
  }
  const actual = estructura.id === "construccion" ? carpetaConstruccionActual(carpeta) : carpeta;
  const valida = estructura.carpetas.find(
    (rutaPermitida) => rutaPermitida.toLowerCase() === actual.toLowerCase(),
  );
  if (!valida) {
    throw new HttpError(400, `La carpeta no pertenece a la estructura del proyecto: ${actual}`);
  }
  return valida;
}

function rutaSeguraZip(valor: string): string {
  const ruta = normalizarRuta(valor);
  if (/[\u0000-\u001f<>:"|?*]/.test(ruta) ||
      ruta.split("/").some((parte) => !parte || parte === "." || parte === "..")) {
    throw new HttpError(400, `Ruta no válida en el ZIP: ${valor}`);
  }
  return ruta;
}

function carpetaDeEntrada(
  ruta: string,
  proyectoId: string,
  estructura: Estructura | null,
  manifiesto?: EntradaManifiesto,
): string | null {
  const partes = sinRaizDePaquete(ruta.split("/"), proyectoId, estructura);
  partes.pop();

  // El manifiesto manda sobre la ruta física, pero su carpeta también se valida
  // contra la plantilla: nunca puede introducir una ruta fuera de la estructura.
  if (manifiesto?.carpeta !== undefined) return carpetaDeCarga(manifiesto.carpeta, estructura);
  return partes.length > 0 ? carpetaDeCarga(partes.join("/"), estructura) : null;
}

function estadoValido(valor: string | undefined): EstadoDocumento | null {
  return valor && (ESTADOS as string[]).includes(valor) ? (valor as EstadoDocumento) : null;
}

async function validarActividadEdt(
  proyectoId: string,
  actividadId: string | null | undefined,
): Promise<string | null> {
  if (!actividadId) return null;
  const { rows } = await pool.query<{ id: string }>(
    "SELECT id FROM edt_actividades WHERE id = $1 AND proyecto_id = $2",
    [actividadId, proyectoId],
  );
  if (!rows[0]) throw new HttpError(400, "La actividad EDT no pertenece al proyecto.");
  return actividadId;
}

function siguienteVersion(version: string): string {  const resultado = /^v?(\d+)\.(\d+)$/i.exec(version.trim());
  return resultado ? `v${resultado[1]}.${Number(resultado[2]) + 1}` : version;
}

function versionMayor(candidata: string, actual: string): boolean {
  const nueva = /^v?(\d+)\.(\d+)$/i.exec(candidata.trim());
  const previa = /^v?(\d+)\.(\d+)$/i.exec(actual.trim());
  if (!nueva || !previa) return candidata.trim() !== actual.trim();
  const [mayorNueva, menorNueva] = [Number(nueva[1]), Number(nueva[2])];
  const [mayorPrevia, menorPrevia] = [Number(previa[1]), Number(previa[2])];
  return mayorNueva > mayorPrevia || (mayorNueva === mayorPrevia && menorNueva > menorPrevia);
}

const almacenamiento = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CARPETA),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${extension}`);
  },
});

const subida = multer({
  storage: almacenamiento,
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!EXTENSIONES.has(extension)) {
      cb(new HttpError(400, `Formato no permitido. Usa: ${[...EXTENSIONES].join(", ")}`));
      return;
    }
    cb(null, true);
  },
});

const recibirArchivo: RequestHandler = (req, res, next) => {
  subida.single("archivo")(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return next(new HttpError(400, "El archivo supera el límite de 20 MB"));
    }
    return next(err instanceof HttpError ? err : new HttpError(400, "No se pudo procesar el archivo"));
  });
};

const subidaPaquete = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, _file, cb) => cb(null, `sei-paquete-${crypto.randomUUID()}.zip`),
  }),
  limits: { fileSize: LIMITE_PAQUETE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== ".zip") {
      cb(new HttpError(400, "El paquete debe ser un archivo .zip"));
      return;
    }
    cb(null, true);
  },
});

const recibirPaquete: RequestHandler = (req, res, next) => {
  if (req.is("application/json")) return next();
  subidaPaquete.single("archivo")(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return next(new HttpError(400, "El paquete supera el límite de 100 MB"));
    }
    return next(err instanceof HttpError ? err : new HttpError(400, "No se pudo procesar el paquete"));
  });
};

const documentoSchema = z.object({
  proyectoId: z.string().trim().min(1, "El proyecto es obligatorio"),
  tipo: z.string().trim().min(1, "El tipo es obligatorio").max(60),
  carpeta: z.string().trim().max(300).nullable().optional(),
  nombre: z.string().trim().max(200).optional(),
  version: z.string().trim().max(20).optional().default("v1.0"),
  estado: z.enum(["Aprobado", "En revisión", "Borrador", "Rechazado"]).optional().default("En revisión"),
  fechaDocumento: fechaDocumentoSchema,
  numeroDocumento: numeroDocumentoSchema.optional(),
  edtActividadId: z.string().uuid("Actividad EDT inválida").nullable().optional(),
});

const documentoActualizacionSchema = z.object({
  tipo: z.string().trim().max(60).optional(),
  carpeta: z.string().trim().max(300).nullable().optional(),
  nombre: z.string().trim().max(200).optional(),
  version: z.string().trim().max(20).optional(),
  estado: z.enum(["Aprobado", "En revisión", "Borrador", "Rechazado"]).optional(),
  fechaDocumento: fechaDocumentoActualizacionSchema.optional(),
  numeroDocumento: numeroDocumentoSchema.optional(),
  edtActividadId: z.string().uuid("Actividad EDT inválida").nullable().optional(),
});

export const documentos = Router();

documentos.get(
  "/",
  ah(async (req, res) => {
    const proyectoId = typeof req.query.proyectoId === "string" ? req.query.proyectoId : null;
    const tipo = typeof req.query.tipo === "string" ? req.query.tipo : null;
    const edtActividadId =
      typeof req.query.edtActividadId === "string" ? req.query.edtActividadId : null;

    const filtros: string[] = [];
    const valores: string[] = [];
    if (proyectoId) {
      valores.push(proyectoId);
      filtros.push(`proyecto_id = $${valores.length}`);
    }
    if (tipo) {
      valores.push(tipo);
      filtros.push(`tipo = $${valores.length}`);
    }
    if (edtActividadId) {
      valores.push(edtActividadId);
      filtros.push(`edt_actividad_id = $${valores.length}`);
    }

    const donde = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT ${CAMPOS_DOCUMENTO} FROM documentos ${donde} ORDER BY ${ORDEN_DOCUMENTOS}`,
      valores,
    );

    res.json({ documentos: rows });
  }),
);

documentos.post(
  "/",
  recibirArchivo,
  ah(async (req, res) => {
    const directo = Boolean(req.is("application/json"));
    const archivo = req.file;
    if (!directo && !archivo) throw new HttpError(400, "Adjunta un archivo");
    let clave: string | null = null;
    let confirmado = false;

    try {
      const datos = documentoSchema.parse(req.body);
      const { rows: proyectoRows } = await pool.query<{ estructura: string | null }>(
        "SELECT estructura FROM proyectos WHERE id = $1",
        [datos.proyectoId],
      );
      if (!proyectoRows[0]) throw new HttpError(404, "Proyecto no encontrado");
      const carpeta = carpetaDeCarga(datos.carpeta, estructuraPorId(proyectoRows[0].estructura));
      const edtActividadId = await validarActividadEdt(datos.proyectoId, datos.edtActividadId);

      const meta = directo
        ? archivoDirectoSchema.parse((req.body as { archivo?: unknown }).archivo)
        : null;
      const info = meta ? await verificarSubidaDirecta(meta.ruta, "documentos") : null;

      const usuario = res.locals.usuario as UsuarioSesion;
      const nombreArchivo = meta?.nombre ?? archivo!.originalname;
      const nombre = datos.nombre?.trim() || path.parse(nombreArchivo).name;
      clave = meta?.ruta ?? (await guardarArchivo(archivo!, "documentos"));
      const { rows } = await pool.query(
        `INSERT INTO documentos
           (id, nombre, tipo, carpeta, version, fecha, usuario, estado, proyecto_id,
            archivo_nombre, archivo_ruta, archivo_mime, archivo_tamano, fecha_documento,
            numero_documento, edt_actividad_id)
         VALUES ($1, $2, $3, $4, $5, (now() AT TIME ZONE 'America/Bogota')::date,
                 $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING ${CAMPOS_DOCUMENTO}`,
        [
          crypto.randomUUID(),
          nombre,
          datos.tipo,
          carpeta,
          datos.version,
          usuario.nombre,
          datos.estado,
          datos.proyectoId,
          nombreArchivo.slice(0, 255),
          clave,
          meta?.mime ?? archivo?.mimetype ?? null,
          info?.tamano ?? archivo?.size ?? 0,
          datos.fechaDocumento,
          datos.numeroDocumento ?? null,
          edtActividadId,
        ],
      );
      // La auditoría no debe provocar la eliminación de un archivo ya referenciado.
      confirmado = true;

      await registrarAuditoria({
        usuario: usuario.nombre,
        accion: "Creación",
        entidad: "Documento",
        registro: nombre,
        nuevo: `${datos.tipo}${carpeta ? ` · ${carpeta}` : ""} · ${nombreArchivo}`,
      });

      res.status(201).json({ documento: rows[0] });
    } catch (e) {
      if (!confirmado) {
        if (clave) await eliminarArchivo(clave, CARPETA);
        if (archivo) await fs.promises.unlink(archivo.path).catch(() => undefined);
      }
      throw e;
    }
  }),
);

documentos.patch(
  "/:id",
  recibirArchivo,
  ah(async (req, res) => {
    const directo = Boolean(req.is("application/json"));
    const archivo = req.file;
    let claveNueva: string | null = null;
    let claveAnterior: string | null = null;
    let confirmado = false;

    try {
      const datos = documentoActualizacionSchema.parse(req.body);
      const { rows: actualRows } = await pool.query<{
        id: string;
        proyectoId: string;
        version: string;
        nombre: string;
        ruta: string | null;
      }>(
        `SELECT id, proyecto_id AS "proyectoId", version, nombre, archivo_ruta AS ruta
           FROM documentos WHERE id = $1`,
        [req.params.id],
      );
      const actual = actualRows[0];
      if (!actual) throw new HttpError(404, "Documento no encontrado");
      claveAnterior = actual.ruta;

      const tieneCarpeta = Object.prototype.hasOwnProperty.call(req.body, "carpeta");
      let carpeta: string | null = null;
      if (tieneCarpeta) {
        const { rows: proyectoRows } = await pool.query<{ estructura: string | null }>(
          "SELECT estructura FROM proyectos WHERE id = $1",
          [actual.proyectoId],
        );
        carpeta = carpetaDeCarga(
          datos.carpeta ?? "",
          estructuraPorId(proyectoRows[0]?.estructura ?? null),
        );
      }

      const meta =
        directo && req.body?.archivo != null
          ? archivoDirectoSchema.parse((req.body as { archivo?: unknown }).archivo)
          : null;
      const info = meta ? await verificarSubidaDirecta(meta.ruta, "documentos") : null;
      const tieneEdtActividad = Object.prototype.hasOwnProperty.call(req.body, "edtActividadId");
      const edtActividadId = tieneEdtActividad
        ? await validarActividadEdt(actual.proyectoId, datos.edtActividadId)
        : null;

      let archivoNombre: string | null = null;
      let mime: string | null = null;
      let tamano: number | null = null;
      let version = datos.version?.trim() || actual.version;

      if (meta) {
        claveNueva = meta.ruta;
        archivoNombre = meta.nombre;
        mime = meta.mime ?? null;
        tamano = info!.tamano;
        if (!datos.version) version = siguienteVersion(actual.version);
      } else if (archivo) {
        claveNueva = await guardarArchivo(archivo, "documentos");
        archivoNombre = archivo.originalname;
        mime = archivo.mimetype ?? null;
        tamano = archivo.size;
        if (!datos.version) version = siguienteVersion(actual.version);
      }

      const usuario = res.locals.usuario as UsuarioSesion;
      const { rows } = await pool.query(
        `UPDATE documentos
            SET nombre = COALESCE($2, nombre),
                tipo = COALESCE($3, tipo),
                carpeta = CASE WHEN $4 THEN $5 ELSE carpeta END,
                estado = COALESCE($6, estado),
                version = $7,
                usuario = $8,
                archivo_nombre = COALESCE($9, archivo_nombre),
                archivo_ruta = COALESCE($10, archivo_ruta),
                archivo_mime = COALESCE($11, archivo_mime),
                archivo_tamano = COALESCE($12, archivo_tamano),
                fecha_documento = CASE WHEN $14 THEN $15::date ELSE fecha_documento END,
                numero_documento = CASE WHEN $16 THEN $17::text ELSE numero_documento END,
                edt_actividad_id = CASE WHEN $18 THEN $19::uuid ELSE edt_actividad_id END
          WHERE id = $1 AND proyecto_id = $13
          RETURNING ${CAMPOS_DOCUMENTO}`,
        [
          actual.id,
          datos.nombre?.trim() || null,
          datos.tipo || null,
          tieneCarpeta,
          carpeta,
          datos.estado ?? null,
          version,
          usuario.nombre,
          archivoNombre,
          claveNueva,
          mime,
          tamano,
          actual.proyectoId,
          datos.fechaDocumento !== undefined,
          datos.fechaDocumento ?? null,
          datos.numeroDocumento !== undefined,
          datos.numeroDocumento ?? null,
          tieneEdtActividad,
          edtActividadId,
        ],
      );

      const actualizado = rows[0];
      if (claveNueva && actual.ruta) await eliminarArchivo(actual.ruta, CARPETA);
      claveNueva = null;
      confirmado = true;

      await registrarAuditoria({
        usuario: usuario.nombre,
        accion: "Actualización",
        entidad: "Documento",
        registro: actualizado.nombre,
        nuevo: `${actualizado.version}${actualizado.carpeta ? ` · ${actualizado.carpeta}` : ""}${
          archivoNombre ? ` · nuevo archivo ${archivoNombre}` : " · metadatos"
        }`,
      });

      res.json({ documento: actualizado });
    } catch (e) {
      if (!confirmado && claveNueva) await eliminarArchivo(claveNueva, CARPETA);
      if (archivo) await fs.promises.unlink(archivo.path).catch(() => undefined);
      throw e;
    }
  }),
);

documentos.get(
  "/zip",
  ah(async (req, res) => {
    const proyectoId = typeof req.query.proyectoId === "string" ? req.query.proyectoId.trim() : "";
    if (!proyectoId) throw new HttpError(400, "Indica el proyecto a descargar");

    const { rows: proyectoRows } = await pool.query<{
      nombre: string;
      estructura: string | null;
    }>("SELECT nombre, estructura FROM proyectos WHERE id = $1", [proyectoId]);
    const proyecto = proyectoRows[0];
    if (!proyecto) throw new HttpError(404, "Proyecto no encontrado");
    const estructura = estructuraPorId(proyecto.estructura);

    const { rows } = await pool.query<{
      id: string;
      nombre: string;
      tipo: string;
      carpeta: string | null;
      version: string;
      fecha: string;
      fechaDocumento: string | null;
      numeroDocumento: string | null;
      usuario: string;
      estado: string;
      archivoNombre: string | null;
      ruta: string | null;
    }>(
      `SELECT id, nombre, tipo, carpeta, version, to_char(fecha, 'YYYY-MM-DD') AS fecha,
              fecha_documento AS "fechaDocumento", numero_documento AS "numeroDocumento",
              usuario, estado, archivo_nombre AS "archivoNombre", archivo_ruta AS ruta
         FROM documentos WHERE proyecto_id = $1 ORDER BY ${ORDEN_DOCUMENTOS}`,
      [proyectoId],
    );

    const zip = new JSZip();
    const raiz = zip.folder(proyectoId)!;
    if (estructura) {
      for (const carpeta of estructura.carpetas) raiz.folder(carpeta);
    }
    const manifiesto: EntradaManifiesto[] = [];
    const usadas = new Set<string>();
    let total = 0;

    for (const documento of rows) {
      if (!documento.ruta) continue;

      const contenido = await leerArchivo(documento.ruta, CARPETA);
      total += contenido.byteLength;
      if (total > LIMITE_PAQUETE) {
        throw new HttpError(413, "El paquete supera el límite de 100 MB");
      }

      const tipo = TIPOS.includes(documento.tipo) ? documento.tipo : "Otros";
      const carpeta = normalizarCarpeta(documento.carpeta) ?? tipo;
      const extension =
        path.extname(documento.ruta) || path.extname(documento.archivoNombre ?? "");
      const archivo = sanearSegmento(documento.archivoNombre || `${documento.nombre}${extension}`);
      const ruta = rutaUnica(`${carpeta}/${archivo}`, usadas);
      raiz.file(ruta, contenido);
      manifiesto.push({
        id: documento.id,
        archivo: ruta,
        tipo,
        carpeta,
        nombre: documento.nombre,
        version: documento.version,
        estado: estadoValido(documento.estado) ?? undefined,
        fecha: documento.fecha,
        fechaDocumento: documento.fechaDocumento,
        numeroDocumento: documento.numeroDocumento,
        usuario: documento.usuario,
      });
    }

    raiz.file(
      MANIFIESTO,
      JSON.stringify(
        {
          proyecto: proyectoId,
          nombre: proyecto.nombre,
          estructura: proyecto.estructura,
          generadoEn: new Date().toISOString(),
          documentos: manifiesto,
        },
        null,
        2,
      ),
    );

    const paquete = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const usuario = res.locals.usuario as UsuarioSesion;
    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Descarga",
      entidad: "Proyecto",
      registro: proyectoId,
      nuevo: `Paquete ZIP · ${manifiesto.length} documento(s)`,
    });

    const nombre = `${proyectoId}-documentos-${new Date().toISOString().slice(0, 10)}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${nombre}"`);
    res.setHeader("Content-Length", String(paquete.byteLength));
    res.send(paquete);
  }),
);

documentos.post(
  "/zip",
  recibirPaquete,
  ah(async (req, res) => {
    const usuario = res.locals.usuario as UsuarioSesion;
    const cuerpo = (req.body ?? {}) as { proyectoId?: unknown; archivo?: unknown };
    const proyectoId = z
      .string()
      .trim()
      .min(1, "El proyecto es obligatorio")
      .parse(cuerpo.proyectoId);

    const { rows: proyectoRows } = await pool.query<{ estructura: string | null }>(
      "SELECT estructura FROM proyectos WHERE id = $1",
      [proyectoId],
    );
    if (!proyectoRows[0]) throw new HttpError(404, "Proyecto no encontrado");
    const estructura = estructuraPorId(proyectoRows[0].estructura);

    let rutaTemporal: string | null = null;
    let rutaPaquete: string | null = null;
    const nuevasClaves: string[] = [];
    let confirmado = false;

    try {
      let contenidoPaquete: Buffer;
      if (req.file) {
        rutaTemporal = req.file.path;
        contenidoPaquete = await fs.promises.readFile(rutaTemporal);
      } else {
        const meta = archivoDirectoSchema.parse(cuerpo.archivo);
        if (!meta.ruta.startsWith("blob:paquetes/")) {
          throw new HttpError(400, "La ruta del paquete no es válida");
        }
        await verificarSubidaDirecta(meta.ruta, "paquetes");
        rutaPaquete = meta.ruta;
        contenidoPaquete = await leerArchivo(meta.ruta, CARPETA);
      }

      const zip = await JSZip.loadAsync(contenidoPaquete);
      const entradas = Object.values(zip.files).filter((entrada) => !entrada.dir);
      if (entradas.length > MAX_ENTRADAS) {
        throw new HttpError(413, `El ZIP supera el máximo de ${MAX_ENTRADAS} archivos`);
      }

      const archivoManifiesto = entradas.find(
        (entrada) => path.posix.basename(normalizarRuta(entrada.name)).toLowerCase() === MANIFIESTO.toLowerCase(),
      );
      let manifiesto: EntradaManifiesto[] = [];
      if (archivoManifiesto) {
        try {
          const datos = JSON.parse(await archivoManifiesto.async("string")) as {
            documentos?: unknown;
          };
          if (Array.isArray(datos.documentos)) {
            manifiesto = datos.documentos.flatMap((fila) => {
              const revisada = entradaManifiestoSchema.safeParse(fila);
              return revisada.success ? [revisada.data] : [];
            });
          }
        } catch {
          manifiesto = [];
        }
      }

      const porRuta = new Map<string, EntradaManifiesto>();
      const porArchivo = new Map<string, EntradaManifiesto>();
      for (const fila of manifiesto) {
        const ruta = normalizarRuta(fila.archivo).toLowerCase();
        porRuta.set(ruta, fila);
        porArchivo.set(path.posix.basename(ruta), fila);
      }

      const { rows: existentes } = await pool.query<DocumentoExistente>(
        `SELECT id, nombre, tipo, carpeta, version, estado,
                fecha_documento AS "fechaDocumento", numero_documento AS "numeroDocumento",
                archivo_nombre AS "archivoNombre", archivo_ruta AS ruta
           FROM documentos WHERE proyecto_id = $1`,
        [proyectoId],
      );
      const porId = new Map(existentes.map((documento) => [documento.id, documento]));
      const porNombreArchivo = new Map<string, DocumentoExistente>();
      for (const documento of existentes) {
        if (documento.archivoNombre) {
          porNombreArchivo.set(documento.archivoNombre.toLowerCase(), documento);
        }
      }

      type Preparado = {
        archivo: string;
        clave: string;
        mime: string | null;
        tamano: number;
        tipo: string;
        carpeta: string | null;
        entrada?: EntradaManifiesto;
        existente?: DocumentoExistente;
        reutilizaArchivo?: boolean;
      };

      const preparados: Preparado[] = [];
      const advertencias: Array<{ archivo: string; motivo: string }> = [];
      const idsUsados = new Set<string>();
      let sinCambios = 0;
      let total = 0;

      for (const entrada of entradas) {
        const ruta = rutaSeguraZip(entrada.name);
        if (ruta.toLowerCase() === MANIFIESTO.toLowerCase()) continue;
        if (path.posix.basename(ruta).toLowerCase() === MANIFIESTO.toLowerCase()) continue;
        if (ruta.startsWith("__MACOSX/")) continue;

        const archivo = path.posix.basename(ruta);
        if (!archivo || ruta.split("/").some((parte) => parte.startsWith("."))) continue;

        const extension = path.extname(archivo).toLowerCase();
        if (!EXTENSIONES.has(extension)) {
          advertencias.push({ archivo: ruta, motivo: "Formato no permitido" });
          continue;
        }

        const contenido = await entrada.async("nodebuffer");
        if (contenido.byteLength > LIMITE_ARCHIVO) {
          advertencias.push({ archivo: ruta, motivo: "Supera el límite de 20 MB" });
          continue;
        }
        total += contenido.byteLength;
        if (total > LIMITE_PAQUETE) {
          throw new HttpError(413, "El contenido del paquete supera el límite de 100 MB");
        }

        const fila = porRuta.get(ruta.toLowerCase()) ?? porArchivo.get(archivo.toLowerCase());
        const carpeta = carpetaDeEntrada(ruta, proyectoId, estructura, fila);
        let existente =
          (fila?.id ? porId.get(fila.id) : undefined) ??
          porNombreArchivo.get(archivo.toLowerCase());
        if (existente && idsUsados.has(existente.id)) existente = undefined;
        if (existente) idsUsados.add(existente.id);

        const tipo =
          (fila?.tipo && TIPOS.includes(fila.tipo) ? fila.tipo : null) ??
          tipoDeRuta(ruta, proyectoId, estructura, existente?.tipo ?? "Otros");

        if (existente?.ruta) {
          try {
            const anterior = await leerArchivo(existente.ruta, CARPETA);
            if (anterior.equals(contenido)) {
              // El archivo no cambió, pero el manifiesto aún puede corregir sus metadatos.
              preparados.push({
                archivo, clave: existente.ruta, mime: null, tamano: contenido.byteLength,
                tipo, carpeta, entrada: fila, existente, reutilizaArchivo: true,
              });
              sinCambios += 1;
              continue;
            }
          } catch {
            // Si el archivo anterior no se puede leer, se reemplaza.
          }
        }

        const mime = MIME_POR_EXTENSION[extension] ?? null;
        const clave = await guardarBuffer(contenido, archivo, mime, "documentos", CARPETA);
        nuevasClaves.push(clave);

        preparados.push({
          archivo,
          clave,
          mime,
          tamano: contenido.byteLength,
          tipo,
          carpeta,
          entrada: fila,
          existente,
        });
      }

      const cliente = await pool.connect();
      const clavesAnteriores: string[] = [];
      let actualizados = 0;
      let creados = 0;

      try {
        await cliente.query("BEGIN");

        for (const preparado of preparados) {
          const archivoNombre = preparado.archivo.slice(0, 255);

          if (preparado.existente) {
            const versionManifiesto = preparado.entrada?.version?.trim();
            const version = versionManifiesto && versionMayor(versionManifiesto, preparado.existente.version)
              ? versionManifiesto
              : preparado.reutilizaArchivo
                ? preparado.existente.version
                : siguienteVersion(preparado.existente.version);
            const estado = estadoValido(preparado.entrada?.estado) ?? preparado.existente.estado;

            await cliente.query(
              `UPDATE documentos
                  SET tipo = $2, carpeta = COALESCE($3, carpeta), version = $4, estado = $5,
                      fecha = CASE WHEN $12 THEN (now() AT TIME ZONE 'America/Bogota')::date ELSE fecha END,
                      usuario = $6, archivo_nombre = COALESCE($7, archivo_nombre),
                      archivo_ruta = COALESCE($8, archivo_ruta), archivo_mime = COALESCE($9, archivo_mime),
                      archivo_tamano = COALESCE($10, archivo_tamano),
                      fecha_documento = COALESCE($13::date, fecha_documento),
                      numero_documento = COALESCE($14::text, numero_documento)
                WHERE id = $1 AND proyecto_id = $11`,
              [
                preparado.existente.id,
                preparado.tipo,
                preparado.carpeta,
                version,
                estado,
                usuario.nombre,
                preparado.reutilizaArchivo ? null : archivoNombre,
                preparado.reutilizaArchivo ? null : preparado.clave,
                preparado.reutilizaArchivo ? null : preparado.mime,
                preparado.reutilizaArchivo ? null : preparado.tamano,
                proyectoId,
                !preparado.reutilizaArchivo,
                preparado.entrada?.fechaDocumento ?? null,
                preparado.entrada?.numeroDocumento ?? null,
              ],
            );

            if (!preparado.reutilizaArchivo && preparado.existente.ruta) {
              clavesAnteriores.push(preparado.existente.ruta);
            }
            actualizados += 1;
            continue;
          }

          await cliente.query(
            `INSERT INTO documentos
               (id, nombre, tipo, carpeta, version, fecha, usuario, estado, proyecto_id,
                archivo_nombre, archivo_ruta, archivo_mime, archivo_tamano,
                fecha_documento, numero_documento)
             VALUES ($1, $2, $3, $4, $5, (now() AT TIME ZONE 'America/Bogota')::date,
                $6, $7, $8, $9, $10, $11, $12, $13::date, $14::text)`,
            [
              crypto.randomUUID(),
              preparado.entrada?.nombre?.trim() || path.parse(preparado.archivo).name,
              preparado.tipo,
              preparado.carpeta,
              preparado.entrada?.version?.trim() || "v1.0",
              usuario.nombre,
              estadoValido(preparado.entrada?.estado) ?? "En revisión",
              proyectoId,
              archivoNombre,
              preparado.clave,
              preparado.mime,
              preparado.tamano,
              preparado.entrada?.fechaDocumento ?? null,
              preparado.entrada?.numeroDocumento ?? null,
            ],
          );
          creados += 1;
        }

        await cliente.query("COMMIT");
        confirmado = true;
      } catch (e) {
        await cliente.query("ROLLBACK");
        throw e;
      } finally {
        cliente.release();
      }

      for (const clave of clavesAnteriores) {
        await eliminarArchivo(clave, CARPETA);
      }

      await registrarAuditoria({
        usuario: usuario.nombre,
        accion: "Actualización",
        entidad: "Documentos",
        registro: proyectoId,
        nuevo: `Paquete ZIP · ${actualizados} reemplazado(s) · ${creados} nuevo(s)`,
      });

      res.json({
        ok: true,
        actualizados,
        creados,
        sinCambios,
        omitidos: advertencias.length,
        advertencias,
      });
    } catch (e) {
      if (!confirmado) {
        await Promise.all(nuevasClaves.map((clave) => eliminarArchivo(clave, CARPETA)));
      }
      throw e;
    } finally {
      if (rutaTemporal) await fs.promises.unlink(rutaTemporal).catch(() => undefined);
      if (rutaPaquete) await eliminarArchivo(rutaPaquete, CARPETA);
    }
  }),
);

documentos.get(
  "/:id/archivo",
  ah(async (req, res) => {
    const { rows } = await pool.query<{ ruta: string | null; nombre: string; mime: string | null }>(
      `SELECT archivo_ruta AS ruta, archivo_nombre AS nombre, archivo_mime AS mime
         FROM documentos WHERE id = $1`,
      [req.params.id],
    );
    const documento = rows[0];
    if (!documento?.ruta) throw new HttpError(404, "El documento no tiene archivo adjunto");

    await servirArchivo(res, {
      clave: documento.ruta,
      carpeta: CARPETA,
      nombre: documento.nombre,
      mime: documento.mime,
      descargar: req.query.descargar === "1",
    });
  }),
);
