import { Router } from "express";
import { pool } from "../db.js";
import { ah } from "../http.js";
import { CAMPOS_INDICADOR } from "./proyectos.js";

export const indicadores = Router();

indicadores.get(
  "/",
  ah(async (req, res) => {
    const proyectoId = typeof req.query.proyectoId === "string" ? req.query.proyectoId : null;

    const { rows } = proyectoId
      ? await pool.query(
          `SELECT ${CAMPOS_INDICADOR} FROM indicadores WHERE proyecto_id = $1 ORDER BY id`,
          [proyectoId],
        )
      : await pool.query(`SELECT ${CAMPOS_INDICADOR} FROM indicadores ORDER BY id`);

    res.json({ indicadores: rows });
  }),
);
