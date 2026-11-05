import { OAuth2Client } from "google-auth-library";
import { HttpError } from "../http.js";

const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const redirectUri =
  process.env.GOOGLE_REDIRECT_URI?.trim() ??
  "http://localhost:4000/api/auth/google/callback";

const cliente = new OAuth2Client({ clientId, clientSecret, redirectUri });

export function googleConfigurado() {
  return Boolean(clientId && clientSecret);
}

export function urlConsentimiento(state: string) {
  if (!googleConfigurado()) throw new HttpError(503, "Google OAuth no está configurado");
  return cliente.generateAuthUrl({
    access_type: "online",
    prompt: "select_account",
    scope: ["openid", "email", "profile"],
    state,
  });
}

export type PerfilGoogle = {
  googleId: string;
  email: string;
  nombre: string;
  fotoUrl: string | null;
};

export async function perfilDeGoogle(code: string): Promise<PerfilGoogle> {
  const { tokens } = await cliente.getToken(code);
  if (!tokens.id_token) throw new HttpError(400, "Google no devolvió un token de identidad");

  const ticket = await cliente.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw new HttpError(400, "Perfil de Google incompleto");
  if (payload.email_verified === false) throw new HttpError(403, "El correo de Google no está verificado");

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    nombre: payload.name?.trim() || payload.email,
    fotoUrl: payload.picture ?? null,
  };
}

export function dominioPermitido(email: string) {
  const dominio = process.env.ALLOWED_DOMAIN?.trim().toLowerCase();
  if (!dominio) return true;
  return email.toLowerCase().endsWith(`@${dominio}`);
}
