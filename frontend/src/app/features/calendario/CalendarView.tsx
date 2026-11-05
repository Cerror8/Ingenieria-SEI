import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { api } from "../../api/client";
import type {
  CalendarioDatos,
  EventoCalendario,
  PrioridadTablero,
  TareaCalendario,
} from "../../types";
import { CargandoModule, ErrorModule } from "../../components/DataState";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const PRIORIDAD_CFG: Record<PrioridadTablero, { punto: string; borde: string; texto: string }> = {
  Alta: { punto: "bg-red-500", borde: "border-l-red-500", texto: "text-red-600" },
  Media: { punto: "bg-amber-500", borde: "border-l-amber-500", texto: "text-amber-600" },
  Baja: { punto: "bg-sky-500", borde: "border-l-sky-500", texto: "text-sky-600" },
};

const campoCls =
  "w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10";

type FormularioEvento = {
  id: string | null;
  titulo: string;
  descripcion: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  todoElDia: boolean;
};

const formularioVacio = (fecha: string): FormularioEvento => ({
  id: null,
  titulo: "",
  descripcion: "",
  fecha,
  horaInicio: "09:00",
  horaFin: "10:00",
  todoElDia: false,
});

function isoDia(fecha: Date) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function diasDelMes(mes: Date) {
  const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const desplazamiento = (primero.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, indice) => {
    const dia = new Date(primero);
    dia.setDate(primero.getDate() - desplazamiento + indice);
    return dia;
  });
}

function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function fechaLarga(dia: string) {
  return capitalizar(
    new Intl.DateTimeFormat("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${dia}T12:00:00`)),
  );
}

function horaCorta(iso: string) {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function claveEvento(iso: string) {
  return isoDia(new Date(iso));
}

export function CalendarView() {
  const [mes, setMes] = useState(() => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  });
  const [datos, setDatos] = useState<CalendarioDatos>({ tareas: [], eventos: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diaSeleccionado, setDiaSeleccionado] = useState(() => isoDia(new Date()));
  const [formulario, setFormulario] = useState<FormularioEvento | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const dias = useMemo(() => diasDelMes(mes), [mes]);
  const desde = isoDia(dias[0]);
  const hasta = isoDia(dias[dias.length - 1]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await api.calendario(desde, hasta);
      setDatos(respuesta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el calendario.");
    } finally {
      setCargando(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!aviso) return;
    const temporizador = window.setTimeout(() => setAviso(null), 3200);
    return () => window.clearTimeout(temporizador);
  }, [aviso]);

  const tareasPorDia = useMemo(() => {
    const mapa: Record<string, TareaCalendario[]> = {};
    for (const tarea of datos.tareas) {
      const clave = (tarea.fechaLimite ?? "").slice(0, 10);
      if (!clave) continue;
      (mapa[clave] ??= []).push(tarea);
    }
    return mapa;
  }, [datos.tareas]);

  const eventosPorDia = useMemo(() => {
    const mapa: Record<string, EventoCalendario[]> = {};
    for (const evento of datos.eventos) {
      const inicio = new Date(evento.fechaInicio);
      const fin = new Date(evento.fechaFin);
      const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
      const ultimo = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());
      let guarda = 0;
      while (cursor <= ultimo && guarda < 62) {
        const clave = isoDia(cursor);
        (mapa[clave] ??= []).push(evento);
        cursor.setDate(cursor.getDate() + 1);
        guarda += 1;
      }
    }
    return mapa;
  }, [datos.eventos]);

  const hoy = isoDia(new Date());
  const tareasDelDia = tareasPorDia[diaSeleccionado] ?? [];
  const eventosDelDia = [...(eventosPorDia[diaSeleccionado] ?? [])].sort((a, b) =>
    a.fechaInicio.localeCompare(b.fechaInicio),
  );

  const cambiarMes = (delta: number) => {
    const siguiente = new Date(mes.getFullYear(), mes.getMonth() + delta, 1);
    setMes(siguiente);
    const enMesActual =
      diaSeleccionado.slice(0, 7) === isoDia(siguiente).slice(0, 7);
    if (!enMesActual) setDiaSeleccionado(isoDia(siguiente));
  };

  const irHoy = () => {
    const ahora = new Date();
    setMes(new Date(ahora.getFullYear(), ahora.getMonth(), 1));
    setDiaSeleccionado(isoDia(ahora));
  };

  const abrirNuevo = (dia = diaSeleccionado) => {
    setErrorFormulario(null);
    setFormulario(formularioVacio(dia));
  };

  const abrirEdicion = (evento: EventoCalendario) => {
    setErrorFormulario(null);
    const inicio = new Date(evento.fechaInicio);
    const fin = new Date(evento.fechaFin);
    setFormulario({
      id: evento.id,
      titulo: evento.titulo,
      descripcion: evento.descripcion ?? "",
      fecha: isoDia(inicio),
      horaInicio: `${String(inicio.getHours()).padStart(2, "0")}:${String(inicio.getMinutes()).padStart(2, "0")}`,
      horaFin: `${String(fin.getHours()).padStart(2, "0")}:${String(fin.getMinutes()).padStart(2, "0")}`,
      todoElDia: evento.todoElDia,
    });
  };

  const guardarEvento = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!formulario) return;
    setErrorFormulario(null);

    if (formulario.titulo.trim().length < 2) {
      setErrorFormulario("Escribe un título de al menos 2 caracteres.");
      return;
    }
    if (!formulario.todoElDia && formulario.horaFin <= formulario.horaInicio) {
      setErrorFormulario("La hora de fin debe ser posterior a la hora de inicio.");
      return;
    }

    const fechaInicio = new Date(
      formulario.todoElDia
        ? `${formulario.fecha}T00:00:00`
        : `${formulario.fecha}T${formulario.horaInicio}:00`,
    );
    const fechaFin = new Date(
      formulario.todoElDia
        ? `${formulario.fecha}T23:59:00`
        : `${formulario.fecha}T${formulario.horaFin}:00`,
    );

    const cuerpo = {
      titulo: formulario.titulo.trim(),
      descripcion: formulario.descripcion.trim(),
      fechaInicio: fechaInicio.toISOString(),
      fechaFin: fechaFin.toISOString(),
      todoElDia: formulario.todoElDia,
    };

    setGuardando(true);
    try {
      if (formulario.id) {
        await api.actualizarEvento(formulario.id, cuerpo);
        setAviso("Evento actualizado.");
      } else {
        await api.crearEvento(cuerpo);
        setAviso("Evento creado.");
      }
      setDiaSeleccionado(formulario.fecha);
      setFormulario(null);
      await cargar();
    } catch (e) {
      setErrorFormulario(e instanceof Error ? e.message : "No se pudo guardar el evento.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarEvento = async (eventoId: string) => {
    if (!window.confirm("¿Eliminar este evento del calendario?")) return;
    try {
      await api.eliminarEvento(eventoId);
      setAviso("Evento eliminado.");
      setFormulario((actual) => (actual?.id === eventoId ? null : actual));
      await cargar();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo eliminar el evento.");
    }
  };

  const etiquetaMes = capitalizar(
    new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(mes),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Calendario</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Fechas límite de las tareas y tu agenda personal de reuniones.
          </p>
        </div>
        <button
          type="button"
          onClick={() => abrirNuevo()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#9A3412]"
        >
          <Plus className="h-4 w-4" />
          Nuevo evento
        </button>
      </div>

      {aviso && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-semibold text-[#9A3412]">
          {aviso}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => cambiarMes(-1)}
                aria-label="Mes anterior"
                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={irHoy}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => cambiarMes(1)}
                aria-label="Mes siguiente"
                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <h2 className="ml-2 text-sm font-bold text-gray-800">{etiquetaMes}</h2>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-medium text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Tarea
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#C2410C]" />
                Evento
              </span>
            </div>
          </div>

          {cargando ? (
            <CargandoModule mensaje="Cargando calendario…" />
          ) : error ? (
            <ErrorModule mensaje={error} onRetry={() => void cargar()} />
          ) : (
            <>
              <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/60">
                {DIAS_SEMANA.map((dia) => (
                  <div
                    key={dia}
                    className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-gray-400 sm:text-[11px]"
                  >
                    <span className="hidden sm:inline">{dia}</span>
                    <span className="sm:hidden">{dia[0]}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {dias.map((dia) => {
                  const clave = isoDia(dia);
                  const delMes = dia.getMonth() === mes.getMonth();
                  const esHoy = clave === hoy;
                  const seleccionado = clave === diaSeleccionado;
                  const tareas = tareasPorDia[clave] ?? [];
                  const eventos = eventosPorDia[clave] ?? [];

                  return (
                    <button
                      key={clave}
                      type="button"
                      onClick={() => setDiaSeleccionado(clave)}
                      onDoubleClick={() => abrirNuevo(clave)}
                      className={`relative flex min-h-[72px] flex-col gap-1 border-b border-r border-gray-100 p-1 text-left transition-colors last:border-r-0 sm:min-h-[96px] sm:p-1.5 ${
                        seleccionado ? "bg-orange-50/80" : "hover:bg-gray-50"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center self-end rounded-full text-[11px] font-semibold sm:self-start ${
                          esHoy
                            ? "bg-[#C2410C] text-white"
                            : delMes
                              ? "text-gray-700"
                              : "text-gray-300"
                        }`}
                      >
                        {dia.getDate()}
                      </span>

                      <span className="hidden flex-col gap-0.5 sm:flex">
                        {tareas.slice(0, 2).map((tarea) => (
                          <span
                            key={tarea.id}
                            className="flex items-center gap-1 truncate rounded bg-white/70 px-1 py-0.5 text-[10px] text-gray-600"
                          >
                            <span
                              className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${PRIORIDAD_CFG[tarea.prioridad].punto}`}
                            />
                            <span className="truncate">{tarea.titulo}</span>
                          </span>
                        ))}
                        {eventos.slice(0, 2).map((evento) => (
                          <span
                            key={evento.id}
                            className="flex items-center gap-1 truncate rounded bg-[#C2410C]/10 px-1 py-0.5 text-[10px] font-medium text-[#9A3412]"
                          >
                            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#C2410C]" />
                            <span className="truncate">{evento.titulo}</span>
                          </span>
                        ))}
                        {tareas.length + eventos.length > 4 && (
                          <span className="px-1 text-[10px] font-semibold text-gray-400">
                            +{tareas.length + eventos.length - 4} más
                          </span>
                        )}
                      </span>

                      <span className="mt-auto flex gap-0.5 sm:hidden">
                        {[...tareas.slice(0, 2), ...eventos.slice(0, 3)].map((item, indice) => (
                          <span
                            key={`${item.id}-${indice}`}
                            className={`h-1 w-1 rounded-full ${
                              "prioridad" in item ? PRIORIDAD_CFG[item.prioridad].punto : "bg-[#C2410C]"
                            }`}
                          />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <aside className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#9A3412]">
                Día seleccionado
              </p>
              <h3 className="mt-0.5 text-sm font-bold text-gray-800">
                {fechaLarga(diaSeleccionado)}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => abrirNuevo(diaSeleccionado)}
              aria-label="Agregar evento en este día"
              className="rounded-lg bg-orange-50 p-2 text-[#C2410C] transition-colors hover:bg-orange-100"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {tareasDelDia.length === 0 && eventosDelDia.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center">
                <CalendarDays className="h-7 w-7 text-gray-300" />
                <p className="text-xs font-semibold text-gray-500">Sin actividad este día</p>
                <p className="text-[11px] text-gray-400">
                  Crea un evento o revisa las tareas con fecha límite.
                </p>
              </div>
            )}

            {tareasDelDia.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  Tareas con fecha límite
                </p>
                <ul className="space-y-1.5">
                  {tareasDelDia.map((tarea) => (
                    <li
                      key={tarea.id}
                      className={`rounded-r-lg border-l-4 bg-gray-50 px-3 py-2 ${PRIORIDAD_CFG[tarea.prioridad].borde}`}
                    >
                      <p className="text-xs font-semibold text-gray-700">{tarea.titulo}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400">
                        <span className={`font-semibold ${PRIORIDAD_CFG[tarea.prioridad].texto}`}>
                          {tarea.prioridad}
                        </span>
                        <span>·</span>
                        <span className="truncate">{tarea.tablero}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {eventosDelDia.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  Mi agenda
                </p>
                <ul className="space-y-1.5">
                  {eventosDelDia.map((evento) => (
                    <li
                      key={evento.id}
                      className="group flex items-start gap-2 rounded-lg border border-gray-100 px-3 py-2"
                    >
                      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#C2410C]/10">
                        <Clock className="h-3 w-3 text-[#C2410C]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-gray-700">{evento.titulo}</p>
                        <p className="text-[11px] text-gray-400">
                          {evento.todoElDia
                            ? "Todo el día"
                            : `${horaCorta(evento.fechaInicio)} – ${horaCorta(evento.fechaFin)}`}
                        </p>
                        {evento.descripcion && (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-gray-500">
                            {evento.descripcion}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => abrirEdicion(evento)}
                          aria-label={`Editar ${evento.titulo}`}
                          className="rounded p-1 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-600"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void eliminarEvento(evento.id)}
                          aria-label={`Eliminar ${evento.titulo}`}
                          className="rounded p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>

      {formulario && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-gray-800">
                  {formulario.id ? "Editar evento" : "Nuevo evento"}
                </h2>
                <p className="text-xs text-gray-500">Reserva un espacio en tu agenda personal.</p>
              </div>
              <button
                type="button"
                onClick={() => setFormulario(null)}
                aria-label="Cerrar"
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(evento) => void guardarEvento(evento)} className="space-y-4 px-5 py-4">
              <div>
                <label htmlFor="evento-titulo" className="text-xs font-semibold text-slate-700">
                  Título
                </label>
                <input
                  id="evento-titulo"
                  autoFocus
                  value={formulario.titulo}
                  onChange={(e) => setFormulario({ ...formulario, titulo: e.target.value })}
                  placeholder="Reunión de seguimiento"
                  maxLength={160}
                  required
                  className={`mt-1.5 ${campoCls}`}
                />
              </div>

              <div>
                <label htmlFor="evento-descripcion" className="text-xs font-semibold text-slate-700">
                  Descripción
                </label>
                <textarea
                  id="evento-descripcion"
                  value={formulario.descripcion}
                  onChange={(e) => setFormulario({ ...formulario, descripcion: e.target.value })}
                  rows={2}
                  maxLength={2000}
                  placeholder="Tema, enlace de la reunión o notas…"
                  className={`mt-1.5 resize-none ${campoCls}`}
                />
              </div>

              <div>
                <label htmlFor="evento-fecha" className="text-xs font-semibold text-slate-700">
                  Fecha
                </label>
                <input
                  id="evento-fecha"
                  type="date"
                  value={formulario.fecha}
                  onChange={(e) => setFormulario({ ...formulario, fecha: e.target.value })}
                  required
                  className={`mt-1.5 ${campoCls}`}
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={formulario.todoElDia}
                  onChange={(e) => setFormulario({ ...formulario, todoElDia: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-[#C2410C] focus:ring-orange-500/30"
                />
                Todo el día
              </label>

              {!formulario.todoElDia && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="evento-hora-inicio" className="text-xs font-semibold text-slate-700">
                      Hora de inicio
                    </label>
                    <input
                      id="evento-hora-inicio"
                      type="time"
                      value={formulario.horaInicio}
                      onChange={(e) =>
                        setFormulario({ ...formulario, horaInicio: e.target.value })
                      }
                      required
                      className={`mt-1.5 ${campoCls}`}
                    />
                  </div>
                  <div>
                    <label htmlFor="evento-hora-fin" className="text-xs font-semibold text-slate-700">
                      Hora de fin
                    </label>
                    <input
                      id="evento-hora-fin"
                      type="time"
                      value={formulario.horaFin}
                      onChange={(e) => setFormulario({ ...formulario, horaFin: e.target.value })}
                      required
                      className={`mt-1.5 ${campoCls}`}
                    />
                  </div>
                </div>
              )}

              {errorFormulario && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {errorFormulario}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                {formulario.id ? (
                  <button
                    type="button"
                    onClick={() => void eliminarEvento(formulario.id as string)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => setFormulario(null)}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardando}
                    className="rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {guardando ? "Guardando…" : formulario.id ? "Guardar cambios" : "Crear evento"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
