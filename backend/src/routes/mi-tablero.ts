import { Router } from "express";
import { z } from "zod";
import { registrarAuditoria } from "../audit.js";
import type { UsuarioSesion } from "../auth/session.js";
import { pool } from "../db.js";
import { ah, HttpError } from "../http.js";
import { CAMPOS_TAREA, JOINS_TAREA, type Tarea } from "./tableros.js";

const PRIORIDADES = ["Alta", "Media", "Baja"] as const;
const COLUMNAS = ["por-hacer", "en-curso", "completado"] as const;

const fechaCreacion = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()])
  .optional()
  .transform((valor) => (valor ? valor : null));

const fechaActualizacion = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()])
  .optional();

const tareaSchema = z.object({
  titulo: z.string().trim().min(1, "El título es obligatorio").max(200),
  descripcion: z.string().trim().max(1000).optional().default(""),
  prioridad: z.enum(PRIORIDADES).optional().default("Media"),
  fechaLimite: fechaCreacion,
  etiqueta: z.string().trim().max(60).optional().default("Personal"),
  columna: z.enum(COLUMNAS).optional().default("por-hacer"),
});

const actualizacionSchema = z
  .object({
    titulo: z.string().trim().min(1, "El título es obligatorio").max(200).optional(),
    descripcion: z.string().trim().max(1000).optional(),
    prioridad: z.enum(PRIORIDADES).optional(),
    fechaLimite: fechaActualizacion,
    etiqueta: z.string().trim().max(60).optional(),
    columna: z.enum(COLUMNAS).optional(),
  })
  .strict();

const CAMPOS_PERSONAL = `
  id, titulo, descripcion, columna, prioridad,
  fecha_limite AS "fechaLimite", etiqueta, orden,
  completado_en AS "completadoEn",
  creado_en AS "creadoEn", actualizado_en AS "actualizadoEn"
`;

export const miTablero = Router();

miTablero.get(
  "/",
  ah(async (_req, res) => {
    const usuario = res.locals.usuario as UsuarioSesion;

    const [proyecto, personales] = await Promise.all([
      pool.query<Tarea>(
        `SELECT ${CAMPOS_TAREA}
           FROM tareas_tablero t
           ${JOINS_TAREA}
          WHERE t.responsable_id = $1
          ORDER BY array_position(ARRAY['por-hacer','en-curso','en-revision','completado']::text[], t.columna),
                   t.fecha_limite NULLS LAST, t.creado_en`,
        [usuario.id],
      ),
      pool.query(
        `SELECT ${CAMPOS_PERSONAL}
           FROM tareas_personales
          WHERE usuario_id = $1
          ORDER BY array_position(ARRAY['por-hacer','en-curso','completado']::text[], columna),
                   fecha_limite NULLS LAST, orden, creado_en`,
        [usuario.id],
      ),
    ]);

    res.json({ tareasProyecto: proyecto.rows, tareasPersonales: personales.rows });
  }),
);

miTablero.post(
  "/personales",
  ah(async (req, res) => {
    const usuario = res.locals.usuario as UsuarioSesion;
    const datos = tareaSchema.parse(req.body);
    const completadaEn = datos.columna === "completado" ? new Date() : null;

    const { rows } = await pool.query(
      `INSERT INTO tareas_personales
         (usuario_id, titulo, descripcion, columna, prioridad, fecha_limite, etiqueta, orden, completado_en)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               COALESCE((SELECT MAX(orden) + 1 FROM tareas_personales WHERE usuario_id = $1 AND columna = $4), 1),
               $8)
       RETURNING ${CAMPOS_PERSONAL}`,
      [
        usuario.id,
        datos.titulo,
        datos.descripcion,
        datos.columna,
        datos.prioridad,
        datos.fechaLimite,
        datos.etiqueta || "Personal",
        completadaEn,
      ],
    );

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Creación",
      entidad: "Tarea personal",
      registro: datos.titulo,
      nuevo: datos.etiqueta || "Personal",
    });

    res.status(201).json({ tarea: rows[0] });
  }),
);

miTablero.patch(
  "/personales/:id",
  ah(async (req, res) => {
    const usuario = res.locals.usuario as UsuarioSesion;
    const id = z.string().uuid().parse(req.params.id);
    const datos = actualizacionSchema.parse(req.body);

    const { rows: actuales } = await pool.query<{ titulo: string; columna: string }>(
      `SELECT titulo, columna
         FROM tareas_personales
        WHERE id = $1 AND usuario_id = $2`,
      [id, usuario.id],
    );
    const actual = actuales[0];
    if (!actual) throw new HttpError(404, "Tarea personal no encontrada");

    const cambiaFecha = datos.fechaLimite !== undefined;

    const { rows } = await pool.query(
      `UPDATE tareas_personales
          SET titulo = COALESCE($3, titulo),
              descripcion = COALESCE($4, descripcion),
              prioridad = COALESCE($5, prioridad),
              etiqueta = COALESCE($6, etiqueta),
              fecha_limite = CASE WHEN $7 THEN $8::date ELSE fecha_limite END,
              columna = COALESCE($9, columna),
              completado_en = CASE
                WHEN $9 = 'completado' THEN COALESCE(completado_en, now())
                WHEN $9 IS NOT NULL THEN NULL
                ELSE completado_en
              END
        WHERE id = $1 AND usuario_id = $2
        RETURNING ${CAMPOS_PERSONAL}`,
      [
        id,
        usuario.id,
        datos.titulo ?? null,
        datos.descripcion ?? null,
        datos.prioridad ?? null,
        datos.etiqueta ?? null,
        cambiaFecha,
        datos.fechaLimite || null,
        datos.columna ?? null,
      ],
    );

    if (datos.columna && datos.columna !== actual.columna) {
      await registrarAuditoria({
        usuario: usuario.nombre,
        accion: "Actualización",
        entidad: "Tarea personal",
        registro: rows[0].titulo,
        previo: actual.columna,
        nuevo: datos.columna,
      });
    } else {
      await registrarAuditoria({
        usuario: usuario.nombre,
        accion: "Actualización",
        entidad: "Tarea personal",
        registro: rows[0].titulo,
      });
    }

    res.json({ tarea: rows[0] });
  }),
);

miTablero.delete(
  "/personales/:id",
  ah(async (req, res) => {
    const usuario = res.locals.usuario as UsuarioSesion;
    const id = z.string().uuid().parse(req.params.id);

    const { rows } = await pool.query<{ titulo: string }>(
      `DELETE FROM tareas_personales
        WHERE id = $1 AND usuario_id = $2
        RETURNING titulo`,
      [id, usuario.id],
    );
    if (!rows[0]) throw new HttpError(404, "Tarea personal no encontrada");

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Eliminación",
      entidad: "Tarea personal",
      registro: rows[0].titulo,
    });

    res.json({ ok: true });
  }),
);
