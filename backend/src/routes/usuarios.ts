import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { requireAdmin, type UsuarioSesion } from "../auth/session.js";
import { registrarAuditoria } from "../audit.js";
import { pool } from "../db.js";
import { ah, HttpError } from "../http.js";

const ROLES = ["admin", "docente", "estudiante", "usuario"] as const;

const crearSchema = z.object({
  email: z.string().trim().email("Correo inválido").max(160),
  nombre: z.string().trim().min(2, "El nombre es obligatorio").max(120),
  rol: z.enum(ROLES).optional().default("usuario"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72),
});

const actualizarSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre es obligatorio").max(120).optional(),
  rol: z.enum(ROLES).optional(),
  activo: z.boolean().optional(),
});

const CAMPOS_USUARIO = `
  u.id, u.email, u.nombre, u.foto_url AS "fotoUrl", u.proveedor, u.rol, u.activo,
  u.ultimo_acceso AS "ultimoAcceso", u.creado_en AS "creadoEn"
`;

type UsuarioFila = {
  id: string;
  email: string;
  nombre: string;
  fotoUrl: string | null;
  proveedor: string;
  rol: string;
  activo: boolean;
};

export const usuarios = Router();

// Cualquier sesión activa puede consultar a quién asignar tareas.
usuarios.get(
  "/asignables",
  ah(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT id, nombre, foto_url AS "fotoUrl", rol
         FROM usuarios
        WHERE activo = true
        ORDER BY nombre`,
    );
    res.json({ usuarios: rows });
  }),
);

usuarios.use(requireAdmin);

usuarios.get(
  "/",
  ah(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT ${CAMPOS_USUARIO},
              COUNT(t.id)::int AS "tareasAsignadas",
              COUNT(t.id) FILTER (WHERE t.columna = 'completado')::int AS "tareasCompletadas"
         FROM usuarios u
         LEFT JOIN tareas_tablero t ON t.responsable_id = u.id
        GROUP BY u.id
        ORDER BY u.rol, u.nombre`,
    );
    res.json({ usuarios: rows });
  }),
);

usuarios.post(
  "/",
  ah(async (req, res) => {
    const datos = crearSchema.parse(req.body);
    const actor = res.locals.usuario as UsuarioSesion;
    const email = datos.email.toLowerCase();
    const passwordHash = await bcrypt.hash(datos.password, 12);

    const { rows } = await pool.query<UsuarioFila>(
      `INSERT INTO usuarios (email, nombre, proveedor, password_hash, rol)
       VALUES ($1, $2, 'local', $3, $4)
       RETURNING id, email, nombre, foto_url AS "fotoUrl", proveedor, rol, activo,
                 ultimo_acceso AS "ultimoAcceso", creado_en AS "creadoEn"`,
      [email, datos.nombre, passwordHash, datos.rol],
    ).catch((e: { code?: string }) => {
      if (e.code === "23505") throw new HttpError(409, "Ya existe un usuario con ese correo.");
      throw e;
    });

    await registrarAuditoria({
      usuario: actor.nombre,
      accion: "Creación",
      entidad: "Usuario",
      registro: datos.nombre,
      nuevo: `Correo: ${email} · Rol: ${datos.rol}`,
    });

    res.status(201).json({ usuario: { ...rows[0], tareasAsignadas: 0, tareasCompletadas: 0 } });
  }),
);

usuarios.patch(
  "/:id",
  ah(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const datos = actualizarSchema.parse(req.body);
    const actor = res.locals.usuario as UsuarioSesion;

    const { rows: actuales } = await pool.query<UsuarioFila>(
      `SELECT id, email, nombre, foto_url AS "fotoUrl", proveedor, rol, activo
         FROM usuarios WHERE id = $1`,
      [id],
    );
    const actual = actuales[0];
    if (!actual) throw new HttpError(404, "Usuario no encontrado");

    if (id === actor.id && datos.activo === false) {
      throw new HttpError(400, "No puedes desactivar tu propia cuenta.");
    }
    if (id === actor.id && datos.rol && datos.rol !== "admin") {
      throw new HttpError(400, "No puedes quitarte tu propio rol de administrador.");
    }

    const dejaDeSerAdmin =
      actual.rol === "admin" &&
      actual.activo &&
      ((datos.rol !== undefined && datos.rol !== "admin") || datos.activo === false);

    if (dejaDeSerAdmin) {
      const { rows: otros } = await pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
           FROM usuarios
          WHERE rol = 'admin' AND activo = true AND id <> $1`,
        [id],
      );
      if (!otros[0]?.total) {
        throw new HttpError(400, "Debe quedar al menos un administrador activo.");
      }
    }

    const { rows } = await pool.query<UsuarioFila>(
      `UPDATE usuarios
          SET nombre = COALESCE($2, nombre),
              rol = COALESCE($3, rol),
              activo = COALESCE($4, activo)
        WHERE id = $1
        RETURNING id, email, nombre, foto_url AS "fotoUrl", proveedor, rol, activo,
                  ultimo_acceso AS "ultimoAcceso", creado_en AS "creadoEn"`,
      [id, datos.nombre ?? null, datos.rol ?? null, datos.activo ?? null],
    );

    await registrarAuditoria({
      usuario: actor.nombre,
      accion: "Actualización",
      entidad: "Usuario",
      registro: actual.nombre,
      previo: `Rol: ${actual.rol} · Activo: ${actual.activo ? "sí" : "no"}`,
      nuevo: `Rol: ${rows[0].rol} · Activo: ${rows[0].activo ? "sí" : "no"}`,
    });

    res.json({ usuario: rows[0] });
  }),
);
