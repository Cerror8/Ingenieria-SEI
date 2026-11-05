import { Router } from "express";
import { pool } from "../db.js";
import { ah } from "../http.js";
import { CAMPOS_INDICADOR, CAMPOS_PROYECTO } from "./proyectos.js";

export const dashboard = Router();

dashboard.get(
  "/",
  ah(async (_req, res) => {
    const [
      { rows: kpi },
      { rows: estados },
      { rows: avances },
      { rows: lineas },
      { rows: proximos },
      { rows: alertas },
      { rows: periodo },
      { rows: presupuestos },
    ] = await Promise.all([
        pool.query<{
          total: number;
          activos: number;
          finalizados: number;
          retrasados: number;
          avancePromedio: number;
          ejecucionPromedio: number;
          lineasActivas: number;
        }>(
          `SELECT
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE estado = 'En ejecución')::int AS activos,
             COUNT(*) FILTER (WHERE estado = 'Finalizado')::int AS finalizados,
             COUNT(*) FILTER (WHERE estado NOT IN ('Finalizado', 'Cerrado') AND dias_restantes <= 30)::int AS retrasados,
             COALESCE(ROUND(AVG(avance)), 0)::int AS "avancePromedio",
             COALESCE(ROUND(AVG(ejecucion_pct)), 0)::int AS "ejecucionPromedio",
             COUNT(DISTINCT linea) FILTER (WHERE estado IN ('En ejecución', 'En formulación'))::int AS "lineasActivas"
           FROM proyectos`,
        ),
        pool.query<{ nombre: string; total: number }>(
          `SELECT e.estado AS nombre, COALESCE(c.total, 0)::int AS total
             FROM (VALUES
               ('En formulación'), ('En ejecución'), ('Suspendido'), ('Finalizado'), ('Cerrado')
             ) AS e(estado)
             LEFT JOIN (SELECT estado, COUNT(*) AS total FROM proyectos GROUP BY estado) c USING (estado)
            ORDER BY array_position(ARRAY['En formulación','En ejecución','Suspendido','Finalizado','Cerrado']::text[], e.estado)`,
        ),
        pool.query<{ id: string; nombre: string; avance: number }>(
          `SELECT id, nombre, avance
             FROM proyectos
            WHERE estado IN ('En ejecución', 'En formulación')
            ORDER BY dias_restantes, id
            LIMIT 6`,
        ),
        pool.query<{ nombre: string; total: number }>(
          `SELECT linea AS nombre, COUNT(*)::int AS total
             FROM proyectos
            GROUP BY linea
            ORDER BY total DESC, linea`,
        ),
        pool.query(
          `SELECT ${CAMPOS_PROYECTO}
             FROM proyectos
            WHERE estado = 'En ejecución'
            ORDER BY dias_restantes, id
            LIMIT 3`,
        ),
        pool.query(
          `SELECT ${CAMPOS_INDICADOR}
             FROM indicadores
            WHERE estado NOT IN ('Cumplido', 'Pendiente')
            ORDER BY cumplimiento, id`,
        ),
        pool.query<{ desde: number; hasta: number }>(
          `SELECT COALESCE(EXTRACT(YEAR FROM MIN(fecha_inicio))::int, EXTRACT(YEAR FROM CURRENT_DATE)::int) AS desde,
                  COALESCE(EXTRACT(YEAR FROM MAX(fecha_fin))::int, EXTRACT(YEAR FROM CURRENT_DATE)::int) AS hasta
             FROM proyectos`,
        ),
        pool.query<{ id: string; nombre: string; presupuesto: number; ejecucionPct: number }>(
          `SELECT id, nombre, presupuesto, ejecucion_pct AS "ejecucionPct"
             FROM proyectos
            ORDER BY presupuesto DESC, id
            LIMIT 8`,
        ),
      ]);

    res.json({
      kpis: kpi[0],
      estados,
      avances,
      lineas,
      proximos,
      alertas,
      periodo: periodo[0],
      presupuestos,
    });
  }),
);
