import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { api, type EdtActividadApi, type ProyectoApi, type TableroApi } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import type {
  ColumnaTablero,
  PrioridadTablero,
  TareaTablero,
  UsuarioAsignable,
} from "../../types";
import { CargandoModule, ErrorModule } from "../../components/DataState";
import { TableroProgreso } from "./TableroProgreso";
import { TareaDetalle } from "./TareaDetalle";

const COLUMNAS: {
  id: ColumnaTablero;
  titulo: string;
  dot: string;
  barra: string;
}[] = [
  { id: "por-hacer", titulo: "Por hacer", dot: "bg-slate-400", barra: "bg-slate-300" },
  { id: "en-curso", titulo: "En curso", dot: "bg-blue-500", barra: "bg-blue-500" },
  { id: "en-revision", titulo: "En revisión", dot: "bg-amber-500", barra: "bg-amber-500" },
  { id: "completado", titulo: "Completado", dot: "bg-green-500", barra: "bg-green-500" },
];

type Urgencia = "vencida" | "critica" | "proxima" | "lejana" | "sin-fecha";

type EstiloTarea = {
  badge: string;
  borde: string;
  punto: string;
  tarjeta: string;
  fechaChip: string;
};

const PRIORIDAD_CFG: Record<PrioridadTablero, Record<Urgencia, EstiloTarea>> = {
  Alta: {
    vencida: {
      badge: "bg-red-600 text-white border-red-700",
      borde: "border-l-red-700",
      punto: "bg-red-700",
      tarjeta: "border-red-200 bg-red-50",
      fechaChip: "bg-red-600 text-white",
    },
    critica: {
      badge: "bg-red-500 text-white border-red-600",
      borde: "border-l-red-600",
      punto: "bg-red-600",
      tarjeta: "border-red-200 bg-red-50/70",
      fechaChip: "bg-red-100 text-red-700",
    },
    proxima: {
      badge: "bg-red-100 text-red-700 border-red-300",
      borde: "border-l-red-500",
      punto: "bg-red-500",
      tarjeta: "border-slate-200 bg-white",
      fechaChip: "bg-red-50 text-red-600",
    },
    lejana: {
      badge: "bg-red-50 text-red-600 border-red-200",
      borde: "border-l-red-300",
      punto: "bg-red-300",
      tarjeta: "border-slate-200 bg-white",
      fechaChip: "bg-slate-50 text-slate-500",
    },
    "sin-fecha": {
      badge: "bg-red-50 text-red-500 border-red-100",
      borde: "border-l-red-200",
      punto: "bg-red-200",
      tarjeta: "border-slate-200 bg-white",
      fechaChip: "bg-slate-50 text-slate-400",
    },
  },
  Media: {
    vencida: {
      badge: "bg-amber-500 text-amber-950 border-amber-600",
      borde: "border-l-amber-600",
      punto: "bg-amber-600",
      tarjeta: "border-amber-200 bg-amber-50",
      fechaChip: "bg-amber-500 text-amber-950",
    },
    critica: {
      badge: "bg-amber-400 text-amber-950 border-amber-500",
      borde: "border-l-amber-500",
      punto: "bg-amber-500",
      tarjeta: "border-amber-200 bg-amber-50/70",
      fechaChip: "bg-amber-100 text-amber-800",
    },
    proxima: {
      badge: "bg-amber-100 text-amber-800 border-amber-300",
      borde: "border-l-amber-500",
      punto: "bg-amber-500",
      tarjeta: "border-slate-200 bg-white",
      fechaChip: "bg-amber-50 text-amber-700",
    },
    lejana: {
      badge: "bg-amber-50 text-amber-700 border-amber-200",
      borde: "border-l-amber-300",
      punto: "bg-amber-300",
      tarjeta: "border-slate-200 bg-white",
      fechaChip: "bg-slate-50 text-slate-500",
    },
    "sin-fecha": {
      badge: "bg-amber-50 text-amber-600 border-amber-100",
      borde: "border-l-amber-200",
      punto: "bg-amber-200",
      tarjeta: "border-slate-200 bg-white",
      fechaChip: "bg-slate-50 text-slate-400",
    },
  },
  Baja: {
    vencida: {
      badge: "bg-sky-600 text-white border-sky-700",
      borde: "border-l-sky-700",
      punto: "bg-sky-700",
      tarjeta: "border-sky-200 bg-sky-50",
      fechaChip: "bg-sky-600 text-white",
    },
    critica: {
      badge: "bg-sky-500 text-white border-sky-600",
      borde: "border-l-sky-600",
      punto: "bg-sky-600",
      tarjeta: "border-sky-200 bg-sky-50/70",
      fechaChip: "bg-sky-100 text-sky-700",
    },
    proxima: {
      badge: "bg-sky-100 text-sky-700 border-sky-300",
      borde: "border-l-sky-500",
      punto: "bg-sky-500",
      tarjeta: "border-slate-200 bg-white",
      fechaChip: "bg-sky-50 text-sky-700",
    },
    lejana: {
      badge: "bg-sky-50 text-sky-600 border-sky-200",
      borde: "border-l-sky-300",
      punto: "bg-sky-300",
      tarjeta: "border-slate-200 bg-white",
      fechaChip: "bg-slate-50 text-slate-500",
    },
    "sin-fecha": {
      badge: "bg-sky-50 text-sky-500 border-sky-100",
      borde: "border-l-sky-200",
      punto: "bg-sky-200",
      tarjeta: "border-slate-200 bg-white",
      fechaChip: "bg-slate-50 text-slate-400",
    },
  },
};

function diasParaVencer(fechaLimite: string | null | undefined) {
  if (!fechaLimite) return null;
  const [anio, mes, dia] = fechaLimite.slice(0, 10).split("-").map(Number);
  if (!anio || !mes || !dia) return null;
  const limite = Date.UTC(anio, mes - 1, dia);
  const ahora = new Date();
  const hoy = Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  return Math.round((limite - hoy) / 86_400_000);
}

function urgenciaDe(fechaLimite: string | null | undefined): Urgencia {
  const dias = diasParaVencer(fechaLimite);
  if (dias === null) return "sin-fecha";
  if (dias < 0) return "vencida";
  if (dias <= 2) return "critica";
  if (dias <= 7) return "proxima";
  return "lejana";
}

function textoUrgencia(dias: number | null) {
  if (dias === null) return "Sin fecha";
  if (dias < 0) return `Vencida hace ${Math.abs(dias)} d`;
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  return `Vence en ${dias} días`;
}

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

function AvatarResponsable({ nombre, fotoUrl }: { nombre: string; fotoUrl: string | null }) {
  const [rota, setRota] = useState(false);

  useEffect(() => setRota(false), [fotoUrl]);

  return (
    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1F2937] text-[10px] font-bold text-white">
      {fotoUrl && !rota ? (
        <img
          src={fotoUrl}
          alt={nombre}
          referrerPolicy="no-referrer"
          onError={() => setRota(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        iniciales(nombre)
      )}
    </div>
  );
}

function fechaCorta(valor: string) {
  if (!valor) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(
    new Date(`${valor}T12:00:00`),
  );
}

function esGestorDe(tarea: TareaTablero, usuarioId: string, rol: string) {
  return (
    rol === "admin" ||
    tarea.creadoPor === usuarioId ||
    tarea.proyectoLiderId === usuarioId ||
    tarea.tableroCreadoPor === usuarioId
  );
}

const campoCls =
  "w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10";

export function TablerosView({ onNavigate }: { onNavigate: (v: string) => void }) {
  const { usuario } = useAuth();
  const [tableroId, setTableroId] = useState<string | null>(null);
  const [tablero, setTablero] = useState<TableroApi | null>(null);
  const [tareas, setTareas] = useState<TareaTablero[]>([]);
  const [usuariosAsignables, setUsuariosAsignables] = useState<UsuarioAsignable[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoApi[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [nuevoTablero, setNuevoTablero] = useState({ nombre: "", descripcion: "" });
  const [creandoTablero, setCreandoTablero] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [prioridad, setPrioridad] = useState<PrioridadTablero | "Todas">("Todas");
  const [asignacion, setAsignacion] = useState("todas");
  const [detalleAbierto, setDetalleAbierto] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [nueva, setNueva] = useState({
    titulo: "",
    descripcion: "",
    proyectoId: "",
    responsableId: "",
    edtActividadId: "",
    prioridad: "Media" as PrioridadTablero,
    fechaLimite: "",
    etiqueta: "General",
  });
  const [edtActividades, setEdtActividades] = useState<EdtActividadApi[]>([]);
  const [cargandoEdt, setCargandoEdt] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [{ tableros }, { usuarios }, { proyectos: listaProyectos }] = await Promise.all([
        api.tableros(),
        api.usuariosAsignables(),
        api.proyectos(),
      ]);
      setUsuariosAsignables(usuarios);
      setProyectos(listaProyectos);
      if (!tableros.length) {
        setTableroId(null);
        setTablero(null);
        setTareas([]);
        return;
      }
      const detalle = await api.tablero(tableros[0].id);
      setTableroId(detalle.tablero.id);
      setTablero(detalle.tablero);
      setTareas(detalle.tareas);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar el tablero.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!mostrarFormulario || !nueva.proyectoId) {
      setEdtActividades([]);
      return;
    }
    let cancelado = false;
    setCargandoEdt(true);
    void api
      .edt(nueva.proyectoId)
      .then(({ actividades }) => {
        if (!cancelado) setEdtActividades(actividades);
      })
      .catch(() => {
        if (!cancelado) setEdtActividades([]);
      })
      .finally(() => {
        if (!cancelado) setCargandoEdt(false);
      });
    return () => {
      cancelado = true;
    };
  }, [mostrarFormulario, nueva.proyectoId]);

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return tareas.filter((tarea) => {
      const coincideTexto =
        !texto ||
        [
          tarea.titulo,
          tarea.responsable,
          tarea.etiqueta,
          tarea.descripcion,
          tarea.proyectoNombre ?? "",
          tarea.proyectoId ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(texto);
      const coincidePrioridad = prioridad === "Todas" || tarea.prioridad === prioridad;
      const coincideResponsable =
        asignacion === "todas" ||
        (asignacion === "mias" && tarea.responsableId === usuario?.id) ||
        (asignacion === "sin-asignar" && !tarea.responsableId) ||
        (asignacion.startsWith("persona:") &&
          tarea.responsableId === asignacion.slice("persona:".length));
      return coincideTexto && coincidePrioridad && coincideResponsable;
    });
  }, [tareas, busqueda, prioridad, asignacion, usuario?.id]);

  const actualizarTarea = useCallback((actualizada: TareaTablero) => {
    setTareas((prev) => prev.map((tarea) => (tarea.id === actualizada.id ? actualizada : tarea)));
  }, []);

  async function eliminarTarea(id: string) {
    if (!tableroId) return;
    const anteriores = tareas;
    setTareas((prev) => prev.filter((tarea) => tarea.id !== id));
    try {
      await api.eliminarTarea(tableroId, id);
    } catch (e) {
      setTareas(anteriores);
      setAviso(e instanceof Error ? e.message : "No se pudo eliminar la tarea.");
    }
  }

  const cerrarDetalle = useCallback(() => setDetalleAbierto(null), []);

  const actualizarContadores = useCallback(
    (tareaId: string, cambios: { comentarios?: number; adjuntos?: number }) => {
      setTareas((prev) =>
        prev.map((tarea) => (tarea.id === tareaId ? { ...tarea, ...cambios } : tarea)),
      );
    },
    [],
  );

  const tareaDetalle = detalleAbierto
    ? (tareas.find((tarea) => tarea.id === detalleAbierto) ?? null)
    : null;
  const puedeEliminar = usuario?.rol === "admin";

  async function crearTablero(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nuevoTablero.nombre.trim()) return;

    setCreandoTablero(true);
    try {
      const { tablero: creado } = await api.crearTablero({
        nombre: nuevoTablero.nombre.trim(),
        descripcion: nuevoTablero.descripcion.trim(),
      });
      setNuevoTablero({ nombre: "", descripcion: "" });
      setTableroId(creado.id);
      setTablero(creado);
      setTareas([]);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo crear el tablero.");
    } finally {
      setCreandoTablero(false);
    }
  }

  async function crearTarea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nueva.titulo.trim() || !tableroId || !nueva.proyectoId) return;

    setGuardando(true);
    try {
      const { tarea } = await api.crearTarea(tableroId, {
        titulo: nueva.titulo.trim(),
        descripcion: nueva.descripcion.trim(),
        proyectoId: nueva.proyectoId,
        responsableId: nueva.responsableId || null,
        edtActividadId: nueva.edtActividadId || null,
        prioridad: nueva.prioridad,
        fechaLimite: nueva.fechaLimite || null,
        etiqueta: nueva.etiqueta.trim() || "General",
      });
      setTareas((prev) => [...prev, tarea]);
      setNueva({
        titulo: "",
        descripcion: "",
        proyectoId: "",
        responsableId: "",
        edtActividadId: "",
        prioridad: "Media",
        fechaLimite: "",
        etiqueta: "General",
      });
      setMostrarFormulario(false);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo crear la tarea.");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <CargandoModule mensaje="Cargando tablero de trabajo…" />;
  if (error) return <ErrorModule mensaje={error} onRetry={() => void cargar()} />;

  if (!tableroId) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tablero de asignación de trabajo</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Todavía no hay tableros creados en la base de datos.
          </p>
        </div>

        {aviso && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-medium text-amber-800">{aviso}</p>
            <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
              <X className="h-4 w-4 text-amber-600" />
            </button>
          </div>
        )}

        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 shadow-sm sm:p-8">
          <form onSubmit={crearTablero} className="mx-auto max-w-lg space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Crear el primer tablero</h2>
              <p className="mt-1 text-sm text-slate-500">
                Define un nombre y una descripción. Después podrás agregar tareas ligadas a un
                proyecto.
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="tablero-nombre" className="text-xs font-semibold text-slate-700">
                Nombre
              </label>
              <input
                id="tablero-nombre"
                required
                value={nuevoTablero.nombre}
                onChange={(e) =>
                  setNuevoTablero((prev) => ({ ...prev, nombre: e.target.value }))
                }
                placeholder="Ej. Equipo de resultados de aprendizaje"
                className={campoCls}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="tablero-descripcion" className="text-xs font-semibold text-slate-700">
                Descripción
              </label>
              <textarea
                id="tablero-descripcion"
                rows={2}
                value={nuevoTablero.descripcion}
                onChange={(e) =>
                  setNuevoTablero((prev) => ({ ...prev, descripcion: e.target.value }))
                }
                placeholder="Para qué se usará este tablero"
                className={campoCls}
              />
            </div>
            <button
              type="submit"
              disabled={creandoTablero}
              className="w-full rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9A3412] disabled:opacity-60"
            >
              {creandoTablero ? "Creando…" : "Crear tablero"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tablero de asignación de trabajo</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {tablero?.nombre} · Cada tarea está ligada a un proyecto y avanza con aprobación
          </p>
          {tablero?.creadoPorNombre && (
            <p className="mt-1 text-[11px] text-slate-400">
              Líder del tablero: {tablero.creadoPorNombre}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setMostrarFormulario(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#9A3412]"
        >
          <Plus className="h-4 w-4" />
          Nueva tarea
        </button>
      </div>

      {aviso && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-medium text-amber-800">{aviso}</p>
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
            <X className="h-4 w-4 text-amber-600" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar tarea, proyecto, responsable o etiqueta…"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10"
          />
        </div>
        <select
          value={prioridad}
          onChange={(e) => setPrioridad(e.target.value as PrioridadTablero | "Todas")}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 outline-none focus:border-[#EA580C]"
        >
          <option value="Todas">Todas las prioridades</option>
          <option value="Alta">Prioridad alta</option>
          <option value="Media">Prioridad media</option>
          <option value="Baja">Prioridad baja</option>
        </select>
        <select
          value={asignacion}
          onChange={(e) => setAsignacion(e.target.value)}
          aria-label="Filtrar por responsable"
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 outline-none focus:border-[#EA580C]"
        >
          <option value="todas">Todas las personas</option>
          <option value="mias">Mis tareas</option>
          <option value="sin-asignar">Sin asignar</option>
          <optgroup label="Por persona">
            {usuariosAsignables.map((u) => (
              <option key={u.id} value={`persona:${u.id}`}>
                {u.nombre}
              </option>
            ))}
          </optgroup>
        </select>
        <div className="flex flex-col gap-1 text-[11px] font-medium text-gray-500 sm:ml-auto">
          <div className="flex items-center gap-3">
            {(["Baja", "Media", "Alta"] as PrioridadTablero[]).map((p) => (
              <span key={p} className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${PRIORIDAD_CFG[p].proxima.punto}`} />
                {p}
              </span>
            ))}
          </div>
          <span className="text-[10px] font-normal text-gray-400">
            El color se intensifica al acercarse la fecha límite
          </span>
        </div>
        <span className="text-xs font-medium text-gray-400">
          {filtradas.length} de {tareas.length} tareas
        </span>
      </div>

      <TableroProgreso tareas={tareas} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNAS.map((columna) => {
          const tareasColumna = filtradas.filter((tarea) => tarea.columna === columna.id);

          return (
            <section
              key={columna.id}
              className="flex min-h-[360px] flex-col rounded-xl border border-slate-200 bg-slate-50/80 sm:min-h-[420px]"
            >
              <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${columna.dot}`} />
                  <h2 className="text-sm font-bold text-slate-700">{columna.titulo}</h2>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500">
                    {tareasColumna.length}
                  </span>
                </div>
                <div className={`h-1 w-8 rounded-full ${columna.barra}`} />
              </header>

              <div className="flex-1 space-y-3 p-3">
                {tareasColumna.map((tarea) => {
                  const dias = diasParaVencer(tarea.fechaLimite);
                  const urgencia =
                    tarea.columna === "completado" ? "lejana" : urgenciaDe(tarea.fechaLimite);
                  const cfg = PRIORIDAD_CFG[tarea.prioridad][urgencia];
                  const mostrarAlerta = tarea.columna !== "completado" && dias !== null && dias <= 2;
                  const tituloFecha =
                    tarea.columna === "completado" ? "Tarea completada" : textoUrgencia(dias);
                  const esAsignado = Boolean(usuario && tarea.responsableId === usuario.id);
                  const esGestor = Boolean(
                    usuario && esGestorDe(tarea, usuario.id, usuario.rol),
                  );

                  return (
                    <article
                      key={tarea.id}
                      className={`group rounded-lg border border-l-4 p-3 shadow-sm transition hover:shadow-md ${cfg.tarjeta} ${cfg.borde}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9A3412]">
                          {tarea.etiqueta}
                        </span>
                        {puedeEliminar && (
                          <button
                            type="button"
                            onClick={() => void eliminarTarea(tarea.id)}
                            aria-label={`Eliminar ${tarea.titulo}`}
                            className="rounded p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setDetalleAbierto(tarea.id)}
                        className="mt-2 block w-full rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C]/40"
                      >
                        <h3 className="text-sm font-semibold leading-snug text-slate-800">
                          {tarea.titulo}
                        </h3>
                        {tarea.descripcion && (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                            {tarea.descripcion}
                          </p>
                        )}
                        <p className="mt-2 truncate text-[10px] font-semibold text-slate-400">
                          {tarea.proyectoId
                            ? `${tarea.proyectoId} · ${tarea.proyectoNombre ?? "Proyecto"}`
                            : "Sin proyecto"}
                        </p>
                        {tarea.edtActividadNombre && (
                          <p
                            className="mt-1 truncate text-[10px] font-semibold text-orange-600"
                            title={`Actividad EDT de la etapa ${tarea.edtEtapa}: ${tarea.edtActividadNombre}`}
                          >
                            EDT E{tarea.edtEtapa} · {tarea.edtActividadNombre}
                          </p>
                        )}
                      </button>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${cfg.badge}`}
                        >
                          {tarea.prioridad}
                        </span>
                        <span
                          title={tituloFecha}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.fechaChip}`}
                        >
                          <CalendarDays className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {fechaCorta(tarea.fechaLimite ?? "")}
                            {mostrarAlerta ? ` · ${textoUrgencia(dias)}` : ""}
                          </span>
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2.5">
                        <AvatarResponsable
                          nombre={tarea.responsable}
                          fotoUrl={tarea.responsableFoto}
                        />
                        <span className="truncate text-[11px] font-medium text-slate-500">
                          {tarea.responsable}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDetalleAbierto(tarea.id)}
                          title="Comentarios y adjuntos"
                          className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold text-slate-400 transition hover:bg-white hover:text-[#C2410C]"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          {tarea.comentarios}
                          <Paperclip className="ml-1 h-3.5 w-3.5" />
                          {tarea.adjuntos}
                        </button>
                        {tarea.columna === "completado" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : tarea.columna === "en-curso" ? (
                          <Clock className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-slate-300" />
                        )}
                      </div>

                      {tarea.columna === "por-hacer" && esAsignado && (
                        <button
                          type="button"
                          onClick={() => setDetalleAbierto(tarea.id)}
                          className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-blue-700"
                        >
                          Entendido, iniciar tarea
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {tarea.columna === "en-curso" && esAsignado && (
                        <button
                          type="button"
                          onClick={() => setDetalleAbierto(tarea.id)}
                          className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-100"
                        >
                          Comentar avance y adjuntar evidencia
                        </button>
                      )}

                      {tarea.columna === "en-revision" && esGestor && (
                        <button
                          type="button"
                          onClick={() => setDetalleAbierto(tarea.id)}
                          className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#C2410C] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#9A3412]"
                        >
                          Revisar entrega
                        </button>
                      )}

                      {tarea.columna === "por-hacer" && !tarea.responsableId && esGestor && (
                        <button
                          type="button"
                          onClick={() => setDetalleAbierto(tarea.id)}
                          className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-[#EA580C] hover:text-[#C2410C]"
                        >
                          Asignar responsable
                        </button>
                      )}
                    </article>
                  );
                })}

                {tareasColumna.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
                    No hay tareas en esta columna
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-400">
        El flujo es condicional: la persona asignada confirma el inicio, entrega con comentario y
        evidencia, y quien creó la tarea o lidera el proyecto aprueba o devuelve.
      </p>

      {mostrarFormulario && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
          <div className="my-auto w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-800">Nueva tarea</h2>
              <button
                type="button"
                onClick={() => setMostrarFormulario(false)}
                aria-label="Cerrar"
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={crearTarea} className="space-y-4 px-5 py-5">
              {proyectos.length === 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                  <p className="text-xs font-semibold text-amber-800">
                    Primero debes registrar un proyecto.
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                    Toda tarea debe quedar relacionada con un proyecto. Créalo en el módulo
                    Proyectos y vuelve a intentarlo.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarFormulario(false);
                      onNavigate("projects");
                    }}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[#C2410C] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#9A3412]"
                  >
                    Ir a Proyectos
                  </button>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="proyecto-tarea" className="text-xs font-semibold text-slate-700">
                  Proyecto <span className="text-red-500">*</span>
                </label>
                <select
                  id="proyecto-tarea"
                  required
                  value={nueva.proyectoId}
                  onChange={(e) =>
                    setNueva((prev) => ({
                      ...prev,
                      proyectoId: e.target.value,
                      edtActividadId: "",
                    }))
                  }
                  className={campoCls}
                >
                  <option value="">Selecciona un proyecto</option>
                  {proyectos.map((proyecto) => (
                    <option key={proyecto.id} value={proyecto.id}>
                      {proyecto.id} · {proyecto.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edt-tarea" className="text-xs font-semibold text-slate-700">
                  Actividad EDT
                </label>
                <select
                  id="edt-tarea"
                  value={nueva.edtActividadId}
                  onChange={(e) =>
                    setNueva((prev) => ({ ...prev, edtActividadId: e.target.value }))
                  }
                  disabled={!nueva.proyectoId || cargandoEdt}
                  className={campoCls}
                >
                  <option value="">
                    {!nueva.proyectoId
                      ? "Selecciona primero un proyecto"
                      : cargandoEdt
                        ? "Cargando actividades…"
                        : "Sin vincular al EDT"}
                  </option>
                  {[...edtActividades]
                    .sort((a, b) => a.etapa - b.etapa || a.orden - b.orden)
                    .map((actividad) => (
                      <option key={actividad.id} value={actividad.id}>
                        {actividad.padreId ? "↳ " : ""}E{actividad.etapa} ·{" "}
                        {actividad.nombre || "Sin nombre"}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-400">
                  Al aprobar la tarea, la actividad del EDT y el avance del proyecto se actualizan
                  solos.
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="titulo" className="text-xs font-semibold text-slate-700">
                  Título
                </label>
                <input
                  id="titulo"
                  required
                  value={nueva.titulo}
                  onChange={(e) => setNueva((prev) => ({ ...prev, titulo: e.target.value }))}
                  placeholder="Ej. Validar rúbrica de la asignatura"
                  className={campoCls}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="descripcion" className="text-xs font-semibold text-slate-700">
                  Descripción
                </label>
                <textarea
                  id="descripcion"
                  rows={2}
                  value={nueva.descripcion}
                  onChange={(e) => setNueva((prev) => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Detalle breve de la tarea"
                  className={campoCls}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="responsable" className="text-xs font-semibold text-slate-700">
                    Responsable
                  </label>
                  <select
                    id="responsable"
                    value={nueva.responsableId}
                    onChange={(e) =>
                      setNueva((prev) => ({ ...prev, responsableId: e.target.value }))
                    }
                    className={campoCls}
                  >
                    <option value="">Sin asignar</option>
                    {usuariosAsignables.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400">
                    Solo tú o el líder del proyecto pueden cambiarlo después.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="etiqueta" className="text-xs font-semibold text-slate-700">
                    Etiqueta
                  </label>
                  <input
                    id="etiqueta"
                    value={nueva.etiqueta}
                    onChange={(e) => setNueva((prev) => ({ ...prev, etiqueta: e.target.value }))}
                    className={campoCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="prioridad" className="text-xs font-semibold text-slate-700">
                    Prioridad
                  </label>
                  <select
                    id="prioridad"
                    value={nueva.prioridad}
                    onChange={(e) =>
                      setNueva((prev) => ({
                        ...prev,
                        prioridad: e.target.value as PrioridadTablero,
                      }))
                    }
                    className={campoCls}
                  >
                    <option value="Alta">Alta</option>
                    <option value="Media">Media</option>
                    <option value="Baja">Baja</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="fecha" className="text-xs font-semibold text-slate-700">
                    Fecha límite
                  </label>
                  <input
                    id="fecha"
                    type="date"
                    value={nueva.fechaLimite}
                    onChange={(e) =>
                      setNueva((prev) => ({ ...prev, fechaLimite: e.target.value }))
                    }
                    className={campoCls}
                  />
                </div>
              </div>

              <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
                La tarea inicia en “Por hacer”. La persona asignada deberá confirmar con
                “Entendido” antes de pasar a “En curso”.
              </p>

              <div className="flex flex-col-reverse justify-end gap-2 pt-1 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setMostrarFormulario(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando || proyectos.length === 0}
                  className="rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {guardando ? "Guardando…" : "Crear tarea"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tareaDetalle && tableroId && tablero && usuario && (
        <TareaDetalle
          tableroId={tableroId}
          tablero={tablero}
          tarea={tareaDetalle}
          usuario={usuario}
          usuariosAsignables={usuariosAsignables}
          onCerrar={cerrarDetalle}
          onContadores={actualizarContadores}
          onTareaActualizada={actualizarTarea}
          onAviso={setAviso}
        />
      )}
    </div>
  );
}
