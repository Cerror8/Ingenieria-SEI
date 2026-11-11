import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Edit2, Plus, Trash2, X } from "lucide-react";
import { api, mapActividad } from "../../api/client";
import { ACT_STATUS_CFG, GANTT_MONTHS } from "../../constants";
import type { GanttActivity } from "../../types";

type EstadoActividad = GanttActivity["status"];

const ESTADOS: EstadoActividad[] = ["Pendiente", "En curso", "Completada", "Retrasada"];

export function GanttTab({
  proyectoId,
  anio,
  onChanged,
  onShowToast,
}: {
  proyectoId: string;
  anio: number;
  onChanged?: () => void;
  onShowToast: (mensaje: string) => void;
}) {
  const [actividades, setActividades] = useState<GanttActivity[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ actividad: GanttActivity | null } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const detalle = await api.proyecto(proyectoId);
      setActividades(detalle.actividades.map(mapActividad));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el cronograma.");
    } finally {
      setCargando(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const eliminar = async (actividad: GanttActivity) => {
    if (!window.confirm(`¿Eliminar la actividad "${actividad.name}" del cronograma?`)) return;
    setError(null);
    setOcupado(actividad.id);
    try {
      await api.eliminarActividad(proyectoId, actividad.id);
      setActividades((prev) => prev.filter((a) => a.id !== actividad.id));
      onShowToast("Actividad eliminada del cronograma.");
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar la actividad.");
    } finally {
      setOcupado(null);
    }
  };

  const guardada = async () => {
    setEditor(null);
    await cargar();
    onShowToast("Cronograma actualizado.");
    onChanged?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-800">Cronograma Gantt</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            {proyectoId} · {anio} · {actividades.length} actividad(es)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditor({ actividad: null })}
          className="flex items-center gap-1.5 self-start rounded-lg bg-[#C2410C] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#9A3412] sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />Nueva actividad
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <p className="flex-1">{error}</p>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar aviso" className="text-red-400 hover:text-red-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {cargando ? (
        <p className="py-10 text-center text-sm text-gray-400">Cargando cronograma…</p>
      ) : actividades.length === 0 ? (
        <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50/40 p-6 text-center">
          <p className="text-sm font-bold text-gray-800">El cronograma está vacío</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-gray-500">
            Agrega las actividades con su mes de inicio y fin para ver el Gantt. Los cambios se
            guardan en el proyecto y aparecen en el seguimiento.
          </p>
          <button
            type="button"
            onClick={() => setEditor({ actividad: null })}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#C2410C] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#9A3412]"
          >
            <Plus className="h-3.5 w-3.5" />Agregar la primera actividad
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100">
          <div className="overflow-x-auto">
            <div style={{ minWidth: 960 }}>
              <div className="flex border-b border-gray-100 bg-gray-50/70">
                <div className="w-52 flex-shrink-0 border-r border-gray-100 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Actividad
                </div>
                <div className="hidden w-28 flex-shrink-0 border-r border-gray-100 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 sm:block">
                  Responsable
                </div>
                <div className="w-16 flex-shrink-0 border-r border-gray-100 px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Inicio
                </div>
                <div className="w-16 flex-shrink-0 border-r border-gray-100 px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Fin
                </div>
                <div className="w-12 flex-shrink-0 border-r border-gray-100 px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Dur.
                </div>
                <div className="w-12 flex-shrink-0 border-r border-gray-100 px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Av.
                </div>
                <div className="grid flex-1 grid-cols-12">
                  {GANTT_MONTHS.map((mes) => (
                    <div key={mes} className="border-r border-gray-100 px-1 py-2.5 text-center text-[10px] font-bold text-gray-400 last:border-r-0">
                      {mes}
                    </div>
                  ))}
                </div>
                <div className="w-20 flex-shrink-0 border-l border-gray-100 px-2 py-2.5 text-[10px] font-bold uppercase text-gray-500">
                  Acciones
                </div>
              </div>

              {actividades.map((actividad) => {
                const izquierda = ((actividad.startMonth - 1) / 12) * 100;
                const ancho = ((actividad.endMonth - actividad.startMonth + 1) / 12) * 100;
                const color = actividad.isMilestone
                  ? "#F59E0B"
                  : actividad.status === "Completada"
                    ? "#10B981"
                    : actividad.status === "En curso"
                      ? "#EA580C"
                      : actividad.status === "Retrasada"
                        ? "#EF4444"
                        : "#CBD5E1";
                const cfg = ACT_STATUS_CFG[actividad.status];

                return (
                  <div
                    key={actividad.id}
                    className={`flex border-b border-gray-50 transition-colors hover:bg-orange-50/5 ${actividad.isMilestone ? "bg-amber-50/20" : ""}`}
                  >
                    <div className="w-52 flex-shrink-0 border-r border-gray-100 px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {actividad.isMilestone && <span className="text-amber-500">◆</span>}
                        <span className="truncate text-xs font-semibold text-gray-800">{actividad.name}</span>
                      </div>
                      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
                        {actividad.status}
                      </span>
                    </div>
                    <div className="hidden w-28 flex-shrink-0 items-center border-r border-gray-100 px-3 py-3 text-xs text-gray-500 sm:flex">
                      {actividad.responsible || "Sin asignar"}
                    </div>
                    <div className="flex w-16 flex-shrink-0 items-center border-r border-gray-100 px-2 py-3 text-xs text-gray-400">
                      {GANTT_MONTHS[actividad.startMonth - 1]}
                    </div>
                    <div className="flex w-16 flex-shrink-0 items-center border-r border-gray-100 px-2 py-3 text-xs text-gray-400">
                      {GANTT_MONTHS[actividad.endMonth - 1]}
                    </div>
                    <div className="flex w-12 flex-shrink-0 items-center border-r border-gray-100 px-2 py-3 text-xs text-gray-400">
                      {actividad.endMonth - actividad.startMonth + 1}m
                    </div>
                    <div className="flex w-12 flex-shrink-0 items-center border-r border-gray-100 px-2 py-3 text-xs font-bold text-gray-700">
                      {actividad.progress}%
                    </div>
                    <div className="relative flex flex-1 items-center py-3">
                      <div className="absolute inset-x-0 inset-y-0 flex items-center px-1">
                        {Array.from({ length: 11 }, (_, indice) => (
                          <div
                            key={indice}
                            className="absolute h-full border-r border-gray-100"
                            style={{ left: `${((indice + 1) / 12) * 100}%` }}
                          />
                        ))}
                        {actividad.isMilestone ? (
                          <div
                            className="absolute flex items-center justify-center"
                            style={{ left: `${izquierda}%`, transform: "translateX(-50%)" }}
                          >
                            <span className="text-lg text-amber-500">◆</span>
                          </div>
                        ) : (
                          <div
                            className="absolute flex h-4 items-center overflow-hidden rounded-full"
                            style={{
                              left: `${izquierda}%`,
                              width: `${ancho}%`,
                              backgroundColor: `${color}30`,
                              border: `1.5px solid ${color}`,
                            }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${actividad.progress}%`, backgroundColor: color }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex w-20 flex-shrink-0 items-center gap-0.5 border-l border-gray-100 px-2 py-3">
                      <button
                        type="button"
                        onClick={() => setEditor({ actividad })}
                        title="Editar actividad"
                        className="rounded p-1 text-gray-300 transition-colors hover:bg-orange-50 hover:text-orange-600"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void eliminar(actividad)}
                        disabled={ocupado === actividad.id}
                        title="Eliminar actividad"
                        className="rounded p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-wait disabled:opacity-40"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
        {[
          ["#10B981", "Completada"],
          ["#EA580C", "En curso"],
          ["#CBD5E1", "Pendiente"],
          ["#EF4444", "Retrasada"],
          ["#F59E0B", "Hito"],
        ].map(([color, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="h-3 w-3 flex-shrink-0 rounded-sm" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
      </div>

      {editor && (
        <EditorActividad
          key={editor.actividad?.id ?? "nueva"}
          proyectoId={proyectoId}
          actividad={editor.actividad}
          onCerrar={() => setEditor(null)}
          onGuardada={() => void guardada()}
        />
      )}
    </div>
  );
}

function EditorActividad({
  proyectoId,
  actividad,
  onCerrar,
  onGuardada,
}: {
  proyectoId: string;
  actividad: GanttActivity | null;
  onCerrar: () => void;
  onGuardada: () => void;
}) {
  const [nombre, setNombre] = useState(actividad?.name ?? "");
  const [responsable, setResponsable] = useState(actividad?.responsible ?? "");
  const [mesInicio, setMesInicio] = useState(actividad?.startMonth ?? 1);
  const [mesFin, setMesFin] = useState(actividad?.endMonth ?? 1);
  const [avance, setAvance] = useState(actividad?.progress ?? 0);
  const [estado, setEstado] = useState<EstadoActividad>(actividad?.status ?? "Pendiente");
  const [hito, setHito] = useState(Boolean(actividad?.isMilestone));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (guardando) return;
    if (!nombre.trim()) return setError("Escribe el nombre de la actividad.");
    if (mesFin < mesInicio) return setError("El mes de fin no puede ser anterior al de inicio.");

    setGuardando(true);
    setError(null);
    const datos = {
      nombre: nombre.trim(),
      responsable: responsable.trim(),
      mesInicio,
      mesFin,
      avance,
      estado,
      hito,
    };

    try {
      if (actividad) {
        await api.actualizarActividad(proyectoId, actividad.id, datos);
      } else {
        await api.crearActividad(proyectoId, datos);
      }
      onGuardada();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la actividad.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={(evento) => void guardar(evento)}
        className="w-full max-w-lg rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-bold text-gray-900">
            {actividad ? "Editar actividad" : "Nueva actividad"}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="gantt-nombre" className="text-xs font-semibold text-slate-700">
              Actividad
            </label>
            <input
              id="gantt-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={200}
              required
              className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
            />
          </div>

          <div>
            <label htmlFor="gantt-responsable" className="text-xs font-semibold text-slate-700">
              Responsable
            </label>
            <input
              id="gantt-responsable"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              maxLength={120}
              placeholder="Sin asignar"
              className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="gantt-mes-inicio" className="text-xs font-semibold text-slate-700">
                Mes de inicio
              </label>
              <select
                id="gantt-mes-inicio"
                value={mesInicio}
                onChange={(e) => setMesInicio(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
              >
                {GANTT_MONTHS.map((mes, indice) => (
                  <option key={mes} value={indice + 1}>{mes}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="gantt-mes-fin" className="text-xs font-semibold text-slate-700">
                Mes de fin
              </label>
              <select
                id="gantt-mes-fin"
                value={mesFin}
                onChange={(e) => setMesFin(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
              >
                {GANTT_MONTHS.map((mes, indice) => (
                  <option key={mes} value={indice + 1}>{mes}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="gantt-avance" className="text-xs font-semibold text-slate-700">
                Avance (%)
              </label>
              <input
                id="gantt-avance"
                type="number"
                min={0}
                max={100}
                value={avance}
                onChange={(e) => setAvance(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
              />
            </div>
            <div>
              <label htmlFor="gantt-estado" className="text-xs font-semibold text-slate-700">
                Estado
              </label>
              <select
                id="gantt-estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value as EstadoActividad)}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
              >
                {ESTADOS.map((valor) => <option key={valor} value={valor}>{valor}</option>)}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={hito}
              onChange={(e) => setHito(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500/30"
            />
            Marcar como hito
          </label>

          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9A3412] disabled:cursor-wait disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Guardar actividad"}
          </button>
        </div>
      </form>
    </div>
  );
}
