import { useMemo, type ReactNode } from "react";
import { CalendarRange, TrendingUp, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ColumnaTablero, TareaTablero } from "../../types";

const COLUMNAS: { id: ColumnaTablero; titulo: string; color: string }[] = [
  { id: "por-hacer", titulo: "Por hacer", color: "bg-slate-400" },
  { id: "en-curso", titulo: "En curso", color: "bg-blue-500" },
  { id: "en-revision", titulo: "En revisión", color: "bg-amber-500" },
  { id: "completado", titulo: "Completado", color: "bg-emerald-500" },
];

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

function claveLocal(valor: string | Date) {
  const fecha = typeof valor === "string" ? new Date(valor) : valor;
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function Tarjeta({
  icono: Icono,
  titulo,
  detalle,
  children,
}: {
  icono: LucideIcon;
  titulo: string;
  detalle: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <span className="rounded-lg bg-orange-50 p-1.5 text-[#C2410C]">
          <Icono className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-700">{titulo}</p>
          <p className="truncate text-[11px] text-slate-400">{detalle}</p>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function TableroProgreso({ tareas }: { tareas: TareaTablero[] }) {
  const total = tareas.length;
  const completadas = tareas.filter((tarea) => tarea.columna === "completado").length;
  const avance = total ? Math.round((completadas / total) * 100) : 0;

  const conteoColumnas = useMemo(
    () =>
      COLUMNAS.map((columna) => ({
        ...columna,
        total: tareas.filter((tarea) => tarea.columna === columna.id).length,
      })),
    [tareas],
  );

  const personas = useMemo(() => {
    const mapa = new Map<
      string,
      { id: string; nombre: string; foto: string | null; total: number; completadas: number }
    >();

    for (const tarea of tareas) {
      const id = tarea.responsableId ?? "sin-asignar";
      const actual =
        mapa.get(id) ??
        {
          id,
          nombre: tarea.responsableId ? tarea.responsable : "Sin asignar",
          foto: tarea.responsableId ? tarea.responsableFoto : null,
          total: 0,
          completadas: 0,
        };
      actual.total += 1;
      if (tarea.columna === "completado") actual.completadas += 1;
      if (tarea.responsableId && tarea.responsableFoto) actual.foto = tarea.responsableFoto;
      mapa.set(id, actual);
    }

    return [...mapa.values()].sort((a, b) => {
      if (a.id === "sin-asignar") return 1;
      if (b.id === "sin-asignar") return -1;
      return b.total - a.total || a.nombre.localeCompare(b.nombre);
    });
  }, [tareas]);

  const semana = useMemo(() => {
    const dias: { clave: string; etiqueta: string; numero: string; cantidad: number }[] = [];
    const hoy = new Date();

    for (let i = 6; i >= 0; i -= 1) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i);
      dias.push({
        clave: claveLocal(fecha),
        etiqueta: new Intl.DateTimeFormat("es-CO", { weekday: "short" })
          .format(fecha)
          .replace(".", ""),
        numero: String(fecha.getDate()),
        cantidad: 0,
      });
    }

    const indice = new Map(dias.map((dia) => [dia.clave, dia]));
    for (const tarea of tareas) {
      if (!tarea.completadoEn) continue;
      const dia = indice.get(claveLocal(tarea.completadoEn));
      if (dia) dia.cantidad += 1;
    }

    return dias;
  }, [tareas]);

  const totalSemana = semana.reduce((suma, dia) => suma + dia.cantidad, 0);
  const maxSemana = Math.max(1, ...semana.map((dia) => dia.cantidad));

  if (!total) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-400">
        El seguimiento aparecerá cuando existan tareas en el tablero.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Tarjeta icono={TrendingUp} titulo="Avance general" detalle={`${completadas} de ${total} tareas completadas`}>
        <div className="flex items-end justify-between gap-3">
          <p className="text-3xl font-bold leading-none text-slate-800">
            {avance}
            <span className="text-base font-semibold text-slate-400">%</span>
          </p>
          <div className="flex flex-wrap justify-end gap-1.5">
            {conteoColumnas.map((columna) => (
              <span
                key={columna.id}
                title={columna.titulo}
                className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${columna.color}`} />
                {columna.total}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#EA580C] to-emerald-500 transition-all"
            style={{ width: `${avance}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          {total - completadas} {total - completadas === 1 ? "tarea pendiente" : "tareas pendientes"} en el tablero
        </p>
      </Tarjeta>

      <Tarjeta icono={Users} titulo="Avance por persona" detalle="Tareas asignadas y completadas">
        <ul className="max-h-36 space-y-2 overflow-y-auto pr-1">
          {personas.map((persona) => {
            const pct = persona.total ? Math.round((persona.completadas / persona.total) * 100) : 0;
            return (
              <li key={persona.id} className="flex items-center gap-2">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1F2937] text-[10px] font-bold text-white">
                  {persona.foto ? (
                    <img
                      src={persona.foto}
                      alt={persona.nombre}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    iniciales(persona.nombre)
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-semibold text-slate-600">
                      {persona.nombre}
                    </span>
                    <span className="flex-shrink-0 text-[10px] font-medium text-slate-400">
                      {persona.completadas}/{persona.total}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Tarjeta>

      <Tarjeta
        icono={CalendarRange}
        titulo="Ritmo semanal"
        detalle={`${totalSemana} ${totalSemana === 1 ? "tarea completada" : "tareas completadas"} en 7 días`}
      >
        <div className="flex h-20 items-end justify-between gap-1.5">
          {semana.map((dia) => (
            <div key={dia.clave} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] font-semibold text-slate-400">
                {dia.cantidad || ""}
              </span>
              <div
                title={`${dia.cantidad} completadas`}
                className={`w-full rounded-t ${
                  dia.cantidad ? "bg-[#EA580C]" : "bg-slate-100"
                }`}
                style={{ height: `${Math.max(4, (dia.cantidad / maxSemana) * 52)}px` }}
              />
              <span className="text-[9px] uppercase leading-none text-slate-400">{dia.etiqueta}</span>
              <span className="text-[9px] leading-none text-slate-300">{dia.numero}</span>
            </div>
          ))}
        </div>
      </Tarjeta>
    </div>
  );
}
