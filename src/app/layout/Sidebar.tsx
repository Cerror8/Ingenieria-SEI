import { BarChart2, LogOut } from "lucide-react";
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
}: {
  currentView: string;
  onNavigate: (v: string) => void;
}) {
  const { usuario, cerrarSesion } = useAuth();
  const isActive = (id: string) =>
    currentView === id ||
    (id === "projects" && (currentView === "project-detail" || currentView === "create-project"));

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-[#1F2937] select-none">
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#C2410C] rounded-lg flex items-center justify-center">
            <BarChart2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-black text-white leading-tight tracking-wide">INGENIERÍA</p>
            <p className="text-xs font-black text-[#FDBA74] leading-tight tracking-wide">SEI</p>
          </div>
        </div>
        <p className="text-[10px] text-white/40 mt-2">Plataforma institucional</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              isActive(item.id)
                ? "bg-[#C2410C] text-white shadow-sm"
                : "text-white/55 hover:bg-white/10 hover:text-white/85"
            }`}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
            {item.id === "informes" && (
              <span className="ml-auto text-[10px] font-black bg-white/15 text-white px-1.5 py-0.5 rounded-full">
                3
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-2.5">
          {usuario?.fotoUrl ? (
            <img
              src={usuario.fotoUrl}
              alt={usuario.nombre}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-white/20"
            />
          ) : (
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-black text-white">
                {usuario ? iniciales(usuario.nombre) : "SE"}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{usuario?.nombre ?? "Invitado"}</p>
            <p className="text-[10px] text-white/45 truncate">
              {usuario ? ROL_ETIQUETA[usuario.rol] : "Sin sesión"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void cerrarSesion()}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="p-1.5 rounded-md text-white/45 hover:text-white hover:bg-white/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
