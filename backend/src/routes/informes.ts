import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { ah, HttpError } from "../http.js";
import type { UsuarioSesion } from "../auth/session.js";

const CAMPOS_INFORME = `
  id, fecha, tipo, periodo, proyecto, generado_por AS "generadoPor", formato,
  periodo_inicio AS "periodoInicio", periodo_fin AS "periodoFin",
  contenido, consolidado
`;

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato AAAA-MM-DD")
  .refine((valor) => {
    const fecha = new Date(`${valor}T00:00:00.000Z`);
    return !valor.startsWith("0000") && !Number.isNaN(fecha.getTime()) &&
      fecha.toISOString().slice(0, 10) === valor;
  }, "La fecha debe ser una fecha real");

const informeSemanalSchema = z.object({
  tipo: z.literal("Semanal"),
  proyecto: z.string().trim().min(1, "Selecciona el proyecto").max(60),
  periodoInicio: fechaSchema,
  periodoFin: fechaSchema,
  contenido: z.string().trim().min(1, "Registra el contenido del informe").max(20_000),
}).refine((datos) => datos.periodoFin >= datos.periodoInicio, {
  message: "La fecha final no puede ser anterior a la inicial",
  path: ["periodoFin"],
});

const consolidarSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("Mensual"),
    proyecto: z.string().trim().min(1).max(60),
    anio: z.coerce.number().int().min(2000).max(2100),
    mes: z.coerce.number().int().min(1).max(12),
  }),
  z.object({
    tipo: z.literal("Trimestral"),
    proyecto: z.string().trim().min(1).max(60),
    anio: z.coerce.number().int().min(2000).max(2100),
    trimestre: z.coerce.number().int().min(1).max(4),
  }),
]);

export const informes = Router();

informes.get(
  "/",
  ah(async (req, res) => {
    const proyecto = typeof req.query.proyecto === "string" ? req.query.proyecto.trim() : "";
    const { rows } = proyecto
      ? await pool.query(
          `SELECT ${CAMPOS_INFORME} FROM informes
            WHERE proyecto = $1
            ORDER BY fecha DESC, id DESC`,
          [proyecto],
        )
      : await pool.query(
          `SELECT ${CAMPOS_INFORME} FROM informes ORDER BY fecha DESC, id DESC`,
        );
    res.json({ informes: rows });
  }),
);

informes.post(
  "/",
  ah(async (req, res) => {
    const datos = informeSemanalSchema.parse(req.body);
    await exigirProyecto(datos.proyecto);
    const usuario = res.locals.usuario as UsuarioSesion;
    const informe = await insertarInforme({
      tipo: datos.tipo,
      proyecto: datos.proyecto,
      periodoInicio: datos.periodoInicio,
      periodoFin: datos.periodoFin,
      contenido: datos.contenido,
      generadoPor: usuario.nombre,
      consolidado: false,
    });
    res.status(201).json({ informe });
  }),
);

// El mensual reúne los semanales del mes; el trimestral reúne los mensuales del trimestre.
informes.post(
  "/consolidar",
  ah(async (req, res) => {
    const datos = consolidarSchema.parse(req.body);
    await exigirProyecto(datos.proyecto);
    const usuario = res.locals.usuario as UsuarioSesion;

    const rango = datos.tipo === "Mensual"
      ? rangoMes(datos.anio, datos.mes)
      : rangoTrimestre(datos.anio, datos.trimestre);
    const origenTipo = datos.tipo === "Mensual" ? "Semanal" : "Mensual";

    const { rows: hijos } = await pool.query<{
      periodo: string; periodoInicio: string; periodoFin: string; contenido: string;
    }>(
      `SELECT periodo, periodo_inicio AS "periodoInicio", periodo_fin AS "periodoFin", contenido
         FROM informes
        WHERE proyecto = $1 AND tipo = $2 AND periodo_inicio IS NOT NULL
          AND periodo_inicio >= $3::date AND periodo_inicio <= $4::date
        ORDER BY periodo_inicio, id`,
      [datos.proyecto, origenTipo, rango.inicio, rango.fin],
    );

    const etiqueta = datos.tipo === "Mensual"
      ? `Mes ${datos.mes}/${datos.anio}`
      : `Trimestre ${datos.trimestre}/${datos.anio}`;
    const contenido = hijos.length
      ? [
          `Consolidado de ${hijos.length} informe(s) ${origenTipo.toLowerCase()}(es) · ${etiqueta}.`,
          "",
          ...hijos.map((hijo) => {
            const texto = hijo.contenido.trim() || "Sin observaciones registradas.";
            return `• ${hijo.periodo}: ${texto}`;
          }),
        ].join("\n")
      : `Sin informes ${origenTipo.toLowerCase()}es registrados en ${etiqueta.toLowerCase()}.`;

    const { rows: existentes } = await pool.query<{ id: string }>(
      `SELECT id FROM informes
        WHERE tipo = $1 AND proyecto = $2 AND periodo_inicio = $3::date AND periodo_fin = $4::date
        LIMIT 1`,
      [datos.tipo, datos.proyecto, rango.inicio, rango.fin],
    );

    let informe: unknown;
    if (existentes[0]) {
      const { rows } = await pool.query(
        `UPDATE informes SET
           fecha = (now() AT TIME ZONE 'America/Bogota')::date,
           periodo = $2, contenido = $3, generado_por = $4, consolidado = true
         WHERE id = $1
         RETURNING ${CAMPOS_INFORME}`,
        [existentes[0].id, etiqueta, contenido, usuario.nombre],
      );
      informe = rows[0];
    } else {
      informe = await insertarInforme({
        tipo: datos.tipo,
        proyecto: datos.proyecto,
        periodoInicio: rango.inicio,
        periodoFin: rango.fin,
        contenido,
        generadoPor: usuario.nombre,
        consolidado: true,
        periodo: etiqueta,
      });
    }

    res.status(201).json({ informe, orígenes: hijos.length });
  }),
);

async function exigirProyecto(proyecto: string) {
  const { rows } = await pool.query("SELECT 1 FROM proyectos WHERE id = $1", [proyecto]);
  if (!rows[0]) throw new HttpError(400, "El proyecto seleccionado no existe.");
}

async function siguienteId(): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT 'RPT-' || lpad(
        (COALESCE(MAX((regexp_replace(id, '\\D', '', 'g'))::bigint), 0) + 1)::text, 4, '0'
     ) AS id
       FROM informes`,
  );
  return rows[0].id;
}

async function insertarInforme(datos: {
  tipo: string;
  proyecto: string;
  periodoInicio: string;
  periodoFin: string;
  contenido: string;
  generadoPor: string;
  consolidado: boolean;
  periodo?: string;
}) {
  const id = await siguienteId();
  const periodo = datos.periodo ?? `${datos.periodoInicio} al ${datos.periodoFin}`;
  const { rows } = await pool.query(
    `INSERT INTO informes
       (id, fecha, tipo, periodo, proyecto, generado_por, formato,
        periodo_inicio, periodo_fin, contenido, consolidado)
     VALUES ($1, (now() AT TIME ZONE 'America/Bogota')::date, $2, $3, $4, $5, 'PDF',
        $6::date, $7::date, $8, $9)
     RETURNING ${CAMPOS_INFORME}`,
    [id, datos.tipo, periodo, datos.proyecto, datos.generadoPor,
      datos.periodoInicio, datos.periodoFin, datos.contenido, datos.consolidado],
  );
  return rows[0];
}

function rangoMes(anio: number, mes: number) {
  const inicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const fin = new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
  return { inicio, fin };
}

function rangoTrimestre(anio: number, trimestre: number) {
  const mesInicio = (trimestre - 1) * 3 + 1;
  const mesFin = mesInicio + 2;
  const inicio = `${anio}-${String(mesInicio).padStart(2, "0")}-01`;
  const fin = new Date(Date.UTC(anio, mesFin, 0)).toISOString().slice(0, 10);
  return { inicio, fin };
}
