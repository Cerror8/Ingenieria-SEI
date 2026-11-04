import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, Briefcase, BookOpen, FileText, FolderOpen,
  Activity, ChevronRight, ChevronDown, ChevronUp,
  Plus, Search, Download, Eye, Edit2, Bell, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, DollarSign, ArrowLeft, X, Upload,
  Link2, MoreHorizontal, ChevronLeft, Filter, Tag, Paperclip,
  Clock, BarChart2, Percent, Check, Trash2, Save, FileDown, Sliders
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend
} from "recharts";
import { GanttActivity } from "../../../types";
import { PROJECTS, INDICATORS, DOCUMENTS, AUDIT_LOG, REPORTS, GANTT_ACTIVITIES } from "../../../data/mock";
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
  const [seguimientoAvance, setSeguimientoAvance] = useState(68);
  const [seguimientoDesc, setSeguimientoDesc] = useState("Se han completado los módulos de formación en metodología investigativa y validación de instrumentos.");
  const [showActModal, setShowActModal] = useState(false);
  const [ganttActivities, setGanttActivities] = useState<GanttActivity[]>(GANTT_ACTIVITIES);

  const project = PROJECTS.find(p => p.id === projectId);
  if (!project) return null;

  const toggle = (s: string) => setExpanded(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const budgetMonthly = [
    { m: "Ene", p: 15000000, e: 9500000 },
    { m: "Feb", p: 30000000, e: 22000000 },
    { m: "Mar", p: 50000000, e: 44000000 },
    { m: "Abr", p: 70000000, e: 62000000 },
    { m: "May", p: 90000000, e: 80000000 },
    { m: "Jun", p: 110000000, e: 95000000 },
    { m: "Jul", p: 130000000, e: 106000000 },
    { m: "Ago", p: 150000000, e: 118500000 },
  ];

  const projIndicators = INDICATORS.filter(i => i.projectId === projectId).concat(INDICATORS).slice(0, 5);
  const projDocs = DOCUMENTS.filter(d => d.projectId === projectId).concat(DOCUMENTS).slice(0, 6);
  const docCategories = ["Todos", "Ficha técnica", "Actas", "Informes", "Antecedentes", "Evidencias", "Otros"];
  const filteredDocs = docCat === "Todos" ? projDocs : projDocs.filter(d => d.type === docCat);

  const ingresos = [
    { tipo: "Recursos propios", concepto: "Aporte institucional", valor: 100000000 },
    { tipo: "Aportes de terceros", concepto: "Convenio MEN", valor: 50000000 },
  ];
  const gastos = [
    { cat: "Personal", concepto: "Investigadores", unidad: "Mes", cant: 12, valorUnit: 5000000, total: 60000000 },
    { cat: "Equipos", concepto: "Materiales de laboratorio", unidad: "Global", cant: 1, valorUnit: 25000000, total: 25000000 },
    { cat: "Difusión", concepto: "Publicaciones y artículos", unidad: "Publicación", cant: 4, valorUnit: 6250000, total: 25000000 },
  ];
  const contrapartidas = [
    { entidad: "Gobernación del Meta", valor: 15000000 },
    { entidad: "Alcaldía Villavicencio", valor: 8000000 },
  ];
  const desembolsos = [
    { fecha: "15/01/2026", concepto: "Primer desembolso", valor: 40000000 },
    { fecha: "15/04/2026", concepto: "Segundo desembolso", valor: 35000000 },
    { fecha: "15/07/2026", concepto: "Tercer desembolso", valor: 25000000 },
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
                <span className="font-mono text-sm font-black text-blue-700">{project.id}</span>
                <StatusBadge status={project.status} />
                <span className="text-sm text-gray-400">Avance: <strong className="text-gray-900">{project.progress}%</strong></span>
              </div>
              <h1 className="text-lg font-bold text-gray-900 mt-1 leading-tight">{project.name}</h1>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={onGenerateReport} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#1B3C6B] text-white rounded-lg hover:bg-[#152f54] transition-colors">
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
                className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? "border-[#1B3C6B] text-[#1B3C6B] bg-blue-50/30" : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"}`}>
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
                  { label: "Avance técnico", value: `${project.progress}%`, color: "bg-blue-600", bg: "bg-blue-50", tc: "text-blue-800" },
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-800">Ficha Técnica FR-019</h2>
                <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" />Guardado correctamente
                </div>
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
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-gray-50/50 resize-none" />
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
                <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Actualizado hace 1 min · {new Date().toLocaleDateString("es-CO")}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Avance técnico",        value: `${project.progress}%`,        bg: "bg-blue-50",    tc: "text-blue-800"   },
                  { label: "Avance financiero",     value: `${project.budgetExecuted}%`,   bg: "bg-emerald-50", tc: "text-emerald-800" },
                  { label: "Indicadores cumplidos", value: "3 / 5",                        bg: "bg-green-50",   tc: "text-green-800"  },
                  { label: "Alertas activas",       value: "2",                            bg: "bg-red-50",     tc: "text-red-700"    },
                ].map(k => (
                  <div key={k.label} className={`${k.bg} rounded-xl p-3`}>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{k.label}</p>
                    <p className={`text-2xl font-black mt-1 ${k.tc}`}>{k.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-100 p-4">
                  <h3 className="text-xs font-bold text-gray-700 mb-3">Avance técnico vs planificado</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={budgetMonthly.map(d => ({ m: d.m, real: Math.round(d.e / d.p * project.progress), plan: Math.round(d.e / d.p * (project.progress + 10)) }))}>
                      <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis key="xaxis" dataKey="m" tick={{ fontSize: 11 }} />
                      <YAxis key="yaxis" tick={{ fontSize: 11 }} domain={[0, 100]} />
                      <Tooltip key="tooltip" contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Area key="area-plan" type="monotone" dataKey="plan" name="Planificado" stroke="#CBD5E1" fill="none" strokeDasharray="4 2" strokeWidth={1.5} />
                      <Area key="area-real" type="monotone" dataKey="real" name="Ejecutado" stroke="#2563EB" fill="#EFF6FF" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-xl border border-gray-100 p-4">
                  <h3 className="text-xs font-bold text-gray-700 mb-3">Estado de indicadores</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie key="pie" data={[{ name: "Cumplido", value: 3 }, { name: "En riesgo", value: 1 }, { name: "No cumplido", value: 1 }]} cx="50%" cy="50%" innerRadius={42} outerRadius={66} dataKey="value">
                        {["#10B981", "#F59E0B", "#EF4444"].map((c, i) => <Cell key={`ind-${i}`} fill={c} />)}
                      </Pie>
                      <Tooltip key="tooltip" contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Legend key="legend" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
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
                  { label: "Avance técnico",     value: `${project.progress}%`,      color: "text-blue-700",   bg: "bg-blue-50" },
                  { label: "Avance presupuestal",value: `${project.budgetExecuted}%`, color: "text-emerald-700",bg: "bg-emerald-50" },
                  { label: "Indicadores",        value: "3 / 5",                     color: "text-purple-700", bg: "bg-purple-50" },
                  { label: "Actividades",        value: "5 / 8",                     color: "text-orange-700", bg: "bg-orange-50" },
                  { label: "Entregables",        value: "3",                         color: "text-teal-700",   bg: "bg-teal-50" },
                  { label: "Alertas",            value: "2",                         color: "text-red-700",    bg: "bg-red-50" },
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
                    <span className="text-lg font-black text-blue-700">{seguimientoAvance}%</span>
                  </div>
                  <input type="range" min={0} max={100} value={seguimientoAvance} onChange={e => setSeguimientoAvance(+e.target.value)}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  <div className="mt-2"><Bar2 value={seguimientoAvance} color="bg-blue-500" h="h-2" /></div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Descripción del avance técnico</label>
                  <textarea rows={3} value={seguimientoDesc} onChange={e => setSeguimientoDesc(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-gray-50/50 resize-none" />
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => onShowToast("Proyecto actualizado correctamente.")} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#1B3C6B] text-white rounded-lg hover:bg-[#152f54] transition-colors">
                    <Sliders className="w-3.5 h-3.5" />Actualizar avance
                  </button>
                  <span className="text-xs text-gray-400">Última actualización: hace 5 segundos</span>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/40">
                  <h3 className="text-sm font-bold text-gray-800">Actividades</h3>
                  <button onClick={() => setShowActModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#1B3C6B] text-white rounded-lg hover:bg-[#152f54] transition-colors">
                    <Plus className="w-3.5 h-3.5" />Nueva actividad
                  </button>
                </div>
                <table className="w-full text-sm">
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
                            <Bar2 value={a.progress} color="bg-blue-500" h="h-1.5" />
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
                          <input type="text" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-gray-50/50" />
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
                      <button onClick={() => { setShowActModal(false); onShowToast("Actividad agregada correctamente."); }} className="flex-1 py-2 text-sm font-semibold bg-[#1B3C6B] text-white rounded-lg hover:bg-[#152f54]">Guardar actividad</button>
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
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#1B3C6B] text-white rounded-lg hover:bg-[#152f54] transition-colors">
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
                      const barColor = a.isMilestone ? "#F59E0B" : a.status === "Completada" ? "#10B981" : a.status === "En curso" ? "#2563EB" : a.status === "Retrasada" ? "#EF4444" : "#CBD5E1";
                      return (
                        <div key={a.id} className={`flex border-b border-gray-50 hover:bg-blue-50/5 transition-colors ${a.isMilestone ? "bg-amber-50/20" : ""}`}>
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
                            <button className="p-1 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit2 className="w-3 h-3" /></button>
                            <button onClick={() => setGanttActivities(p => p.filter((_, j) => j !== idx))} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                {[["#10B981", "Completada"], ["#2563EB", "En curso"], ["#CBD5E1", "Pendiente"], ["#EF4444", "Retrasada"], ["#F59E0B", "Hito"]].map(([color, label]) => (
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
                  { label: "Ejecutado",         value: fmt(Math.round(project.budget * project.budgetExecuted / 100)),    tc: "text-blue-700" },
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
                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${presupuestoTab === st ? "bg-white text-[#1B3C6B] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                    {st.charAt(0).toUpperCase() + st.slice(1)}
                  </button>
                ))}
              </div>

              {presupuestoTab === "ingresos" && (
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/40">
                    <h3 className="text-sm font-bold text-gray-800">Ingresos</h3>
                    <button className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"><Plus className="w-3 h-3" />Agregar</button>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/40 border-b border-gray-100">
                        {["Tipo", "Concepto", "Valor total"].map(h => (
                          <th key={h} className={`px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider ${h === "Tipo" || h === "Concepto" ? "text-left" : "text-right"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {ingresos.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-4 py-2.5 text-sm text-gray-600">{r.tipo}</td>
                          <td className="px-4 py-2.5 text-sm text-gray-800 font-semibold">{r.concepto}</td>
                          <td className="px-4 py-2.5 text-sm text-right font-semibold text-blue-700">{fmt(r.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td colSpan={2} className="px-4 py-2.5 text-sm font-bold text-gray-900">Total ingresos</td>
                        <td className="px-4 py-2.5 text-sm font-bold text-right text-blue-700">{fmt(ingresos.reduce((a, r) => a + r.valor, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {presupuestoTab === "gastos" && (
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/40">
                    <h3 className="text-sm font-bold text-gray-800">Gastos</h3>
                    <button className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"><Plus className="w-3 h-3" />Agregar</button>
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
                        {gastos.map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="px-4 py-2.5 text-sm text-gray-600">{r.cat}</td>
                            <td className="px-4 py-2.5 text-sm text-gray-800 font-semibold">{r.concepto}</td>
                            <td className="px-4 py-2.5 text-sm text-right text-gray-500">{r.unidad}</td>
                            <td className="px-4 py-2.5 text-sm text-right text-gray-500">{r.cant}</td>
                            <td className="px-4 py-2.5 text-sm text-right text-gray-500">{fmt(r.valorUnit)}</td>
                            <td className="px-4 py-2.5 text-sm text-right font-semibold text-blue-700">{fmt(r.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t border-gray-200">
                          <td colSpan={5} className="px-4 py-2.5 text-sm font-bold text-gray-900">Total gastos</td>
                          <td className="px-4 py-2.5 text-sm font-bold text-right text-blue-700">{fmt(gastos.reduce((a, r) => a + r.total, 0))}</td>
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
                    <button className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"><Plus className="w-3 h-3" />Agregar contrapartida</button>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/40 border-b border-gray-100">
                        {["Entidad", "Valor"].map(h => (
                          <th key={h} className={`px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider ${h === "Entidad" ? "text-left" : "text-right"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
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
              )}

              {presupuestoTab === "desembolsos" && (
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/40">
                    <h3 className="text-sm font-bold text-gray-800">Desembolsos</h3>
                    <button className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"><Plus className="w-3 h-3" />Agregar desembolso</button>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/40 border-b border-gray-100">
                        {["Fecha", "Concepto", "Valor"].map(h => (
                          <th key={h} className={`px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider ${h === "Valor" ? "text-right" : "text-left"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {desembolsos.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-4 py-2.5 text-xs text-gray-400">{r.fecha}</td>
                          <td className="px-4 py-2.5 text-sm font-semibold text-gray-800">{r.concepto}</td>
                          <td className="px-4 py-2.5 text-sm text-right font-semibold text-blue-700">{fmt(r.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td colSpan={2} className="px-4 py-2.5 text-sm font-bold text-gray-900">Total desembolsado</td>
                        <td className="px-4 py-2.5 text-sm font-bold text-right text-blue-700">{fmt(desembolsos.reduce((a, r) => a + r.valor, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── INDICADORES ── */}
          {tab === "indicadores" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800">Indicadores del proyecto</h2>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#1B3C6B] text-white rounded-lg hover:bg-[#152f54] transition-colors">
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
                      <button className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
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
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800">Repositorio documental</h2>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#1B3C6B] text-white rounded-lg hover:bg-[#152f54] transition-colors">
                  <Upload className="w-3.5 h-3.5" /> Cargar documento
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {docCategories.map(cat => (
                  <button key={cat} onClick={() => setDocCat(cat)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${docCat === cat ? "bg-[#1B3C6B] text-white border-[#1B3C6B]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"}`}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
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
                            <button className="p-1 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Ver"><Eye className="w-3.5 h-3.5" /></button>
                            <button className="p-1 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Descargar"><Download className="w-3.5 h-3.5" /></button>
                            <button className="p-1 text-gray-300 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Nueva versión"><Clock className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── ANTECEDENTES ── */}
          {tab === "antecedentes" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800">Antecedentes asociados</h2>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors">
                  <Link2 className="w-3.5 h-3.5" /> Asociar antecedente
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Buscar por código, línea o palabra clave…" className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-gray-50/50" />
              </div>
              <div className="space-y-3">
                {[
                  { id: "PRY-2024-008", name: "Sistema de riego inteligente v1.0", line: "Tecnología e Innovación", docs: 12, year: 2024 },
                  { id: "PRY-2023-015", name: "Competencias docentes digitales", line: "Educación y Pedagogía", docs: 8, year: 2023 },
                ].map(ant => (
                  <div key={ant.id} className="rounded-xl border border-gray-100 p-4 hover:border-blue-100 hover:bg-blue-50/10 transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-blue-700">{ant.id}</span>
                          <span className="text-xs text-gray-400">· {ant.year}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 mt-0.5">{ant.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-400">Línea: <strong className="text-gray-600">{ant.line}</strong></span>
                          <span className="text-xs text-gray-400">Documentos: <strong className="text-gray-600">{ant.docs}</strong></span>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
                        <button className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
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
                  <button onClick={onGenerateReport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#1B3C6B] text-white rounded-lg hover:bg-[#152f54] transition-colors">
                    <FileText className="w-3.5 h-3.5" /> Generar informe
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
                {["Informe diario", "Informe semanal", "Informe del proyecto"].map(tipo => (
                  <div key={tipo} className="rounded-xl border border-gray-100 p-4 hover:border-blue-100 hover:bg-blue-50/10 transition-all">
                    <p className="text-sm font-semibold text-gray-900 mb-3">{tipo}</p>
                    <div className="flex gap-2">
                      <button onClick={onGenerateReport} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold bg-[#1B3C6B] text-white rounded-lg hover:bg-[#152f54] transition-colors">
                        <FileText className="w-3 h-3" />PDF
                      </button>
                      <button className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors">
                        <FileDown className="w-3 h-3" />Word
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {REPORTS.slice(0, 4).map(r => (
                  <div key={r.id} className="rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-50 text-blue-700">{r.type}</span>
                        <p className="text-sm font-semibold text-gray-900 mt-1.5">{r.period}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Generado: {r.date} · {r.generatedBy}</p>
                      </div>
                      <div className="flex gap-1">
                        <button className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Eye className="w-4 h-4" /></button>
                        <button className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Descargar PDF"><Download className="w-4 h-4" /></button>
                        <button className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Descargar Word"><FileDown className="w-4 h-4" /></button>
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/60 border-b border-gray-100">
                      {["Fecha", "Tipo", "Período", "Proyecto", "Generado por", "Formato", "Acciones"].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {REPORTS.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-xs text-gray-500">{r.date}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-800">{r.type}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{r.period}</td>
                        <td className="px-4 py-3"><span className="font-mono text-xs font-bold text-blue-700">{r.project}</span></td>
                        <td className="px-4 py-3 text-xs text-gray-500">{r.generatedBy}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 bg-red-50 text-red-700 text-xs font-bold rounded">{r.format}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                            <button className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Download className="w-3.5 h-3.5" /></button>
                            <button className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><FileDown className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                {AUDIT_LOG.map((entry, i) => (
                  <div key={i} className="rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono text-xs font-semibold text-gray-500">{entry.date}</span>
                          <span className="text-xs font-bold text-gray-800">{entry.user}</span>
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${entry.action === "Creación" ? "bg-green-50 text-green-700" : entry.action === "Carga documento" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                            {entry.action}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-xs">
                          <span className="text-gray-400">Entidad:</span>
                          <span className="font-semibold text-gray-700">{entry.entity}</span>
                          <span className="text-gray-300">·</span>
                          <span className="font-mono font-bold text-blue-700">{entry.record}</span>
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
    </div>
  );
}
