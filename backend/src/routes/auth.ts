import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { dominioPermitido, googleConfigurado, perfilDeGoogle, urlConsentimiento } from "../auth/google.js";
import { crearSesion, destruirSesion, usuarioDeSesion } from "../auth/session.js";
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

const loginSchema = z.object({
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
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
};

export const auth = Router();

// Acceso local (solo administradores).
auth.post(
  "/login",
  limitadorLogin,
  ah(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const { rows } = await pool.query<UsuarioLogin>(
      `SELECT ${CAMPOS_USUARIO}, password_hash AS "passwordHash", activo
         FROM usuarios
        WHERE lower(email) = lower($1) AND proveedor = 'local'`,
      [email],
    );

    const usuario = rows[0];
    if (!usuario || !usuario.activo) throw new HttpError(401, "Correo o contraseña incorrectos");

    const coincide = await bcrypt.compare(password, usuario.passwordHash);
    if (!coincide) throw new HttpError(401, "Correo o contraseña incorrectos");

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

      const usuario = await withTx(async (db) => {
        const { rows } = await db.query<{ id: string; activo: boolean }>(
          `SELECT id, activo
             FROM usuarios
            WHERE google_id = $1 OR lower(email) = lower($2)
            LIMIT 1`,
          [perfil.googleId, perfil.email],
        );

        if (rows[0]) {
          if (!rows[0].activo) throw new HttpError(403, "Usuario inactivo");

          const { rows: actualizados } = await db.query<{ id: string }>(
            `UPDATE usuarios
                SET google_id = COALESCE(google_id, $2),
                    nombre = $3,
                    foto_url = $4,
                    ultimo_acceso = now()
              WHERE id = $1
              RETURNING id`,
            [rows[0].id, perfil.googleId, perfil.nombre, perfil.fotoUrl],
          );
          return actualizados[0];
        }

        const { rows: creados } = await db.query<{ id: string }>(
          `INSERT INTO usuarios (email, nombre, foto_url, proveedor, google_id, rol, ultimo_acceso)
           VALUES ($1, $2, $3, 'google', $4, 'usuario', now())
           RETURNING id`,
          [perfil.email, perfil.nombre, perfil.fotoUrl, perfil.googleId],
        );
        return creados[0];
      });

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

auth.post(
  "/logout",
  ah(async (req, res) => {
    await destruirSesion(req, res);
    res.json({ ok: true });
  }),
);
