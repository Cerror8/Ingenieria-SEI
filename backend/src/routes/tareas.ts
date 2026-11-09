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
  servirArchivo,
  verificarSubidaDirecta,
} from "../lib/almacen.js";
import { carpetaSubidas } from "../lib/carpetas.js";

const CARPETA = carpetaSubidas("tareas");

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

const comentarioSchema = z.object({
  contenido: z.string().trim().min(1, "Escribe un comentario").max(2000),
});

type TareaRef = { id: string; titulo: string };

async function tareaDeRuta(tableroId: string, tareaId: string): Promise<TareaRef> {
  const { rows } = await pool.query<TareaRef>(
    "SELECT id, titulo FROM tareas_tablero WHERE id = $1 AND tablero_id = $2",
    [tareaId, tableroId],
  );
  if (!rows[0]) throw new HttpError(404, "Tarea no encontrada");
  return rows[0];
}

function idsDeRuta(params: Record<string, string | undefined>) {
  return {
    tableroId: z.string().uuid().parse(params.id),
    tareaId: z.string().uuid().parse(params.tareaId),
  };
}

export const tareas = Router();

tareas.get(
  "/:id/tareas/:tareaId/comentarios",
  ah(async (req, res) => {
    const { tableroId, tareaId } = idsDeRuta(req.params);
    await tareaDeRuta(tableroId, tareaId);

    const { rows } = await pool.query(
      `SELECT c.id, c.contenido, c.autor, c.usuario_id AS "usuarioId",
              u.foto_url AS "autorFoto", c.creado_en AS "creadoEn"
         FROM comentarios_tarea c
         LEFT JOIN usuarios u ON u.id = c.usuario_id
        WHERE c.tarea_id = $1
        ORDER BY c.creado_en`,
      [tareaId],
    );
    res.json({ comentarios: rows });
  }),
);

tareas.post(
  "/:id/tareas/:tareaId/comentarios",
  ah(async (req, res) => {
    const { tableroId, tareaId } = idsDeRuta(req.params);
    const usuario = res.locals.usuario as UsuarioSesion;
    const datos = comentarioSchema.parse(req.body);
    await tareaDeRuta(tableroId, tareaId);

    const { rows } = await pool.query(
      `WITH nuevo AS (
         INSERT INTO comentarios_tarea (tarea_id, usuario_id, autor, contenido)
         VALUES ($1, $2, $3, $4)
         RETURNING *
       )
       SELECT n.id, n.contenido, n.autor, n.usuario_id AS "usuarioId",
              u.foto_url AS "autorFoto", n.creado_en AS "creadoEn"
         FROM nuevo n
         LEFT JOIN usuarios u ON u.id = n.usuario_id`,
      [tareaId, usuario.id, usuario.nombre, datos.contenido],
    );

    res.status(201).json({ comentario: rows[0] });
  }),
);

tareas.delete(
  "/:id/tareas/:tareaId/comentarios/:comentarioId",
  ah(async (req, res) => {
    const { tableroId, tareaId } = idsDeRuta(req.params);
    const comentarioId = z.string().uuid().parse(req.params.comentarioId);
    const usuario = res.locals.usuario as UsuarioSesion;
    await tareaDeRuta(tableroId, tareaId);

    const { rows } = await pool.query<{ usuarioId: string | null }>(
      `SELECT usuario_id AS "usuarioId" FROM comentarios_tarea
        WHERE id = $1 AND tarea_id = $2`,
      [comentarioId, tareaId],
    );
    if (!rows[0]) throw new HttpError(404, "Comentario no encontrado");
    if (rows[0].usuarioId !== usuario.id && usuario.rol !== "admin") {
      throw new HttpError(403, "Solo el autor o un administrador pueden eliminar el comentario.");
    }

    await pool.query("DELETE FROM comentarios_tarea WHERE id = $1", [comentarioId]);
    res.json({ ok: true });
  }),
);

tareas.get(
  "/:id/tareas/:tareaId/adjuntos",
  ah(async (req, res) => {
    const { tableroId, tareaId } = idsDeRuta(req.params);
    await tareaDeRuta(tableroId, tareaId);

    const { rows } = await pool.query(
      `SELECT a.id, a.nombre, a.mime, a.tamano, a.usuario_id AS "usuarioId",
              COALESCE(u.nombre, 'Usuario eliminado') AS "subidoPor",
              u.foto_url AS "autorFoto", a.creado_en AS "creadoEn"
         FROM adjuntos_tarea a
         LEFT JOIN usuarios u ON u.id = a.usuario_id
        WHERE a.tarea_id = $1
        ORDER BY a.creado_en DESC`,
      [tareaId],
    );
    res.json({ adjuntos: rows });
  }),
);

tareas.post(
  "/:id/tareas/:tareaId/adjuntos",
  recibirArchivo,
  ah(async (req, res) => {
    const directo = Boolean(req.is("application/json"));
    const archivo = req.file;
    if (!directo && !archivo) throw new HttpError(400, "Adjunta un archivo");
    let clave: string | null = null;

    try {
      const { tableroId, tareaId } = idsDeRuta(req.params);
      const tarea = await tareaDeRuta(tableroId, tareaId);
      const usuario = res.locals.usuario as UsuarioSesion;

      const meta = directo
        ? archivoDirectoSchema.parse((req.body as { archivo?: unknown }).archivo)
        : null;
      const info = meta ? await verificarSubidaDirecta(meta.ruta, "tareas") : null;
      const nombreArchivo = meta?.nombre ?? archivo!.originalname;
      clave = meta?.ruta ?? (await guardarArchivo(archivo!, "tareas"));

      const { rows } = await pool.query(
        `INSERT INTO adjuntos_tarea (tarea_id, usuario_id, nombre, ruta, mime, tamano)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, nombre, mime, tamano, creado_en AS "creadoEn"`,
        [
          tareaId,
          usuario.id,
          nombreArchivo.slice(0, 255),
          clave,
          meta?.mime ?? archivo?.mimetype ?? null,
          info?.tamano ?? archivo?.size ?? 0,
        ],
      );

      await registrarAuditoria({
        usuario: usuario.nombre,
        accion: "Creación",
        entidad: "Adjunto de tarea",
        registro: tarea.titulo,
        nuevo: nombreArchivo,
      });

      res.status(201).json({
        adjunto: {
          ...rows[0],
          usuarioId: usuario.id,
          subidoPor: usuario.nombre,
          autorFoto: usuario.fotoUrl,
        },
      });
    } catch (e) {
      if (clave) await eliminarArchivo(clave, CARPETA);
      if (archivo) await fs.promises.unlink(archivo.path).catch(() => undefined);
      throw e;
    }
  }),
);

tareas.get(
  "/:id/tareas/:tareaId/adjuntos/:adjuntoId/archivo",
  ah(async (req, res) => {
    const { tableroId, tareaId } = idsDeRuta(req.params);
    const adjuntoId = z.string().uuid().parse(req.params.adjuntoId);
    await tareaDeRuta(tableroId, tareaId);

    const { rows } = await pool.query<{ ruta: string; nombre: string; mime: string | null }>(
      `SELECT ruta, nombre, mime FROM adjuntos_tarea WHERE id = $1 AND tarea_id = $2`,
      [adjuntoId, tareaId],
    );
    const adjunto = rows[0];
    if (!adjunto) throw new HttpError(404, "Adjunto no encontrado");

    await servirArchivo(res, {
      clave: adjunto.ruta,
      carpeta: CARPETA,
      nombre: adjunto.nombre,
      mime: adjunto.mime,
      descargar: req.query.descargar === "1",
    });
  }),
);

tareas.delete(
  "/:id/tareas/:tareaId/adjuntos/:adjuntoId",
  ah(async (req, res) => {
    const { tableroId, tareaId } = idsDeRuta(req.params);
    const adjuntoId = z.string().uuid().parse(req.params.adjuntoId);
    const usuario = res.locals.usuario as UsuarioSesion;
    const tarea = await tareaDeRuta(tableroId, tareaId);

    const { rows } = await pool.query<{ usuarioId: string | null; ruta: string; nombre: string }>(
      `SELECT usuario_id AS "usuarioId", ruta, nombre FROM adjuntos_tarea
        WHERE id = $1 AND tarea_id = $2`,
      [adjuntoId, tareaId],
    );
    const adjunto = rows[0];
    if (!adjunto) throw new HttpError(404, "Adjunto no encontrado");
    if (adjunto.usuarioId !== usuario.id && usuario.rol !== "admin") {
      throw new HttpError(403, "Solo quien subió el archivo o un administrador pueden eliminarlo.");
    }

    await pool.query("DELETE FROM adjuntos_tarea WHERE id = $1", [adjuntoId]);
    await eliminarArchivo(adjunto.ruta, CARPETA);

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Eliminación",
      entidad: "Adjunto de tarea",
      registro: tarea.titulo,
      previo: adjunto.nombre,
    });

    res.json({ ok: true });
  }),
);
