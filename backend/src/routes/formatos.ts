import crypto from "node:crypto";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { registrarAuditoria } from "../audit.js";
import type { UsuarioSesion } from "../auth/session.js";
import { pool } from "../db.js";
import { ah, HttpError } from "../http.js";

const CAMPOS_FORMATO = `
  f.id, f.nombre, f.descripcion, f.campos, f.activo,
  f.valor_id AS "valorId", v.nombre AS "valorNombre",
  f.creado_por AS "creadoPor", f.creado_en AS "creadoEn",
  (SELECT count(*)::int FROM formatos_registros r WHERE r.formato_id = f.id) AS "totalRegistros"
`;

const formatoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  descripcion: z.string().trim().max(500).optional(),
  campos: z
    .array(z.string().trim().min(1, "El campo no puede estar vacío").max(120))
    .min(1, "Define al menos un campo")
    .max(60),
  valorId: z.string().trim().max(60).nullable().optional(),
});

const registroSchema = z.object({
  valores: z.record(z.string(), z.string().max(2000)),
});

const requiereAdmin: RequestHandler = (_req, res, next) => {
  const usuario = res.locals.usuario as UsuarioSesion;
  if (usuario.rol !== "admin") {
    next(new HttpError(403, "Solo un administrador puede gestionar los formatos"));
    return;
  }
  next();
};

export const formatos = Router();

formatos.get(
  "/",
  ah(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT ${CAMPOS_FORMATO}
         FROM formatos f
         LEFT JOIN valores_referencia v ON v.id = f.valor_id
        WHERE f.activo
        ORDER BY f.creado_en DESC, f.id`,
    );
    res.json({ formatos: rows });
  }),
);

formatos.post(
  "/",
  requiereAdmin,
  ah(async (req, res) => {
    const datos = formatoSchema.parse(req.body);
    const usuario = res.locals.usuario as UsuarioSesion;

    if (datos.valorId) {
      const existe = await pool.query("SELECT 1 FROM valores_referencia WHERE id = $1", [datos.valorId]);
      if (!existe.rowCount) throw new HttpError(404, "Valor de referencia no encontrado");
    }

    const { rows } = await pool.query(
      `INSERT INTO formatos (id, nombre, descripcion, campos, valor_id, creado_por)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       RETURNING id, nombre, descripcion, campos, activo, valor_id AS "valorId", creado_por AS "creadoPor", creado_en AS "creadoEn"`,
      [
        crypto.randomUUID(),
        datos.nombre,
        datos.descripcion ?? null,
        JSON.stringify(datos.campos),
        datos.valorId ?? null,
        usuario.nombre,
      ],
    );

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Creación",
      entidad: "Formato",
      registro: datos.nombre,
      nuevo: `${datos.campos.length} campo(s)`,
    });

    res.status(201).json({ formato: rows[0] });
  }),
);

formatos.delete(
  "/:id",
  requiereAdmin,
  ah(async (req, res) => {
    const usuario = res.locals.usuario as UsuarioSesion;
    const { rows } = await pool.query<{ nombre: string }>(
      "DELETE FROM formatos WHERE id = $1 RETURNING nombre",
      [req.params.id],
    );
    const formato = rows[0];
    if (!formato) throw new HttpError(404, "Formato no encontrado");

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Eliminación",
      entidad: "Formato",
      registro: formato.nombre,
    });

    res.json({ ok: true });
  }),
);

formatos.get(
  "/:id/registros",
  ah(async (req, res) => {
    const formato = await pool.query("SELECT id FROM formatos WHERE id = $1 AND activo", [req.params.id]);
    if (!formato.rowCount) throw new HttpError(404, "Formato no encontrado");

    const { rows } = await pool.query(
      `SELECT id, valores, diligenciado_por AS "diligenciadoPor", creado_en AS "creadoEn"
         FROM formatos_registros WHERE formato_id = $1
         ORDER BY creado_en DESC, id`,
      [req.params.id],
    );
    res.json({ registros: rows });
  }),
);

formatos.post(
  "/:id/registros",
  ah(async (req, res) => {
    const datos = registroSchema.parse(req.body);
    const usuario = res.locals.usuario as UsuarioSesion;

    const { rows: formatoRows } = await pool.query<{ campos: string[] }>(
      "SELECT campos FROM formatos WHERE id = $1 AND activo",
      [req.params.id],
    );
    const formato = formatoRows[0];
    if (!formato) throw new HttpError(404, "Formato no encontrado");

    const faltantes = formato.campos.filter((campo) => !(campo in datos.valores));
    if (faltantes.length) {
      throw new HttpError(400, `Faltan campos por diligenciar: ${faltantes.join(", ")}`);
    }

    const { rows } = await pool.query(
      `INSERT INTO formatos_registros (id, formato_id, valores, diligenciado_por)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING id, valores, diligenciado_por AS "diligenciadoPor", creado_en AS "creadoEn"`,
      [crypto.randomUUID(), req.params.id, JSON.stringify(datos.valores), usuario.nombre],
    );

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Diligenciamiento",
      entidad: "Formato",
      registro: req.params.id,
    });

    res.status(201).json({ registro: rows[0] });
  }),
);
