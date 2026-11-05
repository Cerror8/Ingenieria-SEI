import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  GripVertical,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type {
  ColumnaTablero,
  PrioridadTablero,
  TareaTablero,
} from "../../types";

const CLAVE_ALMACEN = "sei.tablero.tareas.v1";

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

const PRIORIDAD_CFG: Record<PrioridadTablero, string> = {
  Alta: "bg-red-50 text-red-700 border-red-200",
  Media: "bg-amber-50 text-amber-700 border-amber-200",
  Baja: "bg-slate-100 text-slate-600 border-slate-200",
};

const TAREAS_INICIALES: TareaTablero[] = [
  {
    id: "T-001",
    titulo: "Definir resultados de aprendizaje del programa",
    descripcion: "Consolidar el documento base con el comité curricular.",
    columna: "por-hacer",
    responsable: "Carmen López",
    prioridad: "Alta",
    fechaLimite: "2026-11-12",
    etiqueta: "RAP",
  },
  {
    id: "T-002",
    titulo: "Levantar evidencias del período 2026-1",
    descripcion: "Recopilar rúbricas y actas de las asignaturas piloto.",
    columna: "por-hacer",
    responsable: "Julián Rojas",
    prioridad: "Media",
    fechaLimite: "2026-11-18",
    etiqueta: "Evidencias",
  },
  {
    id: "T-003",
    titulo: "Modelo de datos del módulo RAP",
    descripcion: "Programas, asignaturas, resultados y evidencias.",
    columna: "en-curso",
    responsable: "Laura Gómez",
    prioridad: "Alta",
    fechaLimite: "2026-11-10",
    etiqueta: "Backend",
  },
  {
    id: "T-004",
    titulo: "Diseñar tablero de asignación de trabajo",
    descripcion: "Columnas, responsables y prioridades estilo Monday.",
    columna: "en-curso",
    responsable: "Andrés Paz",
    prioridad: "Alta",
    fechaLimite: "2026-11-14",
    etiqueta: "Frontend",
  },
  {
    id: "T-005",
    titulo: "Validar login institucional con Google",
    descripcion: "Probar el flujo OAuth con cuentas del dominio CESMAG.",
    columna: "en-revision",
    responsable: "Carmen López",
    prioridad: "Media",
    fechaLimite: "2026-11-08",
    etiqueta: "Acceso",
  },
  {
    id: "T-006",
    titulo: "Documentar el esquema de sesiones",
    descripcion: "Explicar tablas, cookies y expiración de sesión.",
    columna: "completado",
    responsable: "Laura Gómez",
    prioridad: "Baja",
    fechaLimite: "2026-11-04",
    etiqueta: "Documentación",
  },
  {
    id: "T-007",
    titulo: "Configurar PostgreSQL en Docker",
    descripcion: "Contenedor, volumen y esquema inicial en el puerto 5433.",
    columna: "completado",
    responsable: "Andrés Paz",
    prioridad: "Media",
    fechaLimite: "2026-11-03",
    etiqueta: "Infraestructura",
  },
];

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

function cargarTareas(): TareaTablero[] {
  try {
    const guardadas = localStorage.getItem(CLAVE_ALMACEN);
    if (!guardadas) return TAREAS_INICIALES;
    const datos = JSON.parse(guardadas) as TareaTablero[];
    return Array.isArray(datos) && datos.length > 0 ? datos : TAREAS_INICIALES;
  } catch {
    return TAREAS_INICIALES;
  }
}

function fechaCorta(valor: string) {
  if (!valor) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(
    new Date(`${valor}T12:00:00`),
  );
}

const campoCls =
  "w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10";

export function TablerosView() {
  const [tareas, setTareas] = useState<TareaTablero[]>(cargarTareas);
  const [busqueda, setBusqueda] = useState("");
  const [prioridad, setPrioridad] = useState<PrioridadTablero | "Todas">("Todas");
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [columnaActiva, setColumnaActiva] = useState<ColumnaTablero | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [nueva, setNueva] = useState({
    titulo: "",
    descripcion: "",
    responsable: "",
    prioridad: "Media" as PrioridadTablero,
    fechaLimite: "",
    etiqueta: "General",
    columna: "por-hacer" as ColumnaTablero,
  });

  useEffect(() => {
    localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(tareas));
  }, [tareas]);

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return tareas.filter((tarea) => {
      const coincideTexto =
        !texto ||
        [tarea.titulo, tarea.responsable, tarea.etiqueta, tarea.descripcion]
          .join(" ")
          .toLowerCase()
          .includes(texto);
      const coincidePrioridad = prioridad === "Todas" || tarea.prioridad === prioridad;
      return coincideTexto && coincidePrioridad;
    });
  }, [tareas, busqueda, prioridad]);

  function moverTarea(id: string, columna: ColumnaTablero) {
    setTareas((prev) => prev.map((tarea) => (tarea.id === id ? { ...tarea, columna } : tarea)));
  }

  function eliminarTarea(id: string) {
    setTareas((prev) => prev.filter((tarea) => tarea.id !== id));
  }

  function crearTarea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nueva.titulo.trim()) return;

    setTareas((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        titulo: nueva.titulo.trim(),
        descripcion: nueva.descripcion.trim(),
        responsable: nueva.responsable.trim() || "Sin asignar",
        prioridad: nueva.prioridad,
        fechaLimite: nueva.fechaLimite,
        etiqueta: nueva.etiqueta.trim() || "General",
        columna: nueva.columna,
      },
    ]);
    setNueva({
      titulo: "",
      descripcion: "",
      responsable: "",
      prioridad: "Media",
      fechaLimite: "",
      etiqueta: "General",
      columna: "por-hacer",
    });
    setMostrarFormulario(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tablero de asignación de trabajo</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Equipo Ingeniería SEI · Arrastra las tarjetas entre columnas
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMostrarFormulario(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#9A3412]"
        >
          <Plus className="h-4 w-4" />
          Nueva tarea
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar tarea, responsable o etiqueta…"
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
        <span className="ml-auto text-xs font-medium text-gray-400">
          {filtradas.length} de {tareas.length} tareas
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNAS.map((columna) => {
          const tareasColumna = filtradas.filter((tarea) => tarea.columna === columna.id);
          const activa = columnaActiva === columna.id;

          return (
            <section
              key={columna.id}
              onDragOver={(e) => {
                e.preventDefault();
                setColumnaActiva(columna.id);
              }}
              onDragLeave={() => setColumnaActiva(null)}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || arrastrando;
                if (id) moverTarea(id, columna.id);
                setArrastrando(null);
                setColumnaActiva(null);
              }}
              className={`flex min-h-[420px] flex-col rounded-xl border bg-slate-50/80 transition-colors ${
                activa ? "border-[#EA580C] bg-orange-50/50" : "border-slate-200"
              }`}
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
                {tareasColumna.map((tarea) => (
                  <article
                    key={tarea.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", tarea.id);
                      setArrastrando(tarea.id);
                    }}
                    onDragEnd={() => {
                      setArrastrando(null);
                      setColumnaActiva(null);
                    }}
                    className={`group cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md active:cursor-grabbing ${
                      arrastrando === tarea.id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9A3412]">
                        {tarea.etiqueta}
                      </span>
                      <div className="flex items-center gap-1">
                        <GripVertical className="h-3.5 w-3.5 text-slate-300" />
                        <button
                          type="button"
                          onClick={() => eliminarTarea(tarea.id)}
                          aria-label={`Eliminar ${tarea.titulo}`}
                          className="rounded p-1 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="mt-2 text-sm font-semibold leading-snug text-slate-800">
                      {tarea.titulo}
                    </h3>
                    {tarea.descripcion && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                        {tarea.descripcion}
                      </p>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${PRIORIDAD_CFG[tarea.prioridad]}`}
                      >
                        {tarea.prioridad}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                        <CalendarDays className="h-3 w-3" />
                        {fechaCorta(tarea.fechaLimite)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1F2937] text-[10px] font-bold text-white">
                        {iniciales(tarea.responsable)}
                      </div>
                      <span className="truncate text-[11px] font-medium text-slate-500">
                        {tarea.responsable}
                      </span>
                      {tarea.columna === "completado" ? (
                        <CheckCircle2 className="ml-auto h-4 w-4 text-green-500" />
                      ) : tarea.columna === "en-curso" ? (
                        <Clock className="ml-auto h-4 w-4 text-blue-500" />
                      ) : (
                        <Circle className="ml-auto h-4 w-4 text-slate-300" />
                      )}
                    </div>
                  </article>
                ))}

                {tareasColumna.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
                    Suelta una tarea aquí
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setNueva((prev) => ({ ...prev, columna: columna.id }));
                  setMostrarFormulario(true);
                }}
                className="m-3 mt-0 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-500 transition hover:border-[#EA580C] hover:text-[#C2410C]"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar tarea
              </button>
            </section>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-400">
        Las tareas se guardan en este navegador. La conexión con la base de datos se hará en la
        siguiente fase.
      </p>

      {mostrarFormulario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
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
                  <input
                    id="responsable"
                    value={nueva.responsable}
                    onChange={(e) =>
                      setNueva((prev) => ({ ...prev, responsable: e.target.value }))
                    }
                    placeholder="Nombre"
                    className={campoCls}
                  />
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

              <div className="space-y-1.5">
                <label htmlFor="columna" className="text-xs font-semibold text-slate-700">
                  Columna
                </label>
                <select
                  id="columna"
                  value={nueva.columna}
                  onChange={(e) =>
                    setNueva((prev) => ({
                      ...prev,
                      columna: e.target.value as ColumnaTablero,
                    }))
                  }
                  className={campoCls}
                >
                  {COLUMNAS.map((columna) => (
                    <option key={columna.id} value={columna.id}>
                      {columna.titulo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setMostrarFormulario(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#9A3412]"
                >
                  Crear tarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
