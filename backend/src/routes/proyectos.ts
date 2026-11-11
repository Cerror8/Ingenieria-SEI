import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { registrarAuditoria } from "../audit.js";
import { pool, withTx, type Db } from "../db.js";
import { ah, HttpError } from "../http.js";
import { estructuraPorId } from "../lib/estructura.js";
import { requireAdmin, type UsuarioSesion } from "../auth/session.js";

export const ESTADOS_EN_EJECUCION = [
  "En ejecución",
  "En ejecución, prorrogado en tiempo",
  "En ejecución, adición presupuestal",
  "En ejecución, modificado",
] as const;
export const ESTADOS_PROYECTO = [
  "En formulación", ...ESTADOS_EN_EJECUCION, "Suspendido", "Finalizado", "Cerrado",
] as const;

export const CAMPOS_PROYECTO = `
  id, nombre, linea, estructura, responsable, lider_id AS "liderId", estado, avance, presupuesto,
  presupuesto_negociacion AS "presupuestoNegociacion",
  presupuesto_ejecucion AS "presupuestoEjecucion",
  presupuesto_alerta AS "presupuestoAlerta",
  ejecucion_pct AS "ejecucionPct", fecha_inicio AS "fechaInicio", fecha_fin AS "fechaFin",
  dias_restantes AS "diasRestantes", dependencia, objetivo,
  nombre_corto AS "nombreCorto", numero_contrato AS "numeroContrato", organizadores,
  entidad_contratante AS "entidadContratante", entidad_contratista AS "entidadContratista",
  fecha_asignacion AS "fechaAsignacion", creado_por AS "creadoPor", creado_en AS "creadoEn"
`;

export const CAMPOS_INDICADOR = `
  id, nombre, meta, avance, cumplimiento, estado, responsable,
  fecha, proyecto_id AS "proyectoId"
`;

export const CAMPOS_DOCUMENTO = `
  id, nombre, tipo, carpeta, version, fecha, usuario, estado, proyecto_id AS "proyectoId",
  fecha_documento AS "fechaDocumento", numero_documento AS "numeroDocumento",
  archivo_nombre AS "archivoNombre", archivo_mime AS "archivoMime",
  archivo_tamano AS "archivoTamano"
`;

// Fecha interna ascendente (desconocidas al final) y número con orden natural:
// Acta 2 precede a Acta 10 sin depender de la collation de la base.
export const ORDEN_DOCUMENTOS = `fecha_documento ASC NULLS LAST,
  (numero_documento IS NULL),
  ARRAY(SELECT CASE WHEN segmento[1] ~ '^[0-9]+$'
           THEN lpad(ltrim(segmento[1], '0'), 80, '0') ELSE lower(segmento[1]) END
        FROM regexp_matches(numero_documento, '[0-9]+|[^0-9]+', 'g')
             WITH ORDINALITY AS partes(segmento, posicion)
        ORDER BY posicion) COLLATE "C",
  fecha ASC, id ASC`;

export const CAMPOS_ACTIVIDAD = `
  id, nombre, responsable, mes_inicio AS "mesInicio", mes_fin AS "mesFin",
  avance, estado, hito, proyecto_id AS "proyectoId"
`;

export const CAMPOS_DESEMBOLSO = `
  id, fecha, concepto, valor, clase, numero_acta AS "numeroActa",
  proyecto_id AS "proyectoId"
`;

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato AAAA-MM-DD")
  .refine((valor) => {
    const fecha = new Date(`${valor}T00:00:00.000Z`);
    return !valor.startsWith("0000") && !Number.isNaN(fecha.getTime()) &&
      fecha.toISOString().slice(0, 10) === valor;
  }, "La fecha debe ser una fecha real");

const periodoSchema = z.object({ fechaInicio: fechaSchema, fechaFin: fechaSchema })
  .refine((datos) => datos.fechaFin >= datos.fechaInicio, {
    message: "La fecha de fin no puede ser anterior a la fecha de inicio",
    path: ["fechaFin"],
  });

// Sin defaults: PATCH conserva lo omitido y permite vaciar los textos contractuales históricos.
const camposEditablesSchema = z.object({
  nombre: z.string().trim().min(3, "El nombre es obligatorio").max(200),
  nombreCorto: z.string().trim().max(200),
  numeroContrato: z.string().trim().max(200),
  organizadores: z.string().trim().max(2000),
  entidadContratante: z.string().trim().max(200),
  entidadContratista: z.string().trim().max(200),
  fechaAsignacion: fechaSchema.nullable(),
  linea: z.string().trim().min(1, "La línea es obligatoria").max(120),
  estructura: z.string().trim().max(60).nullable().transform((valor) => valor || null),
  responsable: z.string().trim().max(120),
  liderId: z.string().uuid("Líder inválido").nullable(),
  estado: z.enum(ESTADOS_PROYECTO),
  dependencia: z.string().trim().max(160),
  objetivo: z.string().trim().max(2000),
  presupuesto: z.coerce.number().int().min(0),
  presupuestoNegociacion: z.coerce.number().int().min(0),
  presupuestoEjecucion: z.coerce.number().int().min(0),
  presupuestoAlerta: z.coerce.number().int().min(0),
  fechaInicio: fechaSchema,
  fechaFin: fechaSchema,
  avance: z.coerce.number().int().min(0).max(100),
  ejecucionPct: z.coerce.number().int().min(0).max(100),
});

const proyectoSchema = camposEditablesSchema.extend({
  id: z.string().trim().max(40)
    .regex(/^(OBR|INT|CON)-[A-Z0-9][A-Z0-9-]*$/i,
      "El código debe usar OBR-, INT- o CON- seguido de un consecutivo de letras, números y guiones"),
  nombreCorto: camposEditablesSchema.shape.nombreCorto.min(1, "El nombre corto es obligatorio"),
  numeroContrato: camposEditablesSchema.shape.numeroContrato.min(1, "El número de contrato es obligatorio"),
  organizadores: camposEditablesSchema.shape.organizadores.optional().default(""),
  entidadContratante: camposEditablesSchema.shape.entidadContratante.min(1, "La entidad contratante es obligatoria"),
  entidadContratista: camposEditablesSchema.shape.entidadContratista.min(1, "La entidad contratista es obligatoria"),
  fechaAsignacion: fechaSchema,
  estructura: camposEditablesSchema.shape.estructura.optional(),
  responsable: camposEditablesSchema.shape.responsable.optional().default("Sin asignar"),
  liderId: camposEditablesSchema.shape.liderId.optional(),
  estado: camposEditablesSchema.shape.estado.optional().default("En formulación"),
  dependencia: camposEditablesSchema.shape.dependencia.optional().default("Sin definir"),
  objetivo: camposEditablesSchema.shape.objetivo.optional().default(""),
  presupuesto: camposEditablesSchema.shape.presupuesto.optional().default(0),
  presupuestoNegociacion: camposEditablesSchema.shape.presupuestoNegociacion.optional().default(0),
  presupuestoEjecucion: camposEditablesSchema.shape.presupuestoEjecucion.optional().default(0),
  presupuestoAlerta: camposEditablesSchema.shape.presupuestoAlerta.optional().default(0),
  fechaInicio: fechaSchema.optional(),
  fechaFin: fechaSchema.optional(),
  avance: camposEditablesSchema.shape.avance.optional().default(0),
  ejecucionPct: camposEditablesSchema.shape.ejecucionPct.optional().default(0),
});

const actividadCampos = {
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  responsable: z.string().trim().max(120),
  mesInicio: z.coerce.number().int().min(1).max(12),
  mesFin: z.coerce.number().int().min(1).max(12),
  avance: z.coerce.number().int().min(0).max(100),
  estado: z.enum(["Pendiente", "En curso", "Completada", "Retrasada"]),
  hito: z.boolean(),
};

const crearActividadSchema = z.object({
  nombre: actividadCampos.nombre,
  responsable: actividadCampos.responsable.optional().default("Sin asignar"),
  mesInicio: actividadCampos.mesInicio,
  mesFin: actividadCampos.mesFin,
  avance: actividadCampos.avance.optional().default(0),
  estado: actividadCampos.estado.optional().default("Pendiente"),
  hito: actividadCampos.hito.optional().default(false),
});

const actualizarActividadSchema = z.object(actividadCampos).partial().strict()
  .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), {
    message: "Envía al menos un dato para actualizar",
  });

const desembolsoSchema = z.object({
  fecha: fechaSchema,
  concepto: z.string().trim().min(1, "El concepto es obligatorio").max(200),
  valor: z.coerce.number().int().min(0),
  clase: z.enum(["Desembolso", "Acta parcial"]).optional().default("Desembolso"),
  numeroActa: z.string().trim().max(80).nullable().optional().default(null),
});

const actualizarProyectoSchema = camposEditablesSchema.partial().strict()
  .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), {
    message: "Envía al menos un dato para actualizar",
  });

// Lista cerrada: nunca se interpolan nombres de columna enviados por el cliente.
const COLUMNAS_EDITABLES: Record<keyof z.infer<typeof camposEditablesSchema>, string> = {
  nombre: "nombre", nombreCorto: "nombre_corto", numeroContrato: "numero_contrato",
  organizadores: "organizadores", entidadContratante: "entidad_contratante",
  entidadContratista: "entidad_contratista", fechaAsignacion: "fecha_asignacion",
  linea: "linea", estructura: "estructura", responsable: "responsable", liderId: "lider_id",
  estado: "estado", dependencia: "dependencia", objetivo: "objetivo", presupuesto: "presupuesto",
  presupuestoNegociacion: "presupuesto_negociacion",
  presupuestoEjecucion: "presupuesto_ejecucion",
  presupuestoAlerta: "presupuesto_alerta",
  fechaInicio: "fecha_inicio", fechaFin: "fecha_fin", avance: "avance", ejecucionPct: "ejecucion_pct",
};

type Relacionados = {
  documentos: number;
  indicadores: number;
  actividades: number;
  edt: number;
  tareas: number;
  informes: number;
};

async function contarRelacionados(db: Pick<Db, "query">, proyecto: { id: string; nombre: string }) {
  // El productor actual de informes guarda el id; también hay referencias libres por nombre.
  const { rows } = await db.query<Relacionados>(
    `SELECT
       (SELECT COUNT(*)::int FROM documentos WHERE proyecto_id = $1) AS documentos,
       (SELECT COUNT(*)::int FROM indicadores WHERE proyecto_id = $1) AS indicadores,
       (SELECT COUNT(*)::int FROM actividades WHERE proyecto_id = $1) AS actividades,
       (SELECT COUNT(*)::int FROM edt_actividades WHERE proyecto_id = $1) AS edt,
       (SELECT COUNT(*)::int FROM tareas_tablero WHERE proyecto_id = $1) AS tareas,
       (SELECT COUNT(*)::int FROM informes WHERE proyecto = $1 OR proyecto = $2) AS informes`,
    [proyecto.id, proyecto.nombre],
  );
  return rows[0];
}

export const proyectos = Router();

proyectos.get(
  "/",
  ah(async (_req, res) => {
    const { rows } = await pool.query(`SELECT ${CAMPOS_PROYECTO} FROM proyectos ORDER BY id`);
    res.json({ proyectos: rows });
  }),
);

proyectos.get(
  "/:id/eliminacion",
  requireAdmin,
  ah(async (req, res) => {
    const id = z.string().trim().min(1).parse(req.params.id);
    const { rows } = await pool.query<{ id: string; nombre: string }>(
      "SELECT id, nombre FROM proyectos WHERE id = $1", [id],
    );
    if (!rows[0]) throw new HttpError(404, "Proyecto no encontrado");
    const relacionados = await contarRelacionados(pool, rows[0]);
    res.json({ relacionados, puedeEliminar: Object.values(relacionados).every((total) => total === 0) });
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

    const [{ rows: indicadores }, { rows: documentos }, { rows: actividades }, { rows: desembolsos }] =
      await Promise.all([
        pool.query(`SELECT ${CAMPOS_INDICADOR} FROM indicadores WHERE proyecto_id = $1 ORDER BY id`, [id]),
        pool.query(`SELECT ${CAMPOS_DOCUMENTO} FROM documentos WHERE proyecto_id = $1 ORDER BY ${ORDEN_DOCUMENTOS}`, [id]),
        pool.query(`SELECT ${CAMPOS_ACTIVIDAD} FROM actividades WHERE proyecto_id = $1 ORDER BY mes_inicio, id`, [id]),
        pool.query(`SELECT ${CAMPOS_DESEMBOLSO} FROM desembolsos WHERE proyecto_id = $1 ORDER BY fecha, creado_en`, [id]),
      ]);

    res.json({ proyecto, indicadores, documentos, actividades, desembolsos });
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

    // Conserva los defaults anteriores, pero valida también el período efectivo al omitir fechas.
    const { rows: fechas } = await pool.query<{ fechaInicio: string; fechaFin: string }>(
      `SELECT COALESCE($1::date, (now() AT TIME ZONE 'America/Bogota')::date) AS "fechaInicio",
              COALESCE($2::date, COALESCE($1::date, (now() AT TIME ZONE 'America/Bogota')::date) + 364) AS "fechaFin"`,
      [datos.fechaInicio ?? null, datos.fechaFin ?? null],
    );
    const periodo = periodoSchema.parse(fechas[0]);
    const usuario = res.locals.usuario as UsuarioSesion;
    const { rows } = await pool.query(
      `INSERT INTO proyectos
         (id, nombre, linea, responsable, estado, avance, presupuesto, ejecucion_pct,
          fecha_inicio, fecha_fin, dias_restantes, dependencia, objetivo, lider_id, estructura,
          nombre_corto, numero_contrato, organizadores, entidad_contratante, entidad_contratista,
          fecha_asignacion, creado_por, presupuesto_negociacion, presupuesto_ejecucion,
          presupuesto_alerta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10::date,
         GREATEST(0, $10::date - (now() AT TIME ZONE 'America/Bogota')::date),
         $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::date, $21, $22, $23, $24)
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
        periodo.fechaInicio,
        periodo.fechaFin,
        datos.dependencia || "Sin definir",
        datos.objetivo,
        liderId,
        estructura?.id ?? null,
        datos.nombreCorto,
        datos.numeroContrato,
        datos.organizadores,
        datos.entidadContratante,
        datos.entidadContratista,
        datos.fechaAsignacion,
        usuario.nombre,
        datos.presupuestoNegociacion,
        datos.presupuestoEjecucion,
        datos.presupuestoAlerta,
      ],
    );

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

const PROYECTO_EJEMPLO = {
  id: "INT-EJEMPLO-001",
  nombre: "Interventoría técnica, administrativa y financiera al contrato de obra 2026-045",
  nombreCorto: "EJEMPLO-INT-045",
  numeroContrato: "INT-2026-045",
  organizadores: "Oficina de Software",
  entidadContratante: "Universidad CESMAG",
  entidadContratista: "SEI Ingeniería S.A.S.",
  linea: "Interventoría de obra",
  dependencia: "Dirección de Interventoría",
  responsable: "Coordinación de Interventoría",
  objetivo:
    "Ejemplo guía: registro completo de un contrato de interventoría con entidades, fechas, presupuestos y checklist EDT por etapas.",
  estructura: "interventoria-consultoria",
};

proyectos.post(
  "/ejemplo",
  requireAdmin,
  ah(async (_req, res) => {
    const usuario = res.locals.usuario as UsuarioSesion;
    const { rows: existentes } = await pool.query(
      `SELECT ${CAMPOS_PROYECTO} FROM proyectos WHERE id = $1`,
      [PROYECTO_EJEMPLO.id],
    );
    if (existentes[0]) {
      if (existentes[0].liderId) {
        res.json({ proyecto: existentes[0], creado: false });
        return;
      }
      const { rows: completados } = await pool.query(
        `UPDATE proyectos SET lider_id = $2 WHERE id = $1 RETURNING ${CAMPOS_PROYECTO}`,
        [PROYECTO_EJEMPLO.id, usuario.id],
      );
      res.json({ proyecto: completados[0], creado: false });
      return;
    }

    const { rows } = await pool.query(
      `INSERT INTO proyectos
         (id, nombre, linea, responsable, estado, avance, presupuesto, ejecucion_pct,
          fecha_inicio, fecha_fin, dias_restantes, dependencia, objetivo, estructura,
          nombre_corto, numero_contrato, organizadores, entidad_contratante, entidad_contratista,
          fecha_asignacion, creado_por, lider_id, presupuesto_negociacion, presupuesto_ejecucion,
          presupuesto_alerta)
       VALUES ($1, $2, $3, $4, 'En ejecución', 38, 480000000, 32,
         (now() AT TIME ZONE 'America/Bogota')::date - 120,
         (now() AT TIME ZONE 'America/Bogota')::date + 245,
         245, $5, $6, $7, $8, $9, $10, $11, $12,
         (now() AT TIME ZONE 'America/Bogota')::date - 130,
         $13, $14, 500000000, 460000000, 440000000)
       RETURNING ${CAMPOS_PROYECTO}`,
      [
        PROYECTO_EJEMPLO.id,
        PROYECTO_EJEMPLO.nombre,
        PROYECTO_EJEMPLO.linea,
        PROYECTO_EJEMPLO.responsable,
        PROYECTO_EJEMPLO.dependencia,
        PROYECTO_EJEMPLO.objetivo,
        PROYECTO_EJEMPLO.estructura,
        PROYECTO_EJEMPLO.nombreCorto,
        PROYECTO_EJEMPLO.numeroContrato,
        PROYECTO_EJEMPLO.organizadores,
        PROYECTO_EJEMPLO.entidadContratante,
        PROYECTO_EJEMPLO.entidadContratista,
        usuario.nombre,
        usuario.id,
      ],
    );

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Creación",
      entidad: "Proyecto",
      registro: PROYECTO_EJEMPLO.id,
      nuevo: `Proyecto de ejemplo: ${PROYECTO_EJEMPLO.nombre}`,
    });

    res.status(201).json({ proyecto: rows[0], creado: true });
  }),
);

proyectos.patch(
  "/:id",
  ah(async (req, res) => {
    // Los códigos históricos se conservan; las restricciones de prefijo sólo aplican al alta.
    const id = z.string().trim().min(1).parse(req.params.id);
    const datos = actualizarProyectoSchema.parse(req.body);
    const usuario = res.locals.usuario as UsuarioSesion;
    const proyecto = await withTx(async (db) => {
      const { rows: actuales } = await db.query(
        `SELECT ${CAMPOS_PROYECTO} FROM proyectos WHERE id = $1 FOR UPDATE`, [id],
      );
      const actual = actuales[0];
      if (!actual) throw new HttpError(404, "Proyecto no encontrado");

      periodoSchema.parse({
        fechaInicio: datos.fechaInicio ?? actual.fechaInicio,
        fechaFin: datos.fechaFin ?? actual.fechaFin,
      });

      if (datos.estructura !== undefined && datos.estructura !== actual.estructura) {
        const { rows: documentos } = await db.query<{ total: number }>(
          "SELECT COUNT(*)::int AS total FROM documentos WHERE proyecto_id = $1", [id],
        );
        if (documentos[0].total > 0) {
          throw new HttpError(409, "No se puede cambiar la estructura de un proyecto con documentos.");
        }
        if (datos.estructura && !estructuraPorId(datos.estructura)) {
          throw new HttpError(400, "La estructura documental no existe.");
        }
      }

      if (datos.liderId) {
        const { rows: lider } = await db.query(
          "SELECT 1 FROM usuarios WHERE id = $1 AND activo = true", [datos.liderId],
        );
        if (!lider[0]) throw new HttpError(400, "El líder seleccionado no existe o está inactivo.");
      }

      const valores: unknown[] = [id];
      const cambios: string[] = [];
      for (const campo of Object.keys(datos) as Array<keyof typeof datos>) {
        if (datos[campo] === undefined) continue;
        valores.push(datos[campo]);
        cambios.push(`${COLUMNAS_EDITABLES[campo]} = $${valores.length}`);
        if (campo === "fechaFin") {
          cambios.push(`dias_restantes = GREATEST(0, $${valores.length}::date - (now() AT TIME ZONE 'America/Bogota')::date)`);
        }
      }
      const { rows } = await db.query(
        `UPDATE proyectos SET ${cambios.join(", ")} WHERE id = $1 RETURNING ${CAMPOS_PROYECTO}`,
        valores,
      );
      // La auditoría usa la misma transacción: nunca queda una edición sin su histórico.
      await db.query(
        `INSERT INTO auditoria (usuario, accion, entidad, registro, valor_previo, valor_nuevo)
         VALUES ($1, 'Edición', 'Proyecto', $2, $3, $4)`,
        [usuario.nombre, id, JSON.stringify(actual), JSON.stringify(rows[0])],
      );
      return rows[0];
    });
    res.json({ proyecto });
  }),
);

proyectos.post(
  "/:id/actividades",
  ah(async (req, res) => {
    const id = z.string().trim().min(1).parse(req.params.id);
    const datos = crearActividadSchema.parse(req.body);
    if (datos.mesFin < datos.mesInicio) {
      throw new HttpError(400, "El mes de fin no puede ser anterior al mes de inicio.");
    }

    const { rows: proyecto } = await pool.query("SELECT 1 FROM proyectos WHERE id = $1", [id]);
    if (!proyecto[0]) throw new HttpError(404, "Proyecto no encontrado");

    const activityId = `ACT-${randomUUID().slice(0, 8).toUpperCase()}`;
    const { rows } = await pool.query(
      `INSERT INTO actividades
         (id, nombre, responsable, mes_inicio, mes_fin, avance, estado, hito, proyecto_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${CAMPOS_ACTIVIDAD}`,
      [activityId, datos.nombre, datos.responsable, datos.mesInicio, datos.mesFin,
        datos.avance, datos.estado, datos.hito, id],
    );
    res.status(201).json({ actividad: rows[0] });
  }),
);

proyectos.patch(
  "/:id/actividades/:actividadId",
  ah(async (req, res) => {
    const id = z.string().trim().min(1).parse(req.params.id);
    const actividadId = z.string().trim().min(1).parse(req.params.actividadId);
    const datos = actualizarActividadSchema.parse(req.body);

    const { rows: actuales } = await pool.query(
      `SELECT ${CAMPOS_ACTIVIDAD} FROM actividades WHERE id = $1 AND proyecto_id = $2`,
      [actividadId, id],
    );
    const actual = actuales[0];
    if (!actual) throw new HttpError(404, "Actividad no encontrada");

    const mesInicio = datos.mesInicio ?? actual.mesInicio;
    const mesFin = datos.mesFin ?? actual.mesFin;
    if (mesFin < mesInicio) {
      throw new HttpError(400, "El mes de fin no puede ser anterior al mes de inicio.");
    }

    const { rows } = await pool.query(
      `UPDATE actividades SET
         nombre = $3, responsable = $4, mes_inicio = $5, mes_fin = $6,
         avance = $7, estado = $8, hito = $9
       WHERE id = $1 AND proyecto_id = $2
       RETURNING ${CAMPOS_ACTIVIDAD}`,
      [
        actividadId, id,
        datos.nombre ?? actual.nombre,
        datos.responsable ?? actual.responsable,
        mesInicio,
        mesFin,
        datos.avance ?? actual.avance,
        datos.estado ?? actual.estado,
        datos.hito ?? actual.hito,
      ],
    );
    res.json({ actividad: rows[0] });
  }),
);

proyectos.delete(
  "/:id/actividades/:actividadId",
  ah(async (req, res) => {
    const id = z.string().trim().min(1).parse(req.params.id);
    const actividadId = z.string().trim().min(1).parse(req.params.actividadId);
    const { rowCount } = await pool.query(
      "DELETE FROM actividades WHERE id = $1 AND proyecto_id = $2", [actividadId, id],
    );
    if (!rowCount) throw new HttpError(404, "Actividad no encontrada");
    res.json({ ok: true });
  }),
);

proyectos.post(
  "/:id/desembolsos",
  ah(async (req, res) => {
    const id = z.string().trim().min(1).parse(req.params.id);
    const datos = desembolsoSchema.parse(req.body);
    const { rows: proyecto } = await pool.query("SELECT 1 FROM proyectos WHERE id = $1", [id]);
    if (!proyecto[0]) throw new HttpError(404, "Proyecto no encontrado");

    const { rows } = await pool.query(
      `INSERT INTO desembolsos (proyecto_id, fecha, concepto, valor, clase, numero_acta)
       VALUES ($1, $2::date, $3, $4, $5, $6)
       RETURNING ${CAMPOS_DESEMBOLSO}`,
      [id, datos.fecha, datos.concepto, datos.valor, datos.clase,
        datos.clase === "Acta parcial" ? datos.numeroActa : null],
    );
    res.status(201).json({ desembolso: rows[0] });
  }),
);

proyectos.delete(
  "/:id/desembolsos/:desembolsoId",
  ah(async (req, res) => {
    const id = z.string().trim().min(1).parse(req.params.id);
    const desembolsoId = z.string().uuid("Desembolso inválido").parse(req.params.desembolsoId);
    const { rowCount } = await pool.query(
      "DELETE FROM desembolsos WHERE id = $1 AND proyecto_id = $2", [desembolsoId, id],
    );
    if (!rowCount) throw new HttpError(404, "Desembolso no encontrado");
    res.json({ ok: true });
  }),
);

proyectos.delete(
  "/:id",
  requireAdmin,
  ah(async (req, res) => {
    const id = z.string().trim().min(1).parse(req.params.id);
    const { confirmacion } = z.object({ confirmacion: z.string().min(1) }).strict().parse(req.body);
    if (confirmacion !== id) throw new HttpError(400, "Confirma la eliminación con el código exacto del proyecto.");
    const usuario = res.locals.usuario as UsuarioSesion;

    await withTx(async (db) => {
      const { rows } = await db.query(
        `SELECT ${CAMPOS_PROYECTO} FROM proyectos WHERE id = $1 FOR UPDATE`, [id],
      );
      const proyecto = rows[0];
      if (!proyecto) throw new HttpError(404, "Proyecto no encontrado");

      // Informes no tiene FK: estabiliza sus escrituras durante el conteo y la eliminación.
      // El bloqueo de la fila del proyecto protege las otras cinco relaciones mediante sus FK.
      await db.query("LOCK TABLE informes IN SHARE MODE");
      const relacionados = await contarRelacionados(db, proyecto);
      if (Object.values(relacionados).some((total) => total > 0)) {
        const detalle = Object.entries(relacionados).map(([tipo, total]) => `${tipo}: ${total}`).join(", ");
        throw new HttpError(409, `No se puede eliminar un proyecto con registros relacionados (${detalle}).`);
      }

      await db.query("DELETE FROM proyectos WHERE id = $1", [id]);
      await db.query(
        `INSERT INTO auditoria (usuario, accion, entidad, registro, valor_previo, valor_nuevo)
         VALUES ($1, 'Eliminación', 'Proyecto', $2, $3, '—')`,
        [usuario.nombre, id, JSON.stringify(proyecto)],
      );
    });
    res.json({ ok: true });
  }),
);
