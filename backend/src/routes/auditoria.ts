import { Router } from "express";
import { pool } from "../db.js";
import { ah } from "../http.js";

type EntradaAuditoria = {
  fecha: string;
  usuario: string;
  accion: string;
  entidad: string;
  registro: string;
  previo: string;
  nuevo: string;
};

export const auditoria = Router();

auditoria.get(
  "/",
  ah(async (req, res) => {
    const registro = typeof req.query.registro === "string" ? req.query.registro : null;
    const limite = Math.min(Number(req.query.limite ?? 50) || 50, 200);

    const { rows } = await pool.query<EntradaAuditoria>(
      `SELECT to_char(fecha, 'DD/MM/YYYY HH24:MI') AS fecha, usuario, accion, entidad, registro,
              valor_previo AS "previo", valor_nuevo AS "nuevo"
         FROM auditoria
        ${registro ? "WHERE registro = $1" : ""}
        ORDER BY fecha DESC, id DESC
        LIMIT $${registro ? 2 : 1}`,
      registro ? [registro, limite] : [limite],
    );

    res.json({ auditoria: rows });
  }),
);
