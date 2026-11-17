import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Clock,
  FileText,
  FileUp,
  Layers,
  Link2,
  Mail,
  MailCheck,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import {
  api,
  ApiError,
  type ContactoExternoApi,
  type DocumentoApi,
  type EdtActividadApi,
  type EdtApi,
  type EdtEstado,
  type EdtFaseApi,
  type EdtPlantillaApi,
  type EdtTipoActividad,
  type FormatoApi,
  type NuevaEdtActividad,
} from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { calcularUrgencia, fechaCorta, type Urgencia } from "../../lib/urgencia";
import type { UsuarioAsignable } from "../../types";
import { SubirDocumentoModal } from "../documentos/SubirDocumentoModal";

const TIPOS: EdtTipoActividad[] = ["Actividad", "Documento", "Acta"];

const campoCls =
  "w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10 disabled:opacity-60";

const ESTADO_CFG: Record<EdtEstado, { clases: string; icono: typeof CheckCircle2 }> = {
  Completado: { clases: "border-emerald-200 bg-emerald-50 text-emerald-700", icono: CheckCircle2 },
  "En ejecución": { clases: "border-orange-200 bg-orange-50 text-orange-700", icono: Clock },
  "No realizado": { clases: "border-slate-200 bg-slate-50 text-slate-500", icono: CircleDashed },
};

const TIPO_CFG: Record<EdtTipoActividad, string> = {
  Actividad: "border-slate-200 bg-slate-50 text-slate-600",
  Documento: "border-sky-200 bg-sky-50 text-sky-700",
  Acta: "border-violet-200 bg-violet-50 text-violet-700",
};

const AVANCE_BARRA: Record<Urgencia["nivel"], number> = {
  verde: 18,
  azul: 34,
  amarillo: 52,
  naranja: 70,
  rojo: 88,
  morado: 100,
  "sin-fecha": 0,
};

function etiquetaFase(fase: { clave: string | null; orden?: number | null }): string {
  const partes = fase.clave?.match(/^fase-(\d+)(?:-(\d+))?$/);
  if (partes) return partes[2] ? `Fase ${partes[1]}.${partes[2]}` : `Fase ${partes[1]}`;
  return `Fase ${fase.orden ?? 1}`;
}

function porcentajeCumplido(actividades: EdtActividadApi[]): number {
  const aplicables = actividades.filter((actividad) => !actividad.noAplica);
  if (!aplicables.length) return 0;
  const valor = aplicables.reduce(
    (total, actividad) =>
      total + (actividad.estado === "Completado" ? 1 : actividad.estado === "En ejecución" ? 0.5 : 0),
    0,
  );
  return Math.round((valor / aplicables.length) * 100);
}

export function EdtTab({
  proyectoId,
  onChanged,
  onShowToast,
}: {
  proyectoId: string;
  onChanged?: () => void;
  onShowToast: (mensaje: string) => void;
}) {
  const [edt, setEdt] = useState<EdtApi | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoApi[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioAsignable[]>([]);
  const [carpetas, setCarpetas] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [editorActividad, setEditorActividad] = useState<{
    actividad: EdtActividadApi | null;
    faseId: string;
  } | null>(null);
  const [editorFase, setEditorFase] = useState<EdtFaseApi | null | "nueva">(null);
  const [subida, setSubida] = useState<EdtActividadApi | null>(null);
  const [cargandoPlantilla, setCargandoPlantilla] = useState(false);
  const [formatos, setFormatos] = useState<FormatoApi[]>([]);
  const [contactos, setContactos] = useState<ContactoExternoApi[]>([]);
  const [correo, setCorreo] = useState<EdtActividadApi | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const { usuario } = useAuth();
  const [vistaGeneral, setVistaGeneral] = useState(false);
  const [busquedas, setBusquedas] = useState<Record<string, string>>({});
  const [anchoFases, setAnchoFases] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const barraRef = useRef<HTMLDivElement>(null);

  const cargarDocumentos = useCallback(async () => {
    try {
      const { documentos: filas } = await api.documentos(proyectoId);
      setDocumentos(filas);
    } catch {
      setDocumentos([]);
    }
  }, [proyectoId]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [respuesta, docs] = await Promise.all([
        api.edt(proyectoId),
        api.documentos(proyectoId),
      ]);
      setEdt(respuesta);
      setDocumentos(docs.documentos);
      if (respuesta.proyecto.estructura) {
        try {
          const { estructura } = await api.estructura(respuesta.proyecto.estructura);
          setCarpetas(estructura.carpetas);
        } catch {
          setCarpetas([]);
        }
      } else {
        setCarpetas([]);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo cargar el EDT.");
    } finally {
      setCargando(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void cargar();
    void api
      .usuariosAsignables()
      .then(({ usuarios: filas }) => setUsuarios(filas))
      .catch(() => setUsuarios([]));
    void api
      .formatos()
      .then(({ formatos: filas }) => setFormatos(filas.filter((formato) => formato.activo)))
      .catch(() => setFormatos([]));
    void api
      .contactosExternos()
      .then(({ contactos: filas }) => setContactos(filas.filter((contacto) => contacto.activo)))
      .catch(() => setContactos([]));
  }, [cargar]);

  useEffect(() => {
    if (vistaGeneral) return;
    const grid = gridRef.current;
    if (!grid) return;
    const medir = () => setAnchoFases(grid.scrollWidth);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(grid);
    window.addEventListener("resize", medir);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, [vistaGeneral, edt]);

  function sincronizarScroll(origen: "barra" | "grid") {
    const grid = gridRef.current;
    const barra = barraRef.current;
    if (!grid || !barra) return;
    if (origen === "barra") grid.scrollLeft = barra.scrollLeft;
    else barra.scrollLeft = grid.scrollLeft;
  }

  const documentosPorActividad = useMemo(() => {
    const mapa = new Map<string, DocumentoApi[]>();
    for (const documento of documentos) {
      if (!documento.edtActividadId) continue;
      const lista = mapa.get(documento.edtActividadId) ?? [];
      lista.push(documento);
      mapa.set(documento.edtActividadId, lista);
    }
    return mapa;
  }, [documentos]);

  const actividades = edt?.actividades ?? [];
  const fases = edt?.fases ?? [];

  const resumen = useMemo(() => {
    const aplicables = actividades.filter((actividad) => !actividad.noAplica);
    const total = aplicables.length;
    const completadas = aplicables.filter((actividad) => actividad.estado === "Completado").length;
    const sinDocumento = aplicables.filter(
      (actividad) => actividad.requiereDocumento && actividad.documentos === 0,
    ).length;
    const vencidas = aplicables.filter(
      (actividad) =>
        actividad.estado !== "Completado" &&
        calcularUrgencia(actividad.fechaCumplimiento).nivel === "morado",
    ).length;
    const noAplica = actividades.length - total;
    return { total, completadas, sinDocumento, vencidas, noAplica };
  }, [actividades]);

  async function ejecutar(id: string, accion: () => Promise<unknown>, exito: string) {
    setOcupado(id);
    try {
      await accion();
      onShowToast(exito);
      await cargar();
      onChanged?.();
    } catch (e) {
      onShowToast(e instanceof ApiError ? e.message : "No se pudo completar la acción.");
    } finally {
      setOcupado(null);
    }
  }

  async function cambiarEstado(actividad: EdtActividadApi, estado: EdtEstado) {
    await ejecutar(
      actividad.id,
      () => api.actualizarEdtActividad(actividad.id, { estado }),
      `Actividad actualizada a “${estado}”.`,
    );
  }

  async function eliminarActividad(actividad: EdtActividadApi) {
    if (
      !window.confirm(
        `¿Eliminar la actividad “${actividad.nombre}”? También se quitarán sus tareas y vínculos.`,
      )
    ) {
      return;
    }
    await ejecutar(
      actividad.id,
      () => api.eliminarEdtActividad(actividad.id),
      "Actividad eliminada.",
    );
  }

  async function cargarChecklist() {
    if (
      !window.confirm(
        `Se agregarán al proyecto las actividades y documentos del checklist de ${edt?.proyecto.tipoContrato ?? "interventoría"}. Las ya existentes no se duplican. ¿Continuar?`,
      )
    ) {
      return;
    }
    setCargandoPlantilla(true);
    try {
      const respuesta = await api.cargarPlantillaEdt(proyectoId);
      setEdt(respuesta);
      await cargarDocumentos();
      onShowToast(
        respuesta.creados > 0
          ? `Checklist cargado: ${respuesta.creados} actividad(es) y ${respuesta.tareasCreadas} tarea(s).`
          : "El checklist ya estaba completo.",
      );
      onChanged?.();
    } catch (e) {
      onShowToast(e instanceof ApiError ? e.message : "No se pudo cargar el checklist.");
    } finally {
      setCargandoPlantilla(false);
    }
  }

  async function sincronizarCorreos() {
    setSincronizando(true);
    try {
      const resultado = await api.sincronizarCorreos();
      onShowToast(
        resultado.registrados > 0
          ? `Respuestas registradas: ${resultado.registrados} correo(s) y ${resultado.documentos} documento(s).`
          : `Sin respuestas nuevas (${resultado.revisados} correo(s) revisado(s)).`,
      );
      await cargar();
      onChanged?.();
    } catch (e) {
      onShowToast(e instanceof ApiError ? e.message : "No se pudo sincronizar el correo.");
    } finally {
      setSincronizando(false);
    }
  }

  async function eliminarFase(fase: EdtFaseApi) {
    if (
      !window.confirm(
        `¿Eliminar la fase “${fase.nombre}”? Se eliminarán sus actividades y su tablero.`,
      )
    ) {
      return;
    }
    await ejecutar(
      `fase-${fase.id}`,
      () => api.eliminarFaseEdt(fase.id),
      "Fase eliminada.",
    );
  }

  if (cargando && !edt) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16">
        <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Cargando EDT por fases…</span>
      </div>
    );
  }

  if (error && !edt) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
        {error}
        <button
          type="button"
          onClick={() => void cargar()}
          className="ml-3 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-slate-800">EDT por fases</h2>
            <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#C2410C]">
              {edt?.proyecto.tipoContrato ?? "Interventoría"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Cada fase es un tablero; cada actividad se convierte en una tarea asignable con
            documento obligatorio y requisitos previos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setVistaGeneral((valor) => !valor)}
            aria-pressed={vistaGeneral}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              vistaGeneral
                ? "border-[#C2410C] bg-orange-50 text-[#C2410C]"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            {vistaGeneral ? "Ver tableros" : "Vista general"}
          </button>
          <button
            type="button"
            onClick={cargarChecklist}
            disabled={cargandoPlantilla}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <ListChecksIcon />
            {cargandoPlantilla ? "Cargando…" : "Completar checklist"}
          </button>
          {usuario?.rol === "admin" && (
            <button
              type="button"
              onClick={() => void sincronizarCorreos()}
              disabled={sincronizando}
              title="Busca en el buzón las respuestas de las personas externas y las archiva en su actividad"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <MailCheck className={`h-4 w-4 ${sincronizando ? "animate-pulse" : ""}`} />
              {sincronizando ? "Sincronizando…" : "Sincronizar respuestas"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditorFase("nueva")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Layers className="h-4 w-4" />
            Nueva fase
          </button>
          <button
            type="button"
            onClick={() => {
              const fase = fases[0];
              if (fase) setEditorActividad({ actividad: null, faseId: fase.id });
            }}
            disabled={!fases.length}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#C2410C] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#9A3412] disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Nueva actividad
          </button>
        </div>
      </header>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Resumen
          etiqueta="Actividades"
          valor={resumen.total}
          detalle={`${fases.length} fase(s)${resumen.noAplica ? ` · ${resumen.noAplica} no aplica` : ""}`}
        />
        <Resumen
          etiqueta="Completadas"
          valor={resumen.completadas}
          detalle={`${resumen.total ? Math.round((resumen.completadas / resumen.total) * 100) : 0}% del EDT`}
          tono="emerald"
        />
        <Resumen
          etiqueta="Sin documento"
          valor={resumen.sinDocumento}
          detalle="Documentos obligatorios pendientes"
          tono={resumen.sinDocumento ? "orange" : "slate"}
        />
        <Resumen
          etiqueta="Vencidas"
          valor={resumen.vencidas}
          detalle="Con fecha de entrega superada"
          tono={resumen.vencidas ? "purple" : "slate"}
        />
      </section>

      {fases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
          <p className="text-sm font-semibold text-slate-700">Todavía no hay fases en este EDT.</p>
          <p className="mt-1 text-xs text-slate-500">
            Carga el checklist del contrato o crea una fase para empezar.
          </p>
        </div>
      ) : vistaGeneral ? (
        <VistaGeneralEdt plantilla={edt?.plantillaEdt ?? []} actividades={actividades} />
      ) : (
        <>
          <div className="rounded-lg border border-slate-200 bg-white px-1 py-0.5">
            <div
              ref={barraRef}
              onScroll={() => sincronizarScroll("barra")}
              aria-hidden="true"
              className="overflow-x-auto overflow-y-hidden"
            >
              <div style={{ width: `${Math.max(anchoFases, 1)}px` }} className="h-1" />
            </div>
          </div>
          <div
            ref={gridRef}
            onScroll={() => sincronizarScroll("grid")}
            className="grid auto-cols-[minmax(290px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-3"
          >
          {fases.map((fase) => {
            const actividadesFase = actividades.filter(
              (actividad) => actividad.faseId === fase.id,
            );
            const busqueda = (busquedas[fase.id] ?? "").trim().toLocaleLowerCase("es");
            const actividadesFiltradas = busqueda
              ? actividadesFase.filter((actividad) =>
                  [actividad.nombre, actividad.descripcion, actividad.responsable ?? ""].some(
                    (valor) => valor.toLocaleLowerCase("es").includes(busqueda),
                  ),
                )
              : actividadesFase;
            const progreso = porcentajeCumplido(actividadesFase);
            const aplicablesFase = actividadesFase.filter((actividad) => !actividad.noAplica);
            const anterior = fases.find((otra) => otra.id === fase.dependeDeFaseId);
            return (
              <section
                key={fase.id}
                className="flex min-h-[220px] flex-col rounded-xl border border-slate-200 bg-slate-50/70"
              >
                <header className="rounded-t-xl border-b border-slate-200 bg-white px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                          {etiquetaFase(fase)}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                            fase.esPrincipal
                              ? "bg-orange-50 text-[#C2410C]"
                              : "bg-sky-50 text-sky-700"
                          }`}
                        >
                          {fase.esPrincipal ? "Principal" : "Adicional"}
                        </span>
                      </div>
                      <h3 className="mt-1 truncate text-sm font-bold text-slate-800" title={fase.nombre}>
                        {fase.nombre}
                      </h3>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">
                        {fase.descripcion || "Sin descripción."}
                      </p>
                      <div className="relative mt-2">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                        <input
                          type="search"
                          value={busquedas[fase.id] ?? ""}
                          onChange={(event) =>
                            setBusquedas((actual) => ({
                              ...actual,
                              [fase.id]: event.target.value,
                            }))
                          }
                          placeholder="Buscar en esta fase…"
                          aria-label={`Buscar actividades en ${fase.nombre}`}
                          className="w-full rounded-md border border-slate-200 bg-slate-50 py-1 pl-7 pr-2 text-[11px] text-slate-700 outline-none focus:border-[#EA580C] focus:bg-white"
                        />
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => setEditorFase(fase)}
                        aria-label={`Editar fase ${fase.nombre}`}
                        className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {!fase.esPrincipal && (
                        <button
                          type="button"
                          onClick={() => void eliminarFase(fase)}
                          disabled={ocupado === `fase-${fase.id}`}
                          aria-label={`Eliminar fase ${fase.nombre}`}
                          className="rounded-md p-1.5 text-rose-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {anterior && (
                    <p className="mt-2 inline-flex items-center gap-1 rounded bg-slate-50 px-1.5 py-1 text-[10px] text-slate-500">
                      <Link2 className="h-3 w-3" />
                      Después de: {anterior.nombre}
                    </p>
                  )}
                  <div className="mt-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${progreso}%` }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                      <span>
                        {aplicablesFase.filter((a) => a.estado === "Completado").length}/
                        {aplicablesFase.length} completadas
                      </span>
                      <span>{progreso}%</span>
                    </div>
                  </div>
                </header>

                <div className="max-h-[540px] flex-1 space-y-2 overflow-y-auto p-2">
                  {actividadesFiltradas.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-[11px] text-slate-400">
                      {actividadesFase.length === 0
                        ? "Sin actividades en esta fase."
                        : "Ninguna actividad coincide con la búsqueda."}
                    </p>
                  ) : (
                    [...actividadesFiltradas]
                      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre))
                      .map((actividad) => (
                        <TarjetaActividad
                          key={actividad.id}
                          actividad={actividad}
                          documentos={documentosPorActividad.get(actividad.id) ?? []}
                          ocupado={ocupado === actividad.id}
                          onEditar={() =>
                            setEditorActividad({ actividad, faseId: fase.id })
                          }
                          onEliminar={() => void eliminarActividad(actividad)}
                          onEstado={(estado) => void cambiarEstado(actividad, estado)}
                          onSubir={() => setSubida(actividad)}
                          onCorreo={() => setCorreo(actividad)}
                        />
                      ))
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setEditorActividad({ actividad: null, faseId: fase.id })}
                  className="m-2 inline-flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-[11px] font-semibold text-slate-500 transition hover:border-[#EA580C] hover:text-[#C2410C]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar actividad
                </button>
              </section>
            );
          })}
          </div>
        </>
      )}

      <p className="text-[11px] leading-relaxed text-slate-400">
        Las fases del checklist se conservan como guía y pueden renombrarse. Las fases adicionales
        se conectan a la fase anterior. Los documentos que cargues aquí quedan también en
        Documentos, dentro de la carpeta sugerida, y una actividad no puede completarse sin sus
        documentos y requisitos previos. La vista general compara la plantilla del contrato con las
        actividades ya cargadas en el proyecto.
      </p>

      {editorActividad && edt && (
        <ModalActividad
          key={`${editorActividad.actividad?.id ?? "nueva"}-${editorActividad.faseId}`}
          proyectoId={proyectoId}
          faseInicial={editorActividad.faseId}
          actividad={editorActividad.actividad}
          fases={fases}
          actividades={actividades}
          usuarios={usuarios}
          contactos={contactos}
          carpetas={carpetas}
          formatos={formatos}
          onContactoCreado={(contacto) => setContactos((actual) => [...actual, contacto])}
          onCerrar={() => setEditorActividad(null)}
          onGuardado={async () => {
            setEditorActividad(null);
            await cargar();
            onChanged?.();
          }}
          onShowToast={onShowToast}
        />
      )}

      {editorFase && (
        <ModalFase
          key={editorFase === "nueva" ? "nueva" : editorFase.id}
          proyectoId={proyectoId}
          fase={editorFase === "nueva" ? null : editorFase}
          fases={fases}
          onCerrar={() => setEditorFase(null)}
          onGuardado={async () => {
            setEditorFase(null);
            await cargar();
            onChanged?.();
          }}
          onShowToast={onShowToast}
        />
      )}

      <SubirDocumentoModal
        abierto={Boolean(subida)}
        proyectoId={proyectoId}
        edtActividadId={subida?.id ?? null}
        carpetaInicial={subida?.carpeta ?? null}
        tipoInicial={subida?.tipo === "Acta" ? "Actas" : subida?.tipo === "Documento" ? "Documentación técnica" : undefined}
        nombreInicial={subida?.nombre}
        onCerrar={() => setSubida(null)}
        onSubido={() => {
          void cargar();
          onChanged?.();
        }}
      />

      {correo && (
        <ModalCorreo
          actividad={correo}
          onCerrar={() => setCorreo(null)}
          onEnviado={async () => {
            setCorreo(null);
            await cargar();
            onChanged?.();
          }}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}

function ListChecksIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="m3 7 2 2 3-3M3 17l2 2 3-3M13 6h8M13 12h8M13 18h8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Resumen({
  etiqueta,
  valor,
  detalle,
  tono = "slate",
}: {
  etiqueta: string;
  valor: number;
  detalle: string;
  tono?: "slate" | "emerald" | "orange" | "purple";
}) {
  const tonos = {
    slate: "text-slate-800",
    emerald: "text-emerald-600",
    orange: "text-orange-600",
    purple: "text-purple-600",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{etiqueta}</p>
      <p className={`mt-1 text-2xl font-bold ${tonos[tono]}`}>{valor}</p>
      <p className="text-[11px] text-slate-500">{detalle}</p>
    </div>
  );
}

function VistaGeneralEdt({
  plantilla,
  actividades,
}: {
  plantilla: EdtPlantillaApi[];
  actividades: EdtActividadApi[];
}) {
  const presentes = new Set(
    actividades
      .map((actividad) => actividad.plantillaClave)
      .filter((clave): clave is string => Boolean(clave)),
  );
  const total = plantilla.reduce((suma, fase) => suma + fase.actividades.length, 0);
  const obtenidas = plantilla.reduce(
    (suma, fase) => suma + fase.actividades.filter((item) => presentes.has(item.clave)).length,
    0,
  );

  if (!plantilla.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
        <p className="text-sm font-semibold text-slate-700">
          Aún no hay una plantilla de checklist para este tipo de contrato.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-bold text-slate-800">Vista general del EDT</p>
          <p className="text-[11px] text-slate-500">
            Plantilla del contrato con cada actividad: ✓ presente en el proyecto, ✗ falta cargarla.
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
            obtenidas === total
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-orange-200 bg-orange-50 text-[#C2410C]"
          }`}
        >
          {obtenidas}/{total} obtenidas
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {plantilla.map((fase) => {
          const hechas = fase.actividades.filter((item) => presentes.has(item.clave)).length;
          return (
            <section
              key={fase.clave}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              <header className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-orange-600">
                    {etiquetaFase({ clave: fase.clave })}
                  </p>
                  <h3 className="truncate text-sm font-bold text-slate-800" title={fase.nombre}>
                    {fase.nombre}
                  </h3>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                    hechas === fase.actividades.length
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  {hechas}/{fase.actividades.length}
                </span>
              </header>
              <ul className="divide-y divide-slate-50">
                {fase.actividades.map((item) => {
                  const existe = presentes.has(item.clave);
                  return (
                    <li key={item.clave} className="flex items-start gap-2 px-4 py-2">
                      {existe ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                      )}
                      <span
                        className={`text-xs leading-snug ${
                          existe ? "text-slate-700" : "text-rose-600"
                        }`}
                      >
                        {item.nombre}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TarjetaActividad({
  actividad,
  documentos,
  ocupado,
  onEditar,
  onEliminar,
  onEstado,
  onSubir,
  onCorreo,
}: {
  actividad: EdtActividadApi;
  documentos: DocumentoApi[];
  ocupado: boolean;
  onEditar: () => void;
  onEliminar: () => void;
  onEstado: (estado: EdtEstado) => void;
  onSubir: () => void;
  onCorreo: () => void;
}) {
  const urgencia = calcularUrgencia(actividad.fechaCumplimiento);
  const estado = ESTADO_CFG[actividad.estado];
  const IconoEstado = estado.icono;
  const requisitosVisibles = actividad.requisitos.filter((requisito) => !requisito.noAplica);
  const pendientes = requisitosVisibles.filter(
    (requisito) =>
      requisito.estado !== "Completado" || (requisito.tipo !== "Actividad" && !requisito.tieneDocumento),
  );
  const faltaDocumento = actividad.requiereDocumento && actividad.documentos === 0;
  const bloqueada = !actividad.noAplica && (faltaDocumento || pendientes.length > 0);

  return (
    <article
      className={`rounded-lg border p-3 shadow-sm ${
        actividad.noAplica
          ? "border-dashed border-slate-300 bg-slate-50/70 opacity-80"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${TIPO_CFG[actividad.tipo]}`}>
          {actividad.tipo}
        </span>
        {actividad.noAplica ? (
          <span className="rounded-full border border-slate-300 bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-500">
            No aplica
          </span>
        ) : (
          <>
            <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${estado.clases}`}>
              <IconoEstado className="mr-0.5 inline h-2.5 w-2.5" />
              {actividad.estado}
            </span>
            <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${urgencia.badge}`}>
              Alta · {urgencia.etiqueta}
            </span>
          </>
        )}
        <span className="ml-auto flex gap-0.5">
          <button
            type="button"
            onClick={onEditar}
            aria-label="Editar actividad"
            className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onEliminar}
            disabled={ocupado}
            aria-label="Eliminar actividad"
            className="rounded p-1 text-rose-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>

      <h4 className="mt-2 text-[13px] font-semibold leading-snug text-slate-800">
        {actividad.nombre || "Actividad sin nombre"}
      </h4>
      {actividad.descripcion && (
        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-500">
          {actividad.descripcion}
        </p>
      )}

      {actividad.noAplica ? (
        <p className="mt-2 rounded bg-slate-100 px-2 py-1 text-[10px] leading-snug text-slate-500">
          No aplica a este proyecto: no cuenta en el avance ni exige documento.
        </p>
      ) : (
        <div className="mt-2.5">
          <div className="relative h-5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${urgencia.barra}`}
              style={{ width: `${AVANCE_BARRA[urgencia.nivel]}%` }}
            />
            <span className="pointer-events-none absolute inset-y-0 left-1 flex items-center rounded-full bg-white/85 px-1.5 text-[9px] font-semibold text-slate-700">
              {fechaCorta(actividad.fechaCumplimiento)}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-1 flex items-center rounded-full bg-white/85 px-1.5 text-[9px] font-semibold text-slate-600">
              {urgencia.restante}
            </span>
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px]">
        <span className="inline-flex items-center gap-1 rounded bg-slate-50 px-1.5 py-0.5 text-slate-500">
          {actividad.responsable || "Sin asignar"}
        </span>
        {actividad.contactoExterno && (
          <span
            title={actividad.contactoExterno.organizacion || actividad.contactoExterno.email}
            className="inline-flex max-w-full items-center gap-1 rounded bg-violet-50 px-1.5 py-0.5 text-violet-700"
          >
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{actividad.contactoExterno.email}</span>
          </span>
        )}
        {actividad.correoEnviadoEn && (
          <span
            title={`Correo enviado el ${actividad.correoEnviadoEn.slice(0, 10)}`}
            className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700"
          >
            <MailCheck className="h-3 w-3" />
            Correo enviado
          </span>
        )}
        {actividad.requiereDocumento && !actividad.noAplica && (
          <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
              faltaDocumento ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
            }`}
          >
            <FileText className="h-3 w-3" />
            {faltaDocumento ? "Falta documento" : `${actividad.documentos} documento(s)`}
          </span>
        )}
        {actividad.tareas > 0 && (
          <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-600">
            {actividad.tareas} tarea(s)
          </span>
        )}
      </div>

      {actividad.formatos.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {actividad.formatos.map((formato) => (
            <span
              key={formato.id}
              title={formato.nombre}
              className="inline-flex max-w-full items-center gap-1 rounded bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700"
            >
              <FileText className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{formato.nombre}</span>
            </span>
          ))}
        </div>
      )}

      {requisitosVisibles.length > 0 && (
        <div className="mt-2 space-y-1 rounded-lg bg-slate-50 px-2 py-1.5">
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
            Requisitos previos
          </p>
          {requisitosVisibles.map((requisito) => {
            const listo =
              requisito.estado === "Completado" &&
              (requisito.tipo === "Actividad" || requisito.tieneDocumento);
            return (
              <p
                key={requisito.id}
                className={`flex items-start gap-1 text-[10px] ${listo ? "text-emerald-600" : "text-amber-700"}`}
              >
                {listo ? (
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                )}
                <span className="line-clamp-2">{requisito.nombre}</span>
              </p>
            );
          })}
        </div>
      )}

      {documentos.length > 0 && (
        <div className="mt-2 space-y-1">
          {documentos.map((documento) => (
            <a
              key={documento.id}
              href={api.documentoArchivoUrl(documento.id, true)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-sky-700 hover:bg-sky-50"
            >
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate">{documento.nombre}</span>
              <span className="ml-auto shrink-0 text-slate-400">{documento.version}</span>
            </a>
          ))}
        </div>
      )}

      {bloqueada && actividad.estado !== "Completado" && (
        <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-[10px] leading-snug text-amber-700">
          {faltaDocumento
            ? "Carga el documento obligatorio antes de completar."
            : "Completa primero los requisitos previos."}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1">
        {actividad.noAplica && (
          <span className="text-[10px] font-medium text-slate-400">
            Edita la actividad para volver a aplicarla.
          </span>
        )}
        {!actividad.noAplica && actividad.estado === "No realizado" && (
          <button
            type="button"
            onClick={() => onEstado("En ejecución")}
            disabled={ocupado}
            className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-semibold text-[#C2410C] transition hover:bg-orange-100 disabled:opacity-50"
          >
            <Play className="h-3 w-3" />
            Iniciar
          </button>
        )}
        {!actividad.noAplica && actividad.estado === "En ejecución" && (
          <button
            type="button"
            onClick={() => onEstado("Completado")}
            disabled={ocupado}
            title={bloqueada ? "Faltan documentos o requisitos" : "Marcar como completada"}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
            Completar
          </button>
        )}
        {!actividad.noAplica && actividad.estado === "Completado" && (
          <button
            type="button"
            onClick={() => onEstado("En ejecución")}
            disabled={ocupado}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" />
            Reabrir
          </button>
        )}
        {!actividad.noAplica && (
          <button
            type="button"
            onClick={onSubir}
            className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-700 transition hover:bg-sky-100"
          >
            <FileUp className="h-3 w-3" />
            Documento
          </button>
        )}
        {!actividad.noAplica && actividad.contactoExterno && (
          <button
            type="button"
            onClick={onCorreo}
            title={`Enviar el detalle de la actividad a ${actividad.contactoExterno.email}`}
            className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700 transition hover:bg-violet-100"
          >
            <Mail className="h-3 w-3" />
            Enviar correo
          </button>
        )}
      </div>
    </article>
  );
}

function ModalCorreo({
  actividad,
  onCerrar,
  onEnviado,
  onShowToast,
}: {
  actividad: EdtActividadApi;
  onCerrar: () => void;
  onEnviado: () => Promise<void>;
  onShowToast: (mensaje: string) => void;
}) {
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contacto = actividad.contactoExterno;

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const resultado = await api.enviarCorreoActividad(actividad.id, mensaje.trim() || undefined);
      onShowToast(`Correo enviado a ${contacto?.email ?? "la persona externa"}.`);
      await onEnviado();
      void resultado;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo enviar el correo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
      <div className="my-auto w-full max-w-xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-800">Enviar correo de la actividad</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={enviar} className="space-y-4 px-5 py-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">{actividad.nombre}</p>
            <p className="mt-0.5">
              Para: {contacto ? `${contacto.nombre} <${contacto.email}>` : "Sin persona externa"}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              El asunto incluye un código de la actividad: cuando respondan conservando el asunto,
              su respuesta y sus archivos se archivan aquí.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="correo-mensaje" className="text-xs font-semibold text-slate-700">
              Mensaje adicional (opcional)
            </label>
            <textarea
              id="correo-mensaje"
              rows={4}
              value={mensaje}
              onChange={(event) => setMensaje(event.target.value)}
              className={campoCls}
              placeholder="Ej. Por favor enviar el acta firmada antes del viernes."
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
            >
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse justify-end gap-2 pt-1 sm:flex-row">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando || !contacto}
              className="rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enviando ? "Enviando…" : "Enviar correo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalActividad({
  proyectoId,
  faseInicial,
  actividad,
  fases,
  actividades,
  usuarios,
  contactos,
  carpetas,
  formatos,
  onContactoCreado,
  onCerrar,
  onGuardado,
  onShowToast,
}: {
  proyectoId: string;
  faseInicial: string;
  actividad: EdtActividadApi | null;
  fases: EdtFaseApi[];
  actividades: EdtActividadApi[];
  usuarios: UsuarioAsignable[];
  contactos: ContactoExternoApi[];
  carpetas: string[];
  formatos: FormatoApi[];
  onContactoCreado: (contacto: ContactoExternoApi) => void;
  onCerrar: () => void;
  onGuardado: () => Promise<void>;
  onShowToast: (mensaje: string) => void;
}) {
  const [nombre, setNombre] = useState(actividad?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(actividad?.descripcion ?? "");
  const [faseId, setFaseId] = useState(actividad?.faseId ?? faseInicial);
  const [tipo, setTipo] = useState<EdtTipoActividad>(actividad?.tipo ?? "Actividad");
  const [fecha, setFecha] = useState(actividad?.fechaCumplimiento?.slice(0, 10) ?? "");
  const [asignado, setAsignado] = useState(
    actividad?.contactoExternoId
      ? `externo:${actividad.contactoExternoId}`
      : (actividad?.responsableId ?? ""),
  );
  const [mostrarExterno, setMostrarExterno] = useState(false);
  const [nuevoContacto, setNuevoContacto] = useState({
    nombre: "",
    email: "",
    organizacion: "",
  });
  const [creandoContacto, setCreandoContacto] = useState(false);
  const [errorContacto, setErrorContacto] = useState<string | null>(null);
  const [requiereDocumento, setRequiereDocumento] = useState(
    actividad?.requiereDocumento ?? false,
  );
  const [noAplica, setNoAplica] = useState(actividad?.noAplica ?? false);
  const [carpeta, setCarpeta] = useState(actividad?.carpeta ?? "");
  const [requisitoIds, setRequisitoIds] = useState<string[]>(
    actividad?.requisitos.map((requisito) => requisito.id) ?? [],
  );
  const [formatoIds, setFormatoIds] = useState<string[]>(
    actividad?.formatos.map((formato) => formato.id) ?? [],
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opcionesRequisito = actividades
    .filter((otra) => otra.id !== actividad?.id)
    .sort((a, b) => a.etapa - b.etapa || a.orden - b.orden);

  function alternarRequisito(id: string) {
    setRequisitoIds((actual) =>
      actual.includes(id) ? actual.filter((valor) => valor !== id) : [...actual, id],
    );
  }

  function alternarFormato(id: string) {
    setFormatoIds((actual) =>
      actual.includes(id) ? actual.filter((valor) => valor !== id) : [...actual, id],
    );
  }

  async function crearContacto() {
    if (creandoContacto) return;
    if (!nuevoContacto.nombre.trim() || !nuevoContacto.email.trim()) {
      return setErrorContacto("Escribe el nombre y el correo de la persona externa.");
    }
    setCreandoContacto(true);
    setErrorContacto(null);
    try {
      const { contacto } = await api.crearContactoExterno({
        nombre: nuevoContacto.nombre.trim(),
        email: nuevoContacto.email.trim(),
        organizacion: nuevoContacto.organizacion.trim(),
      });
      onContactoCreado(contacto);
      setAsignado(`externo:${contacto.id}`);
      setMostrarExterno(false);
      setNuevoContacto({ nombre: "", email: "", organizacion: "" });
      onShowToast(`Persona externa agregada: ${contacto.email}.`);
    } catch (e) {
      setErrorContacto(e instanceof ApiError ? e.message : "No se pudo crear el contacto.");
    } finally {
      setCreandoContacto(false);
    }
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guardando) return;
    if (!nombre.trim()) return setError("Escribe el nombre de la actividad.");
    if (!faseId) return setError("Selecciona una fase.");

    const externoId = asignado.startsWith("externo:") ? asignado.slice("externo:".length) : null;
    const usuario = usuarios.find((fila) => fila.id === asignado);
    const datos: NuevaEdtActividad = {
      faseId,
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      tipo,
      prioridad: "Alta",
      requiereDocumento,
      noAplica,
      carpeta: carpeta || null,
      responsableId: externoId ? null : asignado || null,
      responsable: externoId ? null : (usuario?.nombre ?? null),
      contactoExternoId: externoId,
      fechaCumplimiento: fecha || null,
      requisitoIds,
      formatoIds,
    };

    setGuardando(true);
    setError(null);
    try {
      if (actividad) {
        await api.actualizarEdtActividad(actividad.id, datos);
      } else {
        await api.crearEdtActividad(proyectoId, { ...datos, estado: "No realizado" });
      }
      onShowToast(actividad ? "Actividad actualizada." : "Actividad creada y asignada al tablero.");
      await onGuardado();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar la actividad.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
      <div className="my-auto w-full max-w-2xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-800">
            {actividad ? "Editar actividad" : "Nueva actividad"}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={enviar} className="max-h-[75vh] space-y-4 overflow-y-auto px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="act-nombre" className="text-xs font-semibold text-slate-700">
                Nombre <span className="text-rose-500">*</span>
              </label>
              <input
                id="act-nombre"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={campoCls}
                placeholder="Ej. Acta de inicio del contrato"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="act-descripcion" className="text-xs font-semibold text-slate-700">
                Descripción
              </label>
              <textarea
                id="act-descripcion"
                rows={2}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className={campoCls}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="act-fase" className="text-xs font-semibold text-slate-700">
                Fase / tablero
              </label>
              <select
                id="act-fase"
                value={faseId}
                onChange={(e) => setFaseId(e.target.value)}
                className={campoCls}
              >
                {fases.map((fase) => (
                  <option key={fase.id} value={fase.id}>
                    {etiquetaFase(fase)} · {fase.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="act-tipo" className="text-xs font-semibold text-slate-700">
                Tipo
              </label>
              <select
                id="act-tipo"
                value={tipo}
                onChange={(e) => {
                  const valor = e.target.value as EdtTipoActividad;
                  setTipo(valor);
                  if (valor !== "Actividad") setRequiereDocumento(true);
                }}
                className={campoCls}
              >
                {TIPOS.map((valor) => (
                  <option key={valor} value={valor}>
                    {valor}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="act-fecha" className="text-xs font-semibold text-slate-700">
                Fecha de entrega
              </label>
              <input
                id="act-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={campoCls}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="act-responsable" className="text-xs font-semibold text-slate-700">
                Responsable
              </label>
              <select
                id="act-responsable"
                value={asignado}
                onChange={(e) => setAsignado(e.target.value)}
                className={campoCls}
              >
                <option value="">Sin asignar</option>
                <optgroup label="Equipo">
                  {usuarios.map((fila) => (
                    <option key={fila.id} value={fila.id}>
                      {fila.nombre}
                    </option>
                  ))}
                </optgroup>
                {contactos.length > 0 && (
                  <optgroup label="Personas externas">
                    {contactos.map((contacto) => (
                      <option key={contacto.id} value={`externo:${contacto.id}`}>
                        {contacto.nombre} · {contacto.email}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button
                type="button"
                onClick={() => setMostrarExterno((valor) => !valor)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C2410C] hover:underline"
              >
                <UserPlus className="h-3 w-3" />
                {mostrarExterno ? "Ocultar" : "Agregar persona externa"}
              </button>
              {mostrarExterno && (
                <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/50 p-2">
                  <input
                    value={nuevoContacto.nombre}
                    onChange={(e) =>
                      setNuevoContacto((actual) => ({ ...actual, nombre: e.target.value }))
                    }
                    placeholder="Nombre"
                    aria-label="Nombre de la persona externa"
                    className={campoCls}
                  />
                  <input
                    type="email"
                    value={nuevoContacto.email}
                    onChange={(e) =>
                      setNuevoContacto((actual) => ({ ...actual, email: e.target.value }))
                    }
                    placeholder="correo@entidad.gov.co"
                    aria-label="Correo de la persona externa"
                    className={campoCls}
                  />
                  <input
                    value={nuevoContacto.organizacion}
                    onChange={(e) =>
                      setNuevoContacto((actual) => ({ ...actual, organizacion: e.target.value }))
                    }
                    placeholder="Entidad u organización (opcional)"
                    aria-label="Organización de la persona externa"
                    className={campoCls}
                  />
                  {errorContacto && (
                    <p className="text-[11px] font-medium text-rose-600">{errorContacto}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => void crearContacto()}
                    disabled={creandoContacto}
                    className="rounded-md bg-violet-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
                  >
                    {creandoContacto ? "Guardando…" : "Guardar persona externa"}
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="act-carpeta" className="text-xs font-semibold text-slate-700">
                Carpeta guía
              </label>
              <select
                id="act-carpeta"
                value={carpeta}
                onChange={(e) => setCarpeta(e.target.value)}
                className={campoCls}
              >
                <option value="">Sin carpeta sugerida</option>
                {carpetas.map((ruta) => (
                  <option key={ruta} value={ruta}>
                    {ruta}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 sm:col-span-2">
              <input
                type="checkbox"
                checked={requiereDocumento}
                onChange={(e) => setRequiereDocumento(e.target.checked)}
                className="h-4 w-4 accent-[#C2410C]"
              />
              <span className="text-xs font-semibold text-slate-700">
                Exige un documento cargado para completarse
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 sm:col-span-2">
              <input
                type="checkbox"
                checked={noAplica}
                onChange={(e) => setNoAplica(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#C2410C]"
              />
              <span className="text-xs font-semibold text-slate-700">
                No aplica a este proyecto
                <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                  Sale del avance y del checklist documental; no exige documento ni puede completarse.
                </span>
              </span>
            </label>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-700">Requisitos previos</p>
            <p className="text-[11px] text-slate-400">
              La actividad no podrá completarse hasta que estos requisitos estén completos y, si son
              documentos, tengan archivo cargado.
            </p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60 p-2">
              {opcionesRequisito.length === 0 ? (
                <p className="px-2 py-3 text-center text-[11px] text-slate-400">
                  No hay otras actividades para vincular.
                </p>
              ) : (
                opcionesRequisito.map((otra) => {
                  const fase = fases.find((fila) => fila.id === otra.faseId);
                  return (
                    <label
                      key={otra.id}
                      className="flex items-start gap-2 rounded px-1.5 py-1 text-[11px] text-slate-600 hover:bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={requisitoIds.includes(otra.id)}
                        onChange={() => alternarRequisito(otra.id)}
                        className="mt-0.5 h-3.5 w-3.5 accent-[#C2410C]"
                      />
                      <span>
                        <span className="font-medium text-slate-700">{otra.nombre}</span>
                        <span className="ml-1 text-slate-400">
                          {fase ? `· ${etiquetaFase(fase)}` : ""} · {otra.tipo}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-700">Formatos del módulo Formatos</p>
            <p className="text-[11px] text-slate-400">
              Marca los formatos que esta actividad debe diligenciar o entregar. Se crean y editan
              en el módulo Formatos.
            </p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60 p-2">
              {formatos.length === 0 ? (
                <p className="px-2 py-3 text-center text-[11px] text-slate-400">
                  No hay formatos activos. Créalos en el módulo Formatos para asignarlos aquí.
                </p>
              ) : (
                formatos.map((formato) => (
                  <label
                    key={formato.id}
                    title={formato.descripcion ?? formato.nombre}
                    className="flex items-start gap-2 rounded px-1.5 py-1 text-[11px] text-slate-600 hover:bg-white"
                  >
                    <input
                      type="checkbox"
                      checked={formatoIds.includes(formato.id)}
                      onChange={() => alternarFormato(formato.id)}
                      className="mt-0.5 h-3.5 w-3.5 accent-[#C2410C]"
                    />
                    <span>
                      <span className="font-medium text-slate-700">{formato.nombre}</span>
                      {formato.totalRegistros > 0 && (
                        <span className="ml-1 text-slate-400">
                          · {formato.totalRegistros} registro(s)
                        </span>
                      )}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
            >
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse justify-end gap-2 pt-1 sm:flex-row">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {guardando ? "Guardando…" : actividad ? "Guardar cambios" : "Crear actividad"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalFase({
  proyectoId,
  fase,
  fases,
  onCerrar,
  onGuardado,
  onShowToast,
}: {
  proyectoId: string;
  fase: EdtFaseApi | null;
  fases: EdtFaseApi[];
  onCerrar: () => void;
  onGuardado: () => Promise<void>;
  onShowToast: (mensaje: string) => void;
}) {
  const [nombre, setNombre] = useState(fase?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(fase?.descripcion ?? "");
  const [dependeDeFaseId, setDependeDeFaseId] = useState(
    fase?.dependeDeFaseId ?? fases[fases.length - 1]?.id ?? "",
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guardando) return;
    if (!nombre.trim()) return setError("Escribe el nombre de la fase.");

    setGuardando(true);
    setError(null);
    try {
      if (fase) {
        await api.actualizarFaseEdt(fase.id, {
          nombre: nombre.trim(),
          descripcion: descripcion.trim(),
          dependeDeFaseId: dependeDeFaseId || null,
        });
      } else {
        await api.crearFaseEdt(proyectoId, {
          nombre: nombre.trim(),
          descripcion: descripcion.trim(),
          dependeDeFaseId: dependeDeFaseId || null,
        });
      }
      onShowToast(fase ? "Fase actualizada." : "Fase creada con su tablero.");
      await onGuardado();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar la fase.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
      <div className="my-auto w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-800">
            {fase ? "Editar fase" : "Nueva fase"}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={enviar} className="space-y-4 px-5 py-5">
          <div className="space-y-1.5">
            <label htmlFor="fase-nombre" className="text-xs font-semibold text-slate-700">
              Nombre <span className="text-rose-500">*</span>
            </label>
            <input
              id="fase-nombre"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={campoCls}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="fase-descripcion" className="text-xs font-semibold text-slate-700">
              Descripción
            </label>
            <textarea
              id="fase-descripcion"
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className={campoCls}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="fase-anterior" className="text-xs font-semibold text-slate-700">
              Se conecta después de
            </label>
            <select
              id="fase-anterior"
              value={dependeDeFaseId}
              onChange={(e) => setDependeDeFaseId(e.target.value)}
              className={campoCls}
            >
              <option value="">Sin fase anterior</option>
              {fases
                .filter((otra) => otra.id !== fase?.id)
                .map((otra) => (
                  <option key={otra.id} value={otra.id}>
                    {etiquetaFase(otra)} · {otra.nombre}
                  </option>
                ))}
            </select>
            <p className="text-[11px] text-slate-400">
              Las fases adicionales heredan el orden y se muestran como un tablero conectado al
              flujo principal.
            </p>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {guardando ? "Guardando…" : fase ? "Guardar cambios" : "Crear fase"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
