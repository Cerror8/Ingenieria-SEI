import { Router } from "express";
import { z } from "zod";
import { registrarAuditoria } from "../audit.js";
import type { UsuarioSesion } from "../auth/session.js";
import { pool } from "../db.js";
import { ah, HttpError } from "../http.js";

export const contactos = Router();

const CAMPOS = `
  id, nombre, email, organizacion, activo,
  creado_por AS "creadoPor", creado_en AS "creadoEn"
`;

const contactoSchema = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre del contacto").max(120),
  email: z.string().trim().toLowerCase().email("El correo no es válido").max(180),
  organizacion: z.string().trim().max(160).optional().default(""),
});

const actualizacionSchema = contactoSchema.partial().extend({
  activo: z.boolean().optional(),
});

contactos.get(
  "/",
  ah(async (req, res) => {
    const busca = typeof req.query.buscar === "string" ? req.query.buscar.trim() : "";
    const { rows } = await pool.query(
      `SELECT ${CAMPOS}
         FROM contactos_externos
        WHERE ($1 = '' OR nombre ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%'
               OR organizacion ILIKE '%' || $1 || '%')
        ORDER BY activo DESC, nombre`,
      [busca],
    );
    res.json({ contactos: rows });
  }),
);

contactos.post(
  "/",
  ah(async (req, res) => {
    const datos = contactoSchema.parse(req.body);
    const usuario = res.locals.usuario as UsuarioSesion;

    const { rows: existente } = await pool.query(
      "SELECT 1 FROM contactos_externos WHERE lower(email) = $1",
      [datos.email],
    );
    if (existente[0]) {
      throw new HttpError(400, "Ya existe un contacto externo con ese correo.");
    }

    const { rows } = await pool.query(
      `INSERT INTO contactos_externos (nombre, email, organizacion, creado_por)
       VALUES ($1, $2, $3, $4)
       RETURNING ${CAMPOS}`,
      [datos.nombre, datos.email, datos.organizacion, usuario.nombre],
    );

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Creación",
      entidad: "Contacto externo",
      registro: datos.email,
      nuevo: datos.nombre,
    });

    res.status(201).json({ contacto: rows[0] });
  }),
);

contactos.patch(
  "/:id",
  ah(async (req, res) => {
    const id = z.string().uuid("Contacto inválido").parse(req.params.id);
    const datos = actualizacionSchema.parse(req.body);
    const usuario = res.locals.usuario as UsuarioSesion;

    const { rows: actual } = await pool.query<{ nombre: string; email: string }>(
      "SELECT nombre, email FROM contactos_externos WHERE id = $1",
      [id],
    );
    if (!actual[0]) throw new HttpError(404, "Contacto externo no encontrado");

    if (datos.email && datos.email !== actual[0].email) {
      const { rows: existente } = await pool.query(
        "SELECT 1 FROM contactos_externos WHERE lower(email) = $1 AND id <> $2",
        [datos.email, id],
      );
      if (existente[0]) throw new HttpError(400, "Ya existe un contacto externo con ese correo.");
    }

    const { rows } = await pool.query(
      `UPDATE contactos_externos
          SET nombre = COALESCE($2, nombre),
              email = COALESCE($3, email),
              organizacion = COALESCE($4, organizacion),
              activo = COALESCE($5, activo),
              actualizado_en = now()
        WHERE id = $1
        RETURNING ${CAMPOS}`,
      [id, datos.nombre, datos.email, datos.organizacion, datos.activo],
    );

    await pool.query(
      `UPDATE edt_actividades
          SET responsable = $2
        WHERE contacto_externo_id = $1 AND $2 IS NOT NULL`,
      [id, datos.nombre ?? null],
    );

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Actualización",
      entidad: "Contacto externo",
      registro: rows[0]?.email ?? actual[0].email,
      previo: actual[0].nombre,
      nuevo: rows[0]?.nombre ?? actual[0].nombre,
    });

    res.json({ contacto: rows[0] });
  }),
);
