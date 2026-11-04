import { Router } from "express";
import { z } from "zod";
import { pool, withTx, type Db } from "../db.js";
import { ah, HttpError } from "../http.js";

export const proyectos = Router();

export async function idPorCodigo(db: { query: Db["query"] }, codigo: string): Promise<number> {
  const r = await db.query("SELECT id FROM proyectos WHERE codigo = $1", [codigo]);
  if (!r.rowCount) throw new HttpError(404, `Proyecto ${codigo} no existe`);
  return r.rows[0].id;
}

// ---- Frame 01: validaciones -------------------------------------------------
const base = z.object({
  codigo: z.string().trim().min(1, "El código es obligatorio"),
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  lineaId: z.number({ required_error: "La línea es obligatoria" }).int(),
  estado: z.enum(["Estructuración", "En formulación", "En ejecución", "Suspendido", "Finalizado", "Cerrado"],
    { required_error: "El estado es obligatorio" }),
  dependenciaId: z.number().int().nullish(),
  gestionPmo: z.string().nullish(),
  fechaGestion: z.string().nullish(),
  responsable: z.string().nullish(),
  objetivoGeneral: z.string().nullish(),
  valorTotal: z.number().min(0).default(0),
  valorSupervision: z.number().min(0).default(0),
  fechaInicio: z.string().nullish(),
  fechaFin: z.string().nullish(),
});

// ---- Listado (Frame: Proyectos) ----------------------------------------------
proyectos.get("/", ah(async (req, res) => {
  const { q, estado, lineaId } = req.query as Record<string, string | undefined>;
  const r = await pool.query(
    `SELECT p.codigo, p.nombre, l.nombre AS linea, p.estado, p.responsable, p.valor_total,
            p.avance_tecnico, k.avance_presupuestal, p.fecha_fin, p.actualizado_en
       FROM proyectos p
       JOIN lineas_investigacion l ON l.id = p.linea_id
       JOIN v_kpis_proyecto k ON k.proyecto_id = p.id
      WHERE ($1::text IS NULL OR p.codigo ILIKE '%'||$1||'%' OR p.nombre ILIKE '%'||$1||'%')
        AND ($2::text IS NULL OR p.estado = $2)
        AND ($3::int  IS NULL OR p.linea_id = $3)
      ORDER BY p.codigo DESC`,
    [q ?? null, estado ?? null, lineaId ? Number(lineaId) : null]);
  res.json(r.rows);
}));

// ---- Crear (Frame 01 → Frame 09) --------------------------------------------
proyectos.post("/", ah(async (req, res) => {
  const d = base.parse(req.body);
  const row = await withTx(req, async (db) => {
    const r = await db.query(
      `INSERT INTO proyectos(codigo,nombre,linea_id,estado,dependencia_id,gestion_pmo,fecha_gestion,
                             responsable,objetivo_general,valor_total,valor_supervision,fecha_inicio,fecha_fin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING codigo, nombre, estado`,
      [d.codigo, d.nombre, d.lineaId, d.estado, d.dependenciaId ?? null, d.gestionPmo ?? null,
       d.fechaGestion ?? null, d.responsable ?? null, d.objetivoGeneral ?? null, d.valorTotal,
       d.valorSupervision, d.fechaInicio ?? null, d.fechaFin ?? null]);
    await db.query("INSERT INTO ficha_fr019(proyecto_id) SELECT id FROM proyectos WHERE codigo=$1", [d.codigo]);
    return r.rows[0];
  });
  res.status(201).json(row);
}));

// Validación de unicidad en vivo (mensaje bajo el campo "Código")
proyectos.get("/validar-codigo/:codigo", ah(async (req, res) => {
  const r = await pool.query("SELECT 1 FROM proyectos WHERE codigo = $1", [req.params.codigo]);
  res.json({ disponible: r.rowCount === 0 });
}));

// ---- Detalle y edición (Frame 10: NO reinicia el formulario) -----------------
proyectos.get("/:codigo", ah(async (req, res) => {
  const r = await pool.query(
    `SELECT p.*, l.nombre AS linea, d.nombre AS dependencia
       FROM proyectos p JOIN lineas_investigacion l ON l.id = p.linea_id
       LEFT JOIN dependencias d ON d.id = p.dependencia_id WHERE p.codigo = $1`, [req.params.codigo]);
  if (!r.rowCount) throw new HttpError(404, "Proyecto no existe");
  res.json(r.rows[0]);
}));

proyectos.put("/:codigo", ah(async (req, res) => {
  const d = base.partial().parse(req.body);
  const out = await withTx(req, async (db) => {
    const id = await idPorCodigo(db, req.params.codigo);
    const map: Record<string, string> = {
      codigo: "codigo", nombre: "nombre", lineaId: "linea_id", estado: "estado", dependenciaId: "dependencia_id",
      gestionPmo: "gestion_pmo", fechaGestion: "fecha_gestion", responsable: "responsable",
      objetivoGeneral: "objetivo_general", valorTotal: "valor_total", valorSupervision: "valor_supervision",
      fechaInicio: "fecha_inicio", fechaFin: "fecha_fin" };
    const sets: string[] = []; const vals: unknown[] = [];
    for (const [k, col] of Object.entries(map)) if (k in d) { vals.push((d as any)[k] ?? null); sets.push(`${col}=$${vals.length}`); }
    if (!sets.length) throw new HttpError(400, "Nada para actualizar");
    vals.push(id);
    const r = await db.query(`UPDATE proyectos SET ${sets.join(",")} WHERE id=$${vals.length} RETURNING codigo, actualizado_en`, vals);
    return r.rows[0];
  });
  res.json(out);   // el cliente muestra "Proyecto actualizado correctamente." y refresca KPIs
}));

// ---- Dashboard individual (Frames 14-15) ------------------------------------
proyectos.get("/:codigo/dashboard", ah(async (req, res) => {
  const id = await idPorCodigo(pool, req.params.codigo);
  const [kpi, ind, act, pres] = await Promise.all([
    pool.query("SELECT * FROM v_kpis_proyecto WHERE proyecto_id=$1", [id]),
    pool.query("SELECT estado, COUNT(*)::int AS total FROM indicadores WHERE proyecto_id=$1 GROUP BY estado", [id]),
    pool.query(`SELECT id, nombre, es_hito, fecha_inicio, fecha_fin, avance, estado
                  FROM actividades WHERE proyecto_id=$1 ORDER BY fecha_inicio`, [id]),
    pool.query("SELECT * FROM v_presupuesto WHERE proyecto_id=$1", [id]),
  ]);
  res.json({ kpis: kpi.rows[0], indicadoresPorEstado: ind.rows, ganttResumido: act.rows,
             presupuesto: pres.rows[0], generadoEn: new Date().toISOString() });
}));

// ---- Dashboard general ---------------------------------------------------------
proyectos.get("/_global/resumen", ah(async (_req, res) => {
  const [tot, estados, lineas] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total,
                       ROUND(AVG(avance_tecnico),1) AS avance_promedio FROM proyectos`),
    pool.query("SELECT estado, COUNT(*)::int AS total FROM proyectos GROUP BY estado"),
    pool.query(`SELECT l.nombre AS linea, COUNT(*)::int AS total FROM proyectos p
                  JOIN lineas_investigacion l ON l.id=p.linea_id GROUP BY 1 ORDER BY 2 DESC`),
  ]);
  res.json({ ...tot.rows[0], porEstado: estados.rows, porLinea: lineas.rows });
}));

// ---- Seguimiento: avance técnico (Frame 04) ---------------------------------
proyectos.post("/:codigo/avance", ah(async (req, res) => {
  const d = z.object({ porcentaje: z.number().min(0).max(100), descripcion: z.string().default("") }).parse(req.body);
  const out = await withTx(req, async (db) => {
    const id = await idPorCodigo(db, req.params.codigo);
    await db.query("INSERT INTO avance_historial(proyecto_id,porcentaje,descripcion,usuario) VALUES ($1,$2,$3,current_setting('app.usuario'))",
      [id, d.porcentaje, d.descripcion]);
    const r = await db.query("UPDATE proyectos SET avance_tecnico=$1 WHERE id=$2 RETURNING avance_tecnico, actualizado_en", [d.porcentaje, id]);
    return r.rows[0];
  });
  res.json(out);
}));
