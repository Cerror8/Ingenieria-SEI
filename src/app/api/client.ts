import type { Usuario } from "../types";

const API_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000/api"
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Opciones = {
  method?: "GET" | "POST";
  body?: unknown;
};

async function request<T>(path: string, opciones: Opciones = {}): Promise<T> {
  let respuesta: Response;

  try {
    respuesta = await fetch(`${API_URL}${path}`, {
      method: opciones.method ?? "GET",
      credentials: "include",
      headers: opciones.body ? { "Content-Type": "application/json" } : undefined,
      body: opciones.body ? JSON.stringify(opciones.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "No se pudo conectar con el servidor. Verifica que el backend esté activo.");
  }

  const datos = (await respuesta.json().catch(() => ({}))) as { error?: string };

  if (!respuesta.ok) {
    throw new ApiError(respuesta.status, datos.error ?? "Ocurrió un error inesperado");
  }

  return datos as T;
}

export const api = {
  iniciarSesion: (email: string, password: string) =>
    request<{ usuario: Usuario }>("/auth/login", { method: "POST", body: { email, password } }),
  cerrarSesion: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  usuarioActual: () => request<{ usuario: Usuario }>("/auth/me"),
  urlGoogle: `${API_URL}/auth/google`,
};
