import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ClipboardList, LogOut, UserRound } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
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

export function ProfileMenu({ onNavigate }: { onNavigate: (v: string) => void }) {
  const { usuario, cerrarSesion } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrarFuera = (evento: MouseEvent) => {
      if (ref.current && !ref.current.contains(evento.target as Node)) setAbierto(false);
    };
    const cerrarEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", cerrarFuera);
    document.addEventListener("keydown", cerrarEscape);
    return () => {
      document.removeEventListener("mousedown", cerrarFuera);
      document.removeEventListener("keydown", cerrarEscape);
    };
  }, [abierto]);

  const ir = (vista: string) => {
    setAbierto(false);
    onNavigate(vista);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-gray-100"
      >
        {usuario?.fotoUrl ? (
          <img
            src={usuario.fotoUrl}
            alt={usuario.nombre}
            referrerPolicy="no-referrer"
            className="h-8 w-8 rounded-full border border-gray-200 object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C2410C]/10">
            <span className="text-xs font-black text-[#C2410C]">
              {usuario ? iniciales(usuario.nombre) : "SE"}
            </span>
          </div>
        )}
        <div className="hidden min-w-0 text-left md:block">
          <p className="max-w-[160px] truncate text-xs font-bold leading-tight text-gray-700">
            {usuario?.nombre}
          </p>
          <p className="max-w-[160px] truncate text-[10px] text-gray-400">{usuario?.email}</p>
        </div>
        <ChevronDown
          className={`hidden h-3.5 w-3.5 text-gray-400 transition-transform md:block ${
            abierto ? "rotate-180" : ""
          }`}
        />
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl"
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="truncate text-sm font-bold text-gray-800">{usuario?.nombre}</p>
            <p className="truncate text-xs text-gray-500">{usuario?.email}</p>
            <span className="mt-2 inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9A3412]">
              {usuario ? ROL_ETIQUETA[usuario.rol] : "Sin sesión"}
            </span>
          </div>

          <div className="p-1.5">
            <button
              type="button"
              onClick={() => ir("perfil")}
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <UserRound className="h-4 w-4 text-gray-400" />
              Mi perfil
            </button>
            <button
              type="button"
              onClick={() => ir("calendario")}
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <CalendarDays className="h-4 w-4 text-gray-400" />
              Mi calendario
            </button>
            <button
              type="button"
              onClick={() => ir("mi-tablero")}
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <ClipboardList className="h-4 w-4 text-gray-400" />
              Mi tablero
            </button>
            <div className="my-1 h-px bg-gray-100" />
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                void cerrarSesion();
              }}
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
