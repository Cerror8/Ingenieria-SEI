import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { LoginView } from "./features/auth/LoginView";
import { HomeView } from "./features/home/HomeView";

function PantallaCarga() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F8FAFC]">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1F2937]">
        <GraduationCap className="h-7 w-7 text-white" />
      </div>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-[#C2410C]" />
      </div>
      <p className="text-xs font-medium text-slate-500">Verificando sesión…</p>
    </div>
  );
}

function RutaPrivada() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <PantallaCarga />;
  return usuario ? <HomeView /> : <Navigate to="/login" replace />;
}

function RutaPublica() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <PantallaCarga />;
  return usuario ? <Navigate to="/" replace /> : <LoginView />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<RutaPublica />} />
          <Route path="/" element={<RutaPrivada />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
