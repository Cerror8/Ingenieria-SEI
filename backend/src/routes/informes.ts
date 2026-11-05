import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { ah } from "../http.js";
import type { UsuarioSesion } from "../auth/session.js";

const CAMPOS_INFORME = `
  id, fecha, tipo, periodo, proyecto, generado_por AS "generadoPor", formato
`;

const informeSchema = z.object({
  tipo: z.string().trim().min(1).max(80),
  periodo: z.string().trim().min(1).max(80),
  proyecto: z.string().trim().max(60).optional().default("Todos"),
  formato: z.enum(["PDF", "Word"]).optional().default("PDF"),
});

export const informes = Router();

informes.get(
  "/",
  ah(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT ${CAMPOS_INFORME} FROM informes ORDER BY fecha DESC, id DESC`,
    );
    res.json({ informes: rows });
  }),
);

informes.post(
  "/",
  ah(async (req, res) => {
    const datos = informeSchema.parse(req.body);
    const usuario = res.locals.usuario as UsuarioSesion;

    const { rows } = await pool.query<{ id: string }>(
      `SELECT 'RPT-' || lpad((COUNT(*) + 1)::text, 3, '0') AS id FROM informes`,
    );

    const { rows: creados } = await pool.query(
      `INSERT INTO informes (id, fecha, tipo, periodo, proyecto, generado_por, formato)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6)
       RETURNING ${CAMPOS_INFORME}`,
      [rows[0].id, datos.tipo, datos.periodo, datos.proyecto, usuario.nombre, datos.formato],
    );

    res.status(201).json({ informe: creados[0] });
  }),
);
