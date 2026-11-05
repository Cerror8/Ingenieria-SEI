import { Router } from "express";
import { z } from "zod";
import { registrarAuditoria } from "../audit.js";
import type { UsuarioSesion } from "../auth/session.js";
import { pool } from "../db.js";
import { ah, HttpError } from "../http.js";

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

const eventoBase = z.object({
  titulo: z.string().trim().min(1, "El título es obligatorio").max(160),
  descripcion: z.string().trim().max(1000).optional(),
  fechaInicio: z.string().datetime({ offset: true, message: "Fecha de inicio inválida" }),
  fechaFin: z.string().datetime({ offset: true, message: "Fecha de fin inválida" }),
  todoElDia: z.boolean().optional(),
});

const eventoSchema = eventoBase
  .extend({
    descripcion: z.string().trim().max(1000).default(""),
    todoElDia: z.boolean().default(false),
  })
  .refine((v) => new Date(v.fechaFin) >= new Date(v.fechaInicio), {
    message: "La fecha de fin debe ser posterior al inicio",
    path: ["fechaFin"],
  });

const CAMPOS_EVENTO = `
  id, titulo, descripcion,
  fecha_inicio AS "fechaInicio", fecha_fin AS "fechaFin",
  todo_el_dia AS "todoElDia", usuario_id AS "usuarioId", creado_en AS "creadoEn"
`;

export const calendario = Router();

calendario.get(
  "/",
  ah(async (req, res) => {
    const usuario = res.locals.usuario as UsuarioSesion;
    const { desde, hasta } = z.object({ desde: fechaSchema, hasta: fechaSchema }).parse(req.query);
    if (desde > hasta) throw new HttpError(400, "El rango de fechas es inválido");

    const [tareas, eventos] = await Promise.all([
      pool.query(
        `SELECT ta.id,
                ta.titulo,
                ta.descripcion,
                ta.prioridad,
                ta.columna,
                ta.fecha_limite AS "fechaLimite",
                tb.id AS "tableroId",
                tb.nombre AS tablero
           FROM tareas_tablero ta
           JOIN tableros tb ON tb.id = ta.tablero_id
          WHERE ta.fecha_limite BETWEEN $1::date AND $2::date
          ORDER BY ta.fecha_limite, ta.titulo`,
        [desde, hasta],
      ),
      pool.query(
        `SELECT ${CAMPOS_EVENTO}
           FROM eventos_calendario
          WHERE usuario_id = $1
            AND fecha_fin >= ($2::date - interval '1 day')
            AND fecha_inicio < ($3::date + interval '2 days')
          ORDER BY fecha_inicio`,
        [usuario.id, desde, hasta],
      ),
    ]);

    res.json({ tareas: tareas.rows, eventos: eventos.rows });
  }),
);

calendario.post(
  "/eventos",
  ah(async (req, res) => {
    const usuario = res.locals.usuario as UsuarioSesion;
    const datos = eventoSchema.parse(req.body);

    const { rows } = await pool.query(
      `INSERT INTO eventos_calendario
         (titulo, descripcion, fecha_inicio, fecha_fin, todo_el_dia, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${CAMPOS_EVENTO}`,
      [datos.titulo, datos.descripcion, datos.fechaInicio, datos.fechaFin, datos.todoElDia, usuario.id],
    );

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Creación",
      entidad: "Evento de calendario",
      registro: datos.titulo,
      nuevo: datos.titulo,
    });

    res.status(201).json({ evento: rows[0] });
  }),
);

calendario.patch(
  "/eventos/:id",
  ah(async (req, res) => {
    const usuario = res.locals.usuario as UsuarioSesion;
    const id = z.string().uuid().parse(req.params.id);
    const datos = eventoBase.partial().parse(req.body);

    const { rows: actuales } = await pool.query(
      `SELECT ${CAMPOS_EVENTO}
         FROM eventos_calendario
        WHERE id = $1 AND usuario_id = $2`,
      [id, usuario.id],
    );
    const actual = actuales[0];
    if (!actual) throw new HttpError(404, "Evento no encontrado");

    const inicio = datos.fechaInicio ?? actual.fechaInicio;
    const fin = datos.fechaFin ?? actual.fechaFin;
    if (new Date(fin) < new Date(inicio)) {
      throw new HttpError(400, "La fecha de fin debe ser posterior al inicio");
    }

    const { rows } = await pool.query(
      `UPDATE eventos_calendario
          SET titulo = COALESCE($3, titulo),
              descripcion = COALESCE($4, descripcion),
              fecha_inicio = COALESCE($5, fecha_inicio),
              fecha_fin = COALESCE($6, fecha_fin),
              todo_el_dia = COALESCE($7, todo_el_dia)
        WHERE id = $1 AND usuario_id = $2
        RETURNING ${CAMPOS_EVENTO}`,
      [
        id,
        usuario.id,
        datos.titulo ?? null,
        datos.descripcion ?? null,
        datos.fechaInicio ?? null,
        datos.fechaFin ?? null,
        datos.todoElDia ?? null,
      ],
    );

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Actualización",
      entidad: "Evento de calendario",
      registro: rows[0].titulo,
    });

    res.json({ evento: rows[0] });
  }),
);

calendario.delete(
  "/eventos/:id",
  ah(async (req, res) => {
    const usuario = res.locals.usuario as UsuarioSesion;
    const id = z.string().uuid().parse(req.params.id);

    const { rows } = await pool.query<{ titulo: string }>(
      `DELETE FROM eventos_calendario
        WHERE id = $1 AND usuario_id = $2
        RETURNING titulo`,
      [id, usuario.id],
    );
    if (!rows[0]) throw new HttpError(404, "Evento no encontrado");

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Eliminación",
      entidad: "Evento de calendario",
      registro: rows[0].titulo,
    });

    res.json({ ok: true });
  }),
);
