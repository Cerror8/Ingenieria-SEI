import { BarChart2, LogOut, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { NAV_ITEMS } from "../constants";
import type { Rol } from "../types";

const ROL_ETIQUETA: Record<Rol, string> = {
  admin: "Administrador",
  docente: "Docente",
  estudiante: "Estudiante",
  usuario: "Usuario",
};

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

export function Sidebar({
  currentView,
  onNavigate,
  open,
  onClose,
}: {
  currentView: string;
  onNavigate: (v: string) => void;
  open: boolean;
  onClose: () => void;
}) {
  const { usuario, cerrarSesion } = useAuth();
  const isActive = (id: string) =>
    currentView === id ||
    (id === "projects" && (currentView === "project-detail" || currentView === "create-project"));

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-shrink-0 select-none flex-col bg-[#1F2937] transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-56 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Menú principal"
      >
        <div className="flex items-start justify-between border-b border-white/10 px-4 py-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C2410C]">
                <BarChart2 className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-black leading-tight tracking-wide text-white">INGENIERÍA</p>
                <p className="text-xs font-black leading-tight tracking-wide text-[#FDBA74]">SEI</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                onClose();
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                isActive(item.id)
                  ? "bg-[#C2410C] text-white shadow-sm"
                  : "text-white/55 hover:bg-white/10 hover:text-white/85"
              }`}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-2.5">
            {usuario?.fotoUrl ? (
              <img
                src={usuario.fotoUrl}
                alt={usuario.nombre}
                referrerPolicy="no-referrer"
                className="h-8 w-8 flex-shrink-0 rounded-full border border-white/20 object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/20">
                <span className="text-xs font-black text-white">
                  {usuario ? iniciales(usuario.nombre) : "SE"}
                </span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">{usuario?.nombre ?? "Invitado"}</p>
              <p className="truncate text-[10px] text-white/45">
                {usuario ? ROL_ETIQUETA[usuario.rol] : "Sin sesión"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void cerrarSesion()}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="rounded-md p-1.5 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
