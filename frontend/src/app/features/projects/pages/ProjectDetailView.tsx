import { useCallback, useEffect, useState } from "react";
import {
  FileText, FolderOpen, Activity, ChevronRight,
  Download, Eye, Edit2, ArrowLeft, X, Upload,
  Clock, Sliders, Archive, FileUp, ListChecks
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line
} from "recharts";
import type { AuditEntry, Desembolso, Document, GanttActivity, Project } from "../../../types";
import {
  api, mapActividad, mapAuditoria, mapDesembolso, mapDocumento, mapProyecto,
  type CurvaSApi, type EstructuraApi, type ResumenZipApi,
} from "../../../api/client";
import { CargandoModule, ErrorModule } from "../../../components/DataState";
import { SubirDocumentoModal } from "../../documentos/SubirDocumentoModal";
import { ActualizarDocumentoModal } from "../../documentos/ActualizarDocumentoModal";
import { ChecklistDocumentalModal } from "../ChecklistDocumentalModal";
import { EdtTab } from "../EdtTab";
import { GanttTab } from "../GanttTab";
import { PresupuestoTab } from "../PresupuestoTab";
import { InformesView } from "../../informes/InformesView";
import { ACT_STATUS_CFG, GANTT_MONTHS, PROJ_TABS } from "../../../constants";
import { fmt } from "../../../lib/format";
import { chartColor } from "../../../lib/chartColors";
import { StatusBadge, Bar2, Crumb } from "../../../components/shared";

export function ProjectDetailView({ projectId, initialTab = "resumen", onBack, onEdit, onShowToast }: {
  projectId: string; initialTab?: string; onBack: () => void; onEdit: () => void;
  onShowToast: (msg: string) => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const [docCat, setDocCat] = useState("Todos");
  const [docFolder, setDocFolder] = useState("Todas");
  const [seguimientoAvance, setSeguimientoAvance] = useState(0);
  const [guardandoAvance, setGuardandoAvance] = useState(false);
  const [mostrarSubida, setMostrarSubida] = useState(false);
  const [mostrarChecklist, setMostrarChecklist] = useState(false);
  const [docEditando, setDocEditando] = useState<Document | null>(null);
  const [mostrarZip, setMostrarZip] = useState(false);
  const [zipArchivo, setZipArchivo] = useState<File | null>(null);
  const [zipEnviando, setZipEnviando] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [zipResumen, setZipResumen] = useState<ResumenZipApi | null>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [estructura, setEstructura] = useState<EstructuraApi | null>(null);
  const [projDocs, setProjDocs] = useState<Document[]>([]);
  const [desembolsos, setDesembolsos] = useState<Desembolso[]>([]);
  const [auditoria, setAuditoria] = useState<AuditEntry[]>([]);
  const [ganttActivities, setGanttActivities] = useState<GanttActivity[]>([]);
  const [curvaS, setCurvaS] = useState<CurvaSApi | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [detalle, auditoriaRes, curvaRes] = await Promise.all([
        api.proyecto(projectId),
        api.auditoria(projectId),
        api.curvaS(projectId).catch(() => null),
      ]);
      const proyecto = mapProyecto(detalle.proyecto);
      setProject(proyecto);
      let estructuraDetalle: EstructuraApi | null = null;
      if (detalle.proyecto.estructura) {
        estructuraDetalle = (
          await api.estructura(detalle.proyecto.estructura).catch(() => ({ estructura: null }))
        ).estructura;
      }
      setEstructura(estructuraDetalle);
      setSeguimientoAvance(proyecto.progress);
      setProjDocs(detalle.documentos.map(mapDocumento));
      setDesembolsos(detalle.desembolsos.map(mapDesembolso));
      setGanttActivities(detalle.actividades.map(mapActividad));
      setCurvaS(curvaRes);
      setAuditoria(auditoriaRes.auditoria.map(mapAuditoria));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el proyecto.");
    } finally {
      setCargando(false);
    }
  }, [projectId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const recargarResumen = useCallback(async () => {
    const [detalle, curvaRes] = await Promise.all([
      api.proyecto(projectId),
      api.curvaS(projectId).catch(() => null),
    ]);
    setProject(mapProyecto(detalle.proyecto));
    setProjDocs(detalle.documentos.map(mapDocumento));
    setDesembolsos(detalle.desembolsos.map(mapDesembolso));
    setGanttActivities(detalle.actividades.map(mapActividad));
    setCurvaS(curvaRes);
  }, [projectId]);

  const recargarDocs = recargarResumen;

  const guardarAvance = async () => {
    if (!project || guardandoAvance) return;
    setGuardandoAvance(true);
    try {
      const { proyecto } = await api.actualizarProyecto(projectId, { avance: seguimientoAvance });
      setProject(mapProyecto(proyecto));
      setCurvaS(await api.curvaS(projectId).catch(() => null));
      onShowToast("Avance técnico actualizado.");
    } catch (e) {
      onShowToast(e instanceof Error ? e.message : "No se pudo actualizar el avance.");
    } finally {
      setGuardandoAvance(false);
    }
  };

  const importarZip = async () => {
    if (!zipArchivo) {
      setZipError("Selecciona el archivo ZIP.");
      return;
    }

    setZipEnviando(true);
    setZipError(null);
    setZipResumen(null);

    try {
      const resumen = await api.importarDocumentosZip(zipArchivo, projectId);
      setZipResumen(resumen);
      await recargarDocs();
      onShowToast(
        `Paquete aplicado: ${resumen.actualizados} reemplazado(s) y ${resumen.creados} nuevo(s).`,
      );
    } catch (e) {
      setZipError(e instanceof Error ? e.message : "No se pudo actualizar desde el ZIP.");
    } finally {
      setZipEnviando(false);
    }
  };

  if (cargando) return <CargandoModule mensaje="Cargando detalle del proyecto…" />;
  if (error) return <ErrorModule mensaje={error} onRetry={() => void cargar()} />;
  if (!project) return <ErrorModule mensaje="Proyecto no encontrado." />;

  const docCategories = ["Todos", "Actas", "Informes", "Antecedentes", "Evidencias", "Documentación técnica", "Comunicaciones", "Otros"];
  const carpetas = estructura?.carpetas ?? [];
  const carpetasConDocumentos = carpetas.filter((carpeta) =>
    projDocs.some((doc) => doc.folder === carpeta || doc.folder?.startsWith(`${carpeta}/`)),
  ).length;
  const filteredDocs = projDocs.filter((doc) => {
    const coincideTipo = docCat === "Todos" || doc.type === docCat;
    const coincideCarpeta = docFolder === "Todas" || (doc.folder ?? "").startsWith(docFolder);
    return coincideTipo && coincideCarpeta;
  });

  const actividadesCompletadas = ganttActivities.filter(a => a.status === "Completada").length;
  const avanceActividades = ganttActivities.length > 0
    ? Math.round((actividadesCompletadas / ganttActivities.length) * 100)
    : 0;
  const entregablesAprobados = projDocs.filter(d => d.status === "Aprobado").length;
  const avanceEntregables = projDocs.length > 0
    ? Math.round((entregablesAprobados / projDocs.length) * 100)
    : 0;
  const anioProyecto = Number(project.startIso.slice(0, 4)) || new Date().getFullYear();
  const conSigno = (valor: number) => `${valor > 0 ? "+" : ""}${valor}`;
  const etiquetaCurva = (fecha: string) => {
    const [anio, mes] = fecha.split("-");
    return (GANTT_MONTHS[Number(mes) - 1] ?? mes).slice(0, 3) + " " + (anio ?? "").slice(2);
  };
  const puntosCurva = curvaS?.puntos ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="mt-1.5 p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <Crumb items={[{ label: "Área proyectos", onClick: onBack }, { label: project.id }, { label: "Detalle" }]} />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-sm font-black text-orange-700">{project.id}</span>
                <StatusBadge status={project.status} />
                <span className={`border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] ${
                  project.tipoContrato === "Obra"
                    ? "border-[#F39200]/40 bg-[#F39200]/10 text-[#9A3412]"
                    : "border-slate-300 bg-slate-100 text-slate-600"
                }`}>
                  {project.tipoContrato}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400">
                  Avance <strong className="sei-figure ml-1 font-semibold text-[#1B1B1B]">{project.progress}%</strong>
                </span>
              </div>
              <h1 className="text-lg font-bold text-gray-900 mt-1 leading-tight">{project.name}</h1>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => setTab("informes")} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#F39200] text-[#1B1B1B] rounded-lg hover:bg-[#FFAA2B] transition-colors">
                <FileText className="w-3.5 h-3.5" /> Informes
              </button>
              <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors bg-white">
                <Edit2 className="w-3.5 h-3.5" /> Editar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="scrollbar-hide overflow-x-auto border-b border-slate-200/80">
          <div className="flex min-w-max">
            {PROJ_TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`whitespace-nowrap border-b-2 px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.12em] transition-colors ${tab === t.id ? "border-[#F39200] text-[#1B1B1B]" : "border-transparent text-slate-400 hover:border-slate-300 hover:text-slate-700"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">

          {/* ── RESUMEN ── */}
          {tab === "resumen" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Avance técnico", value: `${project.progress}%`, color: "bg-[#F39200]", bg: "bg-orange-50", tc: "text-[#9A3412]" },
                  { label: "Ejec. presupuestal", value: `${project.budgetExecuted}%`, color: "bg-emerald-500", bg: "bg-emerald-50", tc: "text-emerald-800" },
                  { label: "Inicio", value: project.startDate, color: "", bg: "bg-gray-50", tc: "text-gray-800" },
                  { label: "Finalización", value: project.endDate, color: "", bg: "bg-gray-50", tc: "text-gray-800" },
                ].map(k => (
                  <div key={k.label} className="relative overflow-hidden rounded-lg border border-slate-200/80 bg-white p-3">
                    <span className="absolute left-0 top-0 h-5 w-[3px] bg-[#F39200]" />
                    <p className="sei-label text-slate-400">{k.label}</p>
                    <p className={`sei-figure mt-1 text-xl font-semibold ${k.tc}`}>{k.value}</p>
                    {k.color && <div className="mt-2"><Bar2 value={parseInt(k.value)} color={k.color} h="h-1.5" /></div>}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <h3 className="mb-3 border-b border-slate-200 pb-2 text-[13px] font-semibold text-[#1B1B1B]">Información del proyecto</h3>
                  <div className="space-y-0 rounded-lg border border-slate-200/80 overflow-hidden divide-y divide-gray-50">
                    {([
                      { label: "Nombre corto", value: project.nombreCorto || "—", fila: "bg-orange-50/60", valor: "text-[#C2410C] font-extrabold text-base" },
                      { label: "N.º de contrato", value: project.numeroContrato || "—", fila: "bg-indigo-50/60", valor: "font-mono text-indigo-700 font-bold" },
                      { label: "Entidad contratante", value: project.entidadContratante || "—" },
                      { label: "Entidad contratista", value: project.entidadContratista || "—" },
                      { label: "Organizadores", value: project.organizadores || "—" },
                      { label: "Responsable", value: project.responsible },
                      { label: "Línea / área", value: project.line, fila: "bg-sky-50/60", valor: "text-sky-700 font-bold" },
                      { label: "Tipo de contrato", value: project.tipoContrato },
                      { label: "Área responsable", value: project.dependency },
                      { label: "Fecha de asignación", value: project.fechaAsignacion, fila: "bg-amber-50/60", valor: "text-amber-700 font-bold" },
                      { label: "Valor total", value: fmt(project.budget), fila: "bg-emerald-50/60", valor: "text-emerald-700 font-extrabold text-base" },
                      { label: "Creado por", value: project.creadoPor || "Sin registro" },
                      { label: "Fecha de creación", value: project.creadoEn },
                    ] as Array<{ label: string; value: string; fila?: string; valor?: string }>).map(r => (
                      <div key={r.label} className={`flex gap-3 px-4 py-2.5 ${r.fila ?? ""}`}>
                        <span className="sei-label w-32 flex-shrink-0 text-slate-400">{r.label}</span>
                        <span className={`text-sm text-gray-900 ${r.valor ?? ""}`}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="mb-3 border-b border-slate-200 pb-2 text-[13px] font-semibold text-[#1B1B1B]">Objetivo general</h3>
                  <p className="text-sm text-gray-600 leading-relaxed p-4 bg-gray-50 rounded-lg border border-slate-200/80">{project.objective}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── SEGUIMIENTO ── */}
          {tab === "seguimiento" && (
            <div className="space-y-5">
              <h2 className="text-sm font-bold text-gray-800">Seguimiento del proyecto</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Avance técnico", value: `${project.progress}%`, color: "text-orange-700", bar: project.progress, barColor: "bg-orange-500", hint: curvaS ? `Programado ${curvaS.resumen.avanceProgramadoHoy}%` : `${project.progress}% acumulado` },
                  { label: "Avance presupuestal", value: `${project.budgetExecuted}%`, color: "text-emerald-700", bar: project.budgetExecuted, barColor: "bg-emerald-500", hint: curvaS ? `Programado ${curvaS.resumen.ejecucionProgramadaHoy}%` : `${project.budgetExecuted}% acumulado` },
                  { label: "Actividades", value: `${actividadesCompletadas} / ${ganttActivities.length}`, color: "text-orange-700", bar: avanceActividades, barColor: "bg-amber-500", hint: `${avanceActividades}% completado` },
                  { label: "Entregables", value: String(projDocs.length), color: "text-gray-700", bar: avanceEntregables, barColor: "bg-sky-500", hint: `${entregablesAprobados} aprobado(s)` },
                ].map(k => (
                  <div key={k.label} className="relative overflow-hidden rounded-lg border border-slate-200/80 bg-white p-3">
                    <span className="absolute left-0 top-0 h-5 w-[3px] bg-[#F39200]" />
                    <p className="sei-label text-slate-400">{k.label}</p>
                    <p className={`sei-figure mt-0.5 text-2xl font-semibold ${k.color}`}>{k.value}</p>
                    <div className="mt-2"><Bar2 value={k.bar} color={k.barColor} h="h-1.5" /></div>
                    <p className="mt-1 text-[10px] text-slate-400">{k.hint}</p>
                  </div>
                ))}
              </div>

              {curvaS && (
                <div className="rounded-lg border border-slate-200/80 p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="sei-label text-slate-500">Curva S · avance acumulado</h3>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        Programación {curvaS.fuenteProgramacion === "Gantt"
                          ? "ponderada por la duración de las actividades del Gantt"
                          : "lineal entre las fechas del contrato"}
                        {" · "}cortes reales desde {etiquetaCurva(curvaS.proyecto.fechaInicio)}.
                      </p>
                    </div>
                    <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${
                      curvaS.resumen.diasEquivalentes >= 0
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-red-200 bg-red-50 text-red-700"
                    }`}>
                      {curvaS.resumen.diasEquivalentes >= 0 ? "Adelantado" : "Atrasado"} {Math.abs(curvaS.resumen.diasEquivalentes)} días
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-semibold text-gray-700">
                        Avance técnico
                        <span className="ml-2 font-normal text-slate-400">
                          Prog. {curvaS.resumen.avanceProgramadoHoy}% · Real {curvaS.resumen.avanceRealHoy}% ·{" "}
                          <span className={curvaS.resumen.desviacionAvance >= 0 ? "text-emerald-600" : "text-red-600"}>
                            {conSigno(curvaS.resumen.desviacionAvance)} pp
                          </span>
                        </span>
                      </p>
                      <ResponsiveContainer width="100%" height={190}>
                        <LineChart data={puntosCurva} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
                          <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis key="xaxis" dataKey="fecha" tick={{ fontSize: 10 }} tickFormatter={etiquetaCurva} interval="preserveStartEnd" minTickGap={18} />
                          <YAxis key="yaxis" tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                          <Tooltip key="tooltip" labelFormatter={etiquetaCurva} formatter={(v: number, nombre: string) => [v == null ? "—" : `${v}%`, nombre]} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                          <Legend key="legend" iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
                          <Line key="programado" type="monotone" dataKey="avanceProgramado" name="Programado" stroke={chartColor(0)} strokeDasharray="6 4" strokeWidth={2} dot={false} />
                          <Line key="real" type="monotone" dataKey="avanceReal" name="Real" stroke={chartColor(1)} strokeWidth={2.5} dot={puntosCurva.length <= 14 ? { r: 2.5 } : false} connectNulls={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-gray-700">
                        Ejecución presupuestal
                        <span className="ml-2 font-normal text-slate-400">
                          Prog. {curvaS.resumen.ejecucionProgramadaHoy}% · Real {curvaS.resumen.ejecucionRealHoy}% ·{" "}
                          <span className={curvaS.resumen.desviacionEjecucion >= 0 ? "text-emerald-600" : "text-red-600"}>
                            {conSigno(curvaS.resumen.desviacionEjecucion)} pp
                          </span>
                        </span>
                      </p>
                      <ResponsiveContainer width="100%" height={190}>
                        <LineChart data={puntosCurva} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
                          <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis key="xaxis" dataKey="fecha" tick={{ fontSize: 10 }} tickFormatter={etiquetaCurva} interval="preserveStartEnd" minTickGap={18} />
                          <YAxis key="yaxis" tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                          <Tooltip key="tooltip" labelFormatter={etiquetaCurva} formatter={(v: number, nombre: string) => [v == null ? "—" : `${v}%`, nombre]} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                          <Legend key="legend" iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
                          <Line key="programado" type="monotone" dataKey="ejecucionProgramada" name="Programado" stroke={chartColor(2)} strokeDasharray="6 4" strokeWidth={2} dot={false} />
                          <Line key="real" type="monotone" dataKey="ejecucionReal" name="Real" stroke={chartColor(3)} strokeWidth={2.5} dot={puntosCurva.length <= 14 ? { r: 2.5 } : false} connectNulls={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-slate-200/80 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-gray-800">
                    {project.progressSource === "Manual" ? "Actualizar avance técnico" : "Avance técnico"}
                  </h3>
                  <span className="border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">
                    {project.progressSource === "EDT"
                      ? "Automático desde EDT"
                      : project.progressSource === "Gantt"
                        ? "Automático desde Gantt"
                        : "Manual"}
                  </span>
                </div>
                {project.progressSource === "Manual" ? (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-700">Porcentaje de avance</span>
                        <span className="text-lg font-black text-orange-700">{seguimientoAvance}%</span>
                      </div>
                      <input type="range" min={0} max={100} value={seguimientoAvance} onChange={e => setSeguimientoAvance(+e.target.value)}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600" />
                      <div className="mt-2"><Bar2 value={seguimientoAvance} color="bg-orange-500" h="h-2" /></div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button onClick={() => void guardarAvance()} disabled={guardandoAvance || seguimientoAvance === project.progress}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#C2410C] text-white rounded-lg hover:bg-[#9A3412] transition-colors disabled:cursor-not-allowed disabled:opacity-50">
                        <Sliders className="w-3.5 h-3.5" />{guardandoAvance ? "Guardando…" : "Actualizar avance"}
                      </button>
                      <span className="text-xs text-gray-400">Se guarda en el proyecto y alimenta el dashboard.</span>
                    </div>
                  </>
                ) : (
                  <div>
                    <div className="flex items-end justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-700">Porcentaje de avance</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {project.progressSource === "EDT" ? "Calculado desde el EDT" : "Calculado desde el cronograma Gantt"}
                          {" · "}se actualiza al cambiar el estado de las actividades.
                        </p>
                      </div>
                      <span className="sei-figure flex-shrink-0 text-3xl font-semibold text-orange-700">{project.progress}%</span>
                    </div>
                    <div className="mt-3"><Bar2 value={project.progress} color="bg-orange-500" h="h-2.5" /></div>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-200/80 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/40">
                  <h3 className="text-sm font-bold text-gray-800">Actividades del cronograma</h3>
                  <button onClick={() => setTab("gantt")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors">
                    Gestionar en Gantt
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="bg-gray-50/60 border-b border-gray-100">
                        {["Actividad", "Responsable", "Inicio", "Fin", "Avance", "Estado"].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 sei-label text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {ganttActivities.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">
                            Sin actividades en el cronograma. Agrégalas desde la pestaña Gantt.
                          </td>
                        </tr>
                      )}
                      {ganttActivities.map(a => (
                        <tr key={a.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-2.5 font-semibold text-gray-800 text-sm">{a.name}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{a.responsible || "Sin asignar"}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">{GANTT_MONTHS[a.startMonth - 1]} {anioProyecto}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">{GANTT_MONTHS[a.endMonth - 1]} {anioProyecto}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2 min-w-[80px]">
                              <Bar2 value={a.progress} color="bg-orange-500" h="h-1.5" />
                              <span className="text-xs font-bold text-gray-700 flex-shrink-0">{a.progress}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ACT_STATUS_CFG[a.status].bg} ${ACT_STATUS_CFG[a.status].text}`}>
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── EDT ── */}
          {tab === "edt" && (
            <EdtTab
              proyectoId={projectId}
              onShowToast={onShowToast}
              onChanged={() => void recargarResumen()}
            />
          )}

          {/* ── GANTT ── */}
          {tab === "gantt" && (
            <GanttTab
              proyectoId={projectId}
              anio={anioProyecto}
              onChanged={() => void recargarResumen()}
              onShowToast={onShowToast}
            />
          )}

          {/* ── PRESUPUESTO ── */}
          {tab === "presupuesto" && (
            <PresupuestoTab
              proyecto={project}
              desembolsos={desembolsos}
              onRefresh={() => void recargarResumen()}
              onShowToast={onShowToast}
            />
          )}

          {/* ── INDICADORES ── */}
          {/* ── DOCUMENTOS ── */}
          {tab === "documentos" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-gray-800">Repositorio documental</h2>
                  {estructura && (
                    <p className="text-[11px] text-gray-400">Plantilla: {estructura.nombre}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { window.location.href = api.documentosZipUrl(projectId); }}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <Archive className="w-3.5 h-3.5" /> Descargar ZIP
                  </button>
                  <button
                    onClick={() => {
                      setZipArchivo(null);
                      setZipError(null);
                      setZipResumen(null);
                      setMostrarZip(true);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50/50 px-3 py-1.5 text-xs font-semibold text-orange-700 transition-colors hover:bg-orange-50"
                  >
                    <FileUp className="w-3.5 h-3.5" /> Actualizar desde ZIP
                  </button>
                  <button
                    onClick={() => setMostrarChecklist(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <ListChecks className="w-3.5 h-3.5" /> Checklist documental
                  </button>
                  <button
                    onClick={() => setMostrarSubida(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#C2410C] text-white rounded-lg hover:bg-[#9A3412] transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" /> Cargar documento
                  </button>
                </div>
              </div>
              {estructura && (
                <div className="flex flex-col gap-2 rounded-xl border border-orange-100 bg-orange-50/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">Checklist documental</h3>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      {carpetasConDocumentos} de {carpetas.length} carpetas con documentos · {projDocs.length} documento(s) cargado(s).
                      Se actualiza con las actividades completadas del EDT.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMostrarChecklist(true)}
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-[#C2410C] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#9A3412]"
                  >
                    <ListChecks className="h-3.5 w-3.5" /> Abrir checklist ({carpetasConDocumentos}/{carpetas.length})
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {docCategories.map(cat => (
                  <button key={cat} onClick={() => setDocCat(cat)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${docCat === cat ? "bg-[#C2410C] text-white border-[#C2410C]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"}`}>
                    {cat}
                  </button>
                ))}
                {carpetas.length > 0 && (
                  <select
                    value={docFolder}
                    onChange={(e) => setDocFolder(e.target.value)}
                    aria-label="Filtrar documentos por carpeta"
                    className="ml-auto rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 focus:border-[#F39200] focus:outline-none"
                  >
                    <option value="Todas">Todas las carpetas</option>
                    {carpetas.map((carpeta) => (
                      <option key={carpeta} value={carpeta}>{carpeta}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="rounded-lg border border-slate-200/80 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-sm">
                  <thead>
                    <tr className="bg-gray-50/60 border-b border-gray-100">
                      {["Nombre", "N.º documento", "Tipo", "Versión", "Fecha documento", "Fecha subida", "Usuario", "Estado", "Acciones"].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 sei-label text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredDocs.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-xs text-gray-400">
                          {projDocs.length === 0
                            ? "Este proyecto aún no tiene documentos. Carga el primero o actualiza desde un ZIP."
                            : "No hay documentos que coincidan con el tipo y la carpeta seleccionados."}
                        </td>
                      </tr>
                    )}
                    {filteredDocs.map(doc => (
                      <tr key={doc.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                            <span className="text-sm font-semibold text-gray-800">{doc.name}</span>
                          </div>
                          {doc.folder && (
                            <p className="mt-0.5 pl-[22px] text-[10px] text-gray-400">{doc.folder}</p>
                          )}
                          {doc.edtActividadId && (
                            <button
                              type="button"
                              onClick={() => setTab("edt")}
                              className="ml-[22px] mt-1 inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-700 transition hover:bg-sky-100"
                            >
                              Vinculado al EDT
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{doc.documentNumber ?? "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{doc.type}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{doc.version}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{doc.documentDate}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{doc.date}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{doc.user}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${doc.status === "Aprobado" ? "bg-green-50 text-green-700" : doc.status === "En revisión" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              disabled={!doc.fileName}
                              onClick={() => window.open(api.documentoArchivoUrl(doc.id), "_blank", "noopener,noreferrer")}
                              title="Ver"
                              className="p-1 text-gray-300 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={!doc.fileName}
                              onClick={() => { window.location.href = api.documentoArchivoUrl(doc.id, true); }}
                              title="Descargar"
                              className="p-1 text-gray-300 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => setDocEditando(doc)} className="p-1 text-gray-300 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Nueva versión"><Clock className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}

          {/* ── ANTECEDENTES ── */}
          {tab === "antecedentes" && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-gray-800">Antecedentes asociados</h2>
              <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-xs text-gray-400">
                Este proyecto no tiene antecedentes asociados. Los antecedentes se relacionan desde el
                módulo Antecedentes y no duplican los documentos.
              </p>
            </div>
          )}

          {/* ── INFORMES ── */}
          {tab === "informes" && <InformesView proyectoId={projectId} />}

          {/* ── AUDITORÍA ── */}
          {tab === "auditoria" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800">Auditoría del proyecto</h2>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                  <Download className="w-3.5 h-3.5" />Exportar
                </button>
              </div>
              <div className="space-y-2">
                {auditoria.map((entry, i) => (
                  <div key={i} className="rounded-lg border border-slate-200/80 p-4 hover:border-gray-200 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono text-xs font-semibold text-gray-500">{entry.date}</span>
                          <span className="text-xs font-bold text-gray-800">{entry.user}</span>
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${entry.action === "Creación" ? "bg-green-50 text-green-700" : entry.action === "Carga documento" ? "bg-orange-50 text-orange-700" : "bg-amber-50 text-amber-700"}`}>
                            {entry.action}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-xs">
                          <span className="text-gray-400">Entidad:</span>
                          <span className="font-semibold text-gray-700">{entry.entity}</span>
                          <span className="text-gray-300">·</span>
                          <span className="font-mono font-bold text-orange-700">{entry.record}</span>
                        </div>
                        {entry.prevValue !== "—" && (
                          <div className="flex items-center gap-2 mt-1.5 text-xs flex-wrap">
                            <span className="text-red-400 line-through">{entry.prevValue}</span>
                            <ChevronRight className="w-3 h-3 text-gray-400" />
                            <span className="text-green-700 font-semibold">{entry.newValue}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      <SubirDocumentoModal
        abierto={mostrarSubida}
        proyectoId={projectId}
        onCerrar={() => setMostrarSubida(false)}
        onSubido={() => void recargarDocs()}
      />

      <ChecklistDocumentalModal
        abierto={mostrarChecklist}
        proyectoId={projectId}
        onCerrar={() => setMostrarChecklist(false)}
        onActualizado={() => void recargarDocs()}
        onShowToast={onShowToast}
      />

      <ActualizarDocumentoModal
        abierto={Boolean(docEditando)}
        documento={docEditando}
        onCerrar={() => setDocEditando(null)}
        onActualizado={() => void recargarDocs()}
      />

      {mostrarZip && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-2xl bg-white shadow-xl sm:rounded-lg">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-bold text-gray-900">Actualizar documentos desde ZIP</h2>
              <button
                type="button"
                onClick={() => setMostrarZip(false)}
                aria-label="Cerrar"
                className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <p className="rounded-lg border border-orange-100 bg-orange-50/60 px-3 py-2.5 text-xs leading-relaxed text-orange-900">
                Se reemplaza el contenido de los documentos cuyo nombre de archivo coincide con el
                ZIP y se conservan los demás. Los archivos nuevos se agregan al proyecto{" "}
                <strong className="font-mono">{projectId}</strong>. Puedes usar el ZIP descargado
                desde aquí como plantilla.
              </p>

              <div className="space-y-1.5">
                <label htmlFor="zip-proyecto" className="text-xs font-semibold text-slate-700">
                  Archivo ZIP
                </label>
                <input
                  id="zip-proyecto"
                  type="file"
                  accept=".zip,application/zip"
                  disabled={zipEnviando}
                  onChange={(e) => {
                    setZipArchivo(e.target.files?.[0] ?? null);
                    setZipError(null);
                    setZipResumen(null);
                  }}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#C2410C] hover:file:bg-orange-100"
                />
                <p className="text-[11px] text-slate-400">
                  Máximo 100 MB · hasta 200 archivos · PDF, Word, Excel, PowerPoint, imágenes o TXT de
                  hasta 20 MB cada uno
                </p>
              </div>

              {zipError && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {zipError}
                </p>
              )}

              {zipResumen && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-xs text-green-800">
                  <p className="font-semibold">
                    Paquete aplicado: {zipResumen.actualizados} reemplazado(s) ·{" "}
                    {zipResumen.creados} nuevo(s)
                    {zipResumen.sinCambios > 0 ? ` · ${zipResumen.sinCambios} sin cambios` : ""}
                    {zipResumen.omitidos > 0 ? ` · ${zipResumen.omitidos} omitido(s)` : ""}.
                  </p>
                  {zipResumen.advertencias.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-green-700">
                      {zipResumen.advertencias.map((item) => (
                        <li key={item.archivo}>
                          <span className="font-mono">{item.archivo}</span>: {item.motivo}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setMostrarZip(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
                >
                  {zipResumen ? "Cerrar" : "Cancelar"}
                </button>
                <button
                  type="button"
                  onClick={() => void importarZip()}
                  disabled={zipEnviando || !zipArchivo}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FileUp className="h-4 w-4" />
                  {zipEnviando ? "Actualizando…" : "Actualizar documentos"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
