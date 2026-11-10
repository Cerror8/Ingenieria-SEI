import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router, type RequestHandler } from "express";
import multer from "multer";
import { z } from "zod";
import { registrarAuditoria } from "../audit.js";
import type { UsuarioSesion } from "../auth/session.js";
import { pool } from "../db.js";
import { ah, HttpError } from "../http.js";
import {
  archivoDirectoSchema,
  eliminarArchivo,
  guardarArchivo,
  rutaLocalParaLeer,
  servirArchivo,
  verificarSubidaDirecta,
} from "../lib/almacen.js";
import { carpetaSubidas } from "../lib/carpetas.js";

const CARPETA = carpetaSubidas();

const EXTENSIONES = new Set([".xls", ".xlsx", ".pdf", ".doc", ".docx", ".csv", ".txt", ".png", ".jpg", ".jpeg"]);

const almacenamiento = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CARPETA),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${extension}`);
  },
});

const subida = multer({
  storage: almacenamiento,
  limits: { fileSize: 30 * 1024 * 1024, files: 1 },
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
      return next(new HttpError(400, "El archivo supera el límite de 30 MB"));
    }
    return next(err instanceof HttpError ? err : new HttpError(400, "No se pudo procesar el archivo"));
  });
};

const valorSchema = z.object({
  nombre: z.string().trim().max(200).optional(),
  tipo: z.string().trim().min(1, "El tipo es obligatorio").max(60),
  descripcion: z.string().trim().max(500).optional(),
});

const CAMPOS_VALOR = `
  id, nombre, tipo, descripcion, subido_por AS "subidoPor",
  archivo_nombre AS "archivoNombre", archivo_mime AS "archivoMime",
  archivo_tamano AS "archivoTamano", creado_en AS "creadoEn",
  actualizado_en AS "actualizadoEn"
`;

const actualizarValorSchema = z
  .object({
    nombre: z.string().trim().min(1, "El nombre es obligatorio").max(200).optional(),
    tipo: z.string().trim().min(1, "El tipo es obligatorio").max(60).optional(),
    descripcion: z.string().trim().max(500).nullable().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: "Envía al menos un dato para actualizar",
  });

const CAMPOS_TABLA = `
  id, hoja, fila_cabecera AS "filaCabecera", columnas,
  total_filas AS "totalFilas", truncada,
  analizada_por AS "analizadaPor", actualizado_en AS "actualizadoEn"
`;

const columnaSchema = z.object({
  letra: z.string().trim().min(1).max(3),
  etiqueta: z.string().trim().min(1, "La columna no tiene etiqueta").max(120),
});

const tablaSchema = z.object({
  hoja: z.string().trim().min(1, "Indica la hoja").max(120),
  filaCabecera: z.number().int().min(1).max(200000),
  columnas: z.array(columnaSchema).min(1, "La tabla no tiene columnas").max(60),
  filas: z
    .array(z.array(z.string().max(400)).max(60))
    .max(1500, "La tabla supera el máximo de 1500 filas"),
  truncada: z.boolean().optional(),
});

const requiereAdmin: RequestHandler = (_req, res, next) => {
  const usuario = res.locals.usuario as UsuarioSesion;
  if (usuario.rol !== "admin") {
    next(new HttpError(403, "Solo un administrador puede gestionar los valores de referencia"));
    return;
  }
  next();
};

export const valores = Router();

valores.get(
  "/",
  ah(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT ${CAMPOS_VALOR},
              (SELECT count(*)::int FROM valores_tablas t WHERE t.valor_id = valores_referencia.id) AS "totalTablas"
         FROM valores_referencia ORDER BY creado_en DESC, id`,
    );
    res.json({ valores: rows });
  }),
);

valores.post(
  "/",
  requiereAdmin,
  recibirArchivo,
  ah(async (req, res) => {
    const directo = Boolean(req.is("application/json"));
    const archivo = req.file;
    if (!directo && !archivo) throw new HttpError(400, "Adjunta un archivo");
    let clave: string | null = null;

    try {
      const datos = valorSchema.parse(req.body);
      const meta = directo
        ? archivoDirectoSchema.parse((req.body as { archivo?: unknown }).archivo)
        : null;
      const info = meta ? await verificarSubidaDirecta(meta.ruta, "valores") : null;

      const usuario = res.locals.usuario as UsuarioSesion;
      const nombreArchivo = meta?.nombre ?? archivo!.originalname;
      const nombre = datos.nombre?.trim() || path.parse(nombreArchivo).name;
      clave = meta?.ruta ?? (await guardarArchivo(archivo!, "valores"));

      const { rows } = await pool.query(
        `INSERT INTO valores_referencia
           (id, nombre, tipo, descripcion, archivo_nombre, archivo_ruta, archivo_mime, archivo_tamano, subido_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING ${CAMPOS_VALOR}, 0 AS "totalTablas"`,
        [
          crypto.randomUUID(),
          nombre,
          datos.tipo,
          datos.descripcion ?? null,
          nombreArchivo.slice(0, 255),
          clave,
          meta?.mime ?? archivo?.mimetype ?? null,
          info?.tamano ?? archivo?.size ?? 0,
          usuario.nombre,
        ],
      );

      await registrarAuditoria({
        usuario: usuario.nombre,
        accion: "Creación",
        entidad: "Valor de referencia",
        registro: nombre,
        nuevo: `${datos.tipo} · ${nombreArchivo}`,
      });

      res.status(201).json({ valor: rows[0] });
    } catch (e) {
      if (clave) await eliminarArchivo(clave, CARPETA);
      if (archivo) await fs.promises.unlink(archivo.path).catch(() => undefined);
      throw e;
    }
  }),
);

valores.patch(
  "/:id",
  requiereAdmin,
  ah(async (req, res) => {
    const datos = actualizarValorSchema.parse(req.body);
    const usuario = res.locals.usuario as UsuarioSesion;

    const { rows } = await pool.query(
      `WITH actualizado AS (
         UPDATE valores_referencia
            SET nombre = COALESCE($2, nombre),
                tipo = COALESCE($3, tipo),
                descripcion = CASE WHEN $4 THEN $5 ELSE descripcion END,
                actualizado_en = now()
          WHERE id = $1
          RETURNING *
       )
       SELECT ${CAMPOS_VALOR},
              (SELECT count(*)::int FROM valores_tablas t WHERE t.valor_id = actualizado.id) AS "totalTablas"
         FROM actualizado`,
      [
        req.params.id,
        datos.nombre ?? null,
        datos.tipo ?? null,
        datos.descripcion !== undefined,
        datos.descripcion ?? null,
      ],
    );
    const valor = rows[0];
    if (!valor) throw new HttpError(404, "Valor no encontrado");

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Actualización",
      entidad: "Valor de referencia",
      registro: valor.nombre,
    });

    res.json({ valor });
  }),
);

valores.post(
  "/:id/archivo",
  requiereAdmin,
  recibirArchivo,
  ah(async (req, res) => {
    const { rows: actuales } = await pool.query<{ nombre: string; ruta: string }>(
      "SELECT nombre, archivo_ruta AS ruta FROM valores_referencia WHERE id = $1",
      [req.params.id],
    );
    const valor = actuales[0];
    const directo = Boolean(req.is("application/json"));
    const archivo = req.file;

    if (!valor) {
      if (archivo) await fs.promises.unlink(archivo.path).catch(() => undefined);
      throw new HttpError(404, "Valor no encontrado");
    }
    if (!directo && !archivo) throw new HttpError(400, "Adjunta un archivo");

    let clave: string | null = null;
    try {
      const meta = directo
        ? archivoDirectoSchema.parse((req.body as { archivo?: unknown }).archivo)
        : null;
      const info = meta ? await verificarSubidaDirecta(meta.ruta, "valores") : null;

      const usuario = res.locals.usuario as UsuarioSesion;
      const nombreArchivo = meta?.nombre ?? archivo!.originalname;
      clave = meta?.ruta ?? (await guardarArchivo(archivo!, "valores"));

      const { rows } = await pool.query(
        `WITH actualizado AS (
           UPDATE valores_referencia
              SET archivo_nombre = $2, archivo_ruta = $3, archivo_mime = $4,
                  archivo_tamano = $5, subido_por = $6, actualizado_en = now()
            WHERE id = $1
            RETURNING *
         )
         SELECT ${CAMPOS_VALOR},
                (SELECT count(*)::int FROM valores_tablas t WHERE t.valor_id = actualizado.id) AS "totalTablas"
           FROM actualizado`,
        [
          req.params.id,
          nombreArchivo.slice(0, 255),
          clave,
          meta?.mime ?? archivo?.mimetype ?? null,
          info?.tamano ?? archivo?.size ?? 0,
          usuario.nombre,
        ],
      );

      // La versión anterior deja de existir cuando la nueva quedó registrada.
      if (clave !== valor.ruta) await eliminarArchivo(valor.ruta, CARPETA);

      await registrarAuditoria({
        usuario: usuario.nombre,
        accion: "Actualización",
        entidad: "Valor de referencia",
        registro: valor.nombre,
        nuevo: nombreArchivo,
      });

      res.json({ valor: rows[0] });
    } catch (e) {
      if (clave) await eliminarArchivo(clave, CARPETA);
      if (archivo) await fs.promises.unlink(archivo.path).catch(() => undefined);
      throw e;
    }
  }),
);

valores.delete(
  "/:id",
  requiereAdmin,
  ah(async (req, res) => {
    const usuario = res.locals.usuario as UsuarioSesion;
    const { rows } = await pool.query<{ ruta: string; nombre: string }>(
      "DELETE FROM valores_referencia WHERE id = $1 RETURNING archivo_ruta AS ruta, nombre",
      [req.params.id],
    );
    const valor = rows[0];
    if (!valor) throw new HttpError(404, "Valor no encontrado");

    await eliminarArchivo(valor.ruta, CARPETA);

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Eliminación",
      entidad: "Valor de referencia",
      registro: valor.nombre,
    });

    res.json({ ok: true });
  }),
);

valores.get(
  "/:id/tablas",
  ah(async (req, res) => {
    const existe = await pool.query("SELECT 1 FROM valores_referencia WHERE id = $1", [req.params.id]);
    if (!existe.rowCount) throw new HttpError(404, "Valor no encontrado");

    const { rows } = await pool.query(
      `SELECT ${CAMPOS_TABLA} FROM valores_tablas WHERE valor_id = $1 ORDER BY hoja`,
      [req.params.id],
    );
    res.json({ tablas: rows });
  }),
);

valores.get(
  "/:id/tablas/:tablaId/filas",
  ah(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT ${CAMPOS_TABLA}, filas FROM valores_tablas WHERE id = $1 AND valor_id = $2`,
      [req.params.tablaId, req.params.id],
    );
    const tabla = rows[0];
    if (!tabla) throw new HttpError(404, "Tabla no encontrada");
    res.json({ tabla });
  }),
);

valores.post(
  "/:id/tablas",
  requiereAdmin,
  ah(async (req, res) => {
    const datos = tablaSchema.parse(req.body);
    const usuario = res.locals.usuario as UsuarioSesion;

    const { rows: valorRows } = await pool.query<{ nombre: string }>(
      "SELECT nombre FROM valores_referencia WHERE id = $1",
      [req.params.id],
    );
    const valor = valorRows[0];
    if (!valor) throw new HttpError(404, "Valor no encontrado");

    const filas = datos.filas.map((fila) =>
      Array.from({ length: datos.columnas.length }, (_, indice) => fila[indice] ?? ""),
    );
    const totalFilas = filas.length;

    const { rows } = await pool.query(
      `INSERT INTO valores_tablas
         (id, valor_id, hoja, fila_cabecera, columnas, filas, total_filas, truncada, analizada_por)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9)
       ON CONFLICT (valor_id, hoja) DO UPDATE SET
         fila_cabecera = EXCLUDED.fila_cabecera,
         columnas = EXCLUDED.columnas,
         filas = EXCLUDED.filas,
         total_filas = EXCLUDED.total_filas,
         truncada = EXCLUDED.truncada,
         analizada_por = EXCLUDED.analizada_por,
         actualizado_en = now()
       RETURNING ${CAMPOS_TABLA}`,
      [
        crypto.randomUUID(),
        req.params.id,
        datos.hoja,
        datos.filaCabecera,
        JSON.stringify(datos.columnas),
        JSON.stringify(filas),
        totalFilas,
        datos.truncada ?? false,
        usuario.nombre,
      ],
    );

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Análisis",
      entidad: "Valor de referencia",
      registro: valor.nombre,
      nuevo: `Hoja “${datos.hoja}” · ${totalFilas} fila(s) · ${datos.columnas.length} columna(s)`,
    });

    res.status(201).json({ tabla: rows[0] });
  }),
);

valores.delete(
  "/:id/tablas/:tablaId",
  requiereAdmin,
  ah(async (req, res) => {
    const usuario = res.locals.usuario as UsuarioSesion;
    const { rows } = await pool.query<{ hoja: string; nombre: string }>(
      `DELETE FROM valores_tablas t
        USING valores_referencia v
        WHERE t.id = $1 AND t.valor_id = $2 AND v.id = t.valor_id
        RETURNING t.hoja, v.nombre`,
      [req.params.tablaId, req.params.id],
    );
    const tabla = rows[0];
    if (!tabla) throw new HttpError(404, "Tabla no encontrada");

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Eliminación",
      entidad: "Tabla de valor",
      registro: tabla.nombre,
      previo: `Hoja “${tabla.hoja}”`,
    });

    res.json({ ok: true });
  }),
);

valores.get(
  "/:id/estilos",
  ah(async (req, res) => {
    const hoja = typeof req.query.hoja === "string" ? req.query.hoja : null;
    if (!hoja) throw new HttpError(400, "Indica la hoja a consultar");

    const { rows } = await pool.query<{ ruta: string; nombre: string }>(
      "SELECT archivo_ruta AS ruta, archivo_nombre AS nombre FROM valores_referencia WHERE id = $1",
      [req.params.id],
    );
    const valor = rows[0];
    if (!valor) throw new HttpError(404, "Valor no encontrado");

    if (!/\.xlsx$/i.test(valor.nombre) && !/\.xlsx$/i.test(valor.ruta)) {
      res.json({ estilos: {} });
      return;
    }

    const ruta = await rutaLocalParaLeer(valor.ruta, CARPETA);

    try {
      const { estilosDeHoja } = await import("../lib/estilosExcel.js");
      res.json({ estilos: await estilosDeHoja(ruta, hoja, 300) });
    } catch {
      res.json({ estilos: {} });
    }
  }),
);

valores.get(
  "/:id/archivo",
  ah(async (req, res) => {
    const { rows } = await pool.query<{ ruta: string; nombre: string; mime: string | null }>(
      `SELECT archivo_ruta AS ruta, archivo_nombre AS nombre, archivo_mime AS mime
         FROM valores_referencia WHERE id = $1`,
      [req.params.id],
    );
    const valor = rows[0];
    if (!valor) throw new HttpError(404, "Valor no encontrado");

    await servirArchivo(res, {
      clave: valor.ruta,
      carpeta: CARPETA,
      nombre: valor.nombre,
      mime: valor.mime,
      descargar: req.query.descargar === "1",
    });
  }),
);
