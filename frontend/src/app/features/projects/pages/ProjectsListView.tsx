import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  Archive, BookOpen, Edit2, Eye, FolderOpen, MoreVertical, Plus, RotateCcw, Search, Trash2, X,
} from "lucide-react";
import { api, mapProyecto } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import { fmt } from "../../../lib/format";
import { StatusBadge, Bar2 } from "../../../components/shared";
import { CargandoModule } from "../../../components/DataState";
import { STATUS_CFG } from "../../../constants";
import type { Project } from "../../../types";

type Props = {
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onEditProject: (id: string) => void;
  onDocumentsProject: (id: string) => void;
};

export function ProjectsListView({
  onSelectProject,
  onCreateProject,
  onEditProject,
  onDocumentsProject,
}: Props) {
  const { usuario } = useAuth();
  const [proyectos, setProyectos] = useState<Project[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [lineFilter, setLineFilter] = useState("Todas");
  const [responsibleFilter, setResponsibleFilter] = useState("Todos");
  const [paraEliminar, setParaEliminar] = useState<Project | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  const [creandoEjemplo, setCreandoEjemplo] = useState(false);
  const peticionRef = useRef(0);
  const cerrarMenu = useCallback(() => setMenuAbierto(null), []);

  const cargar = useCallback(async () => {
    const peticion = ++peticionRef.current;
    setCargando(true);
    setError(null);
    try {
      const { proyectos: datos } = await api.proyectos();
      if (peticion === peticionRef.current) {
        setProyectos(datos.map(mapProyecto));
        setCargado(true);
      }
    } catch (e) {
      if (peticion === peticionRef.current) setError(e instanceof Error ? e.message : "Error al cargar los proyectos.");
    } finally {
      if (peticion === peticionRef.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
    return () => { peticionRef.current += 1; };
  }, [cargar]);

  const eliminado = (id: string) => {
    setProyectos(actuales => actuales.filter(p => p.id !== id));
    setParaEliminar(null);
    setAviso(`El proyecto ${id} fue eliminado.`);
    void cargar();
  };
  const crearEjemplo = async () => {
    setCreandoEjemplo(true);
    setError(null);
    setAviso(null);
    try {
      const { proyecto, creado } = await api.crearProyectoEjemplo();
      setAviso(
        creado
          ? `Proyecto de ejemplo ${proyecto.id} creado. Ábrelo, revisa sus pestañas y en EDT pulsa "Completar plantilla" para cargar las tres etapas.`
          : `El proyecto de ejemplo ${proyecto.id} ya existe; puedes abrirlo para repasar el registro.`,
      );
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el proyecto de ejemplo.");
    } finally {
      setCreandoEjemplo(false);
    }
  };
  const consulta = search.trim().toLocaleLowerCase("es");
  const lineas = [...new Set(proyectos.map(p => p.line).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const responsables = [...new Set(proyectos.map(p => p.responsible).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const filtered = proyectos.filter(p => {
    const coincideTexto = [p.id, p.name, p.nombreCorto, p.numeroContrato, p.organizadores, p.entidadContratante]
      .some(valor => (valor ?? "").toLocaleLowerCase("es").includes(consulta));
    return coincideTexto
      && (statusFilter === "Todos" || p.status === statusFilter)
      && (lineFilter === "Todas" || p.line === lineFilter)
      && (responsibleFilter === "Todos" || p.responsible === responsibleFilter);
  });
  const hayFiltros = search.trim() !== "" || statusFilter !== "Todos" || lineFilter !== "Todas" || responsibleFilter !== "Todos";
  const limpiarFiltros = () => {
    setSearch("");
    setStatusFilter("Todos");
    setLineFilter("Todas");
    setResponsibleFilter("Todos");
  };

  if (cargando && !cargado) return <CargandoModule mensaje="Cargando proyectos…" />;

  return (
    <div className="space-y-5">
      {paraEliminar && usuario?.rol === "admin" && (
        <DeleteProjectDialog proyecto={paraEliminar} onClose={() => setParaEliminar(null)} onDeleted={eliminado} />
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Proyectos de Ingeniería SEI</h1>
          <p className="mt-0.5 text-sm text-gray-500">{proyectos.length} proyectos registrados</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {usuario?.rol === "admin" && (
            <button type="button" onClick={() => void crearEjemplo()} disabled={creandoEjemplo} title="Crea un proyecto guía con datos realistas, sin documentos ni actividades vinculadas" className="inline-flex items-center justify-center gap-2 rounded-lg border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 shadow-sm transition-colors hover:bg-orange-50 disabled:cursor-wait disabled:opacity-60">
              <BookOpen className="h-4 w-4" />{creandoEjemplo ? "Creando ejemplo…" : "Proyecto de ejemplo"}
            </button>
          )}
          <button type="button" onClick={onCreateProject} disabled={!usuario} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#9A3412] disabled:opacity-60">
            <Plus className="h-4 w-4" />Nuevo proyecto
          </button>
        </div>
      </div>
      {aviso && <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{aviso}</p>}
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          <button type="button" onClick={() => void cargar()} disabled={cargando} className="font-semibold underline disabled:opacity-60">Reintentar carga</button>
        </div>
      )}
      {cargando && <p role="status" className="text-xs text-gray-500">Actualizando proyectos…</p>}

      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0">
            <label htmlFor="buscar-proyectos" className="mb-1.5 block text-xs font-semibold text-gray-700">Buscar proyectos</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input id="buscar-proyectos" type="search" placeholder="Código, nombre, contrato, entidad…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
            </div>
          </div>
          <div>
            <label htmlFor="filtrar-estado-proyectos" className="mb-1.5 block text-xs font-semibold text-gray-700">Estado</label>
            <select id="filtrar-estado-proyectos" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20">
              <option value="Todos">Todos los estados</option>
              {Object.keys(STATUS_CFG).map(estado => <option key={estado} value={estado}>{estado}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filtrar-linea-proyectos" className="mb-1.5 block text-xs font-semibold text-gray-700">Línea / área</label>
            <select id="filtrar-linea-proyectos" value={lineFilter} onChange={e => setLineFilter(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20">
              <option value="Todas">Todas las líneas</option>
              {lineas.map(linea => <option key={linea} value={linea}>{linea}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filtrar-responsable-proyectos" className="mb-1.5 block text-xs font-semibold text-gray-700">Responsable</label>
            <select id="filtrar-responsable-proyectos" value={responsibleFilter} onChange={e => setResponsibleFilter(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20">
              <option value="Todos">Todos los responsables</option>
              {responsables.map(responsable => <option key={responsable} value={responsable}>{responsable}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-50 pt-3">
          <p className="text-xs text-gray-500">{filtered.length} de {proyectos.length} proyectos visibles</p>
          <button type="button" onClick={limpiarFiltros} disabled={!hayFiltros}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
            <RotateCcw className="h-3.5 w-3.5" />Limpiar filtros
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm" aria-busy={cargando}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {["Código", "Proyecto", "N.º contrato", "Línea / área", "Responsable", "Estado", "Avance", "Presupuesto", "Finaliza", "Acciones"].map(h => (
                  <th key={h} scope="col" className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50/80">
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-500">
                  {error && !cargado ? "No se pudo obtener la lista de proyectos." : proyectos.length === 0 ? "Aún no hay proyectos registrados." : "No hay proyectos que coincidan con la búsqueda y el estado seleccionado."}
                </td></tr>
              )}
              {filtered.map(p => (
                <tr key={p.id} className="transition-colors hover:bg-orange-50/10">
                  <td className="whitespace-nowrap px-4 py-3"><span className="font-mono text-xs font-bold text-orange-700">{p.id}</span></td>
                  <td className="px-4 py-3">
                    <p className="min-w-[160px] max-w-[260px] break-words text-sm font-semibold text-gray-900">{p.nombreCorto || p.name}</p>
                    {p.nombreCorto && <p className="mt-1 max-w-[260px] break-words text-xs text-gray-500">{p.name}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{p.numeroContrato || "No registrado"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{p.line}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{p.responsible}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-[100px] items-center gap-2">
                      <Bar2 value={p.progress} color="bg-orange-500" h="h-1.5" />
                      <span className="flex-shrink-0 text-xs font-bold text-gray-700">{p.progress}%</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{fmt(p.budget)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{p.endDate}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => onSelectProject(p.id)} className="rounded p-2 text-gray-500 transition-colors hover:bg-orange-50 hover:text-orange-600" title={`Ver detalle de ${p.id}`} aria-label={`Ver detalle de ${p.id}`}><Eye className="h-4 w-4" /></button>
                      {usuario && <button type="button" onClick={() => onEditProject(p.id)} className="rounded p-2 text-gray-500 transition-colors hover:bg-orange-50 hover:text-orange-600" title={`Editar ${p.id}`} aria-label={`Editar ${p.id}`}><Edit2 className="h-4 w-4" /></button>}
                      <ProjectActionsMenu
                        proyecto={p}
                        abierto={menuAbierto === p.id}
                        onToggle={() => setMenuAbierto((actual) => (actual === p.id ? null : p.id))}
                        onCerrar={cerrarMenu}
                        onDocumentos={() => { cerrarMenu(); onDocumentsProject(p.id); }}
                        onEliminar={() => { cerrarMenu(); setAviso(null); setParaEliminar(p); }}
                        esAdmin={usuario?.rol === "admin"}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100 bg-gray-50/40 px-4 py-3">
          <span className="text-xs text-gray-500">Mostrando {filtered.length} de {proyectos.length} proyectos</span>
        </div>
      </div>
    </div>
  );
}

function ProjectActionsMenu({
  proyecto,
  abierto,
  onToggle,
  onCerrar,
  onDocumentos,
  onEliminar,
  esAdmin,
}: {
  proyecto: Project;
  abierto: boolean;
  onToggle: () => void;
  onCerrar: () => void;
  onDocumentos: () => void;
  onEliminar: () => void;
  esAdmin: boolean;
}) {
  const botonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [posicion, setPosicion] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!abierto) {
      setPosicion(null);
      return;
    }

    const ubicar = () => {
      const rect = botonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ancho = 208;
      const alto = esAdmin ? 140 : 92;
      const left = Math.max(8, Math.min(window.innerWidth - ancho - 8, rect.right - ancho));
      const top =
        rect.bottom + 6 + alto > window.innerHeight
          ? Math.max(8, rect.top - alto - 6)
          : rect.bottom + 6;
      setPosicion({ top, left });
    };

    ubicar();
    const alClicFuera = (evento: MouseEvent) => {
      const objetivo = evento.target as Node;
      if (menuRef.current?.contains(objetivo) || botonRef.current?.contains(objetivo)) return;
      onCerrar();
    };
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onCerrar();
    };

    window.addEventListener("pointerdown", alClicFuera);
    window.addEventListener("keydown", alTeclear);
    window.addEventListener("resize", ubicar);
    window.addEventListener("scroll", onCerrar, true);
    return () => {
      window.removeEventListener("pointerdown", alClicFuera);
      window.removeEventListener("keydown", alTeclear);
      window.removeEventListener("resize", ubicar);
      window.removeEventListener("scroll", onCerrar, true);
    };
  }, [abierto, esAdmin, onCerrar]);

  const item =
    "flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-gray-600 transition-colors hover:bg-orange-50 hover:text-orange-700";

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={abierto}
        title={`Más acciones de ${proyecto.id}`}
        aria-label={`Más acciones de ${proyecto.id}`}
        className="rounded p-2 text-gray-500 transition-colors hover:bg-orange-50 hover:text-orange-600"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {abierto && posicion &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Más acciones de ${proyecto.id}`}
            style={{ position: "fixed", top: posicion.top, left: posicion.left, width: 208 }}
            className="z-[90] overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-xl"
          >
            <button type="button" role="menuitem" onClick={onDocumentos} className={item} title={`Documentos de ${proyecto.id}`}>
              <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
              Documentos
            </button>
            <a
              role="menuitem"
              href={api.documentosZipUrl(proyecto.id)}
              onClick={onCerrar}
              className={item}
              title={`Descargar carpeta ZIP de ${proyecto.id}`}
            >
              <Archive className="h-3.5 w-3.5 flex-shrink-0" />
              Descargar ZIP
            </a>
            {esAdmin && (
              <>
                <div className="my-1 border-t border-gray-100" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={onEliminar}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                  title={`Eliminar ${proyecto.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5 flex-shrink-0" />
                  Eliminar proyecto
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

const RELACIONADOS = [
  ["documentos", "Documentos"], ["indicadores", "Indicadores"], ["actividades", "Actividades"],
  ["edt", "EDT"], ["tareas", "Tareas"], ["informes", "Informes"],
] as const;

function DeleteProjectDialog({ proyecto, onClose, onDeleted }: {
  proyecto: Project;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const { usuario } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const eliminandoRef = useRef(false);
  const [preparacion, setPreparacion] = useState<Awaited<ReturnType<typeof api.prepararEliminacionProyecto>> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);
  const [confirmacion, setConfirmacion] = useState("");
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { dialog?.close(); };
  }, []);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setPreparacion(null);
    setError(null);
    api.prepararEliminacionProyecto(proyecto.id).then(datos => {
      if (activo) setPreparacion(datos);
    }).catch((e: unknown) => {
      if (activo) setError(e instanceof Error ? e.message : "No se pudo comprobar si el proyecto puede eliminarse.");
    }).finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [proyecto.id, intento]);

  const sinVinculos = preparacion?.puedeEliminar === true && RELACIONADOS.every(([key]) => preparacion.relacionados[key] === 0);
  const permitido = usuario?.rol === "admin" && !cargando && !eliminando && sinVinculos && confirmacion === proyecto.id;
  const eliminar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!permitido || eliminandoRef.current) return;
    eliminandoRef.current = true;
    setEliminando(true);
    setError(null);
    try {
      await api.eliminarProyecto(proyecto.id, confirmacion);
      onDeleted(proyecto.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el proyecto. La lista se conserva.");
    } finally {
      eliminandoRef.current = false;
      setEliminando(false);
    }
  };

  return (
    <dialog ref={dialogRef} aria-labelledby="eliminar-proyecto-titulo" aria-describedby="eliminar-proyecto-descripcion" onCancel={event => { event.preventDefault(); if (!eliminandoRef.current) onClose(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border-0 bg-white p-5 shadow-2xl backdrop:bg-black/40 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 id="eliminar-proyecto-titulo" className="text-lg font-bold text-gray-900">Eliminar proyecto</h2>
        <button type="button" onClick={onClose} disabled={eliminando} autoFocus title={`Cerrar eliminación de ${proyecto.id}`} aria-label={`Cerrar eliminación de ${proyecto.id}`} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-60"><X className="h-4 w-4" /></button>
      </div>
      <p id="eliminar-proyecto-descripcion" className="mt-2 break-words text-sm text-gray-600"><strong>{proyecto.id}</strong> — {proyecto.nombreCorto || proyecto.name}. Esta acción es permanente y sólo se permite para proyectos sin registros vinculados.</p>
      {cargando && <p role="status" className="mt-4 text-sm text-gray-500">Comprobando registros vinculados…</p>}
      {preparacion && (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {RELACIONADOS.map(([key, label]) => (
              <div key={key} className="rounded-lg bg-gray-50 p-3"><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 text-lg font-bold text-gray-900">{preparacion.relacionados[key]}</dd></div>
            ))}
          </dl>
          {!sinVinculos && <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">No se puede eliminar este proyecto: tiene vínculos o el servidor no permite su eliminación. No se borrará ningún registro relacionado.</p>}
        </>
      )}
      {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!cargando && (error || !sinVinculos) && <button type="button" disabled={eliminando} onClick={() => setIntento(i => i + 1)} className="mt-3 text-sm font-semibold text-orange-700 underline disabled:opacity-60">Volver a comprobar vínculos</button>}
      <form onSubmit={eliminar} className="mt-4 space-y-4" aria-busy={eliminando}>
        <div>
          <label htmlFor="confirmacion-eliminar-proyecto" className="mb-1.5 block break-words text-sm font-semibold text-gray-700">Escriba exactamente {proyecto.id} para confirmar</label>
          <input id="confirmacion-eliminar-proyecto" value={confirmacion} onChange={event => setConfirmacion(event.target.value)} disabled={!sinVinculos || cargando || eliminando} autoComplete="off" spellCheck={false} aria-describedby="confirmacion-eliminar-ayuda" className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:bg-gray-100" />
          <p id="confirmacion-eliminar-ayuda" className="mt-1 text-xs text-gray-500">Debe coincidir el código completo, incluidas mayúsculas y guiones, sin espacios adicionales.</p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={eliminando} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">Cancelar</button>
          <button type="submit" disabled={!permitido} className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="h-4 w-4" />{eliminando ? "Eliminando…" : "Eliminar definitivamente"}</button>
        </div>
      </form>
    </dialog>
  );
}
