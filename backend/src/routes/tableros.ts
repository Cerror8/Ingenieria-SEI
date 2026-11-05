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
  responsableId: z.string().uuid("Responsable inválido").nullable().optional(),
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
  t.id, t.tablero_id AS "tableroId", t.titulo, t.descripcion, t.columna,
  t.responsable, t.responsable_id AS "responsableId",
  u.foto_url AS "responsableFoto",
  t.prioridad, t.fecha_limite AS "fechaLimite", t.etiqueta, t.orden,
  t.completado_en AS "completadoEn",
  (SELECT COUNT(*)::int FROM comentarios_tarea c WHERE c.tarea_id = t.id) AS "comentarios",
  (SELECT COUNT(*)::int FROM adjuntos_tarea a WHERE a.tarea_id = t.id) AS "adjuntos",
  t.creado_en AS "creadoEn", t.actualizado_en AS "actualizadoEn"
`;

type Tarea = {
  id: string;
  tableroId: string;
  titulo: string;
  descripcion: string;
  columna: string;
  responsable: string;
  responsableId: string | null;
  responsableFoto: string | null;
  prioridad: string;
  fechaLimite: string | null;
  etiqueta: string;
  orden: number;
  completadoEn: string | null;
  comentarios: number;
  adjuntos: number;
};

async function resolverResponsable(
  responsableId: string | null | undefined,
  texto: string | null,
): Promise<{ id: string | null; nombre: string | null }> {
  if (responsableId === undefined) return { id: null, nombre: texto };
  if (responsableId === null) return { id: null, nombre: "Sin asignar" };

  const { rows } = await pool.query<{ nombre: string }>(
    "SELECT nombre FROM usuarios WHERE id = $1 AND activo = true",
    [responsableId],
  );
  if (!rows[0]) {
    throw new HttpError(400, "El responsable seleccionado no existe o está inactivo.");
  }
  return { id: responsableId, nombre: rows[0].nombre };
}

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
         FROM tareas_tablero t
         LEFT JOIN usuarios u ON u.id = t.responsable_id
        WHERE t.tablero_id = $1
        ORDER BY array_position(ARRAY['por-hacer','en-curso','en-revision','completado']::text[], t.columna),
                 t.orden, t.creado_en`,
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

    const asignado = await resolverResponsable(
      datos.responsableId,
      datos.responsable?.trim() || "Sin asignar",
    );

    const { rows } = await pool.query<Tarea>(
      `WITH nueva AS (
         INSERT INTO tareas_tablero
           (tablero_id, titulo, descripcion, columna, responsable, responsable_id,
            prioridad, fecha_limite, etiqueta, orden, completado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
                 COALESCE((SELECT MAX(orden) + 1 FROM tareas_tablero WHERE tablero_id = $1 AND columna = $4), 1),
                 CASE WHEN $4 = 'completado' THEN now() END)
         RETURNING *
       )
       SELECT ${CAMPOS_TAREA}
         FROM nueva t
         LEFT JOIN usuarios u ON u.id = t.responsable_id`,
      [
        tableroId,
        datos.titulo,
        datos.descripcion,
        datos.columna,
        asignado.nombre ?? "Sin asignar",
        asignado.id,
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
      `SELECT ${CAMPOS_TAREA}
         FROM tareas_tablero t
         LEFT JOIN usuarios u ON u.id = t.responsable_id
        WHERE t.id = $1 AND t.tablero_id = $2`,
      [tareaId, tableroId],
    );
    const actual = actuales[0];
    if (!actual) throw new HttpError(404, "Tarea no encontrada");

    const columna = datos.columna ?? actual.columna;
    const cambiaColumna = columna !== actual.columna;
    const cambiaResponsable = datos.responsableId !== undefined;
    const asignado = cambiaResponsable
      ? await resolverResponsable(datos.responsableId, datos.responsable ?? null)
      : { id: actual.responsableId, nombre: null };

    const { rows } = await pool.query<Tarea>(
      `WITH actualizada AS (
         UPDATE tareas_tablero
            SET titulo = COALESCE($3, titulo),
                descripcion = COALESCE($4, descripcion),
                columna = $5,
                responsable = CASE WHEN $12 THEN $13 ELSE COALESCE($6, responsable) END,
                responsable_id = CASE WHEN $12 THEN $14 ELSE responsable_id END,
                prioridad = COALESCE($7, prioridad),
                fecha_limite = CASE WHEN $8 THEN $9 ELSE fecha_limite END,
                etiqueta = COALESCE($10, etiqueta),
                completado_en = CASE
                    WHEN $5 = 'completado' AND columna <> 'completado' THEN now()
                    WHEN $5 <> 'completado' THEN NULL
                    ELSE completado_en END,
                orden = CASE WHEN $11 THEN
                          COALESCE((SELECT MAX(orden) + 1 FROM tareas_tablero WHERE tablero_id = $2 AND columna = $5), 1)
                        ELSE orden END
          WHERE id = $1 AND tablero_id = $2
          RETURNING *
       )
       SELECT ${CAMPOS_TAREA}
         FROM actualizada t
         LEFT JOIN usuarios u ON u.id = t.responsable_id`,
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
        cambiaResponsable,
        asignado.nombre,
        asignado.id,
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

    if (cambiaResponsable) {
      const usuario = res.locals.usuario as UsuarioSesion;
      await registrarAuditoria({
        usuario: usuario.nombre,
        accion: "Actualización",
        entidad: "Tarea de tablero",
        registro: actual.titulo,
        previo: `Responsable: ${actual.responsable}`,
        nuevo: `Responsable: ${asignado.nombre ?? "Sin asignar"}`,
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
    const usuario = res.locals.usuario as UsuarioSesion;

    if (usuario.rol !== "admin" && usuario.rol !== "docente") {
      throw new HttpError(403, "Solo administradores y docentes pueden eliminar tareas.");
    }

    const { rows } = await pool.query<{ titulo: string }>(
      "DELETE FROM tareas_tablero WHERE id = $1 AND tablero_id = $2 RETURNING titulo",
      [tareaId, tableroId],
    );
    if (!rows[0]) throw new HttpError(404, "Tarea no encontrada");

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Eliminación",
      entidad: "Tarea de tablero",
      registro: rows[0].titulo,
    });

    res.json({ ok: true });
  }),
);
