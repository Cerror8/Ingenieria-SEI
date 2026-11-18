import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Router, type Response } from "express";
import rateLimit from "express-rate-limit";
import QRCode from "qrcode";
import { z } from "zod";
import { dominioPermitido, googleConfigurado, perfilDeGoogle, urlConsentimiento } from "../auth/google.js";
import {
  crearSesion,
  destruirSesion,
  hashToken,
  usuarioDeSesion,
  type UsuarioSesion,
} from "../auth/session.js";
import { registrarAuditoria } from "../audit.js";
import { pool, withTx } from "../db.js";
import { ah, HttpError } from "../http.js";
import { avisarSolicitudAcceso } from "../lib/correo.js";
import {
  consumirCodigoRespaldo,
  generarCodigosRespaldo,
  generarSecreto,
  hashCodigoRespaldo,
  urlOtpauth,
  verificarTotp,
} from "../lib/totp.js";

const frontend = () => (process.env.FRONTEND_URL ?? "http://localhost:5174").replace(/\/$/, "");
const esProduccion = process.env.NODE_ENV === "production";

const CAMPOS_USUARIO = `
  id, email, nombre, foto_url AS "fotoUrl", telefono,
  whatsapp_opt_in AS "whatsappOptIn", proveedor, rol,
  (totp_habilitado_en IS NOT NULL) AS "totpHabilitado",
  ultimo_acceso AS "ultimoAcceso"
`;

const COOKIE_DESAFIO_2FA = "rap_2fa";
const TTL_DESAFIO_2FA = 5 * 60 * 1000;
const MAX_INTENTOS_2FA = 5;

const opcionesDesafio = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: esProduccion,
  path: "/",
});

async function crearDesafio2fa(res: Response, usuarioId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  await pool.query("DELETE FROM desafios_2fa WHERE expira_en <= now() OR usuario_id = $1", [
    usuarioId,
  ]);
  await pool.query(
    "INSERT INTO desafios_2fa (usuario_id, token_hash, expira_en) VALUES ($1, $2, $3)",
    [usuarioId, hashToken(token), new Date(Date.now() + TTL_DESAFIO_2FA)],
  );
  res.cookie(COOKIE_DESAFIO_2FA, token, {
    ...opcionesDesafio(),
    maxAge: TTL_DESAFIO_2FA,
  });
}

function limpiarDesafio2fa(res: Response) {
  res.clearCookie(COOKIE_DESAFIO_2FA, opcionesDesafio());
}

async function usuarioPublico(id: string): Promise<UsuarioSesion> {
  const { rows } = await pool.query<UsuarioSesion>(
    `SELECT ${CAMPOS_USUARIO} FROM usuarios WHERE id = $1`,
    [id],
  );
  return rows[0];
}

async function confirmarPasswordLocal(usuarioId: string, password: string | undefined) {
  const { rows } = await pool.query<{
    proveedor: string;
    passwordHash: string | null;
  }>(
    `SELECT proveedor, password_hash AS "passwordHash" FROM usuarios WHERE id = $1`,
    [usuarioId],
  );
  const cuenta = rows[0];
  if (!cuenta) throw new HttpError(404, "Usuario no encontrado");
  if (cuenta.proveedor !== "local") return;

  if (!password) throw new HttpError(400, "Escribe tu contraseña para confirmar el cambio.");
  const valida = cuenta.passwordHash && (await bcrypt.compare(password, cuenta.passwordHash));
  if (!valida) throw new HttpError(401, "La contraseña no es correcta.");
}

async function verificarSegundoFactor(usuarioId: string, codigo: string) {
  const { rows } = await pool.query<{
    secreto: string | null;
    habilitadoEn: string | null;
    codigos: string[] | null;
  }>(
    `SELECT totp_secret AS "secreto",
            totp_habilitado_en AS "habilitadoEn",
            totp_codigos AS "codigos"
       FROM usuarios WHERE id = $1`,
    [usuarioId],
  );
  const cuenta = rows[0];
  if (!cuenta?.habilitadoEn || !cuenta.secreto) {
    throw new HttpError(400, "La verificación en dos pasos no está activa.");
  }

  if (verificarTotp(cuenta.secreto, codigo)) return;

  const restantes = consumirCodigoRespaldo(cuenta.codigos, codigo);
  if (!restantes) throw new HttpError(401, "Código incorrecto. Revisa tu aplicación autenticadora.");

  await pool.query("UPDATE usuarios SET totp_codigos = $2 WHERE id = $1", [usuarioId, restantes]);
}

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

const limitador2fa = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Demasiados intentos de verificación. Espera unos minutos." },
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
  telefono: z
    .union([
      z.string().trim().max(30, "El teléfono es demasiado largo"),
      z.literal(""),
      z.null(),
    ])
    .optional(),
  whatsappOptIn: z.boolean().optional(),
});

const cambiarCorreoSchema = z.object({
  email: z.string().trim().email("Correo inválido").max(160),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

const cambiarPasswordSchema = z.object({
  actual: z.string().min(1, "La contraseña actual es obligatoria"),
  nueva: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72),
});

const codigo2faSchema = z.object({
  codigo: z.string().trim().min(6, "Escribe el código de 6 dígitos").max(12),
});

const iniciar2faSchema = z.object({
  password: z.string().optional(),
});

const confirmar2faSchema = z.object({
  password: z.string().optional(),
  codigo: z.string().trim().min(6, "Escribe tu código actual").max(12),
});

type UsuarioLogin = {
  id: string;
  email: string;
  nombre: string;
  fotoUrl: string | null;
  telefono: string | null;
  whatsappOptIn: boolean;
  proveedor: "local";
  rol: "admin" | "usuario";
  totpHabilitado: boolean;
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

    avisarSolicitudAcceso({ nombre: datos.nombre, email, proveedor: "local" });

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

    if (usuario.totpHabilitado) {
      await crearDesafio2fa(res, usuario.id);
      res.json({ requiere2fa: true });
      return;
    }

    await pool.query("UPDATE usuarios SET ultimo_acceso = now() WHERE id = $1", [usuario.id]);
    await crearSesion(res, usuario.id);

    res.json({
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        fotoUrl: usuario.fotoUrl,
        telefono: usuario.telefono,
        whatsappOptIn: usuario.whatsappOptIn,
        proveedor: usuario.proveedor,
        rol: usuario.rol,
        totpHabilitado: false,
        ultimoAcceso: new Date().toISOString(),
      },
    });
  }),
);

// Segundo paso: canje del reto emitido por /login cuando la cuenta tiene TOTP.
auth.post(
  "/2fa",
  limitador2fa,
  ah(async (req, res) => {
    const { codigo } = codigo2faSchema.parse(req.body);
    const token = req.cookies?.[COOKIE_DESAFIO_2FA] as string | undefined;

    if (!token) {
      throw new HttpError(401, "La verificación expiró. Inicia sesión de nuevo.");
    }

    const hash = hashToken(token);
    const { rows } = await pool.query<{
      id: string;
      usuarioId: string;
      intentos: number;
      expiraEn: Date;
      secreto: string | null;
      habilitadoEn: string | null;
      codigos: string[] | null;
      activo: boolean;
      pendienteAprobacion: boolean;
      nombre: string;
    }>(
      `SELECT d.id, d.usuario_id AS "usuarioId", d.intentos, d.expira_en AS "expiraEn",
              u.totp_secret AS "secreto", u.totp_habilitado_en AS "habilitadoEn",
              u.totp_codigos AS "codigos", u.activo,
              u.pendiente_aprobacion AS "pendienteAprobacion", u.nombre
         FROM desafios_2fa d
         JOIN usuarios u ON u.id = d.usuario_id
        WHERE d.token_hash = $1`,
      [hash],
    );
    const desafio = rows[0];

    if (!desafio || new Date(desafio.expiraEn).getTime() <= Date.now()) {
      await pool.query("DELETE FROM desafios_2fa WHERE token_hash = $1", [hash]);
      limpiarDesafio2fa(res);
      throw new HttpError(401, "La verificación expiró. Inicia sesión de nuevo.");
    }

    if (desafio.intentos >= MAX_INTENTOS_2FA) {
      await pool.query("DELETE FROM desafios_2fa WHERE id = $1", [desafio.id]);
      limpiarDesafio2fa(res);
      throw new HttpError(429, "Demasiados códigos incorrectos. Inicia sesión de nuevo.");
    }

    if (!desafio.activo || desafio.pendienteAprobacion) {
      await pool.query("DELETE FROM desafios_2fa WHERE id = $1", [desafio.id]);
      limpiarDesafio2fa(res);
      throw new HttpError(403, "Tu cuenta no puede iniciar sesión. Contacta a un administrador.");
    }

    let valido = Boolean(desafio.secreto && verificarTotp(desafio.secreto, codigo));
    if (!valido && desafio.codigos?.length) {
      const restantes = consumirCodigoRespaldo(desafio.codigos, codigo);
      if (restantes) {
        valido = true;
        await pool.query("UPDATE usuarios SET totp_codigos = $2 WHERE id = $1", [
          desafio.usuarioId,
          restantes,
        ]);
      }
    }

    if (!valido) {
      await pool.query("UPDATE desafios_2fa SET intentos = intentos + 1 WHERE id = $1", [
        desafio.id,
      ]);
      throw new HttpError(401, "Código incorrecto. Revisa tu aplicación autenticadora.");
    }

    await pool.query("DELETE FROM desafios_2fa WHERE id = $1", [desafio.id]);
    limpiarDesafio2fa(res);
    await pool.query("UPDATE usuarios SET ultimo_acceso = now() WHERE id = $1", [
      desafio.usuarioId,
    ]);
    await crearSesion(res, desafio.usuarioId);
    res.json({ usuario: await usuarioPublico(desafio.usuarioId) });
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
      let solicitudCreada: { nombre: string; email: string; proveedor: string } | null = null;

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
                    foto_url = CASE WHEN perfil_editado THEN foto_url ELSE $4 END
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
        solicitudCreada = {
          nombre: perfil.nombre,
          email: perfil.email,
          proveedor: "google",
        };
        return null;
      });

      const nuevaSolicitud = solicitudCreada as { nombre: string; email: string; proveedor: string } | null;
      if (nuevaSolicitud) avisarSolicitudAcceso(nuevaSolicitud);

      if (!usuario) {
        return res.redirect(`${frontend()}/login?error=${bloqueo ?? "inactivo"}`);
      }

      const { rows: cuentas2fa } = await pool.query<{ habilitado: boolean }>(
        `SELECT (totp_habilitado_en IS NOT NULL) AS habilitado FROM usuarios WHERE id = $1`,
        [usuario.id],
      );
      if (cuentas2fa[0]?.habilitado) {
        await crearDesafio2fa(res, usuario.id);
        return res.redirect(`${frontend()}/login?paso=2fa`);
      }

      await pool.query("UPDATE usuarios SET ultimo_acceso = now() WHERE id = $1", [usuario.id]);
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
    const telefono = datos.telefono === undefined ? undefined : datos.telefono?.trim() || null;

    const { rows } = await pool.query(
      `UPDATE usuarios
          SET nombre = $2,
              foto_url = $3,
              telefono = CASE WHEN $4 THEN $5 ELSE telefono END,
              whatsapp_opt_in = COALESCE($6, whatsapp_opt_in),
              perfil_editado = true
        WHERE id = $1
        RETURNING ${CAMPOS_USUARIO}`,
      [actual.id, datos.nombre, fotoUrl, telefono !== undefined, telefono ?? null, datos.whatsappOptIn ?? null],
    );

    res.json({ usuario: rows[0] });
  }),
);

auth.patch(
  "/me/correo",
  limitadorLogin,
  ah(async (req, res) => {
    const actual = await usuarioDeSesion(req);
    if (!actual) throw new HttpError(401, "No autenticado");
    if (actual.proveedor !== "local") {
      throw new HttpError(400, "El correo de una cuenta de Google se administra desde Google.");
    }

    const datos = cambiarCorreoSchema.parse(req.body);
    const email = datos.email.toLowerCase();

    const { rows: cuentas } = await pool.query<{ passwordHash: string | null }>(
      `SELECT password_hash AS "passwordHash" FROM usuarios WHERE id = $1`,
      [actual.id],
    );
    const hash = cuentas[0]?.passwordHash;
    if (!hash || !(await bcrypt.compare(datos.password, hash))) {
      throw new HttpError(401, "La contraseña actual no es correcta.");
    }

    if (email === actual.email.toLowerCase()) {
      res.json({ usuario: actual });
      return;
    }

    const { rows } = await pool.query(
      `UPDATE usuarios SET email = $2 WHERE id = $1 RETURNING ${CAMPOS_USUARIO}`,
      [actual.id, email],
    ).catch((e: { code?: string }) => {
      if (e.code === "23505") throw new HttpError(409, "Ya existe una cuenta con ese correo.");
      throw e;
    });

    await registrarAuditoria({
      usuario: actual.nombre,
      accion: "Actualización",
      entidad: "Usuario",
      registro: actual.nombre,
      previo: `Correo: ${actual.email}`,
      nuevo: `Correo: ${email}`,
    });

    res.json({ usuario: rows[0] });
  }),
);

auth.patch(
  "/me/password",
  limitadorLogin,
  ah(async (req, res) => {
    const actual = await usuarioDeSesion(req);
    if (!actual) throw new HttpError(401, "No autenticado");
    if (actual.proveedor !== "local") {
      throw new HttpError(400, "Tu cuenta ingresa con Google y no tiene contraseña local.");
    }

    const datos = cambiarPasswordSchema.parse(req.body);

    const { rows: cuentas } = await pool.query<{ passwordHash: string | null }>(
      `SELECT password_hash AS "passwordHash" FROM usuarios WHERE id = $1`,
      [actual.id],
    );
    const hash = cuentas[0]?.passwordHash;
    if (!hash || !(await bcrypt.compare(datos.actual, hash))) {
      throw new HttpError(401, "La contraseña actual no es correcta.");
    }
    if (datos.nueva === datos.actual) {
      throw new HttpError(400, "La nueva contraseña debe ser diferente de la actual.");
    }

    const nuevoHash = await bcrypt.hash(datos.nueva, 12);
    await pool.query(`UPDATE usuarios SET password_hash = $2 WHERE id = $1`, [
      actual.id,
      nuevoHash,
    ]);

    await registrarAuditoria({
      usuario: actual.nombre,
      accion: "Actualización",
      entidad: "Usuario",
      registro: actual.nombre,
      nuevo: "Contraseña actualizada",
    });

    res.json({ ok: true });
  }),
);

auth.get(
  "/2fa",
  ah(async (req, res) => {
    const actual = await usuarioDeSesion(req);
    if (!actual) throw new HttpError(401, "No autenticado");

    const { rows } = await pool.query<{ habilitado: boolean; codigosRestantes: number }>(
      `SELECT (totp_habilitado_en IS NOT NULL) AS habilitado,
              COALESCE(cardinality(totp_codigos), 0) AS "codigosRestantes"
         FROM usuarios WHERE id = $1`,
      [actual.id],
    );

    res.json({
      habilitado: Boolean(rows[0]?.habilitado),
      codigosRestantes: rows[0]?.codigosRestantes ?? 0,
    });
  }),
);

// Genera un secreto pendiente y su QR; todavía no activa el segundo factor.
auth.post(
  "/2fa/iniciar",
  limitador2fa,
  ah(async (req, res) => {
    const actual = await usuarioDeSesion(req);
    if (!actual) throw new HttpError(401, "No autenticado");

    const { password } = iniciar2faSchema.parse(req.body ?? {});

    if (actual.totpHabilitado) {
      throw new HttpError(409, "La verificación en dos pasos ya está activa.");
    }
    await confirmarPasswordLocal(actual.id, password);

    const secreto = generarSecreto();
    await pool.query(
      "UPDATE usuarios SET totp_secret = $2, totp_codigos = NULL WHERE id = $1",
      [actual.id, secreto],
    );

    const uri = urlOtpauth(secreto, actual.email);
    const qr = await QRCode.toDataURL(uri, {
      margin: 1,
      width: 240,
      color: { dark: "#1F2937", light: "#FFFFFF" },
    });

    res.json({ secreto, urlOtpauth: uri, qr });
  }),
);

auth.post(
  "/2fa/activar",
  limitador2fa,
  ah(async (req, res) => {
    const actual = await usuarioDeSesion(req);
    if (!actual) throw new HttpError(401, "No autenticado");

    const { codigo } = codigo2faSchema.parse(req.body);
    const { rows } = await pool.query<{ secreto: string | null; habilitado: boolean }>(
      `SELECT totp_secret AS secreto, (totp_habilitado_en IS NOT NULL) AS habilitado
         FROM usuarios WHERE id = $1`,
      [actual.id],
    );
    const cuenta = rows[0];
    if (cuenta?.habilitado) throw new HttpError(409, "La verificación en dos pasos ya está activa.");
    if (!cuenta?.secreto) throw new HttpError(400, "Primero inicia la configuración del segundo factor.");

    if (!verificarTotp(cuenta.secreto, codigo)) {
      throw new HttpError(400, "El código no coincide. Revisa la hora del dispositivo e inténtalo otra vez.");
    }

    const codigos = generarCodigosRespaldo();
    await pool.query(
      `UPDATE usuarios
          SET totp_habilitado_en = now(), totp_codigos = $2
        WHERE id = $1`,
      [actual.id, codigos.map(hashCodigoRespaldo)],
    );

    await registrarAuditoria({
      usuario: actual.nombre,
      accion: "Actualización",
      entidad: "Usuario",
      registro: actual.nombre,
      nuevo: "Verificación en dos pasos activada",
    });

    res.json({ ok: true, codigos });
  }),
);

auth.post(
  "/2fa/desactivar",
  limitador2fa,
  ah(async (req, res) => {
    const actual = await usuarioDeSesion(req);
    if (!actual) throw new HttpError(401, "No autenticado");

    const { password, codigo } = confirmar2faSchema.parse(req.body);
    await confirmarPasswordLocal(actual.id, password);
    await verificarSegundoFactor(actual.id, codigo);

    await pool.query(
      `UPDATE usuarios
          SET totp_secret = NULL, totp_habilitado_en = NULL, totp_codigos = NULL
        WHERE id = $1`,
      [actual.id],
    );
    await pool.query("DELETE FROM desafios_2fa WHERE usuario_id = $1", [actual.id]);

    await registrarAuditoria({
      usuario: actual.nombre,
      accion: "Actualización",
      entidad: "Usuario",
      registro: actual.nombre,
      nuevo: "Verificación en dos pasos desactivada",
    });

    res.json({ ok: true });
  }),
);

auth.post(
  "/2fa/codigos",
  limitador2fa,
  ah(async (req, res) => {
    const actual = await usuarioDeSesion(req);
    if (!actual) throw new HttpError(401, "No autenticado");

    const { password, codigo } = confirmar2faSchema.parse(req.body);
    await confirmarPasswordLocal(actual.id, password);
    await verificarSegundoFactor(actual.id, codigo);

    const codigos = generarCodigosRespaldo();
    await pool.query("UPDATE usuarios SET totp_codigos = $2 WHERE id = $1", [
      actual.id,
      codigos.map(hashCodigoRespaldo),
    ]);

    await registrarAuditoria({
      usuario: actual.nombre,
      accion: "Actualización",
      entidad: "Usuario",
      registro: actual.nombre,
      nuevo: "Códigos de respaldo regenerados",
    });

    res.json({ codigos });
  }),
);

auth.post(
  "/logout",
  ah(async (req, res) => {
    await destruirSesion(req, res);
    limpiarDesafio2fa(res);
    res.json({ ok: true });
  }),
);
