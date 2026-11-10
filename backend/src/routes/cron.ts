import crypto from "node:crypto";
import { Router } from "express";
import { pool } from "../db.js";
import { ah } from "../http.js";
import { avisarRecordatorios, correoConfigurado, type RecordatorioTarea } from "../lib/correo.js";
import { almacenDeRespaldos, crearRespaldo } from "../lib/respaldo.js";

export const cron = Router();

function autorizado(authorization: string | undefined): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;

  const esperado = Buffer.from(`Bearer ${secreto}`);
  const recibido = Buffer.from(authorization ?? "");
  return recibido.length === esperado.length && crypto.timingSafeEqual(recibido, esperado);
}

type FilaRecordatorio = RecordatorioTarea & {
  usuarioId: string;
  email: string;
  nombre: string;
};

cron.get(
  "/recordatorios",
  ah(async (req, res) => {
    if (!autorizado(req.get("authorization"))) {
      res.status(401).json({ error: "No autorizado" });
      return;
    }

    if (!correoConfigurado()) {
      res.status(503).json({ error: "El envío de correo no está configurado." });
      return;
    }

    const { rows } = await pool.query<FilaRecordatorio>(
      `SELECT t.responsable_id AS "usuarioId",
              lower(u.email) AS email,
              u.nombre,
              t.titulo,
              b.nombre AS tablero,
              p.nombre AS proyecto,
              t.fecha_limite AS "fechaLimite",
              (t.fecha_limite - (now() AT TIME ZONE 'America/Bogota')::date)::int AS "diasRestantes",
              t.prioridad
         FROM tareas_tablero t
         JOIN usuarios u ON u.id = t.responsable_id
         JOIN tableros b ON b.id = t.tablero_id
         LEFT JOIN proyectos p ON p.id = t.proyecto_id
        WHERE t.responsable_id IS NOT NULL
          AND t.fecha_limite IS NOT NULL
          AND t.columna <> 'completado'
          AND u.activo = true
          AND t.fecha_limite <= (now() AT TIME ZONE 'America/Bogota')::date + 7
        ORDER BY u.nombre, t.fecha_limite, t.titulo`,
    );

    const grupos = new Map<string, { nombre: string; email: string; tareas: RecordatorioTarea[] }>();
    for (const fila of rows) {
      const grupo = grupos.get(fila.email) ?? {
        nombre: fila.nombre,
        email: fila.email,
        tareas: [],
      };
      grupo.tareas.push({
        titulo: fila.titulo,
        tablero: fila.tablero,
        proyecto: fila.proyecto,
        fechaLimite: fila.fechaLimite,
        diasRestantes: fila.diasRestantes,
        prioridad: fila.prioridad,
      });
      grupos.set(fila.email, grupo);
    }

    const enviados = await avisarRecordatorios([...grupos.values()]);
    console.log(
      `[cron] recordatorios · ${rows.length} tareas · ${grupos.size} personas · ${enviados} correos`,
    );
    res.json({ ok: true, tareas: rows.length, personas: grupos.size, correosEnviados: enviados });
  }),
);

cron.get(
  "/respaldo",
  ah(async (req, res) => {
    if (!autorizado(req.get("authorization"))) {
      res.status(401).json({ error: "No autorizado" });
      return;
    }

    if (!almacenDeRespaldos()) {
      res.status(503).json({ error: "El almacenamiento en Blob no está configurado." });
      return;
    }

    const resultado = await crearRespaldo();
    res.json({ ok: true, ...resultado });
  }),
);
