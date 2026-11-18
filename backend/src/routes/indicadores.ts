import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { pool, withTx, type Db } from "../db.js";
import { ah, HttpError } from "../http.js";
import { CAMPOS_INDICADOR, fechaSchema } from "./proyectos.js";

export const ESTADOS_INDICADOR = ["Cumplido", "En riesgo", "No cumplido", "Pendiente"] as const;
export const ORIGENES_INDICADOR = ["Manual", "EDT"] as const;

const indicadorCampos = {
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  meta: z.string().trim().min(1, "La meta es obligatoria").max(200),
  avance: z.string().trim().max(200),
  cumplimiento: z.coerce.number().int().min(0).max(100),
  estado: z.enum(ESTADOS_INDICADOR),
  responsable: z.string().trim().max(120),
  fecha: fechaSchema,
  origen: z.enum(ORIGENES_INDICADOR),
  edtFaseId: z.string().uuid("Fase del EDT inválida").nullable(),
  actividadesIds: z.array(z.string().uuid("Actividad del EDT inválida")).max(500),
};

const crearIndicadorSchema = z.object({
  proyectoId: z.string().trim().min(1).max(40),
  nombre: indicadorCampos.nombre,
  meta: indicadorCampos.meta,
  avance: indicadorCampos.avance.optional().default("Sin reportar"),
  cumplimiento: indicadorCampos.cumplimiento.optional().default(0),
  estado: indicadorCampos.estado.optional().default("Pendiente"),
  responsable: indicadorCampos.responsable.optional().default("Sin asignar"),
  fecha: indicadorCampos.fecha,
  origen: indicadorCampos.origen.optional().default("EDT"),
  edtFaseId: indicadorCampos.edtFaseId.optional().default(null),
  actividadesIds: indicadorCampos.actividadesIds.optional().default([]),
}).strict()
  .refine((datos) => datos.origen === "Manual" || datos.edtFaseId !== null, {
    message: "Selecciona la fase del EDT para el indicador automático",
    path: ["edtFaseId"],
  });

const actualizarIndicadorSchema = z.object(indicadorCampos).partial().strict()
  .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), {
    message: "Envía al menos un dato para actualizar",
  });

async function validarFaseEdt(db: Pick<Db, "query">, proyectoId: string, faseId: string) {
  const { rows } = await db.query(
    "SELECT 1 FROM edt_fases WHERE id = $1 AND proyecto_id = $2",
    [faseId, proyectoId],
  );
  if (!rows[0]) throw new HttpError(400, "La fase del EDT no existe en el proyecto.");
}

async function validarActividadesEdt(
  db: Pick<Db, "query">,
  proyectoId: string,
  faseId: string,
  actividadesIds: string[],
) {
  if (actividadesIds.length === 0) return;
  const { rows } = await db.query(
    `SELECT COUNT(DISTINCT id)::int AS total
       FROM edt_actividades
      WHERE id = ANY($1::uuid[]) AND proyecto_id = $2 AND fase_id = $3`,
    [actividadesIds, proyectoId, faseId],
  );
  if (rows[0].total !== new Set(actividadesIds).size) {
    throw new HttpError(400, "Alguna actividad no pertenece a la fase del EDT seleccionada.");
  }
}

export const indicadores = Router();

indicadores.get(
  "/",
  ah(async (req, res) => {
    const proyectoId = typeof req.query.proyectoId === "string" ? req.query.proyectoId : null;

    const { rows } = proyectoId
      ? await pool.query(
          `SELECT ${CAMPOS_INDICADOR} FROM indicadores WHERE proyecto_id = $1 ORDER BY creado_en, id`,
          [proyectoId],
        )
      : await pool.query(`SELECT ${CAMPOS_INDICADOR} FROM indicadores ORDER BY creado_en, id`);

    res.json({ indicadores: rows });
  }),
);

indicadores.post(
  "/",
  ah(async (req, res) => {
    const datos = crearIndicadorSchema.parse(req.body);
    const usuario = res.locals.usuario as { nombre: string };

    const indicador = await withTx(async (db) => {
      const { rows: proyecto } = await db.query("SELECT 1 FROM proyectos WHERE id = $1", [datos.proyectoId]);
      if (!proyecto[0]) throw new HttpError(404, "Proyecto no encontrado");

      const faseId = datos.origen === "EDT" ? datos.edtFaseId : null;
      const actividadesIds = faseId ? datos.actividadesIds : [];
      if (faseId) {
        await validarFaseEdt(db, datos.proyectoId, faseId);
        await validarActividadesEdt(db, datos.proyectoId, faseId, actividadesIds);
      }

      const id = `IND-${randomUUID().slice(0, 8).toUpperCase()}`;
      await db.query(
        `INSERT INTO indicadores
           (id, nombre, meta, avance, cumplimiento, estado, responsable, fecha, proyecto_id, origen, edt_fase_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10, $11)`,
        [
          id, datos.nombre, datos.meta, datos.avance, datos.cumplimiento,
          datos.estado, datos.responsable, datos.fecha, datos.proyectoId,
          datos.origen, faseId,
        ],
      );

      if (actividadesIds.length > 0) {
        await db.query(
          `INSERT INTO indicadores_actividades (indicador_id, actividad_id)
           SELECT $1, unnest($2::uuid[])`,
          [id, actividadesIds],
        );
      }

      const { rows } = await db.query(
        `SELECT ${CAMPOS_INDICADOR} FROM indicadores WHERE id = $1`, [id],
      );

      await db.query(
        `INSERT INTO auditoria (usuario, accion, entidad, registro, valor_previo, valor_nuevo)
         VALUES ($1, 'Creación', 'Indicador', $2, '—', $3)`,
        [usuario.nombre, datos.proyectoId, `${id} · ${datos.nombre}`],
      );
      return rows[0];
    });

    res.status(201).json({ indicador });
  }),
);

indicadores.patch(
  "/:id",
  ah(async (req, res) => {
    const id = z.string().trim().min(1).parse(req.params.id);
    const datos = actualizarIndicadorSchema.parse(req.body);
    const usuario = res.locals.usuario as { nombre: string };

    const indicador = await withTx(async (db) => {
      const { rows: actuales } = await db.query(
        `SELECT ${CAMPOS_INDICADOR} FROM indicadores WHERE id = $1 FOR UPDATE`, [id],
      );
      const actual = actuales[0];
      if (!actual) throw new HttpError(404, "Indicador no encontrado");

      const origen: (typeof ORIGENES_INDICADOR)[number] = datos.origen ?? actual.origen;
      const faseId = origen === "EDT"
        ? datos.edtFaseId !== undefined ? datos.edtFaseId : actual.edtFaseId
        : null;

      // null = conservar vínculos; [] = toda la fase (o paso a Manual).
      let actividadesIds: string[] | null = null;
      if (origen === "EDT") {
        if (!faseId) throw new HttpError(400, "Selecciona la fase del EDT para el indicador automático.");
        await validarFaseEdt(db, actual.proyectoId, faseId);
        if (datos.actividadesIds !== undefined) {
          actividadesIds = datos.actividadesIds;
        } else if (datos.edtFaseId !== undefined && datos.edtFaseId !== actual.edtFaseId) {
          actividadesIds = [];
        }
        if (actividadesIds) {
          await validarActividadesEdt(db, actual.proyectoId, faseId, actividadesIds);
        }
      } else {
        actividadesIds = [];
      }

      // En modo EDT el cumplimiento se calcula al leer. Al volver a Manual se siembra
      // con el último cálculo para no perder el avance que ya tenían las actividades.
      const cumplimiento = origen === "EDT"
        ? null
        : datos.cumplimiento ?? (actual.origen === "EDT" ? actual.cumplimiento : null);

      await db.query(
        `UPDATE indicadores SET
           nombre = COALESCE($2, nombre),
           meta = COALESCE($3, meta),
           avance = COALESCE($4, avance),
           cumplimiento = COALESCE($5, cumplimiento),
           estado = COALESCE($6, estado),
           responsable = COALESCE($7, responsable),
           fecha = COALESCE($8::date, fecha),
           origen = $9,
           edt_fase_id = $10
         WHERE id = $1`,
        [
          id,
          datos.nombre ?? null,
          datos.meta ?? null,
          datos.avance ?? null,
          cumplimiento,
          datos.estado ?? null,
          datos.responsable ?? null,
          datos.fecha ?? null,
          origen,
          faseId,
        ],
      );

      if (actividadesIds !== null) {
        await db.query("DELETE FROM indicadores_actividades WHERE indicador_id = $1", [id]);
        if (actividadesIds.length > 0) {
          await db.query(
            `INSERT INTO indicadores_actividades (indicador_id, actividad_id)
             SELECT $1, unnest($2::uuid[])`,
            [id, actividadesIds],
          );
        }
      }

      const { rows } = await db.query(
        `SELECT ${CAMPOS_INDICADOR} FROM indicadores WHERE id = $1`, [id],
      );

      // La auditoría comparte la transacción: nunca queda una edición sin su histórico.
      await db.query(
        `INSERT INTO auditoria (usuario, accion, entidad, registro, valor_previo, valor_nuevo)
         VALUES ($1, 'Edición', 'Indicador', $2, $3, $4)`,
        [usuario.nombre, actual.proyectoId, JSON.stringify(actual), JSON.stringify(rows[0])],
      );
      return rows[0];
    });

    res.json({ indicador });
  }),
);

indicadores.delete(
  "/:id",
  ah(async (req, res) => {
    const id = z.string().trim().min(1).parse(req.params.id);
    const usuario = res.locals.usuario as { nombre: string };

    await withTx(async (db) => {
      const { rows } = await db.query(
        `SELECT ${CAMPOS_INDICADOR} FROM indicadores WHERE id = $1 FOR UPDATE`, [id],
      );
      const actual = rows[0];
      if (!actual) throw new HttpError(404, "Indicador no encontrado");

      await db.query("DELETE FROM indicadores WHERE id = $1", [id]);
      await db.query(
        `INSERT INTO auditoria (usuario, accion, entidad, registro, valor_previo, valor_nuevo)
         VALUES ($1, 'Eliminación', 'Indicador', $2, $3, '—')`,
        [usuario.nombre, actual.proyectoId, JSON.stringify(actual)],
      );
    });

    res.json({ ok: true });
  }),
);
