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
import { CAMPOS_DOCUMENTO } from "./proyectos.js";

const CARPETA = carpetaSubidas();

const EXTENSIONES = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".png", ".jpg", ".jpeg", ".txt",
]);

const TIPOS = ["Ficha técnica", "Actas", "Informes", "Antecedentes", "Evidencias", "Otros"];
const ESTADOS = ["Aprobado", "En revisión", "Borrador", "Rechazado"];
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

type EntradaManifiesto = {
  id?: string;
  archivo: string;
  tipo?: string;
  nombre?: string;
  version?: string;
  estado?: string;
  fecha?: string;
  usuario?: string;
};

type DocumentoExistente = {
  id: string;
  nombre: string;
  tipo: string;
  version: string;
  estado: string;
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

function tipoDeRuta(ruta: string, proyectoId: string, respaldo: string): string {
  const partes = ruta.split("/");
  const sinRaiz =
    partes[0]?.toLowerCase() === proyectoId.toLowerCase() ? partes.slice(1) : partes;
  return sinRaiz.find((parte) => TIPOS.includes(parte)) ?? respaldo;
}

function estadoValido(valor: string | undefined): string | null {
  return valor && ESTADOS.includes(valor) ? valor : null;
}

function siguienteVersion(version: string): string {
  const resultado = /^v?(\d+)\.(\d+)$/i.exec(version.trim());
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
  nombre: z.string().trim().max(200).optional(),
  version: z.string().trim().max(20).optional().default("v1.0"),
  estado: z.enum(["Aprobado", "En revisión", "Borrador", "Rechazado"]).optional().default("En revisión"),
});

export const documentos = Router();

documentos.get(
  "/",
  ah(async (req, res) => {
    const proyectoId = typeof req.query.proyectoId === "string" ? req.query.proyectoId : null;
    const tipo = typeof req.query.tipo === "string" ? req.query.tipo : null;

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

    const donde = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT ${CAMPOS_DOCUMENTO} FROM documentos ${donde} ORDER BY fecha DESC, id`,
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

    try {
      const datos = documentoSchema.parse(req.body);
      const existe = await pool.query("SELECT 1 FROM proyectos WHERE id = $1", [datos.proyectoId]);
      if (!existe.rowCount) throw new HttpError(404, "Proyecto no encontrado");

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
           (id, nombre, tipo, version, fecha, usuario, estado, proyecto_id,
            archivo_nombre, archivo_ruta, archivo_mime, archivo_tamano)
         VALUES ($1, $2, $3, $4, (now() AT TIME ZONE 'America/Bogota')::date, $5, $6, $7, $8, $9, $10, $11)
         RETURNING ${CAMPOS_DOCUMENTO}`,
        [
          crypto.randomUUID(),
          nombre,
          datos.tipo,
          datos.version,
          usuario.nombre,
          datos.estado,
          datos.proyectoId,
          nombreArchivo.slice(0, 255),
          clave,
          meta?.mime ?? archivo?.mimetype ?? null,
          info?.tamano ?? archivo?.size ?? 0,
        ],
      );

      await registrarAuditoria({
        usuario: usuario.nombre,
        accion: "Creación",
        entidad: "Documento",
        registro: nombre,
        nuevo: `${datos.tipo} · ${nombreArchivo}`,
      });

      res.status(201).json({ documento: rows[0] });
    } catch (e) {
      if (clave) await eliminarArchivo(clave, CARPETA);
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

    const { rows: proyectoRows } = await pool.query<{ nombre: string }>(
      "SELECT nombre FROM proyectos WHERE id = $1",
      [proyectoId],
    );
    const proyecto = proyectoRows[0];
    if (!proyecto) throw new HttpError(404, "Proyecto no encontrado");

    const { rows } = await pool.query<{
      id: string;
      nombre: string;
      tipo: string;
      version: string;
      fecha: string;
      usuario: string;
      estado: string;
      archivoNombre: string | null;
      ruta: string | null;
    }>(
      `SELECT id, nombre, tipo, version, to_char(fecha, 'YYYY-MM-DD') AS fecha, usuario, estado,
              archivo_nombre AS "archivoNombre", archivo_ruta AS ruta
         FROM documentos WHERE proyecto_id = $1 ORDER BY tipo, nombre, id`,
      [proyectoId],
    );

    const zip = new JSZip();
    const raiz = zip.folder(proyectoId)!;
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
      const extension =
        path.extname(documento.ruta) || path.extname(documento.archivoNombre ?? "");
      const archivo = sanearSegmento(documento.archivoNombre || `${documento.nombre}${extension}`);
      const ruta = rutaUnica(`${tipo}/${archivo}`, usadas);
      raiz.file(ruta, contenido);
      manifiesto.push({
        id: documento.id,
        archivo: ruta,
        tipo,
        nombre: documento.nombre,
        version: documento.version,
        estado: documento.estado,
        fecha: documento.fecha,
        usuario: documento.usuario,
      });
    }

    raiz.file(
      MANIFIESTO,
      JSON.stringify(
        {
          proyecto: proyectoId,
          nombre: proyecto.nombre,
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

    const existe = await pool.query("SELECT 1 FROM proyectos WHERE id = $1", [proyectoId]);
    if (!existe.rowCount) throw new HttpError(404, "Proyecto no encontrado");

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
            manifiesto = datos.documentos.filter(
              (fila): fila is EntradaManifiesto =>
                Boolean(fila) && typeof (fila as EntradaManifiesto).archivo === "string",
            );
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
        `SELECT id, nombre, tipo, version, estado,
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
        entrada?: EntradaManifiesto;
        existente?: DocumentoExistente;
      };

      const preparados: Preparado[] = [];
      const advertencias: Array<{ archivo: string; motivo: string }> = [];
      const idsUsados = new Set<string>();
      let sinCambios = 0;
      let total = 0;

      for (const entrada of entradas) {
        const ruta = normalizarRuta(entrada.name);
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
        let existente =
          (fila?.id ? porId.get(fila.id) : undefined) ??
          porNombreArchivo.get(archivo.toLowerCase());
        if (existente && idsUsados.has(existente.id)) existente = undefined;
        if (existente) idsUsados.add(existente.id);

        if (existente?.ruta) {
          try {
            const anterior = await leerArchivo(existente.ruta, CARPETA);
            if (anterior.equals(contenido)) {
              sinCambios += 1;
              continue;
            }
          } catch {
            // Si el archivo anterior no se puede leer, se reemplaza.
          }
        }

        const tipo =
          (fila?.tipo && TIPOS.includes(fila.tipo) ? fila.tipo : null) ??
          tipoDeRuta(ruta, proyectoId, existente?.tipo ?? "Otros");

        const mime = MIME_POR_EXTENSION[extension] ?? null;
        const clave = await guardarBuffer(contenido, archivo, mime, "documentos", CARPETA);
        nuevasClaves.push(clave);

        preparados.push({
          archivo,
          clave,
          mime,
          tamano: contenido.byteLength,
          tipo,
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
            const version =
              versionManifiesto && versionMayor(versionManifiesto, preparado.existente.version)
                ? versionManifiesto
                : siguienteVersion(preparado.existente.version);
            const estado = estadoValido(preparado.entrada?.estado) ?? preparado.existente.estado;

            await cliente.query(
              `UPDATE documentos
                  SET tipo = $2, version = $3, estado = $4,
                      fecha = (now() AT TIME ZONE 'America/Bogota')::date,
                      usuario = $5, archivo_nombre = $6, archivo_ruta = $7,
                      archivo_mime = $8, archivo_tamano = $9
                WHERE id = $1 AND proyecto_id = $10`,
              [
                preparado.existente.id,
                preparado.tipo,
                version,
                estado,
                usuario.nombre,
                archivoNombre,
                preparado.clave,
                preparado.mime,
                preparado.tamano,
                proyectoId,
              ],
            );

            if (preparado.existente.ruta) clavesAnteriores.push(preparado.existente.ruta);
            actualizados += 1;
            continue;
          }

          await cliente.query(
            `INSERT INTO documentos
               (id, nombre, tipo, version, fecha, usuario, estado, proyecto_id,
                archivo_nombre, archivo_ruta, archivo_mime, archivo_tamano)
             VALUES ($1, $2, $3, $4, (now() AT TIME ZONE 'America/Bogota')::date,
                $5, $6, $7, $8, $9, $10, $11)`,
            [
              crypto.randomUUID(),
              preparado.entrada?.nombre?.trim() || path.parse(preparado.archivo).name,
              preparado.tipo,
              preparado.entrada?.version?.trim() || "v1.0",
              usuario.nombre,
              estadoValido(preparado.entrada?.estado) ?? "En revisión",
              proyectoId,
              archivoNombre,
              preparado.clave,
              preparado.mime,
              preparado.tamano,
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
