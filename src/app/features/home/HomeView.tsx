import { useState } from "react";
import {
  CalendarClock,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import type { Proveedor, Rol } from "../../types";

const ROL_ETIQUETA: Record<Rol, string> = {
  admin: "Administrador",
  docente: "Docente",
  estudiante: "Estudiante",
  usuario: "Usuario",
};

const PROVEEDOR_ETIQUETA: Record<Proveedor, string> = {
  local: "Acceso administrativo",
  google: "Cuenta de Google",
};

const MODULOS = [
  {
    icon: ClipboardList,
    titulo: "Resultados de aprendizaje",
    detalle: "Registro y definición de RAP por asignatura.",
  },
  {
    icon: LayoutDashboard,
    titulo: "Tableros de trabajo",
    detalle: "Asignación y seguimiento estilo Monday / Brix24.",
  },
  {
    icon: Users,
    titulo: "Usuarios y roles",
    detalle: "Administración de accesos institucionales.",
  },
  {
    icon: FileText,
    titulo: "Informes",
    detalle: "Reportes de avance y evidencias por período.",
  },
];

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

function Avatar({ nombre, fotoUrl }: { nombre: string; fotoUrl: string | null }) {
  const [error, setError] = useState(false);

  if (fotoUrl && !error) {
    return (
      <img
        src={fotoUrl}
        alt={nombre}
        referrerPolicy="no-referrer"
        onError={() => setError(true)}
        className="h-16 w-16 rounded-full border-2 border-white object-cover shadow-sm"
      />
    );
  }

  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white bg-[#C2410C] text-lg font-black text-white shadow-sm">
      {iniciales(nombre) || <GraduationCap className="h-7 w-7" />}
    </div>
  );
}

function fechaAcceso(valor: string | null) {
  if (!valor) return "Sin registro";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(valor));
}

export function HomeView() {
  const { usuario, cerrarSesion } = useAuth();
  const [saliendo, setSaliendo] = useState(false);

  if (!usuario) return null;

  async function onSalir() {
    setSaliendo(true);
    await cerrarSesion();
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1F2937]">
              <LayoutDashboard className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-black leading-tight text-slate-800">Sistema RAP CESMAG</p>
              <p className="text-[11px] text-slate-500">Gestión de Resultados de Aprendizaje</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSalir}
            disabled={saliendo}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {saliendo ? "Cerrando…" : "Cerrar sesión"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-1.5 w-full bg-[#C2410C]" />
          <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar nombre={usuario.nombre} fotoUrl={usuario.fotoUrl} />
              <div className="min-w-0">
                <p className="text-xl font-bold leading-tight text-slate-900">{usuario.nombre}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                  <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{usuario.email}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-[#9A3412]">
                <ShieldCheck className="h-3.5 w-3.5" />
                {ROL_ETIQUETA[usuario.rol]}
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {PROVEEDOR_ETIQUETA[usuario.proveedor]}
              </span>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Rol asignado</p>
            <p className="mt-2 text-lg font-bold text-slate-800">{ROL_ETIQUETA[usuario.rol]}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Método de acceso</p>
            <p className="mt-2 text-lg font-bold text-slate-800">
              {PROVEEDOR_ETIQUETA[usuario.proveedor]}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              <CalendarClock className="h-3.5 w-3.5" />
              Último acceso
            </p>
            <p className="mt-2 text-sm font-semibold leading-snug text-slate-800">
              {fechaAcceso(usuario.ultimoAcceso)}
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold text-slate-800">Módulos del sistema</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {MODULOS.map(({ icon: Icono, titulo, detalle }) => (
              <div
                key={titulo}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-orange-50">
                  <Icono className="h-5 w-5 text-[#C2410C]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{titulo}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{detalle}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <p className="text-center text-[11px] text-slate-400">
          Sesión autenticada · Universidad CESMAG · Pasto, Nariño
        </p>
      </main>
    </div>
  );
}
