import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { dominioPermitido, googleConfigurado, perfilDeGoogle, urlConsentimiento } from "../auth/google.js";
import { crearSesion, destruirSesion, usuarioDeSesion } from "../auth/session.js";
import { registrarAuditoria } from "../audit.js";
import { pool, withTx } from "../db.js";
import { ah, HttpError } from "../http.js";

const frontend = () => (process.env.FRONTEND_URL ?? "http://localhost:5173").replace(/\/$/, "");
const esProduccion = process.env.NODE_ENV === "production";

const CAMPOS_USUARIO = `
  id, email, nombre, foto_url AS "fotoUrl", proveedor, rol,
  ultimo_acceso AS "ultimoAcceso"
`;

const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." },
});

const limitadorRegistro = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes de registro. Inténtalo más tarde." },
});

const loginSchema = z.object({
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

const registroSchema = z.object({
  email: z.string().trim().email("Correo inválido").max(160),
  nombre: z.string().trim().min(2, "El nombre es obligatorio").max(120),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72),
});

const perfilSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre es obligatorio").max(120),
  fotoUrl: z
    .union([z.string().trim().url("La URL de la foto no es válida"), z.literal(""), z.null()])
    .optional(),
});

type UsuarioLogin = {
  id: string;
  email: string;
  nombre: string;
  fotoUrl: string | null;
  proveedor: "local";
  rol: "admin" | "docente" | "estudiante" | "usuario";
  passwordHash: string;
  activo: boolean;
  pendienteAprobacion: boolean;
};

export const auth = Router();

// Solicitud pública de registro con correo y contraseña.
auth.post(
  "/registro",
  limitadorRegistro,
  ah(async (req, res) => {
    const datos = registroSchema.parse(req.body);
    const email = datos.email.toLowerCase();
    const passwordHash = await bcrypt.hash(datos.password, 12);

    const { rows } = await pool.query(
      `INSERT INTO usuarios (email, nombre, proveedor, password_hash, rol, activo, pendiente_aprobacion)
       VALUES ($1, $2, 'local', $3, 'usuario', false, true)
       RETURNING id, email, nombre, creado_en AS "creadoEn"`,
      [email, datos.nombre, passwordHash],
    ).catch((e: { code?: string }) => {
      if (e.code === "23505") {
        throw new HttpError(409, "Ya existe una cuenta o solicitud con ese correo.");
      }
      throw e;
    });

    await registrarAuditoria({
      usuario: "Registro público",
      accion: "Solicitud",
      entidad: "Usuario",
      registro: datos.nombre,
      nuevo: `Correo: ${email} · Pendiente de aprobación`,
    });

    res.status(201).json({ solicitud: rows[0] });
  }),
);

// Acceso local (administradores y cuentas aprobadas).
auth.post(
  "/login",
  limitadorLogin,
  ah(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const { rows } = await pool.query<UsuarioLogin>(
      `SELECT ${CAMPOS_USUARIO}, password_hash AS "passwordHash", activo,
              pendiente_aprobacion AS "pendienteAprobacion"
         FROM usuarios
        WHERE lower(email) = lower($1) AND proveedor = 'local'`,
      [email],
    );

    const usuario = rows[0];
    if (!usuario) throw new HttpError(401, "Correo o contraseña incorrectos");

    const coincide = await bcrypt.compare(password, usuario.passwordHash);
    if (!coincide) throw new HttpError(401, "Correo o contraseña incorrectos");

    if (usuario.pendienteAprobacion) {
      throw new HttpError(403, "Tu solicitud está pendiente de aprobación por un administrador.");
    }
    if (!usuario.activo) {
      throw new HttpError(403, "Tu cuenta está inactiva. Contacta a un administrador.");
    }

    await pool.query("UPDATE usuarios SET ultimo_acceso = now() WHERE id = $1", [usuario.id]);
    await crearSesion(res, usuario.id);

    res.json({
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        fotoUrl: usuario.fotoUrl,
        proveedor: usuario.proveedor,
        rol: usuario.rol,
        ultimoAcceso: new Date().toISOString(),
      },
    });
  }),
);

// Inicio del flujo OAuth 2.0 con Google.
auth.get("/google", (_req, res) => {
  if (!googleConfigurado()) {
    return res.redirect(`${frontend()}/login?error=google_no_configurado`);
  }

  const state = crypto.randomBytes(24).toString("hex");
  res.cookie("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: esProduccion,
    maxAge: 10 * 60 * 1000,
    path: "/",
  });
  return res.redirect(urlConsentimiento(state));
});

auth.get(
  "/google/callback",
  ah(async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const esperado = (req.cookies?.oauth_state as string | undefined) ?? "";
    res.clearCookie("oauth_state", { path: "/" });

    if (req.query.error) return res.redirect(`${frontend()}/login?error=google`);
    if (!code || !state || !esperado || state !== esperado) {
      return res.redirect(`${frontend()}/login?error=oauth_state`);
    }

    try {
      const perfil = await perfilDeGoogle(code);
      if (!dominioPermitido(perfil.email)) {
        return res.redirect(`${frontend()}/login?error=dominio`);
      }

      let bloqueo: "pendiente" | "inactivo" | null = null;

      const usuario = await withTx(async (db) => {
        const { rows } = await db.query<{
          id: string;
          activo: boolean;
          pendienteAprobacion: boolean;
        }>(
          `SELECT id, activo, pendiente_aprobacion AS "pendienteAprobacion"
             FROM usuarios
            WHERE google_id = $1 OR lower(email) = lower($2)
            LIMIT 1`,
          [perfil.googleId, perfil.email],
        );

        if (rows[0]) {
          if (!rows[0].activo) {
            if (rows[0].pendienteAprobacion) {
              bloqueo = "pendiente";
              await db.query(
                `UPDATE usuarios
                    SET google_id = COALESCE(google_id, $2),
                        nombre = CASE WHEN perfil_editado THEN nombre ELSE $3 END,
                        foto_url = CASE WHEN perfil_editado THEN foto_url ELSE $4 END
                  WHERE id = $1`,
                [rows[0].id, perfil.googleId, perfil.nombre, perfil.fotoUrl],
              );
            } else {
              bloqueo = "inactivo";
            }
            return null;
          }

          const { rows: actualizados } = await db.query<{ id: string }>(
            `UPDATE usuarios
                SET google_id = COALESCE(google_id, $2),
                    nombre = CASE WHEN perfil_editado THEN nombre ELSE $3 END,
                    foto_url = CASE WHEN perfil_editado THEN foto_url ELSE $4 END,
                    ultimo_acceso = now()
              WHERE id = $1
              RETURNING id`,
            [rows[0].id, perfil.googleId, perfil.nombre, perfil.fotoUrl],
          );
          return actualizados[0];
        }

        // Una cuenta de Google desconocida se registra como solicitud pendiente.
        await db.query(
          `INSERT INTO usuarios
             (email, nombre, foto_url, proveedor, google_id, rol, activo, pendiente_aprobacion)
           VALUES ($1, $2, $3, 'google', $4, 'usuario', false, true)`,
          [perfil.email, perfil.nombre, perfil.fotoUrl, perfil.googleId],
        );
        bloqueo = "pendiente";
        return null;
      });

      if (!usuario) {
        return res.redirect(`${frontend()}/login?error=${bloqueo ?? "inactivo"}`);
      }

      await crearSesion(res, usuario.id);
      return res.redirect(frontend());
    } catch (e) {
      console.error("[auth] Error en el callback de Google", e);
      return res.redirect(`${frontend()}/login?error=google`);
    }
  }),
);

auth.get(
  "/me",
  ah(async (req, res) => {
    const usuario = await usuarioDeSesion(req);
    if (!usuario) throw new HttpError(401, "No autenticado");
    res.json({ usuario });
  }),
);

auth.patch(
  "/me",
  ah(async (req, res) => {
    const actual = await usuarioDeSesion(req);
    if (!actual) throw new HttpError(401, "No autenticado");

    const datos = perfilSchema.parse(req.body);
    const fotoUrl = datos.fotoUrl ? datos.fotoUrl : null;

    const { rows } = await pool.query(
      `UPDATE usuarios
          SET nombre = $2, foto_url = $3, perfil_editado = true
        WHERE id = $1
        RETURNING ${CAMPOS_USUARIO}`,
      [actual.id, datos.nombre, fotoUrl],
    );

    res.json({ usuario: rows[0] });
  }),
);

auth.post(
  "/logout",
  ah(async (req, res) => {
    await destruirSesion(req, res);
    res.json({ ok: true });
  }),
);
