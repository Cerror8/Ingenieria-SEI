import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CalendarClock, CheckCircle2, ChevronRight } from "lucide-react";
import { api } from "../api/client";
import type { NotificacionTarea, PrioridadTablero } from "../types";

const COLOR_PRIORIDAD: Record<PrioridadTablero, string> = {
  Alta: "border-l-red-500",
  Media: "border-l-amber-500",
  Baja: "border-l-sky-500",
};

function textoVencimiento(dias: number) {
  if (dias < 0) {
    const n = Math.abs(dias);
    return `Vencida hace ${n} ${n === 1 ? "día" : "días"}`;
  }
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  return `Vence en ${dias} días`;
}

export function NotificationsMenu({ onNavigate }: { onNavigate: (v: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<NotificacionTarea[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    try {
      const { notificaciones } = await api.notificaciones();
      setItems(notificaciones);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las notificaciones");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
    const intervalo = window.setInterval(() => void cargar(), 120_000);
    return () => window.clearInterval(intervalo);
  }, [cargar]);

  useEffect(() => {
    if (abierto) void cargar();
  }, [abierto, cargar]);

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

  const total = items.length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={`Notificaciones${total ? `: ${total} tareas próximas a vencer` : ""}`}
        className="relative rounded-lg p-2 transition-colors hover:bg-gray-100"
      >
        <Bell className="h-4 w-4 text-gray-400" />
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-gray-800">Notificaciones</p>
              <p className="text-[11px] text-gray-500">
                {total > 0
                  ? `${total} ${total === 1 ? "tarea próxima" : "tareas próximas"} a vencer`
                  : "Tareas con fecha límite en los próximos 7 días"}
              </p>
            </div>
            <Bell className="h-4 w-4 text-gray-300" />
          </div>

          <div className="max-h-80 overflow-y-auto">
            {cargando ? (
              <p className="px-4 py-6 text-center text-xs text-gray-400">Cargando notificaciones…</p>
            ) : error ? (
              <p className="px-4 py-6 text-center text-xs text-red-500">{error}</p>
            ) : total === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
                <p className="text-xs font-semibold text-gray-600">Sin tareas próximas a vencer</p>
                <p className="text-[11px] text-gray-400">
                  Cuando una tarea se acerque a su fecha límite aparecerá aquí.
                </p>
              </div>
            ) : (
              items.map((item) => {
                const dias = Number(item.diasRestantes);
                const vencida = dias < 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAbierto(false);
                      onNavigate("tableros");
                    }}
                    className={`flex w-full items-start gap-3 border-l-4 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                      COLOR_PRIORIDAD[item.prioridad]
                    }`}
                  >
                    <CalendarClock
                      className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                        vencida ? "text-red-500" : dias <= 1 ? "text-amber-500" : "text-gray-400"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-gray-800">
                        {item.titulo}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-gray-400">
                        {item.tablero}
                      </span>
                      <span
                        className={`mt-0.5 block text-[11px] font-semibold ${
                          vencida ? "text-red-600" : dias <= 1 ? "text-amber-600" : "text-gray-500"
                        }`}
                      >
                        {textoVencimiento(dias)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setAbierto(false);
              onNavigate("tableros");
            }}
            className="flex w-full items-center justify-center gap-1 border-t border-gray-100 px-4 py-2.5 text-xs font-semibold text-[#9A3412] transition-colors hover:bg-orange-50"
          >
            Ir a Tableros
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
