import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api, type TableroApi } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import type {
  ColumnaPersonal,
  ColumnaTablero,
  PrioridadTablero,
  TareaPersonal,
  TareaTablero,
  UsuarioAsignable,
} from "../../types";
import { CargandoModule, ErrorModule } from "../../components/DataState";
import { calcularUrgencia, fechaCorta, type NivelUrgencia } from "../../lib/urgencia";
import { TareaDetalle } from "../tableros/TareaDetalle";

const COLUMNAS_PROYECTO: { id: ColumnaTablero; titulo: string; dot: string; barra: string }[] = [
  { id: "por-hacer", titulo: "Por hacer", dot: "bg-slate-400", barra: "bg-slate-300" },
  { id: "en-curso", titulo: "En curso", dot: "bg-blue-500", barra: "bg-blue-500" },
  { id: "en-revision", titulo: "En revisión", dot: "bg-amber-500", barra: "bg-amber-500" },
  { id: "completado", titulo: "Completado", dot: "bg-green-500", barra: "bg-green-500" },
];

const COLUMNAS_PERSONAL: { id: ColumnaPersonal; titulo: string; dot: string; barra: string }[] = [
  { id: "por-hacer", titulo: "Por hacer", dot: "bg-slate-400", barra: "bg-slate-300" },
  { id: "en-curso", titulo: "En curso", dot: "bg-blue-500", barra: "bg-blue-500" },
  { id: "completado", titulo: "Completado", dot: "bg-green-500", barra: "bg-green-500" },
];

const PRIORIDAD_BADGE: Record<PrioridadTablero, string> = {
  Alta: "bg-red-50 text-red-700 border-red-200",
  Media: "bg-amber-50 text-amber-700 border-amber-200",
  Baja: "bg-sky-50 text-sky-700 border-sky-200",
};

const BORDE_URGENCIA: Record<NivelUrgencia, string> = {
  verde: "border-l-emerald-400",
  azul: "border-l-sky-400",
  amarillo: "border-l-amber-400",
  naranja: "border-l-orange-500",
  rojo: "border-l-rose-500",
  morado: "border-l-purple-600",
  "sin-fecha": "border-l-slate-200",
};

const campoCls =
  "w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10";

type Formulario = {
  id: string | null;
  titulo: string;
  descripcion: string;
  proyectoId: string;
  prioridad: PrioridadTablero;
  fechaLimite: string;
  etiqueta: string;
  columna: ColumnaPersonal;
};

const formularioVacio = (): Formulario => ({
  id: null,
  titulo: "",
  descripcion: "",
  proyectoId: "",
  prioridad: "Media",
  fechaLimite: "",
  etiqueta: "Personal",
  columna: "por-hacer",
});

function TarjetaResumen({
  icono: Icono,
  titulo,
  valor,
  detalle,
  tono,
}: {
  icono: LucideIcon;
  titulo: string;
  valor: number;
  detalle: string;
  tono: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-2.5">
        <span className={`rounded-lg p-1.5 ${tono}`}>
          <Icono className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-700">{titulo}</p>
          <p className="text-[11px] text-slate-400">{detalle}</p>
        </div>
        <span className="ml-auto text-2xl font-bold leading-none text-slate-800">{valor}</span>
      </div>
    </div>
  );
}

export function MiTableroView({ onNavigate }: { onNavigate: (v: string) => void }) {
  const { usuario } = useAuth();
  const [tareasProyecto, setTareasProyecto] = useState<TareaTablero[]>([]);
  const [tareasPersonales, setTareasPersonales] = useState<TareaPersonal[]>([]);
  const [proyectos, setProyectos] = useState<{ id: string; nombre: string }[]>([]);
  const [usuariosAsignables, setUsuariosAsignables] = useState<UsuarioAsignable[]>([]);
  const [filtroProyecto, setFiltroProyecto] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [accionId, setAccionId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [miTablero, { usuarios }] = await Promise.all([
        api.miTablero(),
        api.usuariosAsignables(),
      ]);
      setTareasProyecto(miTablero.tareasProyecto);
      setTareasPersonales(miTablero.tareasPersonales);
      setProyectos(miTablero.proyectos);
      setUsuariosAsignables(usuarios);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar tu tablero.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!aviso) return;
    const temporizador = window.setTimeout(() => setAviso(null), 3600);
    return () => window.clearTimeout(temporizador);
  }, [aviso]);

  const resumen = useMemo(() => {
    const proyectoCompletadas = tareasProyecto.filter((t) => t.columna === "completado").length;
    const personalesCompletadas = tareasPersonales.filter(
      (t) => t.columna === "completado",
    ).length;
    const vencidas = [...tareasProyecto, ...tareasPersonales].filter(
      (t) => t.columna !== "completado" && calcularUrgencia(t.fechaLimite).nivel === "morado",
    ).length;
    return {
      proyectoTotal: tareasProyecto.length,
      proyectoCompletadas,
      proyectoPendientes: tareasProyecto.length - proyectoCompletadas,
      personalTotal: tareasPersonales.length,
      personalesCompletadas,
      personalesPendientes: tareasPersonales.length - personalesCompletadas,
      vencidas,
    };
  }, [tareasProyecto, tareasPersonales]);

  const tareasProyectoFiltradas = useMemo(
    () =>
      filtroProyecto
        ? tareasProyecto.filter((tarea) => tarea.proyectoId === filtroProyecto)
        : tareasProyecto,
    [tareasProyecto, filtroProyecto],
  );

  const tareasPersonalesFiltradas = useMemo(
    () =>
      filtroProyecto
        ? tareasPersonales.filter((tarea) => tarea.proyectoId === filtroProyecto)
        : tareasPersonales,
    [tareasPersonales, filtroProyecto],
  );

  const tareaDetalle = detalleId
    ? (tareasProyecto.find((tarea) => tarea.id === detalleId) ?? null)
    : null;

  const tableroDe = (tarea: TareaTablero): TableroApi => ({
    id: tarea.tableroId,
    nombre: tarea.tableroNombre ?? "Tablero",
    descripcion: "",
    creadoPor: tarea.tableroCreadoPor,
    creadoPorNombre: tarea.tableroCreadoPorNombre,
  });

  const actualizarProyecto = useCallback((actualizada: TareaTablero) => {
    setTareasProyecto((prev) =>
      prev.map((tarea) => (tarea.id === actualizada.id ? actualizada : tarea)),
    );
  }, []);

  const actualizarContadores = useCallback(
    (tareaId: string, cambios: { comentarios?: number; adjuntos?: number }) => {
      setTareasProyecto((prev) =>
        prev.map((tarea) => (tarea.id === tareaId ? { ...tarea, ...cambios } : tarea)),
      );
    },
    [],
  );

  function abrirNueva() {
    setFormulario(formularioVacio());
  }

  function abrirEdicion(tarea: TareaPersonal) {
    setFormulario({
      id: tarea.id,
      titulo: tarea.titulo,
      descripcion: tarea.descripcion,
      proyectoId: tarea.proyectoId ?? "",
      prioridad: tarea.prioridad,
      fechaLimite: tarea.fechaLimite ? tarea.fechaLimite.slice(0, 10) : "",
      etiqueta: tarea.etiqueta,
      columna: tarea.columna,
    });
  }

  async function guardarPersonal(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!formulario || !formulario.titulo.trim()) return;

    setGuardando(true);
    setAviso(null);
    try {
      const cuerpo = {
        titulo: formulario.titulo.trim(),
        descripcion: formulario.descripcion.trim(),
        proyectoId: formulario.proyectoId || null,
        prioridad: formulario.prioridad,
        fechaLimite: formulario.fechaLimite || null,
        etiqueta: formulario.etiqueta.trim() || "Personal",
        columna: formulario.columna,
      };

      if (formulario.id) {
        const { tarea } = await api.actualizarTareaPersonal(formulario.id, cuerpo);
        setTareasPersonales((prev) =>
          prev.map((actual) => (actual.id === tarea.id ? tarea : actual)),
        );
        setAviso("Tarea personal actualizada.");
      } else {
        const { tarea } = await api.crearTareaPersonal(cuerpo);
        setTareasPersonales((prev) => [...prev, tarea]);
        setAviso(
          tarea.fechaLimite
            ? "Tarea personal creada y agregada a tu calendario."
            : "Tarea personal creada.",
        );
      }
      setFormulario(null);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo guardar la tarea personal.");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarColumna(tarea: TareaPersonal, columna: ColumnaPersonal) {
    setAccionId(tarea.id);
    setAviso(null);
    try {
      const { tarea: actualizada } = await api.actualizarTareaPersonal(tarea.id, { columna });
      setTareasPersonales((prev) =>
        prev.map((actual) => (actual.id === actualizada.id ? actualizada : actual)),
      );
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo mover la tarea personal.");
    } finally {
      setAccionId(null);
    }
  }

  async function eliminarPersonal(tarea: TareaPersonal) {
    if (!window.confirm(`¿Eliminar la tarea personal “${tarea.titulo}”?`)) return;
    setAccionId(tarea.id);
    setAviso(null);
    try {
      await api.eliminarTareaPersonal(tarea.id);
      setTareasPersonales((prev) => prev.filter((actual) => actual.id !== tarea.id));
      setFormulario((actual) => (actual?.id === tarea.id ? null : actual));
      setAviso("Tarea personal eliminada.");
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo eliminar la tarea personal.");
    } finally {
      setAccionId(null);
    }
  }

  if (cargando) return <CargandoModule mensaje="Cargando tu tablero personal…" />;
  if (error) return <ErrorModule mensaje={error} onRetry={() => void cargar()} />;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mi tablero</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Tareas de todos tus proyectos asignados y tus propias tareas personales.
          </p>
          {usuario && (
            <p className="mt-1 text-[11px] font-semibold text-slate-400">{usuario.nombre}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => onNavigate("calendario")}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
          >
            <CalendarDays className="h-4 w-4" />
            Ver calendario
          </button>
          <button
            type="button"
            onClick={abrirNueva}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#9A3412]"
          >
            <Plus className="h-4 w-4" />
            Nueva tarea personal
          </button>
        </div>
      </div>

      {aviso && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5">
          <p className="text-xs font-semibold text-[#9A3412]">{aviso}</p>
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
            <X className="h-4 w-4 text-[#C2410C]" />
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <TarjetaResumen
          icono={ClipboardList}
          titulo="Tareas de proyectos"
          valor={resumen.proyectoTotal}
          detalle={`${resumen.proyectoPendientes} pendientes · ${resumen.proyectoCompletadas} completadas`}
          tono="bg-orange-50 text-[#C2410C]"
        />
        <TarjetaResumen
          icono={CalendarDays}
          titulo="Tareas personales"
          valor={resumen.personalTotal}
          detalle={`${resumen.personalesPendientes} pendientes · ${resumen.personalesCompletadas} completadas`}
          tono="bg-blue-50 text-blue-600"
        />
        <TarjetaResumen
          icono={AlertTriangle}
          titulo="Tareas vencidas"
          valor={resumen.vencidas}
          detalle="Sin completar y con fecha pasada"
          tono="bg-red-50 text-red-600"
        />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold text-slate-700">Filtrar por proyecto</p>
          <p className="text-[11px] text-slate-400">
            {filtroProyecto
              ? `${tareasProyectoFiltradas.length + tareasPersonalesFiltradas.length} tareas en el proyecto seleccionado`
              : `Mostrando todos los proyectos · ${tareasProyecto.length + tareasPersonales.length} tareas`}
          </p>
        </div>
        <select
          value={filtroProyecto}
          onChange={(e) => setFiltroProyecto(e.target.value)}
          aria-label="Filtrar tareas por proyecto"
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 outline-none focus:border-[#EA580C] sm:ml-auto sm:w-auto sm:min-w-[280px]"
        >
          <option value="">Todos los proyectos</option>
          {proyectos.map((proyecto) => (
            <option key={proyecto.id} value={proyecto.id}>
              {proyecto.id} · {proyecto.nombre}
            </option>
          ))}
        </select>
      </div>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Tareas asignadas en mis proyectos
            </h2>
            <p className="text-xs text-slate-500">
              Reunidas de todos los tableros donde eres responsable. Abre una tarjeta para
              comentar, adjuntar evidencias o avanzar en el flujo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("tableros")}
            className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-[#C2410C] hover:underline sm:self-auto"
          >
            Ir a Tableros
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {tareasProyectoFiltradas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-600">
              No tienes tareas de proyectos asignadas
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Cuando alguien te asigne una tarea en un tablero, aparecerá aquí.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNAS_PROYECTO.map((columna) => {
              const tareasColumna = tareasProyectoFiltradas.filter(
                (tarea) => tarea.columna === columna.id,
              );

              return (
                <div
                  key={columna.id}
                  className="flex min-h-[240px] flex-col rounded-xl border border-slate-200 bg-slate-50/80"
                >
                  <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${columna.dot}`} />
                      <h3 className="text-xs font-bold text-slate-700">{columna.titulo}</h3>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        {tareasColumna.length}
                      </span>
                    </div>
                    <div className={`h-1 w-6 rounded-full ${columna.barra}`} />
                  </header>

                  <div className="flex-1 space-y-2.5 p-2.5">
                    {tareasColumna.map((tarea) => {
                      const completada = tarea.columna === "completado";
                      const urgencia = calcularUrgencia(tarea.fechaLimite);
                      const borde = completada
                        ? "border-l-emerald-400"
                        : BORDE_URGENCIA[urgencia.nivel];

                      return (
                        <article
                          key={tarea.id}
                          className={`rounded-lg border border-l-4 bg-white p-3 shadow-sm transition hover:shadow-md ${borde}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9A3412]">
                              {tarea.etiqueta}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${PRIORIDAD_BADGE[tarea.prioridad]}`}
                            >
                              {tarea.prioridad}
                            </span>
                          </div>

                          <h4 className="mt-2 text-sm font-semibold leading-snug text-slate-800">
                            {tarea.titulo}
                          </h4>
                          <p className="mt-1 truncate text-[10px] font-semibold text-slate-400">
                            {tarea.proyectoId
                              ? `${tarea.proyectoId} · ${tarea.proyectoNombre ?? "Proyecto"}`
                              : "Sin proyecto"}
                          </p>

                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                completada
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : urgencia.badge
                              }`}
                            >
                              <CalendarDays className="h-3 w-3" />
                              {fechaCorta(tarea.fechaLimite)}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                              <MessageSquare className="h-3 w-3" />
                              {tarea.comentarios}
                              <Paperclip className="ml-1 h-3 w-3" />
                              {tarea.adjuntos}
                            </span>
                          </div>

                          {!completada && tarea.fechaLimite && (
                            <p className="mt-2 text-[10px] font-medium text-slate-400">
                              {urgencia.etiqueta} · {urgencia.restante}
                            </p>
                          )}

                          <button
                            type="button"
                            onClick={() => setDetalleId(tarea.id)}
                            className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-[#EA580C] hover:text-[#C2410C]"
                          >
                            Abrir tarea
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </article>
                      );
                    })}

                    {tareasColumna.length === 0 && (
                      <p className="rounded-lg border border-dashed border-slate-300 px-2 py-5 text-center text-[11px] text-slate-400">
                        Sin tareas
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">Mis tareas personales</h2>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <CalendarDays className="h-3.5 w-3.5 text-[#C2410C]" />
              Son privadas y, si les pones fecha límite, aparecen en tu calendario personal.
            </p>
          </div>
          <button
            type="button"
            onClick={abrirNueva}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-[#9A3412] transition hover:bg-orange-100 sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar tarea personal
          </button>
        </div>

        {tareasPersonalesFiltradas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-600">
              Todavía no tienes tareas personales
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Crea recordatorios, pendientes o actividades propias sin depender de un proyecto.
            </p>
            <button
              type="button"
              onClick={abrirNueva}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#C2410C] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#9A3412]"
            >
              <Plus className="h-3.5 w-3.5" />
              Crear mi primera tarea
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {COLUMNAS_PERSONAL.map((columna) => {
              const tareasColumna = tareasPersonalesFiltradas.filter(
                (tarea) => tarea.columna === columna.id,
              );

              return (
                <div
                  key={columna.id}
                  className="flex min-h-[220px] flex-col rounded-xl border border-slate-200 bg-slate-50/80"
                >
                  <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${columna.dot}`} />
                      <h3 className="text-xs font-bold text-slate-700">{columna.titulo}</h3>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        {tareasColumna.length}
                      </span>
                    </div>
                    <div className={`h-1 w-6 rounded-full ${columna.barra}`} />
                  </header>

                  <div className="flex-1 space-y-2.5 p-2.5">
                    {tareasColumna.map((tarea) => {
                      const completada = tarea.columna === "completado";
                      const urgencia = calcularUrgencia(tarea.fechaLimite);

                      return (
                        <article
                          key={tarea.id}
                          className={`group rounded-lg border border-l-4 bg-white p-3 shadow-sm transition hover:shadow-md ${
                            completada
                              ? "border-l-emerald-400 opacity-80"
                              : BORDE_URGENCIA[urgencia.nivel]
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                              {tarea.etiqueta}
                            </span>
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => abrirEdicion(tarea)}
                                aria-label={`Editar ${tarea.titulo}`}
                                className="rounded p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={accionId === tarea.id}
                                onClick={() => void eliminarPersonal(tarea)}
                                aria-label={`Eliminar ${tarea.titulo}`}
                                className="rounded p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => abrirEdicion(tarea)}
                            className="mt-1.5 block w-full text-left"
                          >
                            <h4
                              className={`text-sm font-semibold leading-snug ${
                                completada
                                  ? "text-slate-400 line-through"
                                  : "text-slate-800"
                              }`}
                            >
                              {tarea.titulo}
                            </h4>
                            {tarea.descripcion && (
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                                {tarea.descripcion}
                              </p>
                            )}
                            {tarea.proyectoId && (
                              <p className="mt-1 truncate text-[10px] font-semibold text-slate-400">
                                {tarea.proyectoId} · {tarea.proyectoNombre ?? "Proyecto"}
                              </p>
                            )}
                          </button>

                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${PRIORIDAD_BADGE[tarea.prioridad]}`}
                            >
                              {tarea.prioridad}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                completada
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : urgencia.badge
                              }`}
                            >
                              <CalendarDays className="h-3 w-3" />
                              {fechaCorta(tarea.fechaLimite)}
                            </span>
                          </div>

                          {!completada && tarea.fechaLimite && (
                            <p className="mt-1.5 text-[10px] font-medium text-slate-400">
                              {urgencia.etiqueta} · {urgencia.restante}
                            </p>
                          )}

                          <div className="mt-2.5 border-t border-slate-100 pt-2">
                            {tarea.columna === "por-hacer" && (
                              <button
                                type="button"
                                disabled={accionId === tarea.id}
                                onClick={() => void cambiarColumna(tarea, "en-curso")}
                                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                                {accionId === tarea.id ? "Moviendo…" : "Iniciar"}
                              </button>
                            )}
                            {tarea.columna === "en-curso" && (
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  disabled={accionId === tarea.id}
                                  onClick={() => void cambiarColumna(tarea, "por-hacer")}
                                  aria-label="Devolver a por hacer"
                                  className="rounded-lg border border-slate-200 p-1.5 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 disabled:opacity-60"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={accionId === tarea.id}
                                  onClick={() => void cambiarColumna(tarea, "completado")}
                                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  {accionId === tarea.id ? "Moviendo…" : "Completar"}
                                </button>
                              </div>
                            )}
                            {tarea.columna === "completado" && (
                              <button
                                type="button"
                                disabled={accionId === tarea.id}
                                onClick={() => void cambiarColumna(tarea, "por-hacer")}
                                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-60"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                {accionId === tarea.id ? "Moviendo…" : "Reabrir tarea"}
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}

                    {tareasColumna.length === 0 && (
                      <p className="rounded-lg border border-dashed border-slate-300 px-2 py-5 text-center text-[11px] text-slate-400">
                        Sin tareas
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white px-4 py-3 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Las tareas personales con fecha límite se sincronizan con tu calendario personal.
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Circle className="h-2.5 w-2.5 fill-slate-300 text-slate-300" />
          Solo tú puedes ver y editar tus tareas personales.
        </span>
      </div>

      {formulario && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
          <div className="my-auto w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  {formulario.id ? "Editar tarea personal" : "Nueva tarea personal"}
                </h2>
                <p className="text-xs text-slate-500">
                  Es independiente de los proyectos y solo la ves tú.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormulario(null)}
                aria-label="Cerrar"
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={guardarPersonal} className="space-y-4 px-5 py-5">
              <div className="space-y-1.5">
                <label htmlFor="personal-titulo" className="text-xs font-semibold text-slate-700">
                  Título
                </label>
                <input
                  id="personal-titulo"
                  autoFocus
                  required
                  maxLength={200}
                  value={formulario.titulo}
                  onChange={(e) =>
                    setFormulario((actual) =>
                      actual ? { ...actual, titulo: e.target.value } : actual,
                    )
                  }
                  placeholder="Ej. Preparar presentación del avance"
                  className={campoCls}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="personal-descripcion"
                  className="text-xs font-semibold text-slate-700"
                >
                  Descripción
                </label>
                <textarea
                  id="personal-descripcion"
                  rows={2}
                  maxLength={1000}
                  value={formulario.descripcion}
                  onChange={(e) =>
                    setFormulario((actual) =>
                      actual ? { ...actual, descripcion: e.target.value } : actual,
                    )
                  }
                  placeholder="Detalle o recordatorio"
                  className={`${campoCls} resize-none`}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="personal-proyecto"
                  className="text-xs font-semibold text-slate-700"
                >
                  Proyecto (opcional)
                </label>
                <select
                  id="personal-proyecto"
                  value={formulario.proyectoId}
                  onChange={(e) =>
                    setFormulario((actual) =>
                      actual ? { ...actual, proyectoId: e.target.value } : actual,
                    )
                  }
                  className={campoCls}
                >
                  <option value="">Sin proyecto</option>
                  {proyectos.map((proyecto) => (
                    <option key={proyecto.id} value={proyecto.id}>
                      {proyecto.id} · {proyecto.nombre}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">
                  Úsalo para agrupar esta tarea personal con un proyecto en los filtros.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="personal-prioridad"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Prioridad
                  </label>
                  <select
                    id="personal-prioridad"
                    value={formulario.prioridad}
                    onChange={(e) =>
                      setFormulario((actual) =>
                        actual
                          ? { ...actual, prioridad: e.target.value as PrioridadTablero }
                          : actual,
                      )
                    }
                    className={campoCls}
                  >
                    <option value="Alta">Alta</option>
                    <option value="Media">Media</option>
                    <option value="Baja">Baja</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="personal-fecha"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Fecha límite
                  </label>
                  <input
                    id="personal-fecha"
                    type="date"
                    value={formulario.fechaLimite}
                    onChange={(e) =>
                      setFormulario((actual) =>
                        actual ? { ...actual, fechaLimite: e.target.value } : actual,
                      )
                    }
                    className={campoCls}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="personal-etiqueta"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Etiqueta
                  </label>
                  <input
                    id="personal-etiqueta"
                    maxLength={60}
                    value={formulario.etiqueta}
                    onChange={(e) =>
                      setFormulario((actual) =>
                        actual ? { ...actual, etiqueta: e.target.value } : actual,
                      )
                    }
                    className={campoCls}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="personal-columna"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Estado
                  </label>
                  <select
                    id="personal-columna"
                    value={formulario.columna}
                    onChange={(e) =>
                      setFormulario((actual) =>
                        actual
                          ? { ...actual, columna: e.target.value as ColumnaPersonal }
                          : actual,
                      )
                    }
                    className={campoCls}
                  >
                    <option value="por-hacer">Por hacer</option>
                    <option value="en-curso">En curso</option>
                    <option value="completado">Completado</option>
                  </select>
                </div>
              </div>

              <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
                Si defines una fecha límite, la tarea aparecerá automáticamente en tu calendario
                personal.
              </p>

              <div className="flex flex-col-reverse justify-end gap-2 pt-1 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setFormulario(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando || !formulario.titulo.trim()}
                  className="rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {guardando
                    ? "Guardando…"
                    : formulario.id
                      ? "Guardar cambios"
                      : "Crear tarea"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tareaDetalle && usuario && (
        <TareaDetalle
          tableroId={tareaDetalle.tableroId}
          tablero={tableroDe(tareaDetalle)}
          tarea={tareaDetalle}
          usuario={usuario}
          usuariosAsignables={usuariosAsignables}
          onCerrar={() => setDetalleId(null)}
          onContadores={actualizarContadores}
          onTareaActualizada={actualizarProyecto}
          onAviso={setAviso}
        />
      )}
    </div>
  );
}
