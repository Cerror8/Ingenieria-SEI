import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import emblemaSei from "../assets/brand/emblema-sei.png";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { LoginView } from "./features/auth/LoginView";
import { RegistroView } from "./features/auth/RegistroView";
import { AppShell } from "./layout/AppShell";

function PantallaCarga() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F8FAFC]">
      <div className="flex h-16 w-24 items-center justify-center rounded-xl border border-[#ECECEC] bg-white shadow-sm">
        <img src={emblemaSei} alt="Ingeniería SEI" className="h-10 w-auto" />
      </div>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-[#F39200]" />
      </div>
      <p className="text-xs font-medium text-slate-500">Verificando sesión…</p>
    </div>
  );
}

function RutaPrivada() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <PantallaCarga />;
  return usuario ? <AppShell /> : <Navigate to="/login" replace />;
}

function RutaPublica({ children }: { children: ReactNode }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <PantallaCarga />;
  return usuario ? <Navigate to="/" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <RutaPublica>
                <LoginView />
              </RutaPublica>
            }
          />
          <Route
            path="/registro"
            element={
              <RutaPublica>
                <RegistroView />
              </RutaPublica>
            }
          />
          <Route path="/" element={<RutaPrivada />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
