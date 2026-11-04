SET search_path = pmo, public;

-- Presupuesto recalculado automáticamente (Frame 07).
-- Supuesto: total = ingresos + contrapartidas; ejecutado = desembolsado.
CREATE OR REPLACE VIEW v_presupuesto AS
SELECT p.id AS proyecto_id, p.codigo, p.valor_total,
       COALESCE(i.t,0) AS ingresos, COALESCE(g.t,0) AS gastos,
       COALESCE(c.t,0) AS contrapartidas, COALESCE(d.t,0) AS desembolsado,
       COALESCE(i.t,0) + COALESCE(c.t,0) AS total_disponible_bruto,
       COALESCE(i.t,0) + COALESCE(c.t,0) - COALESCE(d.t,0) AS disponible,
       CASE WHEN COALESCE(i.t,0) + COALESCE(c.t,0) = 0 THEN 0
            ELSE ROUND(COALESCE(d.t,0) * 100.0 / (COALESCE(i.t,0) + COALESCE(c.t,0)), 2) END AS pct_ejecucion
FROM proyectos p
LEFT JOIN (SELECT proyecto_id, SUM(valor_total) t FROM ficha_ingresos GROUP BY 1) i ON i.proyecto_id = p.id
LEFT JOIN (SELECT proyecto_id, SUM(valor_total) t FROM ficha_gastos   GROUP BY 1) g ON g.proyecto_id = p.id
LEFT JOIN (SELECT proyecto_id, SUM(valor)       t FROM contrapartidas GROUP BY 1) c ON c.proyecto_id = p.id
LEFT JOIN (SELECT proyecto_id, SUM(valor)       t FROM desembolsos    GROUP BY 1) d ON d.proyecto_id = p.id;

-- KPIs por proyecto (Frames 04 y 14)
CREATE OR REPLACE VIEW v_kpis_proyecto AS
SELECT p.id AS proyecto_id, p.codigo, p.estado, p.avance_tecnico,
       b.pct_ejecucion AS avance_presupuestal,
       (SELECT COUNT(*) FROM actividades a WHERE a.proyecto_id = p.id AND NOT a.es_hito) AS actividades,
       (SELECT COUNT(*) FROM actividades a WHERE a.proyecto_id = p.id AND NOT a.es_hito AND a.estado = 'Completada') AS actividades_completadas,
       (SELECT COUNT(*) FROM actividades a WHERE a.proyecto_id = p.id AND a.es_hito) AS hitos,
       (SELECT COUNT(*) FROM documentos x WHERE x.proyecto_id = p.id AND x.categoria IN ('Informes','Evidencias')) AS entregables,
       (SELECT COUNT(*) FROM indicadores i WHERE i.proyecto_id = p.id) AS indicadores,
       COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE i.estado='Cumplido') / NULLIF(COUNT(*),0), 2)
                 FROM indicadores i WHERE i.proyecto_id = p.id), 0) AS indicadores_cumplidos_pct,
       -- Alertas: actividades retrasadas + indicadores en riesgo/no cumplidos
       (SELECT COUNT(*) FROM actividades a WHERE a.proyecto_id = p.id AND (a.estado='Retrasada'
            OR (a.estado <> 'Completada' AND a.fecha_fin < CURRENT_DATE)))
       + (SELECT COUNT(*) FROM indicadores i WHERE i.proyecto_id = p.id AND i.estado IN ('En riesgo','No cumplido')) AS alertas,
       p.actualizado_en
FROM proyectos p JOIN v_presupuesto b ON b.proyecto_id = p.id;
