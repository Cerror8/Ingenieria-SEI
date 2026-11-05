import { BarChart2, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { NAV_ITEMS } from "../constants";

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
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || usuario?.rol === "admin");
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
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#C2410C]">
              <BarChart2 className="h-4 w-4 text-white" />
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
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                onClose();
              }}
              title={collapsed ? item.label : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                collapsed ? "lg:justify-center lg:px-2" : ""
              } ${
                isActive(item.id)
                  ? "bg-[#C2410C] text-white shadow-sm"
                  : "text-white/55 hover:bg-white/10 hover:text-white/85"
              }`}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}
