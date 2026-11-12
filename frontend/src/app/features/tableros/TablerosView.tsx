import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  LayoutGrid,
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
import { calcularUrgencia, fechaCorta, type NivelUrgencia } from "../../lib/urgencia";
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

const LEYENDA_URGENCIA: { nivel: NivelUrgencia; titulo: string; punto: string }[] = [
  { nivel: "verde", titulo: "A tiempo", punto: "bg-emerald-500" },
  { nivel: "azul", titulo: "Programada", punto: "bg-sky-500" },
  { nivel: "amarillo", titulo: "Próxima", punto: "bg-amber-400" },
  { nivel: "naranja", titulo: "Esta semana", punto: "bg-orange-500" },
  { nivel: "rojo", titulo: "Urgente", punto: "bg-rose-500" },
  { nivel: "morado", titulo: "Vencida", punto: "bg-purple-600" },
];

type FiltroPlazo = "todos" | "cercanas" | "intermedias" | "largas" | "sin-fecha";

const PLAZOS: { id: FiltroPlazo; titulo: string }[] = [
  { id: "todos", titulo: "Todos los plazos" },
  { id: "cercanas", titulo: "Fechas cercanas (días)" },
  { id: "intermedias", titulo: "Fechas intermedias (semanas)" },
  { id: "largas", titulo: "Fechas largas (semanas)" },
  { id: "sin-fecha", titulo: "Sin fecha" },
];

const NIVELES_PLAZO: Record<Exclude<FiltroPlazo, "todos" | "sin-fecha">, NivelUrgencia[]> = {
  cercanas: ["morado", "rojo", "naranja", "amarillo"],
  intermedias: ["azul"],
  largas: ["verde"],
};

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
  const [vista, setVista] = useState<"general" | "tablero">("general");
  const [tableroId, setTableroId] = useState<string | null>(null);
  const [tablero, setTablero] = useState<TableroApi | null>(null);
  const [tareas, setTareas] = useState<TareaTablero[]>([]);
  const [tableros, setTableros] = useState<TableroApi[]>([]);
  const [proyectosGeneral, setProyectosGeneral] = useState<{ id: string; nombre: string }[]>([]);
  const [usuariosAsignables, setUsuariosAsignables] = useState<UsuarioAsignable[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoApi[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [nuevoTablero, setNuevoTablero] = useState({ nombre: "", descripcion: "" });
  const [creandoTablero, setCreandoTablero] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [plazo, setPlazo] = useState<FiltroPlazo>("todos");
  const [asignacion, setAsignacion] = useState("todas");
  const [filtroProyecto, setFiltroProyecto] = useState("");
  const [filtroFase, setFiltroFase] = useState("");
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
  const primeraCarga = useRef(true);

  const cargarGeneral = useCallback(async () => {
    const datos = await api.tableroGeneral(filtroProyecto || undefined, filtroFase || undefined);
    setTareas(datos.tareas);
    setTableros(datos.tableros);
    setProyectosGeneral(datos.proyectos);
  }, [filtroProyecto, filtroFase]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [{ tableros: lista }, { usuarios }, { proyectos: listaProyectos }, general] =
        await Promise.all([
          api.tableros(),
          api.usuariosAsignables(),
          api.proyectos(),
          api.tableroGeneral(),
        ]);
      setTableros(lista);
      setUsuariosAsignables(usuarios);
      setProyectos(listaProyectos);
      setProyectosGeneral(general.proyectos);
      setTareas(general.tareas);
      if (!lista.length) {
        setVista("general");
        setTableroId(null);
        setTablero(null);
      }
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
    if (vista !== "general") return;
    if (primeraCarga.current) {
      primeraCarga.current = false;
      return;
    }
    let cancelado = false;
    void cargarGeneral()
      .catch(() => {
        if (!cancelado) setAviso("No se pudo actualizar el tablero general.");
      });
    return () => {
      cancelado = true;
    };
  }, [cargarGeneral, vista]);

  useEffect(() => {
    if (!filtroProyecto) {
      setFiltroFase("");
      return;
    }
    setFiltroFase((actual) => {
      if (!actual) return actual;
      const sigueExistiendo = tableros.some(
        (t) => t.faseId === actual && t.proyectoId === filtroProyecto,
      );
      return sigueExistiendo ? actual : "";
    });
  }, [filtroProyecto, tableros]);

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

  const fasesDisponibles = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const item of tableros) {
      if (!item.faseId || !item.faseNombre) continue;
      if (filtroProyecto && item.proyectoId !== filtroProyecto) continue;
      mapa.set(item.faseId, item.faseNombre);
    }
    return [...mapa.entries()].map(([id, nombre]) => ({ id, nombre }));
  }, [tableros, filtroProyecto]);

  const tablerosPorProyecto = useMemo(() => {
    const mapa = new Map<string, TableroApi[]>();
    for (const item of tableros) {
      const clave = item.proyectoId ?? "sin-proyecto";
      const lista = mapa.get(clave) ?? [];
      lista.push(item);
      mapa.set(clave, lista);
    }
    return [...mapa.values()];
  }, [tableros]);

  const gruposGuia = useMemo(
    () =>
      filtroProyecto
        ? tablerosPorProyecto.filter((grupo) => grupo[0]?.proyectoId === filtroProyecto)
        : tablerosPorProyecto,
    [tablerosPorProyecto, filtroProyecto],
  );

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
          tarea.faseNombre ?? "",
          tarea.edtActividadNombre ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(texto);
      const nivel = calcularUrgencia(tarea.fechaLimite).nivel;
      const coincidePlazo =
        plazo === "todos" ||
        (plazo === "sin-fecha" && nivel === "sin-fecha") ||
        (plazo !== "sin-fecha" && NIVELES_PLAZO[plazo].includes(nivel));
      const coincideResponsable =
        asignacion === "todas" ||
        (asignacion === "mias" && tarea.responsableId === usuario?.id) ||
        (asignacion === "sin-asignar" && !tarea.responsableId) ||
        (asignacion.startsWith("persona:") &&
          tarea.responsableId === asignacion.slice("persona:".length));
      return coincideTexto && coincidePlazo && coincideResponsable;
    });
  }, [tareas, busqueda, plazo, asignacion, usuario?.id]);

  const actualizarTarea = useCallback((actualizada: TareaTablero) => {
    setTareas((prev) => prev.map((tarea) => (tarea.id === actualizada.id ? actualizada : tarea)));
  }, []);

  async function abrirTablero(id: string) {
    if (!id) {
      if (vista === "general") {
        setCargando(true);
        try {
          await cargarGeneral();
        } catch (e) {
          setAviso(e instanceof Error ? e.message : "No se pudo cargar el tablero general.");
        } finally {
          setCargando(false);
        }
      } else {
        setVista("general");
      }
      setTableroId(null);
      setTablero(null);
      return;
    }

    setCargando(true);
    setAviso(null);
    try {
      const detalle = await api.tablero(id);
      setTableroId(detalle.tablero.id);
      setTablero(detalle.tablero);
      setTareas(detalle.tareas);
      setVista("tablero");
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo abrir el tablero.");
    } finally {
      setCargando(false);
    }
  }

  async function eliminarTarea(id: string) {
    const tarea = tareas.find((item) => item.id === id);
    if (!tarea) return;
    const anteriores = tareas;
    setTareas((prev) => prev.filter((item) => item.id !== id));
    try {
      await api.eliminarTarea(tarea.tableroId, id);
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

  function tableroDe(tarea: TareaTablero): TableroApi {
    return {
      id: tarea.tableroId,
      nombre: tarea.tableroNombre ?? "Tablero",
      descripcion: "",
      proyectoId: tarea.tableroProyectoId,
      proyectoNombre: tarea.proyectoNombre,
      faseId: tarea.tableroFaseId,
      faseNombre: tarea.faseNombre,
      tipo: tarea.tableroTipo ?? "Manual",
      creadoPor: tarea.tableroCreadoPor,
      creadoPorNombre: tarea.tableroCreadoPorNombre,
    };
  }

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
      setTableros((prev) => [...prev, creado]);
      setTableroId(creado.id);
      setTablero(creado);
      setTareas([]);
      setVista("tablero");
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo crear el tablero.");
    } finally {
      setCreandoTablero(false);
    }
  }

  function abrirNuevaTarea() {
    if (!tablero) return;
    setNueva((prev) => ({
      ...prev,
      proyectoId: tablero.proyectoId ?? prev.proyectoId,
      etiqueta: tablero.faseNombre ?? prev.etiqueta,
    }));
    setMostrarFormulario(true);
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
        proyectoId: tablero?.proyectoId ?? "",
        responsableId: "",
        edtActividadId: "",
        prioridad: "Media",
        fechaLimite: "",
        etiqueta: tablero?.faseNombre ?? "General",
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

  if (!tableros.length) {
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

  const enGeneral = vista === "general";
  const contexto = enGeneral
    ? filtroProyecto
      ? proyectosGeneral.find((p) => p.id === filtroProyecto)?.nombre ?? filtroProyecto
      : "Todos los proyectos"
    : tablero?.faseNombre ?? tablero?.proyectoNombre ?? tablero?.nombre ?? "Tablero";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {enGeneral ? "Tablero general de proyectos" : "Tablero de fase"}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {enGeneral
              ? `${contexto} · Actividades y tareas de todas las fases y tableros`
              : `${tablero?.proyectoNombre ?? "Proyecto"} · ${contexto} · Las tareas avanzan con aprobación`}
          </p>
          {!enGeneral && tablero?.creadoPorNombre && (
            <p className="mt-1 text-[11px] text-slate-400">
              Líder del tablero: {tablero.creadoPorNombre}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {!enGeneral && (
            <button
              type="button"
              onClick={() => void abrirTablero("")}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
            >
              <LayoutGrid className="h-4 w-4" />
              Ver general
            </button>
          )}
          {!enGeneral && (
            <button
              type="button"
              onClick={abrirNuevaTarea}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#9A3412]"
            >
              <Plus className="h-4 w-4" />
              Nueva tarea
            </button>
          )}
        </div>
      </div>

      {aviso && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-medium text-amber-800">{aviso}</p>
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
            <X className="h-4 w-4 text-amber-600" />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Tablero guía
          </span>
          <span className="text-xs font-medium text-gray-400">
            {filtradas.length} de {tareas.length} tareas
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar tarea, proyecto, fase o responsable…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10"
            />
          </div>
          {enGeneral && (
            <>
              <select
                value={filtroProyecto}
                onChange={(e) => setFiltroProyecto(e.target.value)}
                aria-label="Filtrar por proyecto"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 outline-none focus:border-[#EA580C]"
              >
                <option value="">Todos los proyectos</option>
                {proyectosGeneral.map((proyecto) => (
                  <option key={proyecto.id} value={proyecto.id}>
                    {proyecto.id} · {proyecto.nombre}
                  </option>
                ))}
              </select>
              <select
                value={filtroFase}
                onChange={(e) => setFiltroFase(e.target.value)}
                aria-label="Filtrar por fase"
                disabled={fasesDisponibles.length === 0}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 outline-none focus:border-[#EA580C] disabled:opacity-50"
              >
                <option value="">Todas las fases</option>
                {fasesDisponibles.map((fase) => (
                  <option key={fase.id} value={fase.id}>
                    {fase.nombre}
                  </option>
                ))}
              </select>
            </>
          )}
          <select
            value={plazo}
            onChange={(e) => setPlazo(e.target.value as FiltroPlazo)}
            aria-label="Filtrar por plazo"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 outline-none focus:border-[#EA580C]"
          >
            {PLAZOS.map((opcion) => (
              <option key={opcion.id} value={opcion.id}>
                {opcion.titulo}
              </option>
            ))}
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
        </div>

        <label htmlFor="selector-tablero" className="sr-only">
          Seleccionar tablero
        </label>
        <select
          id="selector-tablero"
          value={enGeneral ? "" : tableroId ?? ""}
          onChange={(e) => void abrirTablero(e.target.value)}
          className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-[#EA580C] sm:max-w-md"
        >
          <option value="">
            {filtroProyecto ? "Tablero general (proyecto seleccionado)" : "Tablero general (todos los proyectos)"}
          </option>
          {gruposGuia.map((grupo) => (
            <optgroup
              key={grupo[0]?.proyectoId ?? "sin"}
              label={grupo[0]?.proyectoNombre ?? grupo[0]?.proyectoId ?? "Sin proyecto"}
            >
              {grupo.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.faseNombre ? `Fase · ${item.faseNombre}` : item.nombre} ({item.totalTareas ?? 0})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-slate-100 bg-white px-4 py-2.5 text-[11px] font-medium text-slate-500">
        <span className="font-bold uppercase tracking-wide text-slate-400">Urgencia por fecha</span>
        {LEYENDA_URGENCIA.map((nivel) => (
          <span key={nivel.nivel} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${nivel.punto}`} />
            {nivel.titulo}
          </span>
        ))}
        <span className="text-[10px] font-normal text-slate-400">
          El color se intensifica al acercarse la fecha límite.
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
                  const completada = tarea.columna === "completado";
                  const urgencia = calcularUrgencia(tarea.fechaLimite);
                  const esAsignado = Boolean(usuario && tarea.responsableId === usuario.id);
                  const esGestor = Boolean(
                    usuario && esGestorDe(tarea, usuario.id, usuario.rol),
                  );

                  return (
                    <article
                      key={tarea.id}
                      className={`group rounded-lg border border-l-4 bg-white p-3 shadow-sm transition hover:shadow-md ${
                        completada ? "border-l-emerald-400 opacity-90" : BORDE_URGENCIA[urgencia.nivel]
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap gap-1">
                          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9A3412]">
                            {tarea.etiqueta}
                          </span>
                          {tarea.faseNombre && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                              {tarea.faseNombre}
                            </span>
                          )}
                        </div>
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
                        <h3
                          className={`text-sm font-semibold leading-snug ${
                            completada ? "text-slate-500 line-through" : "text-slate-800"
                          }`}
                        >
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
                            title={`Actividad EDT: ${tarea.edtActividadNombre}`}
                          >
                            EDT · {tarea.edtActividadNombre}
                          </p>
                        )}
                      </button>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${PRIORIDAD_BADGE[tarea.prioridad]}`}
                        >
                          {tarea.prioridad}
                        </span>
                        <span
                          title={completada ? "Tarea completada" : `${urgencia.etiqueta} · ${urgencia.restante}`}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                            completada
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : urgencia.badge
                          }`}
                        >
                          <CalendarDays className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {fechaCorta(tarea.fechaLimite)}
                            {!completada && tarea.fechaLimite ? ` · ${urgencia.restante}` : ""}
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
                        {completada ? (
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
        El tablero general reúne todas las fases y tableros. La persona asignada confirma el
        inicio, entrega con comentario y evidencia, y quien creó la tarea o lidera el proyecto
        aprueba o devuelve. Los documentos y requisitos del EDT bloquean la aprobación hasta
        cumplirse.
      </p>

      {mostrarFormulario && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
          <div className="my-auto w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">Nueva tarea</h2>
                <p className="text-xs text-slate-500">
                  {tablero?.faseNombre
                    ? `Se agregará al tablero de la fase ${tablero.faseNombre}.`
                    : `Se agregará al tablero ${tablero?.nombre ?? ""}.`}
                </p>
              </div>
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
                  disabled={Boolean(tablero?.proyectoId)}
                  onChange={(e) =>
                    setNueva((prev) => ({
                      ...prev,
                      proyectoId: e.target.value,
                      edtActividadId: "",
                    }))
                  }
                  className={`${campoCls} disabled:opacity-70`}
                >
                  <option value="">Selecciona un proyecto</option>
                  {proyectos.map((proyecto) => (
                    <option key={proyecto.id} value={proyecto.id}>
                      {proyecto.id} · {proyecto.nombre}
                    </option>
                  ))}
                </select>
                {tablero?.proyectoId && (
                  <p className="text-[11px] text-slate-400">
                    El tablero de fase está fijado al proyecto {tablero.proyectoId}.
                  </p>
                )}
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
                    .filter((actividad) => !tablero?.faseId || actividad.faseId === tablero.faseId)
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
                “Entendido” antes de pasar a “En curso”. El color de la tarjeta cambiará según la
                cercanía de la fecha límite.
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

      {tareaDetalle && usuario && (
        <TareaDetalle
          tableroId={tareaDetalle.tableroId}
          tablero={tableroDe(tareaDetalle)}
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
