import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { pool } from "../db.js";

const COOKIE_SESION = "rap_sid";
const TTL_DIAS = Number(process.env.SESSION_TTL_DIAS ?? 7);
const TTL_MS = TTL_DIAS * 24 * 60 * 60 * 1000;

export type UsuarioSesion = {
  id: string;
  email: string;
  nombre: string;
  fotoUrl: string | null;
  proveedor: "google" | "local";
  rol: "admin" | "docente" | "estudiante" | "usuario";
  ultimoAcceso: string | null;
};

const CAMPOS_USUARIO = `
  u.id, u.email, u.nombre, u.foto_url AS "fotoUrl", u.proveedor, u.rol,
  u.ultimo_acceso AS "ultimoAcceso"
`;

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

const opcionesCookie = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
});

export async function crearSesion(res: Response, usuarioId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expira = new Date(Date.now() + TTL_MS);
  await pool.query(
    "INSERT INTO sesiones (usuario_id, token_hash, expira_en) VALUES ($1, $2, $3)",
    [usuarioId, hashToken(token), expira],
  );
  res.cookie(COOKIE_SESION, token, { ...opcionesCookie(), maxAge: TTL_MS });
}

export async function destruirSesion(req: Request, res: Response) {
  const token = req.cookies?.[COOKIE_SESION] as string | undefined;
  if (token) {
    await pool.query("DELETE FROM sesiones WHERE token_hash = $1", [hashToken(token)]);
  }
  res.clearCookie(COOKIE_SESION, opcionesCookie());
}

export async function usuarioDeSesion(req: Request): Promise<UsuarioSesion | null> {
  const token = req.cookies?.[COOKIE_SESION] as string | undefined;
  if (!token) return null;

  const { rows } = await pool.query<UsuarioSesion>(
    `SELECT ${CAMPOS_USUARIO}
       FROM sesiones s
       JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = $1
        AND s.expira_en > now()
        AND u.activo = true`,
    [hashToken(token)],
  );
  return rows[0] ?? null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const usuario = await usuarioDeSesion(req);
    if (!usuario) return res.status(401).json({ error: "No autenticado" });
    res.locals.usuario = usuario;
    next();
  } catch (e) {
    next(e);
  }
}
