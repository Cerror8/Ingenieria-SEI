import { Router } from "express";
import { z } from "zod";
import { registrarAuditoria } from "../audit.js";
import { pool, withTx } from "../db.js";
import { ah, HttpError } from "../http.js";
import { avisarAsignacion, avisarFlujo } from "../lib/correo.js";
import { bloqueoParaCompletar, sincronizarEdtDesdeTareas } from "../lib/avance.js";
import type { UsuarioSesion } from "../auth/session.js";

const PRIORIDADES = ["Alta", "Media", "Baja"] as const;

const fechaSchema = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const tareaSchema = z.object({
  titulo: z.string().trim().min(1, "El título es obligatorio").max(200),
  descripcion: z.string().trim().max(1000).optional().default(""),
  proyectoId: z.string().trim().min(1, "Selecciona un proyecto").max(40),
  responsableId: z.string().uuid("Responsable inválido").nullable().optional(),
  edtActividadId: z.string().uuid("Actividad EDT inválida").nullable().optional(),
  prioridad: z.enum(PRIORIDADES).optional().default("Media"),
  fechaLimite: fechaSchema,
  etiqueta: z.string().trim().max(60).optional().default("General"),
});

const actualizacionSchema = z
  .object({
    titulo: z.string().trim().min(1, "El título es obligatorio").max(200).optional(),
    descripcion: z.string().trim().max(1000).optional(),
    responsableId: z.string().uuid("Responsable inválido").nullable().optional(),
    edtActividadId: z.string().uuid("Actividad EDT inválida").nullable().optional(),
    prioridad: z.enum(PRIORIDADES).optional(),
    fechaLimite: fechaSchema,
    etiqueta: z.string().trim().max(60).optional(),
  })
  .strict();

const devolucionSchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(5, "Explica qué debe corregirse (mínimo 5 caracteres)")
    .max(1000),
});

const tableroSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  descripcion: z.string().trim().max(500).optional().default(""),
});

export const JOINS_TAREA = `
  LEFT JOIN usuarios u ON u.id = t.responsable_id
  LEFT JOIN usuarios c ON c.id = t.creado_por
  LEFT JOIN proyectos p ON p.id = t.proyecto_id
  LEFT JOIN usuarios pl ON pl.id = p.lider_id
  LEFT JOIN tableros b ON b.id = t.tablero_id
  LEFT JOIN usuarios bc ON bc.id = b.creado_por
  LEFT JOIN edt_actividades e ON e.id = t.edt_actividad_id
  LEFT JOIN edt_fases ef ON ef.id = e.fase_id
`;

export const CAMPOS_TAREA = `
  t.id, t.tablero_id AS "tableroId",
  b.nombre AS "tableroNombre",
  b.proyecto_id AS "tableroProyectoId", b.fase_id AS "tableroFaseId",
  b.tipo AS "tableroTipo", ef.nombre AS "faseNombre", ef.orden AS "faseOrden",
  t.proyecto_id AS "proyectoId", p.nombre AS "proyectoNombre",
  p.lider_id AS "proyectoLiderId", pl.nombre AS "proyectoLiderNombre",
  b.creado_por AS "tableroCreadoPor",
  bc.nombre AS "tableroCreadoPorNombre",
  t.titulo, t.descripcion, t.columna,
  t.responsable, t.responsable_id AS "responsableId",
  u.foto_url AS "responsableFoto",
  t.edt_actividad_id AS "edtActividadId",
  e.actividad AS "edtActividadNombre", e.etapa AS "edtEtapa", e.estado AS "edtEstado",
  e.tipo AS "edtTipo", e.requiere_documento AS "edtRequiereDocumento",
  t.creado_por AS "creadoPor", c.nombre AS "creadoPorNombre",
  t.prioridad, t.fecha_limite AS "fechaLimite", t.etiqueta, t.orden,
  t.completado_en AS "completadoEn",
  t.ultima_devolucion_en AS "ultimaDevolucionEn",
  (SELECT COUNT(*)::int FROM comentarios_tarea co WHERE co.tarea_id = t.id) AS "comentarios",
  (SELECT COUNT(*)::int FROM adjuntos_tarea a WHERE a.tarea_id = t.id) AS "adjuntos",
  t.creado_en AS "creadoEn", t.actualizado_en AS "actualizadoEn"
`;

export type Tarea = {
  id: string;
  tableroId: string;
  tableroNombre: string | null;
  tableroProyectoId: string | null;
  tableroFaseId: string | null;
  tableroTipo: string | null;
  faseNombre: string | null;
  faseOrden: number | null;
  proyectoId: string | null;
  proyectoNombre: string | null;
  proyectoLiderId: string | null;
  proyectoLiderNombre: string | null;
  tableroCreadoPor: string | null;
  tableroCreadoPorNombre: string | null;
  titulo: string;
  descripcion: string;
  columna: string;
  responsable: string;
  responsableId: string | null;
  responsableFoto: string | null;
  edtActividadId: string | null;
  edtActividadNombre: string | null;
  edtEtapa: number | null;
  edtEstado: string | null;
  edtTipo: string | null;
  edtRequiereDocumento: boolean | null;
  creadoPor: string | null;
  creadoPorNombre: string | null;
  prioridad: string;
  fechaLimite: string | null;
  etiqueta: string;
  orden: number;
  completadoEn: string | null;
  ultimaDevolucionEn: string | null;
  comentarios: number;
  adjuntos: number;
};

async function cargarTarea(tableroId: string, tareaId: string): Promise<Tarea> {
  const { rows } = await pool.query<Tarea>(
    `SELECT ${CAMPOS_TAREA}
       FROM tareas_tablero t
       ${JOINS_TAREA}
      WHERE t.id = $1 AND t.tablero_id = $2`,
    [tareaId, tableroId],
  );
  if (!rows[0]) throw new HttpError(404, "Tarea no encontrada");
  return rows[0];
}

function esGestor(usuario: UsuarioSesion, tarea: Tarea) {
  return (
    usuario.rol === "admin" ||
    tarea.creadoPor === usuario.id ||
    tarea.proyectoLiderId === usuario.id ||
    tarea.tableroCreadoPor === usuario.id
  );
}

function exigirAsignado(usuario: UsuarioSesion, tarea: Tarea) {
  if (!tarea.responsableId) {
    throw new HttpError(400, "La tarea no tiene una persona asignada.");
  }
  if (tarea.responsableId !== usuario.id) {
    throw new HttpError(403, "Solo la persona asignada puede realizar esta acción.");
  }
}

function exigirGestor(usuario: UsuarioSesion, tarea: Tarea) {
  if (!esGestor(usuario, tarea)) {
    throw new HttpError(403, "Solo quien creó la tarea o lidera el proyecto puede hacerlo.");
  }
}

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

async function resolverEdtActividad(
  edtActividadId: string | null | undefined,
  proyectoId: string | null,
): Promise<string | null> {
  if (!edtActividadId) return null;
  if (!proyectoId) {
    throw new HttpError(400, "Selecciona un proyecto antes de vincular una actividad EDT.");
  }
  const { rows } = await pool.query<{ id: string }>(
    "SELECT id FROM edt_actividades WHERE id = $1 AND proyecto_id = $2",
    [edtActividadId, proyectoId],
  );
  if (!rows[0]) {
    throw new HttpError(400, "La actividad EDT seleccionada no pertenece al proyecto de la tarea.");
  }
  return rows[0].id;
}

async function responderTarea(tableroId: string, tareaId: string) {
  return cargarTarea(tableroId, tareaId);
}

const CAMPOS_TABLERO = `
  t.id, t.nombre, t.descripcion,
  t.proyecto_id AS "proyectoId", p.nombre AS "proyectoNombre",
  t.fase_id AS "faseId", f.nombre AS "faseNombre", f.orden AS "faseOrden",
  t.tipo,
  COUNT(ta.id)::int AS "totalTareas"
`;

const JOINS_TABLERO = `
  LEFT JOIN proyectos p ON p.id = t.proyecto_id
  LEFT JOIN edt_fases f ON f.id = t.fase_id
  LEFT JOIN tareas_tablero ta ON ta.tablero_id = t.id
`;

async function listarTableros() {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS_TABLERO}
       FROM tableros t
       ${JOINS_TABLERO}
      GROUP BY t.id, p.nombre, f.nombre, f.orden
      ORDER BY p.nombre NULLS FIRST, f.orden NULLS FIRST, t.creado_en`,
  );
  return rows;
}

async function actualizarResponsableEdt(
  actividadId: string | null,
  responsableId: string | null,
  responsable: string | null,
) {
  if (!actividadId) return;
  await pool.query(
    `UPDATE edt_actividades
        SET responsable = COALESCE($2, responsable),
            responsable_id = $3
      WHERE id = $1`,
    [actividadId, responsable, responsableId],
  );
}

export const tableros = Router();

tableros.get(
  "/",
  ah(async (_req, res) => {
    res.json({ tableros: await listarTableros() });
  }),
);

tableros.get(
  "/general",
  ah(async (req, res) => {
    const proyectoId = typeof req.query.proyectoId === "string" ? req.query.proyectoId : null;
    const faseId = typeof req.query.faseId === "string" ? req.query.faseId : null;

    const filtros: string[] = [];
    const valores: string[] = [];
    if (proyectoId) {
      valores.push(proyectoId);
      filtros.push(`t.proyecto_id = $${valores.length}`);
    }
    if (faseId) {
      valores.push(faseId);
      filtros.push(`b.fase_id = $${valores.length}`);
    }
    const donde = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const { rows: tareas } = await pool.query<Tarea>(
      `SELECT ${CAMPOS_TAREA}
         FROM tareas_tablero t
         ${JOINS_TAREA}
         ${donde}
        ORDER BY p.nombre NULLS LAST, ef.orden NULLS LAST,
                 array_position(ARRAY['por-hacer','en-curso','en-revision','completado']::text[], t.columna),
                 t.orden, t.creado_en`,
      valores,
    );

    const { rows: proyectos } = await pool.query<{ id: string; nombre: string }>(
      `SELECT DISTINCT p.id, p.nombre
         FROM tareas_tablero t
         JOIN proyectos p ON p.id = t.proyecto_id
        ORDER BY p.nombre`,
    );

    res.json({ tareas, tableros: await listarTableros(), proyectos });
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

    const { rows: tablerosRows } = await pool.query<{
      id: string;
      nombre: string;
      descripcion: string;
      proyectoId: string | null;
      proyectoNombre: string | null;
      faseId: string | null;
      faseNombre: string | null;
      faseOrden: number | null;
      tipo: string;
      creadoPor: string | null;
      creadoPorNombre: string | null;
    }>(
      `SELECT t.id, t.nombre, t.descripcion,
              t.proyecto_id AS "proyectoId", p.nombre AS "proyectoNombre",
              t.fase_id AS "faseId", f.nombre AS "faseNombre", f.orden AS "faseOrden",
              t.tipo,
              t.creado_por AS "creadoPor", u.nombre AS "creadoPorNombre"
         FROM tableros t
         LEFT JOIN proyectos p ON p.id = t.proyecto_id
         LEFT JOIN edt_fases f ON f.id = t.fase_id
         LEFT JOIN usuarios u ON u.id = t.creado_por
        WHERE t.id = $1`,
      [tableroId],
    );
    if (!tablerosRows[0]) throw new HttpError(404, "Tablero no encontrado");

    const { rows: tareas } = await pool.query<Tarea>(
      `SELECT ${CAMPOS_TAREA}
         FROM tareas_tablero t
         ${JOINS_TAREA}
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
    const usuario = res.locals.usuario as UsuarioSesion;

    const { rows: existe } = await pool.query<{ proyectoId: string | null }>(
      `SELECT proyecto_id AS "proyectoId" FROM tableros WHERE id = $1`,
      [tableroId],
    );
    if (!existe[0]) throw new HttpError(404, "Tablero no encontrado");
    if (existe[0].proyectoId && existe[0].proyectoId !== datos.proyectoId) {
      throw new HttpError(400, "Este tablero pertenece a otro proyecto.");
    }

    const { rows: proyecto } = await pool.query<{ id: string; nombre: string }>(
      "SELECT id, nombre FROM proyectos WHERE id = $1",
      [datos.proyectoId],
    );
    if (!proyecto[0]) throw new HttpError(400, "El proyecto seleccionado no existe.");

    const asignado = await resolverResponsable(
      datos.responsableId,
      "Sin asignar",
    );
    const edtActividadId = await resolverEdtActividad(datos.edtActividadId, proyecto[0].id);

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO tareas_tablero
         (tablero_id, proyecto_id, titulo, descripcion, columna, responsable, responsable_id,
          edt_actividad_id, creado_por, prioridad, fecha_limite, etiqueta, orden)
       VALUES ($1, $2, $3, $4, 'por-hacer', $5, $6, $7, $8, $9, $10, $11,
               COALESCE((SELECT MAX(orden) + 1 FROM tareas_tablero WHERE tablero_id = $1 AND columna = 'por-hacer'), 1))
       RETURNING id`,
      [
        tableroId,
        proyecto[0].id,
        datos.titulo,
        datos.descripcion,
        asignado.nombre ?? "Sin asignar",
        asignado.id,
        edtActividadId,
        usuario.id,
        datos.prioridad,
        datos.fechaLimite,
        datos.etiqueta || "General",
      ],
    );

    await sincronizarEdtDesdeTareas(pool, edtActividadId);
    if (edtActividadId && asignado.id) {
      await actualizarResponsableEdt(edtActividadId, asignado.id, asignado.nombre);
    }

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Creación",
      entidad: "Tarea de tablero",
      registro: datos.titulo,
      nuevo: `Proyecto: ${proyecto[0].id} · Por hacer`,
    });

    const tarea = await responderTarea(tableroId, rows[0].id);

    if (asignado.id && asignado.id !== usuario.id) {
      avisarAsignacion({
        usuarioId: asignado.id,
        actor: usuario.nombre,
        titulo: tarea.titulo,
        tablero: tarea.tableroNombre ?? "Tablero",
        proyecto: tarea.proyectoNombre,
        prioridad: tarea.prioridad,
        fechaLimite: tarea.fechaLimite,
      });
    }

    res.status(201).json({ tarea });
  }),
);

tableros.patch(
  "/:id/tareas/:tareaId",
  ah(async (req, res) => {
    const tableroId = z.string().uuid().parse(req.params.id);
    const tareaId = z.string().uuid().parse(req.params.tareaId);
    const datos = actualizacionSchema.parse(req.body);
    const usuario = res.locals.usuario as UsuarioSesion;

    const actual = await cargarTarea(tableroId, tareaId);
    const cambiaResponsable =
      datos.responsableId !== undefined && datos.responsableId !== actual.responsableId;

    if (cambiaResponsable) exigirGestor(usuario, actual);

    const asignado = cambiaResponsable
      ? await resolverResponsable(datos.responsableId, null)
      : { id: actual.responsableId, nombre: null };

    const vuelveAPorHacer =
      cambiaResponsable &&
      !asignado.id &&
      actual.columna !== "por-hacer" &&
      actual.columna !== "completado";

    const cambiaEdt = datos.edtActividadId !== undefined;
    const edtActividadId = cambiaEdt
      ? await resolverEdtActividad(datos.edtActividadId, actual.proyectoId)
      : actual.edtActividadId;

    await pool.query(
      `UPDATE tareas_tablero
          SET titulo = COALESCE($3, titulo),
              descripcion = COALESCE($4, descripcion),
              responsable = CASE WHEN $5 THEN $6 ELSE responsable END,
              responsable_id = CASE WHEN $5 THEN $7 ELSE responsable_id END,
              prioridad = COALESCE($8, prioridad),
              fecha_limite = CASE WHEN $9 THEN $10 ELSE fecha_limite END,
              etiqueta = COALESCE($11, etiqueta),
              columna = CASE WHEN $12 THEN 'por-hacer' ELSE columna END,
              edt_actividad_id = CASE WHEN $13 THEN $14 ELSE edt_actividad_id END,
              ultima_devolucion_en = CASE WHEN $5 THEN now() ELSE ultima_devolucion_en END
        WHERE id = $1 AND tablero_id = $2`,
      [
        tareaId,
        tableroId,
        datos.titulo ?? null,
        datos.descripcion ?? null,
        cambiaResponsable,
        asignado.nombre,
        asignado.id,
        datos.prioridad ?? null,
        datos.fechaLimite !== undefined,
        datos.fechaLimite ?? null,
        datos.etiqueta ?? null,
        vuelveAPorHacer,
        cambiaEdt,
        edtActividadId,
      ],
    );

    if (cambiaEdt) {
      await sincronizarEdtDesdeTareas(pool, actual.edtActividadId);
      await sincronizarEdtDesdeTareas(pool, edtActividadId);
    }
    if (cambiaResponsable && edtActividadId) {
      await actualizarResponsableEdt(edtActividadId, asignado.id, asignado.nombre);
    }

    if (cambiaResponsable) {
      await registrarAuditoria({
        usuario: usuario.nombre,
        accion: "Asignación",
        entidad: "Tarea de tablero",
        registro: actual.titulo,
        previo: `Responsable: ${actual.responsable}`,
        nuevo: `Responsable: ${asignado.nombre ?? "Sin asignar"}`,
      });
    }

    const tarea = await responderTarea(tableroId, tareaId);

    if (cambiaResponsable && asignado.id && asignado.id !== usuario.id) {
      avisarAsignacion({
        usuarioId: asignado.id,
        actor: usuario.nombre,
        titulo: tarea.titulo,
        tablero: tarea.tableroNombre ?? "Tablero",
        proyecto: tarea.proyectoNombre,
        prioridad: tarea.prioridad,
        fechaLimite: tarea.fechaLimite,
      });
    }

    res.json({ tarea });
  }),
);

tableros.post(
  "/:id/tareas/:tareaId/entendido",
  ah(async (req, res) => {
    const tableroId = z.string().uuid().parse(req.params.id);
    const tareaId = z.string().uuid().parse(req.params.tareaId);
    const usuario = res.locals.usuario as UsuarioSesion;
    const actual = await cargarTarea(tableroId, tareaId);

    if (actual.columna !== "por-hacer") {
      throw new HttpError(400, "La tarea ya fue iniciada.");
    }
    exigirAsignado(usuario, actual);

    await pool.query(
      "UPDATE tareas_tablero SET columna = 'en-curso' WHERE id = $1 AND tablero_id = $2",
      [tareaId, tableroId],
    );
    await sincronizarEdtDesdeTareas(pool, actual.edtActividadId);

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Inicio de tarea",
      entidad: "Tarea de tablero",
      registro: actual.titulo,
      previo: "Por hacer",
      nuevo: "En curso",
    });

    avisarFlujo({ tipo: "inicio", tarea: actual, actor: usuario });

    res.json({ tarea: await responderTarea(tableroId, tareaId) });
  }),
);

tableros.post(
  "/:id/tareas/:tareaId/enviar-revision",
  ah(async (req, res) => {
    const tableroId = z.string().uuid().parse(req.params.id);
    const tareaId = z.string().uuid().parse(req.params.tareaId);
    const usuario = res.locals.usuario as UsuarioSesion;
    const actual = await cargarTarea(tableroId, tareaId);

    if (actual.columna !== "en-curso") {
      throw new HttpError(400, "Solo una tarea en curso puede enviarse a revisión.");
    }
    exigirAsignado(usuario, actual);

    const { rows } = await pool.query<{ comentario: boolean; adjunto: boolean }>(
      `SELECT
         EXISTS(
           SELECT 1 FROM comentarios_tarea co
            WHERE co.tarea_id = $1 AND co.usuario_id = $2
              AND ($3::timestamptz IS NULL OR co.creado_en > $3)
         ) AS comentario,
         EXISTS(
           SELECT 1 FROM adjuntos_tarea a
            WHERE a.tarea_id = $1 AND a.usuario_id = $2
              AND ($3::timestamptz IS NULL OR a.creado_en > $3)
         ) AS adjunto`,
      [tareaId, usuario.id, actual.ultimaDevolucionEn],
    );

    if (!rows[0]?.comentario) {
      throw new HttpError(
        400,
        "Agrega un comentario con lo realizado antes de enviar la tarea a revisión.",
      );
    }
    if (!rows[0]?.adjunto) {
      throw new HttpError(
        400,
        "Adjunta al menos una evidencia o documento de lo realizado antes de enviar a revisión.",
      );
    }

    await pool.query(
      "UPDATE tareas_tablero SET columna = 'en-revision' WHERE id = $1 AND tablero_id = $2",
      [tareaId, tableroId],
    );
    await sincronizarEdtDesdeTareas(pool, actual.edtActividadId);

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Envío a revisión",
      entidad: "Tarea de tablero",
      registro: actual.titulo,
      previo: "En curso",
      nuevo: "En revisión",
    });

    avisarFlujo({ tipo: "revision", tarea: actual, actor: usuario });

    res.json({ tarea: await responderTarea(tableroId, tareaId) });
  }),
);

tableros.post(
  "/:id/tareas/:tareaId/aprobar",
  ah(async (req, res) => {
    const tableroId = z.string().uuid().parse(req.params.id);
    const tareaId = z.string().uuid().parse(req.params.tareaId);
    const usuario = res.locals.usuario as UsuarioSesion;
    const actual = await cargarTarea(tableroId, tareaId);

    if (actual.columna !== "en-revision") {
      throw new HttpError(400, "Solo una tarea en revisión puede aprobarse.");
    }
    exigirGestor(usuario, actual);

    // La actividad EDT no puede quedar completada si le falta su documento
    // obligatorio o si aún tiene requisitos previos pendientes.
    if (actual.edtActividadId) {
      const bloqueo = await bloqueoParaCompletar(pool, actual.edtActividadId);
      if (bloqueo) {
        throw new HttpError(
          400,
          `No se puede aprobar todavía: ${bloqueo} Carga el documento o completa los requisitos en la pestaña EDT.`,
        );
      }
    }

    await pool.query(
      `UPDATE tareas_tablero
          SET columna = 'completado', completado_en = now()
        WHERE id = $1 AND tablero_id = $2`,
      [tareaId, tableroId],
    );
    await sincronizarEdtDesdeTareas(pool, actual.edtActividadId);

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Aprobación",
      entidad: "Tarea de tablero",
      registro: actual.titulo,
      previo: "En revisión",
      nuevo: "Completado",
    });

    avisarFlujo({ tipo: "aprobada", tarea: actual, actor: usuario });

    res.json({ tarea: await responderTarea(tableroId, tareaId) });
  }),
);

tableros.post(
  "/:id/tareas/:tareaId/devolver",
  ah(async (req, res) => {
    const tableroId = z.string().uuid().parse(req.params.id);
    const tareaId = z.string().uuid().parse(req.params.tareaId);
    const datos = devolucionSchema.parse(req.body);
    const usuario = res.locals.usuario as UsuarioSesion;
    const actual = await cargarTarea(tableroId, tareaId);

    if (actual.columna !== "en-revision") {
      throw new HttpError(400, "Solo una tarea en revisión puede devolverse.");
    }
    exigirGestor(usuario, actual);

    await withTx(async (db) => {
      await db.query(
        "UPDATE tareas_tablero SET columna = 'en-curso', ultima_devolucion_en = now() WHERE id = $1 AND tablero_id = $2",
        [tareaId, tableroId],
      );
      await db.query(
        `INSERT INTO comentarios_tarea (tarea_id, usuario_id, autor, contenido)
         VALUES ($1, $2, $3, $4)`,
        [tareaId, usuario.id, usuario.nombre, `Corrección solicitada: ${datos.motivo}`],
      );
    });
    await sincronizarEdtDesdeTareas(pool, actual.edtActividadId);

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Devolución",
      entidad: "Tarea de tablero",
      registro: actual.titulo,
      previo: "En revisión",
      nuevo: `En curso · ${datos.motivo}`,
    });

    avisarFlujo({ tipo: "devuelta", tarea: actual, actor: usuario, motivo: datos.motivo });

    res.json({ tarea: await responderTarea(tableroId, tareaId) });
  }),
);

tableros.delete(
  "/:id/tareas/:tareaId",
  ah(async (req, res) => {
    const tableroId = z.string().uuid().parse(req.params.id);
    const tareaId = z.string().uuid().parse(req.params.tareaId);
    const usuario = res.locals.usuario as UsuarioSesion;

    if (usuario.rol !== "admin") {
      throw new HttpError(403, "Solo un administrador puede eliminar tareas.");
    }

    const { rows } = await pool.query<{ titulo: string; edtActividadId: string | null }>(
      `DELETE FROM tareas_tablero WHERE id = $1 AND tablero_id = $2
       RETURNING titulo, edt_actividad_id AS "edtActividadId"`,
      [tareaId, tableroId],
    );
    if (!rows[0]) throw new HttpError(404, "Tarea no encontrada");

    await sincronizarEdtDesdeTareas(pool, rows[0].edtActividadId);

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Eliminación",
      entidad: "Tarea de tablero",
      registro: rows[0].titulo,
    });

    res.json({ ok: true });
  }),
);
