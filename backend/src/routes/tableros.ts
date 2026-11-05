import { Router } from "express";
import { z } from "zod";
import { registrarAuditoria } from "../audit.js";
import { pool } from "../db.js";
import { ah, HttpError } from "../http.js";
import type { UsuarioSesion } from "../auth/session.js";

const COLUMNAS = ["por-hacer", "en-curso", "en-revision", "completado"] as const;
const PRIORIDADES = ["Alta", "Media", "Baja"] as const;

const fechaSchema = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const tareaSchema = z.object({
  titulo: z.string().trim().min(1, "El título es obligatorio").max(200),
  descripcion: z.string().trim().max(1000).optional().default(""),
  columna: z.enum(COLUMNAS).optional().default("por-hacer"),
  responsable: z.string().trim().max(120).optional().default("Sin asignar"),
  prioridad: z.enum(PRIORIDADES).optional().default("Media"),
  fechaLimite: fechaSchema,
  etiqueta: z.string().trim().max(60).optional().default("General"),
});

const actualizacionSchema = tareaSchema.partial();

const tableroSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  descripcion: z.string().trim().max(500).optional().default(""),
});

const CAMPOS_TAREA = `
  id, tablero_id AS "tableroId", titulo, descripcion, columna, responsable,
  prioridad, fecha_limite AS "fechaLimite", etiqueta, orden,
  creado_en AS "creadoEn", actualizado_en AS "actualizadoEn"
`;

type Tarea = {
  id: string;
  tableroId: string;
  titulo: string;
  descripcion: string;
  columna: string;
  responsable: string;
  prioridad: string;
  fechaLimite: string | null;
  etiqueta: string;
  orden: number;
};

export const tableros = Router();

tableros.get(
  "/",
  ah(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT t.id, t.nombre, t.descripcion,
              COUNT(ta.id)::int AS "totalTareas"
         FROM tableros t
         LEFT JOIN tareas_tablero ta ON ta.tablero_id = t.id
        GROUP BY t.id
        ORDER BY t.creado_en`,
    );
    res.json({ tableros: rows });
  }),
);

tableros.post(
  "/",
  ah(async (req, res) => {
    const datos = tableroSchema.parse(req.body);
    const usuario = res.locals.usuario as UsuarioSesion;

    const { rows } = await pool.query(
      `INSERT INTO tableros (nombre, descripcion, creado_por)
       VALUES ($1, $2, $3)
       RETURNING id, nombre, descripcion`,
      [datos.nombre, datos.descripcion, usuario.id],
    );

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Creación",
      entidad: "Tablero",
      registro: datos.nombre,
      nuevo: datos.nombre,
    });

    res.status(201).json({ tablero: { ...rows[0], totalTareas: 0 } });
  }),
);

tableros.get(
  "/:id",
  ah(async (req, res) => {
    const tableroId = z.string().uuid().parse(req.params.id);

    const { rows: tablerosRows } = await pool.query<{ id: string; nombre: string; descripcion: string }>(
      "SELECT id, nombre, descripcion FROM tableros WHERE id = $1",
      [tableroId],
    );
    if (!tablerosRows[0]) throw new HttpError(404, "Tablero no encontrado");

    const { rows: tareas } = await pool.query<Tarea>(
      `SELECT ${CAMPOS_TAREA}
         FROM tareas_tablero
        WHERE tablero_id = $1
        ORDER BY array_position(ARRAY['por-hacer','en-curso','en-revision','completado']::text[], columna),
                 orden, creado_en`,
      [tableroId],
    );

    res.json({ tablero: tablerosRows[0], tareas });
  }),
);

tableros.post(
  "/:id/tareas",
  ah(async (req, res) => {
    const tableroId = z.string().uuid().parse(req.params.id);
    const datos = tareaSchema.parse(req.body);

    const { rows: existe } = await pool.query("SELECT 1 FROM tableros WHERE id = $1", [tableroId]);
    if (!existe[0]) throw new HttpError(404, "Tablero no encontrado");

    const { rows } = await pool.query<Tarea>(
      `INSERT INTO tareas_tablero
         (tablero_id, titulo, descripcion, columna, responsable, prioridad, fecha_limite, etiqueta, orden)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
               COALESCE((SELECT MAX(orden) + 1 FROM tareas_tablero WHERE tablero_id = $1 AND columna = $4), 1))
       RETURNING ${CAMPOS_TAREA}`,
      [
        tableroId,
        datos.titulo,
        datos.descripcion,
        datos.columna,
        datos.responsable || "Sin asignar",
        datos.prioridad,
        datos.fechaLimite,
        datos.etiqueta || "General",
      ],
    );

    const usuario = res.locals.usuario as UsuarioSesion;
    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Creación",
      entidad: "Tarea de tablero",
      registro: datos.titulo,
      nuevo: datos.columna,
    });

    res.status(201).json({ tarea: rows[0] });
  }),
);

tableros.patch(
  "/:id/tareas/:tareaId",
  ah(async (req, res) => {
    const tableroId = z.string().uuid().parse(req.params.id);
    const tareaId = z.string().uuid().parse(req.params.tareaId);
    const datos = actualizacionSchema.parse(req.body);

    const { rows: actuales } = await pool.query<Tarea>(
      `SELECT ${CAMPOS_TAREA} FROM tareas_tablero WHERE id = $1 AND tablero_id = $2`,
      [tareaId, tableroId],
    );
    const actual = actuales[0];
    if (!actual) throw new HttpError(404, "Tarea no encontrada");

    const columna = datos.columna ?? actual.columna;
    const cambiaColumna = columna !== actual.columna;

    const { rows } = await pool.query<Tarea>(
      `UPDATE tareas_tablero
          SET titulo = COALESCE($3, titulo),
              descripcion = COALESCE($4, descripcion),
              columna = $5,
              responsable = COALESCE($6, responsable),
              prioridad = COALESCE($7, prioridad),
              fecha_limite = CASE WHEN $8 THEN $9 ELSE fecha_limite END,
              etiqueta = COALESCE($10, etiqueta),
              orden = CASE WHEN $11 THEN
                        COALESCE((SELECT MAX(orden) + 1 FROM tareas_tablero WHERE tablero_id = $2 AND columna = $5), 1)
                      ELSE orden END
        WHERE id = $1 AND tablero_id = $2
        RETURNING ${CAMPOS_TAREA}`,
      [
        tareaId,
        tableroId,
        datos.titulo ?? null,
        datos.descripcion ?? null,
        columna,
        datos.responsable ?? null,
        datos.prioridad ?? null,
        datos.fechaLimite !== undefined,
        datos.fechaLimite ?? null,
        datos.etiqueta ?? null,
        cambiaColumna,
      ],
    );

    if (cambiaColumna) {
      const usuario = res.locals.usuario as UsuarioSesion;
      await registrarAuditoria({
        usuario: usuario.nombre,
        accion: "Actualización",
        entidad: "Tarea de tablero",
        registro: actual.titulo,
        previo: `Columna: ${actual.columna}`,
        nuevo: `Columna: ${columna}`,
      });
    }

    res.json({ tarea: rows[0] });
  }),
);

tableros.delete(
  "/:id/tareas/:tareaId",
  ah(async (req, res) => {
    const tableroId = z.string().uuid().parse(req.params.id);
    const tareaId = z.string().uuid().parse(req.params.tareaId);

    const { rows } = await pool.query<{ titulo: string }>(
      "DELETE FROM tareas_tablero WHERE id = $1 AND tablero_id = $2 RETURNING titulo",
      [tareaId, tableroId],
    );
    if (!rows[0]) throw new HttpError(404, "Tarea no encontrada");

    const usuario = res.locals.usuario as UsuarioSesion;
    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Eliminación",
      entidad: "Tarea de tablero",
      registro: rows[0].titulo,
    });

    res.json({ ok: true });
  }),
);
