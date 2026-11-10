import { Router } from "express";
import { z } from "zod";
import { registrarAuditoria } from "../audit.js";
import { pool } from "../db.js";
import { ah, HttpError } from "../http.js";
import { estructuraPorId } from "../lib/estructura.js";
import type { UsuarioSesion } from "../auth/session.js";

const ESTADOS = ["En formulación", "En ejecución", "Suspendido", "Finalizado", "Cerrado"] as const;

export const CAMPOS_PROYECTO = `
  id, nombre, linea, estructura, responsable, lider_id AS "liderId", estado, avance, presupuesto,
  ejecucion_pct AS "ejecucionPct", fecha_inicio AS "fechaInicio", fecha_fin AS "fechaFin",
  dias_restantes AS "diasRestantes", dependencia, objetivo
`;

export const CAMPOS_INDICADOR = `
  id, nombre, meta, avance, cumplimiento, estado, responsable,
  fecha, proyecto_id AS "proyectoId"
`;

export const CAMPOS_DOCUMENTO = `
  id, nombre, tipo, carpeta, version, fecha, usuario, estado, proyecto_id AS "proyectoId",
  archivo_nombre AS "archivoNombre", archivo_mime AS "archivoMime",
  archivo_tamano AS "archivoTamano"
`;

export const CAMPOS_ACTIVIDAD = `
  id, nombre, responsable, mes_inicio AS "mesInicio", mes_fin AS "mesFin",
  avance, estado, hito, proyecto_id AS "proyectoId"
`;

const proyectoSchema = z.object({
  id: z
    .string()
    .trim()
    .min(3, "El código es obligatorio")
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, "El código solo admite letras, números y guiones"),
  nombre: z.string().trim().min(3, "El nombre es obligatorio").max(200),
  linea: z.string().trim().min(1, "La línea es obligatoria").max(120),
  estructura: z.string().trim().max(60).nullable().optional(),
  responsable: z.string().trim().max(120).optional().default("Sin asignar"),
  liderId: z.string().uuid("Líder inválido").nullable().optional(),
  estado: z.enum(ESTADOS).optional().default("En formulación"),
  dependencia: z.string().trim().max(160).optional().default("Sin definir"),
  objetivo: z.string().trim().max(2000).optional().default(""),
  presupuesto: z.coerce.number().int().min(0).optional().default(0),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  avance: z.coerce.number().int().min(0).max(100).optional().default(0),
  ejecucionPct: z.coerce.number().int().min(0).max(100).optional().default(0),
});

export const proyectos = Router();

proyectos.get(
  "/",
  ah(async (_req, res) => {
    const { rows } = await pool.query(`SELECT ${CAMPOS_PROYECTO} FROM proyectos ORDER BY id`);
    res.json({ proyectos: rows });
  }),
);

proyectos.get(
  "/:id",
  ah(async (req, res) => {
    const id = z.string().trim().min(1).parse(req.params.id);

    const { rows: proyectosRows } = await pool.query(
      `SELECT ${CAMPOS_PROYECTO} FROM proyectos WHERE id = $1`,
      [id],
    );
    const proyecto = proyectosRows[0];
    if (!proyecto) throw new HttpError(404, "Proyecto no encontrado");

    const [{ rows: indicadores }, { rows: documentos }, { rows: actividades }] = await Promise.all([
      pool.query(`SELECT ${CAMPOS_INDICADOR} FROM indicadores WHERE proyecto_id = $1 ORDER BY id`, [id]),
      pool.query(`SELECT ${CAMPOS_DOCUMENTO} FROM documentos WHERE proyecto_id = $1 ORDER BY fecha DESC`, [id]),
      pool.query(`SELECT ${CAMPOS_ACTIVIDAD} FROM actividades WHERE proyecto_id = $1 ORDER BY mes_inicio, id`, [id]),
    ]);

    res.json({ proyecto, indicadores, documentos, actividades });
  }),
);

proyectos.post(
  "/",
  ah(async (req, res) => {
    const datos = proyectoSchema.parse(req.body);
    const id = datos.id.toUpperCase();
    const liderId = datos.liderId ?? null;
    const estructura = datos.estructura ? estructuraPorId(datos.estructura) : null;
    if (datos.estructura && !estructura) {
      throw new HttpError(400, "La estructura documental no existe.");
    }

    if (liderId) {
      const { rows: lider } = await pool.query(
        "SELECT 1 FROM usuarios WHERE id = $1 AND activo = true",
        [liderId],
      );
      if (!lider[0]) throw new HttpError(400, "El líder seleccionado no existe o está inactivo.");
    }

    const { rows } = await pool.query(
      `INSERT INTO proyectos
         (id, nombre, linea, responsable, estado, avance, presupuesto, ejecucion_pct,
          fecha_inicio, fecha_fin, dias_restantes, dependencia, objetivo, lider_id, estructura)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
         COALESCE($9::date, (now() AT TIME ZONE 'America/Bogota')::date),
         COALESCE($10::date, COALESCE($9::date, (now() AT TIME ZONE 'America/Bogota')::date) + 364),
         GREATEST(0, COALESCE($10::date, COALESCE($9::date, (now() AT TIME ZONE 'America/Bogota')::date) + 364) - (now() AT TIME ZONE 'America/Bogota')::date),
         $11, $12, $13, $14)
       RETURNING ${CAMPOS_PROYECTO}`,
      [
        id,
        datos.nombre,
        datos.linea,
        datos.responsable || "Sin asignar",
        datos.estado,
        datos.avance,
        datos.presupuesto,
        datos.ejecucionPct,
        datos.fechaInicio ?? null,
        datos.fechaFin ?? null,
        datos.dependencia || "Sin definir",
        datos.objetivo,
        liderId,
        estructura?.id ?? null,
      ],
    );

    const usuario = res.locals.usuario as UsuarioSesion;
    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Creación",
      entidad: "Proyecto",
      registro: id,
      nuevo: datos.nombre,
    });

    res.status(201).json({ proyecto: rows[0] });
  }),
);
