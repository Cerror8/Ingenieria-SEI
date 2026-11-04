import { Router } from "express";
import { z } from "zod";
import { pool, withTx } from "../db.js";
import { ah, HttpError } from "../http.js";
import { idPorCodigo } from "./proyectos.js";

export const seguimiento = Router({ mergeParams: true });

// ---- Actividades y Gantt (Frames 05-06) ---------------------------------------
const act = z.object({
  nombre: z.string().min(1), descripcion: z.string().nullish(), responsable: z.string().nullish(),
  fechaInicio: z.string(), fechaFin: z.string(),
  avance: z.number().min(0).max(100).default(0),
  estado: z.enum(["Pendiente", "En curso", "Completada", "Retrasada"]).default("Pendiente"),
  esHito: z.boolean().default(false), dependenciaId: z.number().int().nullish(),
}).refine(a => a.fechaFin >= a.fechaInicio, { message: "La fecha fin no puede ser anterior al inicio", path: ["fechaFin"] });

const SEL = `SELECT id, nombre, descripcion, responsable, fecha_inicio AS "fechaInicio", fecha_fin AS "fechaFin",
  (fecha_fin - fecha_inicio + 1) AS "duracionDias", avance, estado, es_hito AS "esHito", dependencia_id AS "dependenciaId"
  FROM actividades`;

seguimiento.get("/actividades", ah(async (req, res) => {
  const id = await idPorCodigo(pool, req.params.codigo);
  res.json((await pool.query(`${SEL} WHERE proyecto_id=$1 ORDER BY fecha_inicio, id`, [id])).rows);
}));

seguimiento.post("/actividades", ah(async (req, res) => {
  const d = act.parse(req.body);
  const row = await withTx(req, async (db) => {
    const id = await idPorCodigo(db, req.params.codigo);
    const r = await db.query(
      `INSERT INTO actividades(proyecto_id,nombre,descripcion,responsable,fecha_inicio,fecha_fin,avance,estado,es_hito,dependencia_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [id, d.nombre, d.descripcion ?? null, d.responsable ?? null, d.fechaInicio, d.fechaFin, d.avance, d.estado, d.esHito, d.dependenciaId ?? null]);
    return r.rows[0];
  });
  res.status(201).json(row);
}));

seguimiento.put("/actividades/:actId", ah(async (req, res) => {
  const d = act.parse(req.body);
  await withTx(req, async (db) => {
    const id = await idPorCodigo(db, req.params.codigo);
    const r = await db.query(
      `UPDATE actividades SET nombre=$1,descripcion=$2,responsable=$3,fecha_inicio=$4,fecha_fin=$5,avance=$6,estado=$7,es_hito=$8,dependencia_id=$9
        WHERE id=$10 AND proyecto_id=$11`,
      [d.nombre, d.descripcion ?? null, d.responsable ?? null, d.fechaInicio, d.fechaFin, d.avance, d.estado, d.esHito, d.dependenciaId ?? null, req.params.actId, id]);
    if (!r.rowCount) throw new HttpError(404, "Actividad no existe");
  });
  res.json({ ok: true });
}));

seguimiento.delete("/actividades/:actId", ah(async (req, res) => {
  await withTx(req, async (db) => {
    const id = await idPorCodigo(db, req.params.codigo);
    await db.query("DELETE FROM actividades WHERE id=$1 AND proyecto_id=$2", [req.params.actId, id]);
  });
  res.status(204).end();
}));

// ---- Presupuesto (Frame 07) -------------------------------------------------------
seguimiento.get("/presupuesto", ah(async (req, res) => {
  const id = await idPorCodigo(pool, req.params.codigo);
  const [resumen, ing, gas, con, des] = await Promise.all([
    pool.query("SELECT * FROM v_presupuesto WHERE proyecto_id=$1", [id]),
    pool.query("SELECT id,tipo,concepto,valor_total AS \"valorTotal\" FROM ficha_ingresos WHERE proyecto_id=$1 ORDER BY id", [id]),
    pool.query("SELECT id,categoria,concepto,unidad,cantidad,valor_unitario AS \"valorUnitario\",valor_total AS \"valorTotal\" FROM ficha_gastos WHERE proyecto_id=$1 ORDER BY id", [id]),
    pool.query("SELECT id,entidad,valor FROM contrapartidas WHERE proyecto_id=$1 ORDER BY id", [id]),
    pool.query("SELECT id,fecha,concepto,valor FROM desembolsos WHERE proyecto_id=$1 ORDER BY fecha", [id]),
  ]);
  res.json({ resumen: resumen.rows[0], ingresos: ing.rows, gastos: gas.rows, contrapartidas: con.rows, desembolsos: des.rows });
}));

seguimiento.post("/contrapartidas", ah(async (req, res) => {
  const d = z.object({ entidad: z.string().min(1), valor: z.number().min(0) }).parse(req.body);
  const out = await withTx(req, async (db) => {
    const id = await idPorCodigo(db, req.params.codigo);
    await db.query("INSERT INTO contrapartidas(proyecto_id,entidad,valor) VALUES ($1,$2,$3)", [id, d.entidad, d.valor]);
    return (await db.query("SELECT * FROM v_presupuesto WHERE proyecto_id=$1", [id])).rows[0];   // totales recalculados
  });
  res.status(201).json(out);
}));

seguimiento.post("/desembolsos", ah(async (req, res) => {
  const d = z.object({ fecha: z.string(), concepto: z.string().min(1), valor: z.number().positive() }).parse(req.body);
  const out = await withTx(req, async (db) => {
    const id = await idPorCodigo(db, req.params.codigo);
    await db.query("INSERT INTO desembolsos(proyecto_id,fecha,concepto,valor) VALUES ($1,$2,$3,$4)", [id, d.fecha, d.concepto, d.valor]);
    return (await db.query("SELECT * FROM v_presupuesto WHERE proyecto_id=$1", [id])).rows[0];
  });
  res.status(201).json(out);
}));

// ---- Antecedentes (Frame 03): se asocia por RELACIÓN, no se copian archivos ------------
seguimiento.get("/antecedentes", ah(async (req, res) => {
  const id = await idPorCodigo(pool, req.params.codigo);
  res.json((await pool.query(
    `SELECT a.codigo, a.nombre, a.anio, a.tipo_documento AS tipo, a.nivel_estructuracion AS nivel, pa.asociado_en AS "asociadoEn"
       FROM proyecto_antecedentes pa JOIN antecedentes a ON a.id = pa.antecedente_id WHERE pa.proyecto_id=$1 ORDER BY a.anio DESC`, [id])).rows);
}));

seguimiento.post("/antecedentes", ah(async (req, res) => {
  const { antecedente } = z.object({ antecedente: z.string().min(1) }).parse(req.body);   // código, p. ej. PRY-2024-008
  await withTx(req, async (db) => {
    const id = await idPorCodigo(db, req.params.codigo);
    const a = await db.query("SELECT id FROM antecedentes WHERE codigo=$1", [antecedente]);
    if (!a.rowCount) throw new HttpError(404, "Antecedente no existe");
    await db.query("INSERT INTO proyecto_antecedentes(proyecto_id,antecedente_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [id, a.rows[0].id]);
  });
  res.status(201).json({ mensaje: "Antecedente asociado correctamente." });
}));

// ---- Auditoría (Frame 11): vive DENTRO del proyecto -------------------------------------
seguimiento.get("/auditoria", ah(async (req, res) => {
  const id = await idPorCodigo(pool, req.params.codigo);
  res.json((await pool.query(
    `SELECT fecha, usuario, accion, entidad, registro, valor_anterior AS "valorAnterior", valor_nuevo AS "valorNuevo"
       FROM auditoria WHERE proyecto_id=$1 ORDER BY fecha DESC LIMIT 200`, [id])).rows);
}));

// ---- Documentos (Frame 12) e Informes (Frame 13) -----------------------------------------
seguimiento.get("/documentos", ah(async (req, res) => {
  const id = await idPorCodigo(pool, req.params.codigo);
  res.json((await pool.query(
    `SELECT d.id, d.categoria, d.nombre, d.estado, v.version, v.subido_por AS "subidoPor", v.subido_en AS "subidoEn"
       FROM documentos d LEFT JOIN LATERAL (SELECT * FROM documento_versiones WHERE documento_id=d.id ORDER BY version DESC LIMIT 1) v ON true
      WHERE d.proyecto_id=$1 ORDER BY d.categoria, d.nombre`, [id])).rows);
}));

// "Los informes usan los datos más recientes al momento de generar": se guarda una foto en JSON.
seguimiento.post("/informes", ah(async (req, res) => {
  const d = z.object({ tipo: z.enum(["Diario", "Semanal", "Proyecto"]), desde: z.string().nullish(), hasta: z.string().nullish() }).parse(req.body);
  const out = await withTx(req, async (db) => {
    const id = await idPorCodigo(db, req.params.codigo);
    const [kpi, act, ind, pres] = await Promise.all([
      db.query("SELECT * FROM v_kpis_proyecto WHERE proyecto_id=$1", [id]),
      db.query("SELECT nombre,estado,avance,fecha_fin FROM actividades WHERE proyecto_id=$1 ORDER BY fecha_inicio", [id]),
      db.query("SELECT indicador,meta,resultado,estado FROM indicadores WHERE proyecto_id=$1", [id]),
      db.query("SELECT * FROM v_presupuesto WHERE proyecto_id=$1", [id]),
    ]);
    const datos = { kpis: kpi.rows[0], actividades: act.rows, indicadores: ind.rows, presupuesto: pres.rows[0], generadoEn: new Date().toISOString() };
    const r = await db.query(
      `INSERT INTO informes(proyecto_id,tipo,periodo_desde,periodo_hasta,datos,generado_por)
       VALUES ($1,$2,$3,$4,$5,current_setting('app.usuario')) RETURNING id, generado_en AS "generadoEn"`,
      [id, d.tipo, d.desde ?? null, d.hasta ?? null, datos]);
    return { ...r.rows[0], datos };
  });
  res.status(201).json(out);   // El PDF/Word se genera a partir de 'datos' (ver docs/GUIA_BACKEND.md, paso 7)
}));
