import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { NAV_ENTRIES } from "../constants";

export function Sidebar({
  currentView,
  onNavigate,
  open,
  onClose,
  collapsed,
}: {
  currentView: string;
  onNavigate: (v: string) => void;
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
}) {
  const { usuario } = useAuth();
  const [grupoAbierto, setGrupoAbierto] = useState<string | null>(
    () => window.localStorage.getItem("sei-sidebar-grupo"),
  );

  const grupoDeVista = NAV_ENTRIES.find(
    (entrada) =>
      entrada.type === "group" &&
      (entrada.children.some((hijo) => hijo.id === currentView) ||
        (entrada.id === "projects" &&
          (currentView === "project-detail" || currentView === "create-project"))),
  );

  useEffect(() => {
    if (grupoDeVista?.type === "group") {
      setGrupoAbierto((actual) => {
        if (actual === grupoDeVista.id) return actual;
        window.localStorage.setItem("sei-sidebar-grupo", grupoDeVista.id);
        return grupoDeVista.id;
      });
    }
  }, [grupoDeVista]);

  const alternarGrupo = (id: string) => {
    const siguiente = grupoAbierto === id ? null : id;
    setGrupoAbierto(siguiente);
    window.localStorage.setItem("sei-sidebar-grupo", siguiente ?? "");
  };

  const ir = (vista: string) => {
    onNavigate(vista);
    onClose();
  };

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
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-shrink-0 select-none flex-col bg-[#1F2937] transition-[transform,width] duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 ${
          collapsed ? "lg:w-20" : "lg:w-56"
        } ${open ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="Menú principal"
      >
        <div
          className={`flex items-center border-b border-white/10 py-5 ${
            collapsed ? "justify-between px-4 lg:justify-center lg:px-2" : "justify-between px-4"
          }`}
        >
          <div className={`flex items-center gap-3 ${collapsed ? "lg:justify-center" : ""}`}>
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[10px] font-black tracking-tight text-[#FDBA74] shadow-sm">
              SEI
            </div>
            <div className={collapsed ? "lg:hidden" : ""}>
              <p className="text-xs font-black leading-tight tracking-wide text-white">INGENIERÍA</p>
              <p className="text-xs font-black leading-tight tracking-wide text-[#FDBA74]">SEI</p>
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

        <nav
          className={`flex-1 space-y-0.5 overflow-y-auto py-4 ${
            collapsed ? "px-3 lg:px-2" : "px-3"
          }`}
        >
          {NAV_ENTRIES.filter(
            (entrada) => entrada.type !== "item" || !entrada.adminOnly || usuario?.rol === "admin",
          ).map((entrada) => {
            if (entrada.type === "item") {
              const activo = currentView === entrada.id;
              return (
                <button
                  key={entrada.id}
                  onClick={() => ir(entrada.id)}
                  title={collapsed ? entrada.label : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                    collapsed ? "lg:justify-center lg:px-2" : ""
                  } ${
                    activo
                      ? "bg-[#C2410C] text-white shadow-sm"
                      : "text-white/55 hover:bg-white/10 hover:text-white/85"
                  }`}
                >
                  <entrada.icon className="h-4 w-4 flex-shrink-0" />
                  <span className={collapsed ? "lg:hidden" : ""}>{entrada.label}</span>
                </button>
              );
            }

            const abierto = grupoAbierto === entrada.id;
            const hijoActivo = entrada.children.some((hijo) => currentView === hijo.id);
            const activo =
              hijoActivo ||
              (entrada.id === "projects" &&
                (currentView === "project-detail" || currentView === "create-project"));

            return (
              <div key={entrada.id}>
                <button
                  type="button"
                  onClick={() => (collapsed ? ir(entrada.children[0].id) : alternarGrupo(entrada.id))}
                  title={collapsed ? entrada.label : undefined}
                  aria-expanded={abierto}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                    collapsed ? "lg:justify-center lg:px-2" : ""
                  } ${
                    activo
                      ? "bg-[#C2410C] text-white shadow-sm"
                      : "text-white/55 hover:bg-white/10 hover:text-white/85"
                  }`}
                >
                  <entrada.icon className="h-4 w-4 flex-shrink-0" />
                  <span className={`flex-1 text-left ${collapsed ? "lg:hidden" : ""}`}>
                    {entrada.label}
                  </span>
                  {!collapsed && (
                    abierto ? (
                      <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-white/60" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-white/60" />
                    )
                  )}
                </button>

                {abierto && !collapsed && (
                  <div className="mt-0.5 space-y-0.5 border-l border-white/10 pb-1 pl-4 ml-5">
                    {entrada.children.map((hijo) => (
                      <button
                        key={hijo.id}
                        onClick={() => ir(hijo.id)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                          currentView === hijo.id
                            ? "bg-[#C2410C] text-white shadow-sm"
                            : "text-white/55 hover:bg-white/10 hover:text-white/85"
                        }`}
                      >
                        <hijo.icon className="h-3.5 w-3.5 flex-shrink-0" />
                        {hijo.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
