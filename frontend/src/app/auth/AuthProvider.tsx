import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";
import type { Usuario } from "../types";

type ContextoAuth = {
  usuario: Usuario | null;
  cargando: boolean;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
  actualizarPerfil: (datos: {
    nombre: string;
    fotoUrl: string | null;
    telefono: string | null;
    whatsappOptIn: boolean;
  }) => Promise<void>;
  cambiarCorreo: (datos: { email: string; password: string }) => Promise<void>;
  cambiarPassword: (datos: { actual: string; nueva: string }) => Promise<void>;
};

const AuthContext = createContext<ContextoAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;

    api
      .usuarioActual()
      .then(({ usuario: actual }) => {
        if (activo) setUsuario(actual);
      })
      .catch(() => {
        if (activo) setUsuario(null);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const { usuario: autenticado } = await api.iniciarSesion(email, password);
    setUsuario(autenticado);
  }, []);

  const cerrarSesion = useCallback(async () => {
    await api.cerrarSesion().catch(() => undefined);
    setUsuario(null);
  }, []);

  const actualizarPerfil = useCallback(
    async (datos: {
      nombre: string;
      fotoUrl: string | null;
      telefono: string | null;
      whatsappOptIn: boolean;
    }) => {
      const { usuario: actualizado } = await api.actualizarPerfil(datos);
      setUsuario(actualizado);
    },
    [],
  );

  const cambiarCorreo = useCallback(async (datos: { email: string; password: string }) => {
    const { usuario: actualizado } = await api.cambiarCorreo(datos);
    setUsuario(actualizado);
  }, []);

  const cambiarPassword = useCallback(async (datos: { actual: string; nueva: string }) => {
    await api.cambiarPassword(datos);
  }, []);

  const valor = useMemo(
    () => ({
      usuario,
      cargando,
      iniciarSesion,
      cerrarSesion,
      actualizarPerfil,
      cambiarCorreo,
      cambiarPassword,
    }),
    [
      usuario,
      cargando,
      iniciarSesion,
      cerrarSesion,
      actualizarPerfil,
      cambiarCorreo,
      cambiarPassword,
    ],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return contexto;
}
