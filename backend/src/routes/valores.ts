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
  eliminarArchivo,
  guardarArchivo,
  rutaLocalParaLeer,
  servirArchivo,
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
  archivo_tamano AS "archivoTamano", creado_en AS "creadoEn"
`;

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
      `SELECT ${CAMPOS_VALOR} FROM valores_referencia ORDER BY creado_en DESC, id`,
    );
    res.json({ valores: rows });
  }),
);

valores.post(
  "/",
  requiereAdmin,
  recibirArchivo,
  ah(async (req, res) => {
    const archivo = req.file;
    if (!archivo) throw new HttpError(400, "Adjunta un archivo");
    let clave: string | null = null;

    try {
      const datos = valorSchema.parse(req.body);
      const usuario = res.locals.usuario as UsuarioSesion;
      const nombre = datos.nombre?.trim() || path.parse(archivo.originalname).name;
      clave = await guardarArchivo(archivo, "valores");

      const { rows } = await pool.query(
        `INSERT INTO valores_referencia
           (id, nombre, tipo, descripcion, archivo_nombre, archivo_ruta, archivo_mime, archivo_tamano, subido_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING ${CAMPOS_VALOR}`,
        [
          crypto.randomUUID(),
          nombre,
          datos.tipo,
          datos.descripcion ?? null,
          archivo.originalname.slice(0, 255),
          clave,
          archivo.mimetype,
          archivo.size,
          usuario.nombre,
        ],
      );

      await registrarAuditoria({
        usuario: usuario.nombre,
        accion: "Creación",
        entidad: "Valor de referencia",
        registro: nombre,
        nuevo: `${datos.tipo} · ${archivo.originalname}`,
      });

      res.status(201).json({ valor: rows[0] });
    } catch (e) {
      if (clave) await eliminarArchivo(clave, CARPETA);
      await fs.promises.unlink(archivo.path).catch(() => undefined);
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
