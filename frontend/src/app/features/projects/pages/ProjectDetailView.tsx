import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard, Briefcase, BookOpen, FileText, FolderOpen,
  Activity, ChevronRight, ChevronDown, ChevronUp,
  Plus, Search, Download, Eye, Edit2, Bell, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, DollarSign, ArrowLeft, X, Upload,
  Link2, MoreHorizontal, ChevronLeft, Filter, Tag, Paperclip,
  Clock, BarChart2, Percent, Check, Trash2, Save, FileDown, Sliders,
  Archive, FileUp
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import type { AuditEntry, Document, GanttActivity, Indicator, Project, Report } from "../../../types";
import {
  api, mapActividad, mapAuditoria, mapDocumento, mapIndicador, mapInforme, mapProyecto,
  type ResumenZipApi,
} from "../../../api/client";
import { CargandoModule, ErrorModule } from "../../../components/DataState";
import { SubirDocumentoModal } from "../../documentos/SubirDocumentoModal";
import { ActualizarDocumentoModal } from "../../documentos/ActualizarDocumentoModal";
import { IND_CFG, ACT_STATUS_CFG, GANTT_MONTHS, PROJ_TABS } from "../../../constants";
import { fmt } from "../../../lib/format";
import { StatusBadge, IndBadge, Bar2, Crumb } from "../../../components/shared";

export function ProjectDetailView({ projectId, onBack, onGenerateReport, onShowToast }: {
  projectId: string; onBack: () => void; onGenerateReport: () => void; onShowToast: (msg: string) => void;
}) {
  const [tab, setTab] = useState("resumen");
  const [expanded, setExpanded] = useState<string[]>(["Información general"]);
  const [presupuestoTab, setPresupuestoTab] = useState("ingresos");
  const [docCat, setDocCat] = useState("Todos");
  const [seguimientoAvance, setSeguimientoAvance] = useState(0);
  const [seguimientoDesc, setSeguimientoDesc] = useState("");
  const [showActModal, setShowActModal] = useState(false);
  const [mostrarSubida, setMostrarSubida] = useState(false);
  const [docEditando, setDocEditando] = useState<Document | null>(null);
  const [mostrarZip, setMostrarZip] = useState(false);
  const [zipArchivo, setZipArchivo] = useState<File | null>(null);
  const [zipEnviando, setZipEnviando] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [zipResumen, setZipResumen] = useState<ResumenZipApi | null>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [estructuraNombre, setEstructuraNombre] = useState<string | null>(null);
  const [projIndicators, setProjIndicators] = useState<Indicator[]>([]);
  const [projDocs, setProjDocs] = useState<Document[]>([]);
  const [informes, setInformes] = useState<Report[]>([]);
  const [auditoria, setAuditoria] = useState<AuditEntry[]>([]);
  const [ganttActivities, setGanttActivities] = useState<GanttActivity[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [detalle, informesRes, auditoriaRes, estructurasRes] = await Promise.all([
        api.proyecto(projectId),
        api.informes(),
        api.auditoria(projectId),
        api.estructuras().catch(() => ({ estructuras: [] })),
      ]);
      const proyecto = mapProyecto(detalle.proyecto);
      setProject(proyecto);
      const estructuraId = detalle.proyecto.estructura;
      setEstructuraNombre(
        estructuraId
          ? estructurasRes.estructuras.find((e) => e.id === estructuraId)?.nombre ?? null
          : null,
      );
      setSeguimientoAvance(proyecto.progress);
      setProjIndicators(detalle.indicadores.map(mapIndicador));
      setProjDocs(detalle.documentos.map(mapDocumento));
      setGanttActivities(detalle.actividades.map(mapActividad));
      setInformes(informesRes.informes.map(mapInforme));
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

  const recargarDocs = useCallback(async () => {
    const detalle = await api.proyecto(projectId);
    setProjDocs(detalle.documentos.map(mapDocumento));
  }, [projectId]);

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

  const toggle = (s: string) => setExpanded(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  if (cargando) return <CargandoModule mensaje="Cargando detalle del proyecto…" />;
  if (error) return <ErrorModule mensaje={error} onRetry={() => void cargar()} />;
  if (!project) return <ErrorModule mensaje="Proyecto no encontrado." />;

  const docCategories = ["Todos", "Ficha técnica", "Actas", "Informes", "Antecedentes", "Evidencias", "Otros"];
  const filteredDocs = docCat === "Todos" ? projDocs : projDocs.filter(d => d.type === docCat);

  const indicadoresCumplidos = projIndicators.filter(i => i.status === "Cumplido").length;
  const alertasActivas = projIndicators.filter(i => i.status === "En riesgo" || i.status === "No cumplido").length;
  const actividadesCompletadas = ganttActivities.filter(a => a.status === "Completada").length;
  const estadoIndicadores = (["Cumplido", "En riesgo", "No cumplido", "Pendiente"] as const)
    .map(estado => ({
      name: estado,
      value: projIndicators.filter(i => i.status === estado).length,
    }))
    .filter(e => e.value > 0);
  const COLOR_IND: Record<string, string> = {
    Cumplido: "#10B981",
    "En riesgo": "#F59E0B",
    "No cumplido": "#EF4444",
    Pendiente: "#94A3B8",
  };

  const ingresos: { tipo: string; concepto: string; valor: number }[] = [];
  const gastos: {
    cat: string;
    concepto: string;
    unidad: string;
    cant: number;
    valorUnit: number;
    total: number;
  }[] = [];
  const contrapartidas: { entidad: string; valor: number }[] = [];
  const desembolsos: { fecha: string; concepto: string; valor: number }[] = [
  ];

  const FR019_SECTIONS = [
    "Información general", "Problema o necesidad", "Justificación",
    "Objetivo general", "Objetivos específicos", "Cobertura geográfica",
    "Población participante", "Enfoques diferenciales", "Grupos de interés",
    "Metodología", "Indicadores", "Riesgos", "Sostenibilidad",
    "ODS", "Presupuesto", "Aprobaciones",
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="mt-1.5 p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <Crumb items={[{ label: "Proyectos", onClick: onBack }, { label: project.id }, { label: "Detalle" }]} />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-sm font-black text-orange-700">{project.id}</span>
                <StatusBadge status={project.status} />
                <span className="text-sm text-gray-400">Avance: <strong className="text-gray-900">{project.progress}%</strong></span>
              </div>
              <h1 className="text-lg font-bold text-gray-900 mt-1 leading-tight">{project.name}</h1>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={onGenerateReport} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#C2410C] text-white rounded-lg hover:bg-[#9A3412] transition-colors">
                <FileText className="w-3.5 h-3.5" /> Informe
              </button>
              <button onClick={() => onShowToast("Proyecto actualizado correctamente.")} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors bg-white">
                <Edit2 className="w-3.5 h-3.5" /> Editar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide border-b border-gray-100">
          <div className="flex min-w-max">
            {PROJ_TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? "border-[#C2410C] text-[#C2410C] bg-orange-50/30" : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"}`}>
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
                  { label: "Avance técnico", value: `${project.progress}%`, color: "bg-orange-600", bg: "bg-orange-50", tc: "text-orange-800" },
                  { label: "Ejec. presupuestal", value: `${project.budgetExecuted}%`, color: "bg-emerald-500", bg: "bg-emerald-50", tc: "text-emerald-800" },
                  { label: "Inicio", value: project.startDate, color: "", bg: "bg-gray-50", tc: "text-gray-800" },
                  { label: "Finalización", value: project.endDate, color: "", bg: "bg-gray-50", tc: "text-gray-800" },
                ].map(k => (
                  <div key={k.label} className={`${k.bg} rounded-lg p-3`}>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{k.label}</p>
                    <p className={`text-xl font-black mt-1 ${k.tc}`}>{k.value}</p>
                    {k.color && <Bar2 value={parseInt(k.value)} color={k.color} h="h-1.5" />}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <h3 className="text-sm font-bold text-gray-800 mb-3">Información del proyecto</h3>
                  <div className="space-y-0 rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                    {[
                      { label: "Responsable", value: project.responsible },
                      { label: "Línea", value: project.line },
                      { label: "Dependencia", value: project.dependency },
                      { label: "Presupuesto", value: fmt(project.budget) },
                    ].map(r => (
                      <div key={r.label} className="flex gap-3 px-4 py-2.5">
                        <span className="w-32 text-xs font-semibold text-gray-400 flex-shrink-0">{r.label}</span>
                        <span className="text-sm text-gray-900">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800 mb-3">Objetivo general</h3>
                  <p className="text-sm text-gray-600 leading-relaxed p-4 bg-gray-50 rounded-xl border border-gray-100">{project.objective}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── FICHA TÉCNICA ── */}
          {tab === "ficha" && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 className="text-sm font-bold text-gray-800">Ficha Técnica FR-019</h2>
                <span className="text-xs font-medium text-gray-400">Plantilla de referencia</span>
              </div>
              <div className="space-y-2">
                {FR019_SECTIONS.map(sec => (
                  <div key={sec} className="border border-gray-100 rounded-xl overflow-hidden">
                    <button onClick={() => toggle(sec)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/70 hover:bg-gray-100 transition-colors">
                      <span className="text-sm font-semibold text-gray-800">{sec}</span>
                      {expanded.includes(sec) ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>
                    {expanded.includes(sec) && (
                      <div className="px-4 py-4">
                        <textarea rows={3} placeholder={`Ingrese información sobre ${sec.toLowerCase()}…`}
                          defaultValue={sec === "Información general" ? `Proyecto: ${project.name}\nResponsable: ${project.responsible}\nLínea: ${project.line}` : ""}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-gray-50/50 resize-none" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── DASHBOARD INDIVIDUAL ── */}
          {tab === "dashboard" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800">Dashboard del proyecto</h2>
                <span className="text-xs text-gray-400">{project.id}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Avance técnico",        value: `${project.progress}%`,        bg: "bg-orange-50",    tc: "text-orange-800"   },
                  { label: "Avance financiero",     value: `${project.budgetExecuted}%`,   bg: "bg-emerald-50", tc: "text-emerald-800" },
                  { label: "Indicadores cumplidos", value: `${indicadoresCumplidos} / ${projIndicators.length}`, bg: "bg-green-50", tc: "text-green-800" },
                  { label: "Alertas activas",       value: String(alertasActivas),          bg: "bg-red-50",     tc: "text-red-700"    },
                ].map(k => (
                  <div key={k.label} className={`${k.bg} rounded-xl p-3`}>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{k.label}</p>
                    <p className={`text-2xl font-black mt-1 ${k.tc}`}>{k.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-100 p-4">
                  <h3 className="text-xs font-bold text-gray-700 mb-3">Avance técnico y presupuestal (%)</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={[
                      { name: "Técnico", valor: project.progress },
                      { name: "Presupuestal", valor: project.budgetExecuted },
                    ]} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis key="xaxis" dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis key="yaxis" tick={{ fontSize: 11 }} domain={[0, 100]} />
                      <Tooltip key="tooltip" formatter={(v: number) => [`${v}%`, "Avance"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Bar key="bar" dataKey="valor" fill="#EA580C" radius={[4, 4, 0, 0]} barSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-xl border border-gray-100 p-4">
                  <h3 className="text-xs font-bold text-gray-700 mb-3">Estado de indicadores</h3>
                  {estadoIndicadores.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-gray-200 px-3 py-10 text-center text-xs text-gray-400">
                      Sin indicadores registrados.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie key="pie" data={estadoIndicadores} cx="50%" cy="50%" innerRadius={42} outerRadius={66} dataKey="value">
                          {estadoIndicadores.map(e => <Cell key={e.name} fill={COLOR_IND[e.name]} />)}
                        </Pie>
                        <Tooltip key="tooltip" contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Legend key="legend" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
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
                  { label: "Avance técnico",     value: `${project.progress}%`,      color: "text-orange-700",   bg: "bg-orange-50" },
                  { label: "Avance presupuestal",value: `${project.budgetExecuted}%`, color: "text-emerald-700",bg: "bg-emerald-50" },
                  { label: "Indicadores",        value: `${indicadoresCumplidos} / ${projIndicators.length}`, color: "text-slate-700", bg: "bg-slate-50" },
                  { label: "Actividades",        value: `${actividadesCompletadas} / ${ganttActivities.length}`, color: "text-orange-700", bg: "bg-orange-50" },
                  { label: "Entregables",        value: String(projDocs.length),      color: "text-gray-700",   bg: "bg-gray-50" },
                  { label: "Alertas",            value: String(alertasActivas),       color: "text-red-700",    bg: "bg-red-50" },
                ].map(k => (
                  <div key={k.label} className={`${k.bg} rounded-xl p-3`}>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{k.label}</p>
                    <p className={`text-2xl font-black mt-0.5 ${k.color}`}>{k.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-gray-100 p-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-800">Actualizar avance técnico</h3>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-700">Porcentaje de avance</span>
                    <span className="text-lg font-black text-orange-700">{seguimientoAvance}%</span>
                  </div>
                  <input type="range" min={0} max={100} value={seguimientoAvance} onChange={e => setSeguimientoAvance(+e.target.value)}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600" />
                  <div className="mt-2"><Bar2 value={seguimientoAvance} color="bg-orange-500" h="h-2" /></div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Descripción del avance técnico</label>
                  <textarea rows={3} value={seguimientoDesc} onChange={e => setSeguimientoDesc(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-gray-50/50 resize-none" />
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => onShowToast("Proyecto actualizado correctamente.")} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#C2410C] text-white rounded-lg hover:bg-[#9A3412] transition-colors">
                    <Sliders className="w-3.5 h-3.5" />Actualizar avance
                  </button>
                  <span className="text-xs text-gray-400">Última actualización: —</span>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/40">
                  <h3 className="text-sm font-bold text-gray-800">Actividades</h3>
                  <button onClick={() => setShowActModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#C2410C] text-white rounded-lg hover:bg-[#9A3412] transition-colors">
                    <Plus className="w-3.5 h-3.5" />Nueva actividad
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead>
                      <tr className="bg-gray-50/60 border-b border-gray-100">
                        {["Actividad", "Responsable", "Inicio", "Fin", "Avance", "Estado", "Dependencia"].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {ganttActivities.slice(0, 5).map(a => (
                        <tr key={a.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-2.5 font-semibold text-gray-800 text-sm">{a.name}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{a.responsible}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">{GANTT_MONTHS[a.startMonth - 1]} 2026</td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">{GANTT_MONTHS[a.endMonth - 1]} 2026</td>
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
                          <td className="px-4 py-2.5 text-xs text-gray-400">—</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {showActModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-gray-900">Nueva actividad</h3>
                      <button onClick={() => setShowActModal(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {["Nombre", "Responsable"].map(f => (
                        <div key={f} className="col-span-2 first:col-span-2">
                          <label className="block text-xs font-semibold text-gray-700 mb-1.5">{f}</label>
                          <input type="text" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-gray-50/50" />
                        </div>
                      ))}
                      <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Fecha inicio</label><input type="date" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none bg-gray-50/50" /></div>
                      <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Fecha fin</label><input type="date" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none bg-gray-50/50" /></div>
                      <div><label className="block text-xs font-semibold text-gray-700 mb-1.5">Avance (%)</label><input type="number" min={0} max={100} defaultValue={0} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none bg-gray-50/50" /></div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Estado</label>
                        <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none bg-gray-50/50">
                          {["Pendiente","En curso","Completada","Retrasada"].map(v => <option key={v}>{v}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setShowActModal(false)} className="flex-1 py-2 text-sm font-semibold border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">Cancelar</button>
                      <button onClick={() => { setShowActModal(false); onShowToast("Actividad agregada correctamente."); }} className="flex-1 py-2 text-sm font-semibold bg-[#C2410C] text-white rounded-lg hover:bg-[#9A3412]">Guardar actividad</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── GANTT ── */}
          {tab === "gantt" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-gray-800">Cronograma Gantt</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{project.id} · {new Date().getFullYear()}</p>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#C2410C] text-white rounded-lg hover:bg-[#9A3412] transition-colors">
                  <Plus className="w-3.5 h-3.5" />Nueva actividad
                </button>
              </div>

              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <div style={{ minWidth: 900 }}>
                    {/* Header */}
                    <div className="flex border-b border-gray-100 bg-gray-50/70">
                      <div className="w-52 flex-shrink-0 px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r border-gray-100">Actividad</div>
                      <div className="w-28 flex-shrink-0 px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r border-gray-100 hidden sm:block">Responsable</div>
                      <div className="w-16 flex-shrink-0 px-2 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r border-gray-100">Inicio</div>
                      <div className="w-16 flex-shrink-0 px-2 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r border-gray-100">Fin</div>
                      <div className="w-14 flex-shrink-0 px-2 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r border-gray-100">Dur.</div>
                      <div className="w-14 flex-shrink-0 px-2 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-r border-gray-100">Av.</div>
                      <div className="flex-1 grid grid-cols-12">
                        {GANTT_MONTHS.map(m => (
                          <div key={m} className="px-1 py-2.5 text-[10px] font-bold text-gray-400 text-center border-r border-gray-100 last:border-r-0">{m}</div>
                        ))}
                      </div>
                      <div className="w-20 flex-shrink-0 px-2 py-2.5 text-[10px] font-bold text-gray-500 uppercase border-l border-gray-100">Acciones</div>
                    </div>

                    {/* Rows */}
                    {ganttActivities.map((a, idx) => {
                      const barLeft = ((a.startMonth - 1) / 12) * 100;
                      const barWidth = ((a.endMonth - a.startMonth + 1) / 12) * 100;
                      const barColor = a.isMilestone ? "#F59E0B" : a.status === "Completada" ? "#10B981" : a.status === "En curso" ? "#EA580C" : a.status === "Retrasada" ? "#EF4444" : "#CBD5E1";
                      return (
                        <div key={a.id} className={`flex border-b border-gray-50 hover:bg-orange-50/5 transition-colors ${a.isMilestone ? "bg-amber-50/20" : ""}`}>
                          <div className="w-52 flex-shrink-0 px-4 py-3 border-r border-gray-100">
                            <div className="flex items-center gap-1.5">
                              {a.isMilestone && <span className="text-amber-500">◆</span>}
                              <span className="text-xs font-semibold text-gray-800 truncate">{a.name}</span>
                            </div>
                          </div>
                          <div className="w-28 flex-shrink-0 px-3 py-3 text-xs text-gray-500 border-r border-gray-100 hidden sm:flex items-center">{a.responsible.split(" ").slice(-1)[0]}</div>
                          <div className="w-16 flex-shrink-0 px-2 py-3 text-xs text-gray-400 border-r border-gray-100 flex items-center">{GANTT_MONTHS[a.startMonth - 1]}</div>
                          <div className="w-16 flex-shrink-0 px-2 py-3 text-xs text-gray-400 border-r border-gray-100 flex items-center">{GANTT_MONTHS[a.endMonth - 1]}</div>
                          <div className="w-14 flex-shrink-0 px-2 py-3 text-xs text-gray-400 border-r border-gray-100 flex items-center">{a.endMonth - a.startMonth + 1}m</div>
                          <div className="w-14 flex-shrink-0 px-2 py-3 text-xs font-bold text-gray-700 border-r border-gray-100 flex items-center">{a.progress}%</div>
                          <div className="flex-1 relative flex items-center py-3">
                            <div className="absolute inset-y-0 left-0 right-0 flex items-center px-1">
                              {/* Grid lines */}
                              {Array.from({ length: 11 }, (_, i) => (
                                <div key={i} className="absolute h-full border-r border-gray-100" style={{ left: `${((i + 1) / 12) * 100}%` }} />
                              ))}
                              {/* Bar */}
                              {a.isMilestone ? (
                                <div className="absolute flex items-center justify-center" style={{ left: `${barLeft}%`, transform: "translateX(-50%)" }}>
                                  <span className="text-amber-500 text-lg">◆</span>
                                </div>
                              ) : (
                                <div className="absolute rounded-full h-4 flex items-center overflow-hidden"
                                  style={{ left: `${barLeft}%`, width: `${barWidth}%`, backgroundColor: barColor + "30", border: `1.5px solid ${barColor}` }}>
                                  <div className="h-full rounded-full" style={{ width: `${a.progress}%`, backgroundColor: barColor }} />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="w-20 flex-shrink-0 px-2 py-3 border-l border-gray-100 flex items-center gap-0.5">
                            <button className="p-1 text-gray-300 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"><Edit2 className="w-3 h-3" /></button>
                            <button onClick={() => setGanttActivities(p => p.filter((_, j) => j !== idx))} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                {[["#10B981", "Completada"], ["#EA580C", "En curso"], ["#CBD5E1", "Pendiente"], ["#EF4444", "Retrasada"], ["#F59E0B", "Hito"]].map(([color, label]) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PRESUPUESTO ── */}
          {tab === "presupuesto" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Valor total",       value: fmt(project.budget),                                               tc: "text-gray-900" },
                  { label: "Ejecutado",         value: fmt(Math.round(project.budget * project.budgetExecuted / 100)),    tc: "text-orange-700" },
                  { label: "Disponible",        value: fmt(Math.round(project.budget * (100 - project.budgetExecuted) / 100)), tc: "text-emerald-700" },
                  { label: "% Ejecución",       value: `${project.budgetExecuted}%`,                                      tc: "text-orange-600" },
                ].map(k => (
                  <div key={k.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{k.label}</p>
                    <p className={`text-base font-black mt-1 ${k.tc}`}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Sub-tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                {["ingresos", "gastos", "contrapartidas", "desembolsos"].map(st => (
                  <button key={st} onClick={() => setPresupuestoTab(st)}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${presupuestoTab === st ? "bg-white text-[#C2410C] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                    {st.charAt(0).toUpperCase() + st.slice(1)}
                  </button>
                ))}
              </div>

              {presupuestoTab === "ingresos" && (
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/40">
                    <h3 className="text-sm font-bold text-gray-800">Ingresos</h3>
                    <button className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-800"><Plus className="w-3 h-3" />Agregar</button>
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="bg-gray-50/40 border-b border-gray-100">
                        {["Tipo", "Concepto", "Valor total"].map(h => (
                          <th key={h} className={`px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider ${h === "Tipo" || h === "Concepto" ? "text-left" : "text-right"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {ingresos.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-xs text-gray-400">
                            Sin ingresos registrados.
                          </td>
                        </tr>
                      )}
                      {ingresos.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-4 py-2.5 text-sm text-gray-600">{r.tipo}</td>
                          <td className="px-4 py-2.5 text-sm text-gray-800 font-semibold">{r.concepto}</td>
                          <td className="px-4 py-2.5 text-sm text-right font-semibold text-orange-700">{fmt(r.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td colSpan={2} className="px-4 py-2.5 text-sm font-bold text-gray-900">Total ingresos</td>
                        <td className="px-4 py-2.5 text-sm font-bold text-right text-orange-700">{fmt(ingresos.reduce((a, r) => a + r.valor, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                </div>
              )}

              {presupuestoTab === "gastos" && (
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/40">
                    <h3 className="text-sm font-bold text-gray-800">Gastos</h3>
                    <button className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-800"><Plus className="w-3 h-3" />Agregar</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50/40 border-b border-gray-100">
                          {["Categoría", "Concepto", "Unidad", "Cantidad", "Valor unit.", "Valor total"].map(h => (
                            <th key={h} className={`px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider ${h === "Categoría" || h === "Concepto" ? "text-left" : "text-right"}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {gastos.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">
                              Sin gastos registrados.
                            </td>
                          </tr>
                        )}
                        {gastos.map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="px-4 py-2.5 text-sm text-gray-600">{r.cat}</td>
                            <td className="px-4 py-2.5 text-sm text-gray-800 font-semibold">{r.concepto}</td>
                            <td className="px-4 py-2.5 text-sm text-right text-gray-500">{r.unidad}</td>
                            <td className="px-4 py-2.5 text-sm text-right text-gray-500">{r.cant}</td>
                            <td className="px-4 py-2.5 text-sm text-right text-gray-500">{fmt(r.valorUnit)}</td>
                            <td className="px-4 py-2.5 text-sm text-right font-semibold text-orange-700">{fmt(r.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t border-gray-200">
                          <td colSpan={5} className="px-4 py-2.5 text-sm font-bold text-gray-900">Total gastos</td>
                          <td className="px-4 py-2.5 text-sm font-bold text-right text-orange-700">{fmt(gastos.reduce((a, r) => a + r.total, 0))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {presupuestoTab === "contrapartidas" && (
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/40">
                    <h3 className="text-sm font-bold text-gray-800">Contrapartidas</h3>
                    <button className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-800"><Plus className="w-3 h-3" />Agregar contrapartida</button>
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="bg-gray-50/40 border-b border-gray-100">
                        {["Entidad", "Valor"].map(h => (
                          <th key={h} className={`px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider ${h === "Entidad" ? "text-left" : "text-right"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {contrapartidas.length === 0 && (
                        <tr>
                          <td colSpan={2} className="px-4 py-8 text-center text-xs text-gray-400">
                            Sin contrapartidas registradas.
                          </td>
                        </tr>
                      )}
                      {contrapartidas.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-4 py-2.5 text-sm font-semibold text-gray-800">{r.entidad}</td>
                          <td className="px-4 py-2.5 text-sm text-right font-semibold text-emerald-700">{fmt(r.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td className="px-4 py-2.5 text-sm font-bold text-gray-900">Total contrapartidas</td>
                        <td className="px-4 py-2.5 text-sm font-bold text-right text-emerald-700">{fmt(contrapartidas.reduce((a, r) => a + r.valor, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                </div>
              )}

              {presupuestoTab === "desembolsos" && (
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/40">
                    <h3 className="text-sm font-bold text-gray-800">Desembolsos</h3>
                    <button className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-800"><Plus className="w-3 h-3" />Agregar desembolso</button>
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="bg-gray-50/40 border-b border-gray-100">
                        {["Fecha", "Concepto", "Valor"].map(h => (
                          <th key={h} className={`px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider ${h === "Valor" ? "text-right" : "text-left"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {desembolsos.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-xs text-gray-400">
                            Sin desembolsos registrados.
                          </td>
                        </tr>
                      )}
                      {desembolsos.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-4 py-2.5 text-xs text-gray-400">{r.fecha}</td>
                          <td className="px-4 py-2.5 text-sm font-semibold text-gray-800">{r.concepto}</td>
                          <td className="px-4 py-2.5 text-sm text-right font-semibold text-orange-700">{fmt(r.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td colSpan={2} className="px-4 py-2.5 text-sm font-bold text-gray-900">Total desembolsado</td>
                        <td className="px-4 py-2.5 text-sm font-bold text-right text-orange-700">{fmt(desembolsos.reduce((a, r) => a + r.valor, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── INDICADORES ── */}
          {tab === "indicadores" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800">Indicadores del proyecto</h2>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#C2410C] text-white rounded-lg hover:bg-[#9A3412] transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Nuevo indicador
                </button>
              </div>
              <div className="space-y-3">
                {projIndicators.map(ind => (
                  <div key={ind.id} className="rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] text-gray-400 font-bold">{ind.id}</span>
                          <IndBadge status={ind.status} />
                        </div>
                        <p className="text-sm font-semibold text-gray-900 mt-1">{ind.name}</p>
                        <div className="flex flex-wrap gap-4 mt-2">
                          {[["Meta", ind.goal], ["Avance", ind.advance], ["Responsable", ind.responsible], ["Fecha", ind.date]].map(([k, v]) => (
                            <span key={k} className="text-xs text-gray-400">{k}: <strong className="text-gray-700">{v}</strong></span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Bar2 value={ind.compliance} color={IND_CFG[ind.status].bar} h="h-2" />
                          <span className="text-xs font-black text-gray-700 flex-shrink-0">{ind.compliance}%</span>
                        </div>
                      </div>
                      <button className="p-1.5 text-gray-300 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── DOCUMENTOS ── */}
          {tab === "documentos" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-gray-800">Repositorio documental</h2>
                  {estructuraNombre && (
                    <p className="text-[11px] text-gray-400">Plantilla: {estructuraNombre}</p>
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
                    onClick={() => setMostrarSubida(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#C2410C] text-white rounded-lg hover:bg-[#9A3412] transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" /> Cargar documento
                  </button>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {docCategories.map(cat => (
                  <button key={cat} onClick={() => setDocCat(cat)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${docCat === cat ? "bg-[#C2410C] text-white border-[#C2410C]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"}`}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="bg-gray-50/60 border-b border-gray-100">
                      {["Nombre", "Tipo", "Versión", "Fecha", "Usuario", "Estado", "Acciones"].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredDocs.map(doc => (
                      <tr key={doc.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Paperclip className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                            <span className="text-sm font-semibold text-gray-800">{doc.name}</span>
                          </div>
                          {doc.folder && (
                            <p className="mt-0.5 pl-[22px] text-[10px] text-gray-400">{doc.folder}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{doc.type}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{doc.version}</td>
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800">Antecedentes asociados</h2>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-orange-200 text-orange-700 rounded-lg hover:bg-orange-50 transition-colors">
                  <Link2 className="w-3.5 h-3.5" /> Asociar antecedente
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Buscar por código, línea o palabra clave…" className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-gray-50/50" />
              </div>
              <div className="space-y-3">
                <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-xs text-gray-400">
                  No hay antecedentes asociados a este proyecto.
                </p>
              </div>
              <p className="text-xs text-gray-400 italic">Los antecedentes son relaciones lógicas. No duplican físicamente los documentos.</p>
            </div>
          )}

          {/* ── INFORMES ── */}
          {tab === "informes" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-gray-800">Informes del proyecto</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Última actualización: {new Date().toLocaleDateString("es-CO")}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={onGenerateReport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#C2410C] text-white rounded-lg hover:bg-[#9A3412] transition-colors">
                    <FileText className="w-3.5 h-3.5" /> Generar informe
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
                {["Informe diario", "Informe semanal", "Informe del proyecto"].map(tipo => (
                  <div key={tipo} className="rounded-xl border border-gray-100 p-4 hover:border-orange-100 hover:bg-orange-50/10 transition-all">
                    <p className="text-sm font-semibold text-gray-900 mb-3">{tipo}</p>
                    <div className="flex gap-2">
                      <button onClick={onGenerateReport} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold bg-[#C2410C] text-white rounded-lg hover:bg-[#9A3412] transition-colors">
                        <FileText className="w-3 h-3" />PDF
                      </button>
                      <button className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold border border-orange-200 text-orange-700 rounded-lg hover:bg-orange-50 transition-colors">
                        <FileDown className="w-3 h-3" />Word
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {informes.slice(0, 4).map(r => (
                  <div key={r.id} className="rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-orange-50 text-orange-700">{r.type}</span>
                        <p className="text-sm font-semibold text-gray-900 mt-1.5">{r.period}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Generado: {r.date} · {r.generatedBy}</p>
                      </div>
                      <div className="flex gap-1">
                        <button className="p-1.5 text-gray-300 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"><Eye className="w-4 h-4" /></button>
                        <button className="p-1.5 text-gray-300 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors" title="Descargar PDF"><Download className="w-4 h-4" /></button>
                        <button className="p-1.5 text-gray-300 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors" title="Descargar Word"><FileDown className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── HISTORIAL ── */}
          {tab === "historial" && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-gray-800">Historial de informes</h2>
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="bg-gray-50/60 border-b border-gray-100">
                      {["Fecha", "Tipo", "Período", "Proyecto", "Generado por", "Formato", "Acciones"].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {informes.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-xs text-gray-500">{r.date}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-800">{r.type}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{r.period}</td>
                        <td className="whitespace-nowrap px-4 py-3"><span className="font-mono text-xs font-bold text-orange-700">{r.project}</span></td>
                        <td className="px-4 py-3 text-xs text-gray-500">{r.generatedBy}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 bg-red-50 text-red-700 text-xs font-bold rounded">{r.format}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button className="p-1.5 text-gray-300 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                            <button className="p-1.5 text-gray-300 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"><Download className="w-3.5 h-3.5" /></button>
                            <button className="p-1.5 text-gray-300 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"><FileDown className="w-3.5 h-3.5" /></button>
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
                  <div key={i} className="rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors">
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

      <ActualizarDocumentoModal
        abierto={Boolean(docEditando)}
        documento={docEditando}
        onCerrar={() => setDocEditando(null)}
        onActualizado={() => void recargarDocs()}
      />

      {mostrarZip && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
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
