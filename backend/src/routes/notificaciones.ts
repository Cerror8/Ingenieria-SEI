import { Router } from "express";
import { pool } from "../db.js";
import { ah } from "../http.js";

export const notificaciones = Router();

notificaciones.get(
  "/",
  ah(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT ta.id,
              ta.titulo,
              ta.prioridad,
              ta.columna,
              ta.fecha_limite AS "fechaLimite",
              tb.id AS "tableroId",
              tb.nombre AS tablero,
              (ta.fecha_limite - CURRENT_DATE) AS "diasRestantes"
         FROM tareas_tablero ta
         JOIN tableros tb ON tb.id = ta.tablero_id
        WHERE ta.fecha_limite IS NOT NULL
          AND ta.columna <> 'completado'
          AND ta.fecha_limite <= CURRENT_DATE + 7
        ORDER BY ta.fecha_limite,
                 CASE ta.prioridad WHEN 'Alta' THEN 1 WHEN 'Media' THEN 2 ELSE 3 END`,
    );

    res.json({ notificaciones: rows, total: rows.length });
  }),
);
