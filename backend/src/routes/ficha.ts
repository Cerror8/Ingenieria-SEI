import { Router } from "express";
import { pool, withTx } from "../db.js";
import { ah } from "../http.js";
import { idPorCodigo } from "./proyectos.js";

// Ficha técnica FR-019 (Frame 02). Cada sección de lista se reemplaza completa
// (delete + insert) dentro de una transacción: el formulario envía su estado actual.
export const ficha = Router({ mergeParams: true });

type Col = [json: string, sql: string];
const LISTAS: Record<string, { tabla: string; cols: Col[]; orden: string }> = {
  objetivos:    { tabla: "ficha_objetivos", orden: "orden", cols: [["descripcion","descripcion"],["orden","orden"]] },
  riesgos:      { tabla: "ficha_riesgos", orden: "id", cols: [["riesgo","riesgo"],["probabilidad","probabilidad"],["consecuencia","consecuencia"],["planMitigacion","plan_mitigacion"]] },
  cobertura:    { tabla: "ficha_cobertura", orden: "id", cols: [["pais","pais"],["departamento","departamento"],["municipio","municipio"]] },
  poblacion:    { tabla: "ficha_poblacion", orden: "id", cols: [["categoria","categoria"],["cantidad","cantidad"]] },
  enfoquesDiferenciales: { tabla: "ficha_enfoques_diferenciales", orden: "id", cols: [["tipo","tipo"],["descripcion","descripcion"]] },
  gruposInteres:{ tabla: "ficha_grupos_interes", orden: "id", cols: [["tipo","tipo"],["descripcion","descripcion"]] },
  indicadores:  { tabla: "indicadores", orden: "id", cols: [["actividad","actividad"],["indicador","indicador"],["meta","meta"],["resultado","resultado"],["unidad","unidad"],["tiempoEstimado","tiempo_estimado"],["responsable","responsable"],["estado","estado"],["fechaLimite","fecha_limite"]] },
  ingresos:     { tabla: "ficha_ingresos", orden: "id", cols: [["tipo","tipo"],["concepto","concepto"],["valorTotal","valor_total"]] },
  gastos:       { tabla: "ficha_gastos", orden: "id", cols: [["categoria","categoria"],["concepto","concepto"],["unidad","unidad"],["cantidad","cantidad"],["valorUnitario","valor_unitario"]] },
  aprobaciones: { tabla: "ficha_aprobaciones", orden: "id", cols: [["rolAprobador","rol_aprobador"],["nombre","nombre"],["fecha","fecha"],["estadoFirma","estado_firma"]] },
};

ficha.get("/", ah(async (req, res) => {
  const id = await idPorCodigo(pool, req.params.codigo);
  const out: Record<string, unknown> = {};
  const t = await pool.query("SELECT enfoque, problema, justificacion, sostenibilidad FROM ficha_fr019 WHERE proyecto_id=$1", [id]);
  Object.assign(out, t.rows[0] ?? {});
  out.ods = (await pool.query("SELECT ods_id FROM ficha_ods WHERE proyecto_id=$1 ORDER BY 1", [id])).rows.map(r => r.ods_id);
  for (const [k, c] of Object.entries(LISTAS)) {
    const sel = c.cols.map(([j, s]) => `${s} AS "${j}"`).join(", ");
    out[k] = (await pool.query(`SELECT id, ${sel} FROM ${c.tabla} WHERE proyecto_id=$1 ORDER BY ${c.orden}`, [id])).rows;
  }
  const comps = await pool.query("SELECT id, nombre, descripcion, resultado_esperado AS \"resultadoEsperado\" FROM ficha_componentes WHERE proyecto_id=$1 ORDER BY orden, id", [id]);
  for (const c of comps.rows)
    c.actividades = (await pool.query("SELECT descripcion FROM ficha_componente_actividades WHERE componente_id=$1 ORDER BY id", [c.id])).rows.map(r => r.descripcion);
  out.componentes = comps.rows;
  const pct = await pool.query(
    `SELECT (  (enfoque IS NOT NULL AND enfoque<>'')::int + (problema IS NOT NULL AND problema<>'')::int
             + (justificacion IS NOT NULL AND justificacion<>'')::int + (sostenibilidad IS NOT NULL AND sostenibilidad<>'')::int) AS n
       FROM ficha_fr019 WHERE proyecto_id=$1`, [id]);
  const llenas = Object.keys(LISTAS).filter(k => (out[k] as unknown[]).length > 0).length + ((out.componentes as unknown[]).length ? 1 : 0) + ((out.ods as unknown[]).length ? 1 : 0);
  out.diligenciamientoPct = Math.round(100 * ((pct.rows[0]?.n ?? 0) + llenas) / (4 + Object.keys(LISTAS).length + 2));
  res.json(out);
}));

// PUT parcial: solo se tocan las secciones presentes en el cuerpo ("Guardar sección").
ficha.put("/", ah(async (req, res) => {
  const b = req.body as Record<string, any>;
  await withTx(req, async (db) => {
    const id = await idPorCodigo(db, req.params.codigo);
    const textos = ["enfoque", "problema", "justificacion", "sostenibilidad"].filter(k => k in b);
    if (textos.length) {
      await db.query(
        `INSERT INTO ficha_fr019(proyecto_id, ${textos.join(",")}) VALUES ($1, ${textos.map((_, i) => `$${i + 2}`).join(",")})
         ON CONFLICT (proyecto_id) DO UPDATE SET ${textos.map(k => `${k}=EXCLUDED.${k}`).join(",")}`,
        [id, ...textos.map(k => b[k])]);
    }
    if (Array.isArray(b.ods)) {
      await db.query("DELETE FROM ficha_ods WHERE proyecto_id=$1", [id]);
      for (const n of b.ods) await db.query("INSERT INTO ficha_ods VALUES ($1,$2)", [id, n]);
    }
    for (const [k, c] of Object.entries(LISTAS)) {
      if (!Array.isArray(b[k])) continue;
      await db.query(`DELETE FROM ${c.tabla} WHERE proyecto_id=$1`, [id]);
      for (const it of b[k]) {
        const cols = c.cols.map(([, s]) => s);
        await db.query(`INSERT INTO ${c.tabla}(proyecto_id, ${cols.join(",")}) VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(",")})`,
          [id, ...c.cols.map(([j]) => it[j] === "" ? null : it[j] ?? null)]);
      }
    }
    if (Array.isArray(b.componentes)) {
      await db.query("DELETE FROM ficha_componentes WHERE proyecto_id=$1", [id]);
      let orden = 1;
      for (const c of b.componentes) {
        const r = await db.query("INSERT INTO ficha_componentes(proyecto_id,nombre,descripcion,resultado_esperado,orden) VALUES ($1,$2,$3,$4,$5) RETURNING id",
          [id, c.nombre, c.descripcion ?? null, c.resultadoEsperado ?? null, orden++]);
        for (const a of c.actividades ?? [])
          await db.query("INSERT INTO ficha_componente_actividades(componente_id,descripcion) VALUES ($1,$2)", [r.rows[0].id, a]);
      }
    }
  });
  res.json({ ok: true, guardadoEn: new Date().toISOString() });
}));
