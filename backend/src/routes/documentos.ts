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
import { eliminarArchivo, guardarArchivo, servirArchivo, archivoDirectoSchema, verificarSubidaDirecta } from "../lib/almacen.js";
import { carpetaSubidas } from "../lib/carpetas.js";
import { CAMPOS_DOCUMENTO } from "./proyectos.js";

const CARPETA = carpetaSubidas();

const EXTENSIONES = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".png", ".jpg", ".jpeg", ".txt",
]);

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
         VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7, $8, $9, $10, $11)
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
