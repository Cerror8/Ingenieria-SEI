import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ClipboardList, LogOut, UserRound } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import type { Rol } from "../types";

const ROL_ETIQUETA: Record<Rol, string> = {
  admin: "Administrador",
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
        className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-slate-100"
      >
        {usuario?.fotoUrl ? (
          <img
            src={usuario.fotoUrl}
            alt={usuario.nombre}
            referrerPolicy="no-referrer"
            className="h-8 w-8 rounded-full border border-gray-200 object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F39200]/15">
            <span className="font-mono text-[11px] font-medium text-[#9A3412]">
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
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
        >
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="truncate text-[13px] font-semibold text-[#1B1B1B]">{usuario?.nombre}</p>
            <p className="truncate font-mono text-[11px] text-slate-500">{usuario?.email}</p>
            <span className="sei-label mt-2 inline-flex bg-[#F39200]/15 px-2 py-0.5 text-[#9A3412]">
              {usuario ? ROL_ETIQUETA[usuario.rol] : "Sin sesión"}
            </span>
          </div>

          <div className="p-1.5">
            <button
              type="button"
              onClick={() => ir("perfil")}
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#1B1B1B]"
            >
              <UserRound className="h-4 w-4 text-slate-400" />
              Mi perfil
            </button>
            <button
              type="button"
              onClick={() => ir("calendario")}
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#1B1B1B]"
            >
              <CalendarDays className="h-4 w-4 text-slate-400" />
              Mi calendario
            </button>
            <button
              type="button"
              onClick={() => ir("mi-tablero")}
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#1B1B1B]"
            >
              <ClipboardList className="h-4 w-4 text-slate-400" />
              Mi tablero
            </button>
            <div className="my-1 h-px bg-slate-200" />
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                void cerrarSesion();
              }}
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-semibold text-red-600 transition-colors hover:bg-red-50"
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
