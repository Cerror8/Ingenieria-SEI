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
import { ProjectStatus } from "../../../types";
import { RESEARCH_LINES } from "../../../data/charts";
import { STATUS_CFG, WIZARD_STEPS } from "../../../constants";
import { fmt } from "../../../lib/format";
import { Bar2, Crumb } from "../../../components/shared";
import { ProjectCreatedModal } from "../components/ProjectCreatedModal";

export function CreateProjectView({ onBack, onSave }: { onBack: () => void; onSave: () => void }) {
  const [step, setStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [assocModal, setAssocModal] = useState<string | null>(null);

  // Step 1
  const [form, setForm] = useState({
    codigo: "PRY-2026-009", nombre: "", linea: "", dependencia: "", responsable: "",
    estado: "En formulación", fecha: "", gestionPMO: "", valorTotal: "", valorSupervision: "", objetivo: ""
  });
  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 2 FR-019 dynamic data
  const [objetivos, setObjetivos] = useState([{ desc: "Desarrollar instrumentos de evaluación para competencias investigativas", orden: 1 }]);
  const [riesgos, setRiesgos] = useState([{ riesgo: "Baja participación docente", prob: "Media", cons: "Alta", plan: "Estrategia de convocatoria con incentivos" }]);
  const [coberturas, setCoberturas] = useState([{ pais: "Colombia", depto: "Meta", municipio: "Villavicencio" }]);
  const [poblacion, setPoblacion] = useState([{ cat: "Docentes investigadores", cant: "80" }, { cat: "Estudiantes", cant: "200" }]);
  const [enfoques, setEnfoques] = useState([{ tipo: "Género", desc: "Perspectiva de género en la investigación" }]);
  const [grupos, setGrupos] = useState([{ tipo: "Directo", desc: "Docentes y estudiantes investigadores" }]);
  const [componentes, setComponentes] = useState([{ nombre: "Formación", desc: "Capacitación en metodología investigativa", resultado: "Docentes formados", actividades: "Talleres, seminarios" }]);
  const [indicadoresFR, setIndicadoresFR] = useState([{ actividad: "Capacitación", indicador: "N° docentes capacitados", meta: "80", avance: "0", tiempo: "6 meses", responsable: "Dra. Carmen", estado: "Pendiente" }]);
  const [ingresos, setIngresos] = useState([{ tipo: "Recursos propios", concepto: "Aporte institucional", valor: "100000000" }]);
  const [gastos, setGastos] = useState([{ cat: "Personal", concepto: "Investigadores", unidad: "Mes", cant: "12", valorUnit: "5000000", valorTotal: "60000000" }]);
  const [aprobaciones, setAprobaciones] = useState([{ rol: "Director de Investigación", nombre: "Dr. Rafael Gómez", fecha: "", estado: "Pendiente" }]);
  const [fr019Expanded, setFr019Expanded] = useState<string[]>(["Sec 05: Objetivos específicos"]);
  const [odsSelected, setOdsSelected] = useState<number[]>([4, 10, 17]);

  const toggleFR = (s: string) => setFr019Expanded(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  const toggleODS = (n: number) => setOdsSelected(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n]);

  // Step 4 Seguimiento
  const [avanceTecnico, setAvanceTecnico] = useState(0);
  const [avanceDesc, setAvanceDesc] = useState("");

  // Step 5 checklist
  const checklistItems = [
    { label: "Información general", status: form.nombre && form.codigo ? "ok" : "warn" as "ok" | "warn" | "err" },
    { label: "Ficha FR-019", status: "warn" as const },
    { label: "Antecedentes", status: "ok" as const },
    { label: "Presupuesto", status: ingresos.length > 0 ? "ok" : "warn" as "ok" | "warn" | "err" },
    { label: "Actividades", status: "warn" as const },
    { label: "Gantt", status: "warn" as const },
    { label: "Indicadores", status: indicadoresFR.length > 0 ? "ok" : "warn" as "ok" | "warn" | "err" },
  ];

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!form.codigo) e.codigo = "El código es obligatorio";
    if (!form.nombre) e.nombre = "El nombre es obligatorio";
    if (!form.linea) e.linea = "La línea de investigación es obligatoria";
    if (!form.estado) e.estado = "El estado es obligatorio";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    setStep(s => s + 1);
  };

  const handleSave = () => {
    setShowSuccess(true);
  };

  const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-gray-50/50";
  const labelCls = "block text-xs font-semibold text-gray-700 mb-1.5";

  const fr019Sections = [
    "Sec 05: Objetivos específicos",
    "Sec 06: Enfoque",
    "Sec 07: Problema",
    "Sec 08: Justificación",
    "Sec 09: Sostenibilidad y ODS",
    "Sec 10: Riesgos",
    "Sec 11: Cobertura geográfica",
    "Sec 11: Población participante",
    "Sec 12: Enfoques diferenciales",
    "Sec 13: Grupos de interés",
    "Sec 14–15: Componentes de metodología",
    "Sec 16: Indicadores",
    "Sec 17.1: Ingresos",
    "Sec 17.2: Gastos",
    "Aprobaciones",
  ];

  const antecedentes = [
    { id: "PRY-2024-008", name: "Sistema de riego inteligente v1.0", line: "Tecnología e Innovación", tipo: "Proyecto", year: 2024, nivel: "Avanzado" },
    { id: "PRY-2023-015", name: "Competencias docentes digitales", line: "Educación y Pedagogía", tipo: "Proyecto", year: 2023, nivel: "Intermedio" },
    { id: "PRY-2022-007", name: "Biodiversidad y ecosistemas", line: "Medio Ambiente", tipo: "Estudio", year: 2022, nivel: "Básico" },
  ];

  if (showSuccess) {
    return (
      <ProjectCreatedModal
        onGoToProject={() => { setShowSuccess(false); onSave(); }}
        onGoToDashboard={() => { setShowSuccess(false); onBack(); }}
      />
    );
  }

  return (
    <div className="max-w-4xl space-y-5">
      {assocModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-4">Asociar antecedente</h3>
            <div className="space-y-3 mb-5">
              <div className="flex gap-3 text-sm">
                <span className="text-gray-400 w-24 flex-shrink-0">Proyecto:</span>
                <span className="font-mono font-bold text-orange-700">{form.codigo || "PRY-2026-009"}</span>
              </div>
              <div className="flex gap-3 text-sm">
                <span className="text-gray-400 w-24 flex-shrink-0">Antecedente:</span>
                <span className="font-mono font-bold text-orange-700">{assocModal}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setAssocModal(null)} className="flex-1 py-2 text-sm font-semibold border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={() => { setAssocModal(null); }} className="flex-1 py-2 text-sm font-semibold bg-[#C2410C] text-white rounded-lg hover:bg-[#9A3412] transition-colors">Asociar</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nuevo proyecto</h1>
          <Crumb items={[{ label: "Proyectos", onClick: onBack }, { label: "Nuevo proyecto" }]} />
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
        <div className="flex items-center">
          {WIZARD_STEPS.map((s, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <button onClick={() => i + 1 < step && setStep(i + 1)} className="flex flex-col items-center gap-1 group">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${i + 1 < step ? "bg-green-500 text-white" : i + 1 === step ? "bg-[#C2410C] text-white ring-4 ring-orange-100" : "bg-gray-100 text-gray-400"}`}>
                  {i + 1 < step ? <Check className="w-4 h-4" /> : i + 1}
                </span>
                <span className={`text-[10px] font-semibold hidden sm:block whitespace-nowrap ${i + 1 === step ? "text-[#C2410C]" : i + 1 < step ? "text-green-600" : "text-gray-400"}`}>{s}</span>
              </button>
              {i < WIZARD_STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${i + 1 < step ? "bg-green-400" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form content */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">

        {/* ── STEP 1: Información general ── */}
        {step === 1 && (
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-1">Información general</h2>
            <p className="text-xs text-gray-400 mb-5">Complete los campos para crear el proyecto. Los campos marcados con * son obligatorios.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Código del proyecto *</label>
                <input type="text" placeholder="PRY-2026-000" value={form.codigo} onChange={e => upd("codigo", e.target.value)} className={`${inputCls} font-mono ${errors.codigo ? "border-red-400" : ""}`} />
                {errors.codigo && <p className="text-xs text-red-500 mt-1">{errors.codigo}</p>}
              </div>
              <div>
                <label className={labelCls}>Nombre del proyecto *</label>
                <input type="text" placeholder="Nombre completo..." value={form.nombre} onChange={e => upd("nombre", e.target.value)} className={`${inputCls} ${errors.nombre ? "border-red-400" : ""}`} />
                {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre}</p>}
              </div>
              <div>
                <label className={labelCls}>Línea de investigación *</label>
                <select value={form.linea} onChange={e => upd("linea", e.target.value)} className={`${inputCls} ${errors.linea ? "border-red-400" : ""}`}>
                  <option value="">Seleccionar…</option>
                  {RESEARCH_LINES.map(l => <option key={l.line}>{l.line}</option>)}
                </select>
                {errors.linea && <p className="text-xs text-red-500 mt-1">{errors.linea}</p>}
              </div>
              <div>
                <label className={labelCls}>Estado *</label>
                <select value={form.estado} onChange={e => upd("estado", e.target.value)} className={`${inputCls} ${errors.estado ? "border-red-400" : ""}`}>
                  {(Object.keys(STATUS_CFG) as ProjectStatus[]).map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Dependencia proponente</label>
                <input type="text" placeholder="Facultad o unidad..." value={form.dependencia} onChange={e => upd("dependencia", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Responsable</label>
                <input type="text" placeholder="Nombre del investigador" value={form.responsable} onChange={e => upd("responsable", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Gestión PMO</label>
                <input type="text" placeholder="Nombre del gestor PMO" value={form.gestionPMO} onChange={e => upd("gestionPMO", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Fecha de gestión</label>
                <input type="date" value={form.fecha} onChange={e => upd("fecha", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Valor total del proyecto</label>
                <input type="text" placeholder="$0" value={form.valorTotal} onChange={e => upd("valorTotal", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Valor de supervisión</label>
                <input type="text" placeholder="$0" value={form.valorSupervision} onChange={e => upd("valorSupervision", e.target.value)} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Objetivo general *</label>
                <textarea rows={3} placeholder="Describe el propósito principal del proyecto..." value={form.objetivo} onChange={e => upd("objetivo", e.target.value)}
                  className={`${inputCls} resize-none`} />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Ficha técnica FR-019 ── */}
        {step === 2 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-base font-bold text-gray-900">Ficha Técnica FR-019</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-xs font-bold text-orange-700">{form.codigo || "PRY-2026-009"}</span>
                  <span className="text-xs text-gray-400">{form.nombre ? form.nombre.slice(0, 30) + "..." : "Sistema de fortalecimiento..."}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium justify-end">
                  <Save className="w-3 h-3" />
                  Guardado automáticamente hace 20 segundos
                </div>
                <div className="mt-1">
                  <span className="text-xs text-gray-500 font-medium">Diligenciamiento </span>
                  <span className="text-xs font-bold text-orange-700">75%</span>
                </div>
                <div className="w-32 bg-gray-100 rounded-full h-1.5 mt-1 ml-auto">
                  <div className="h-1.5 rounded-full bg-orange-500" style={{ width: "75%" }} />
                </div>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              {fr019Sections.map(sec => (
                <div key={sec} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button onClick={() => toggleFR(sec)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/70 hover:bg-gray-100 transition-colors text-left">
                    <span className="text-sm font-semibold text-gray-800">{sec}</span>
                    {fr019Expanded.includes(sec) ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  </button>
                  {fr019Expanded.includes(sec) && (
                    <div className="px-4 py-4">

                      {sec === "Sec 05: Objetivos específicos" && (
                        <div className="space-y-3">
                          {objetivos.map((o, i) => (
                            <div key={i} className="flex gap-3 items-start bg-gray-50 rounded-lg p-3">
                              <div className="flex-1">
                                <input type="text" placeholder="Descripción del objetivo..." value={o.desc} onChange={e => setObjetivos(prev => prev.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} className={inputCls} />
                              </div>
                              <div className="w-20">
                                <input type="number" placeholder="Orden" value={o.orden} onChange={e => setObjetivos(prev => prev.map((x, j) => j === i ? { ...x, orden: +e.target.value } : x))} className={inputCls} />
                              </div>
                              <button onClick={() => setObjetivos(prev => prev.filter((_, j) => j !== i))} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          <button onClick={() => setObjetivos(prev => [...prev, { desc: "", orden: prev.length + 1 }])} className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-800 transition-colors">
                            <Plus className="w-3.5 h-3.5" />Agregar objetivo
                          </button>
                        </div>
                      )}

                      {(sec === "Sec 06: Enfoque" || sec === "Sec 07: Problema" || sec === "Sec 08: Justificación") && (
                        <textarea rows={4} placeholder={`${sec.replace(/Sec \d+: /, "")} del proyecto...`} className={`${inputCls} resize-none`} />
                      )}

                      {sec === "Sec 09: Sostenibilidad y ODS" && (
                        <div className="space-y-4">
                          <textarea rows={3} placeholder="Sostenibilidad del proyecto..." className={`${inputCls} resize-none`} />
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-2">Objetivos de Desarrollo Sostenible</p>
                            <div className="flex flex-wrap gap-2">
                              {Array.from({ length: 17 }, (_, i) => i + 1).map(n => (
                                <button key={n} onClick={() => toggleODS(n)}
                                  className={`w-10 h-10 rounded-lg text-xs font-bold border transition-colors ${odsSelected.includes(n) ? "bg-[#C2410C] text-white border-[#C2410C]" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}>
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {sec === "Sec 10: Riesgos" && (
                        <div className="space-y-3">
                          <div className="overflow-x-auto rounded-lg border border-gray-100">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                  {["Riesgo", "Probabilidad", "Consecuencia", "Plan de mitigación", ""].map(h => (
                                    <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {riesgos.map((r, i) => (
                                  <tr key={i}>
                                    <td className="px-2 py-2"><input value={r.riesgo} onChange={e => setRiesgos(p => p.map((x, j) => j === i ? { ...x, riesgo: e.target.value } : x))} className="w-full px-2 py-1 text-xs border border-gray-200 rounded" /></td>
                                    <td className="px-2 py-2">
                                      <select value={r.prob} onChange={e => setRiesgos(p => p.map((x, j) => j === i ? { ...x, prob: e.target.value } : x))} className="w-20 px-2 py-1 text-xs border border-gray-200 rounded">
                                        {["Alta","Media","Baja"].map(v => <option key={v}>{v}</option>)}
                                      </select>
                                    </td>
                                    <td className="px-2 py-2">
                                      <select value={r.cons} onChange={e => setRiesgos(p => p.map((x, j) => j === i ? { ...x, cons: e.target.value } : x))} className="w-20 px-2 py-1 text-xs border border-gray-200 rounded">
                                        {["Alta","Media","Baja"].map(v => <option key={v}>{v}</option>)}
                                      </select>
                                    </td>
                                    <td className="px-2 py-2"><input value={r.plan} onChange={e => setRiesgos(p => p.map((x, j) => j === i ? { ...x, plan: e.target.value } : x))} className="w-full px-2 py-1 text-xs border border-gray-200 rounded" /></td>
                                    <td className="px-2 py-2"><button onClick={() => setRiesgos(p => p.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <button onClick={() => setRiesgos(p => [...p, { riesgo: "", prob: "Media", cons: "Media", plan: "" }])} className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-800">
                            <Plus className="w-3.5 h-3.5" />Agregar riesgo
                          </button>
                        </div>
                      )}

                      {sec === "Sec 11: Cobertura geográfica" && (
                        <div className="space-y-3">
                          {coberturas.map((c, i) => (
                            <div key={i} className="flex gap-3 items-center">
                              <input placeholder="País" value={c.pais} onChange={e => setCoberturas(p => p.map((x, j) => j === i ? { ...x, pais: e.target.value } : x))} className={`${inputCls} flex-1`} />
                              <input placeholder="Departamento" value={c.depto} onChange={e => setCoberturas(p => p.map((x, j) => j === i ? { ...x, depto: e.target.value } : x))} className={`${inputCls} flex-1`} />
                              <input placeholder="Municipio" value={c.municipio} onChange={e => setCoberturas(p => p.map((x, j) => j === i ? { ...x, municipio: e.target.value } : x))} className={`${inputCls} flex-1`} />
                              <button onClick={() => setCoberturas(p => p.filter((_, j) => j !== i))} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          ))}
                          <button onClick={() => setCoberturas(p => [...p, { pais: "Colombia", depto: "", municipio: "" }])} className="flex items-center gap-1.5 text-xs font-semibold text-orange-600">
                            <Plus className="w-3.5 h-3.5" />Agregar cobertura
                          </button>
                        </div>
                      )}

                      {sec === "Sec 11: Población participante" && (
                        <div className="space-y-3">
                          <div className="overflow-x-auto rounded-lg border border-gray-100">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                  {["Categoría", "Cantidad", ""].map(h => <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">{h}</th>)}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {poblacion.map((p, i) => (
                                  <tr key={i}>
                                    <td className="px-2 py-2"><input value={p.cat} onChange={e => setPoblacion(prev => prev.map((x, j) => j === i ? { ...x, cat: e.target.value } : x))} className="w-full px-2 py-1 text-xs border border-gray-200 rounded" /></td>
                                    <td className="px-2 py-2"><input value={p.cant} onChange={e => setPoblacion(prev => prev.map((x, j) => j === i ? { ...x, cant: e.target.value } : x))} className="w-24 px-2 py-1 text-xs border border-gray-200 rounded" /></td>
                                    <td className="px-2 py-2"><button onClick={() => setPoblacion(prev => prev.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <button onClick={() => setPoblacion(p => [...p, { cat: "", cant: "" }])} className="flex items-center gap-1.5 text-xs font-semibold text-orange-600">
                            <Plus className="w-3.5 h-3.5" />Agregar categoría
                          </button>
                        </div>
                      )}

                      {sec === "Sec 12: Enfoques diferenciales" && (
                        <div className="space-y-3">
                          {enfoques.map((e, i) => (
                            <div key={i} className="flex gap-3 items-start bg-gray-50 rounded-lg p-3">
                              <select value={e.tipo} onChange={ev => setEnfoques(p => p.map((x, j) => j === i ? { ...x, tipo: ev.target.value } : x))} className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white w-28">
                                {["Etario", "Género", "Étnico", "Inclusión", "Ambiental"].map(t => <option key={t}>{t}</option>)}
                              </select>
                              <input placeholder="Descripción..." value={e.desc} onChange={ev => setEnfoques(p => p.map((x, j) => j === i ? { ...x, desc: ev.target.value } : x))} className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg" />
                              <button onClick={() => setEnfoques(p => p.filter((_, j) => j !== i))} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          ))}
                          <button onClick={() => setEnfoques(p => [...p, { tipo: "Género", desc: "" }])} className="flex items-center gap-1.5 text-xs font-semibold text-orange-600">
                            <Plus className="w-3.5 h-3.5" />Agregar enfoque
                          </button>
                        </div>
                      )}

                      {sec === "Sec 13: Grupos de interés" && (
                        <div className="space-y-3">
                          {grupos.map((g, i) => (
                            <div key={i} className="flex gap-3 items-start bg-gray-50 rounded-lg p-3">
                              <select value={g.tipo} onChange={e => setGrupos(p => p.map((x, j) => j === i ? { ...x, tipo: e.target.value } : x))} className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white w-24">
                                {["Directo", "Indirecto"].map(t => <option key={t}>{t}</option>)}
                              </select>
                              <input placeholder="Descripción del grupo..." value={g.desc} onChange={e => setGrupos(p => p.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg" />
                              <button onClick={() => setGrupos(p => p.filter((_, j) => j !== i))} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          ))}
                          <button onClick={() => setGrupos(p => [...p, { tipo: "Directo", desc: "" }])} className="flex items-center gap-1.5 text-xs font-semibold text-orange-600">
                            <Plus className="w-3.5 h-3.5" />Agregar grupo
                          </button>
                        </div>
                      )}

                      {sec === "Sec 14–15: Componentes de metodología" && (
                        <div className="space-y-4">
                          {componentes.map((c, i) => (
                            <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-600">Componente {i + 1}</span>
                                <button onClick={() => setComponentes(p => p.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                              <input placeholder="Nombre del componente" value={c.nombre} onChange={e => setComponentes(p => p.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))} className={inputCls} />
                              <textarea placeholder="Descripción" rows={2} value={c.desc} onChange={e => setComponentes(p => p.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} className={`${inputCls} resize-none`} />
                              <input placeholder="Resultado esperado" value={c.resultado} onChange={e => setComponentes(p => p.map((x, j) => j === i ? { ...x, resultado: e.target.value } : x))} className={inputCls} />
                              <textarea placeholder="Actividades del componente" rows={2} value={c.actividades} onChange={e => setComponentes(p => p.map((x, j) => j === i ? { ...x, actividades: e.target.value } : x))} className={`${inputCls} resize-none`} />
                            </div>
                          ))}
                          <button onClick={() => setComponentes(p => [...p, { nombre: "", desc: "", resultado: "", actividades: "" }])} className="flex items-center gap-1.5 text-xs font-semibold text-orange-600">
                            <Plus className="w-3.5 h-3.5" />Agregar componente
                          </button>
                        </div>
                      )}

                      {sec === "Sec 16: Indicadores" && (
                        <div className="space-y-3">
                          <div className="overflow-x-auto rounded-lg border border-gray-100">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                  {["Actividad", "Indicador", "Meta", "Resultado/Avance", "Tiempo", "Responsable", "Estado", ""].map(h => (
                                    <th key={h} className="px-2 py-2 text-left font-bold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {indicadoresFR.map((ind, i) => (
                                  <tr key={i}>
                                    {["actividad","indicador","meta","avance","tiempo","responsable"].map(k => (
                                      <td key={k} className="px-2 py-1.5">
                                        <input value={(ind as Record<string, string>)[k]} onChange={e => setIndicadoresFR(p => p.map((x, j) => j === i ? { ...x, [k]: e.target.value } : x))} className="w-full min-w-[80px] px-2 py-1 border border-gray-200 rounded" />
                                      </td>
                                    ))}
                                    <td className="px-2 py-1.5">
                                      <select value={ind.estado} onChange={e => setIndicadoresFR(p => p.map((x, j) => j === i ? { ...x, estado: e.target.value } : x))} className="px-2 py-1 border border-gray-200 rounded text-xs">
                                        {["Pendiente","En curso","Cumplido","No cumplido"].map(v => <option key={v}>{v}</option>)}
                                      </select>
                                    </td>
                                    <td className="px-2 py-1.5"><button onClick={() => setIndicadoresFR(p => p.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <button onClick={() => setIndicadoresFR(p => [...p, { actividad: "", indicador: "", meta: "", avance: "", tiempo: "", responsable: "", estado: "Pendiente" }])} className="flex items-center gap-1.5 text-xs font-semibold text-orange-600">
                            <Plus className="w-3.5 h-3.5" />Agregar indicador
                          </button>
                        </div>
                      )}

                      {sec === "Sec 17.1: Ingresos" && (
                        <div className="space-y-3">
                          <div className="overflow-x-auto rounded-lg border border-gray-100">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                  {["Tipo", "Concepto", "Valor total", ""].map(h => <th key={h} className="px-3 py-2 text-left font-bold text-gray-500 uppercase">{h}</th>)}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {ingresos.map((ing, i) => (
                                  <tr key={i}>
                                    <td className="px-2 py-1.5">
                                      <select value={ing.tipo} onChange={e => setIngresos(p => p.map((x, j) => j === i ? { ...x, tipo: e.target.value } : x))} className="px-2 py-1 border border-gray-200 rounded text-xs">
                                        {["Recursos propios","Aportes de terceros"].map(v => <option key={v}>{v}</option>)}
                                      </select>
                                    </td>
                                    <td className="px-2 py-1.5"><input value={ing.concepto} onChange={e => setIngresos(p => p.map((x, j) => j === i ? { ...x, concepto: e.target.value } : x))} className="w-full px-2 py-1 border border-gray-200 rounded" /></td>
                                    <td className="px-2 py-1.5"><input value={ing.valor} onChange={e => setIngresos(p => p.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))} className="w-32 px-2 py-1 border border-gray-200 rounded" /></td>
                                    <td className="px-2 py-1.5"><button onClick={() => setIngresos(p => p.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <button onClick={() => setIngresos(p => [...p, { tipo: "Recursos propios", concepto: "", valor: "" }])} className="flex items-center gap-1.5 text-xs font-semibold text-orange-600">
                            <Plus className="w-3.5 h-3.5" />Agregar ingreso
                          </button>
                        </div>
                      )}

                      {sec === "Sec 17.2: Gastos" && (
                        <div className="space-y-3">
                          <div className="overflow-x-auto rounded-lg border border-gray-100">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                  {["Categoría", "Concepto", "Unidad", "Cantidad", "Valor unit.", "Valor total", ""].map(h => (
                                    <th key={h} className="px-2 py-2 text-left font-bold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {gastos.map((g, i) => (
                                  <tr key={i}>
                                    <td className="px-2 py-1.5"><input value={g.cat} onChange={e => setGastos(p => p.map((x, j) => j === i ? { ...x, cat: e.target.value } : x))} className="w-24 px-2 py-1 border border-gray-200 rounded" /></td>
                                    <td className="px-2 py-1.5"><input value={g.concepto} onChange={e => setGastos(p => p.map((x, j) => j === i ? { ...x, concepto: e.target.value } : x))} className="w-28 px-2 py-1 border border-gray-200 rounded" /></td>
                                    <td className="px-2 py-1.5"><input value={g.unidad} onChange={e => setGastos(p => p.map((x, j) => j === i ? { ...x, unidad: e.target.value } : x))} className="w-16 px-2 py-1 border border-gray-200 rounded" /></td>
                                    <td className="px-2 py-1.5"><input value={g.cant} onChange={e => setGastos(p => p.map((x, j) => j === i ? { ...x, cant: e.target.value } : x))} className="w-14 px-2 py-1 border border-gray-200 rounded" /></td>
                                    <td className="px-2 py-1.5"><input value={g.valorUnit} onChange={e => setGastos(p => p.map((x, j) => j === i ? { ...x, valorUnit: e.target.value } : x))} className="w-24 px-2 py-1 border border-gray-200 rounded" /></td>
                                    <td className="px-2 py-1.5"><span className="font-semibold text-orange-700">{fmt(+(g.cant || 0) * +(g.valorUnit || 0))}</span></td>
                                    <td className="px-2 py-1.5"><button onClick={() => setGastos(p => p.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <button onClick={() => setGastos(p => [...p, { cat: "", concepto: "", unidad: "", cant: "", valorUnit: "", valorTotal: "" }])} className="flex items-center gap-1.5 text-xs font-semibold text-orange-600">
                            <Plus className="w-3.5 h-3.5" />Agregar gasto
                          </button>
                        </div>
                      )}

                      {sec === "Aprobaciones" && (
                        <div className="space-y-3">
                          <div className="overflow-x-auto rounded-lg border border-gray-100">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                  {["Rol aprobador", "Nombre", "Fecha", "Estado", ""].map(h => <th key={h} className="px-3 py-2 text-left font-bold text-gray-500 uppercase">{h}</th>)}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {aprobaciones.map((a, i) => (
                                  <tr key={i}>
                                    <td className="px-2 py-1.5"><input value={a.rol} onChange={e => setAprobaciones(p => p.map((x, j) => j === i ? { ...x, rol: e.target.value } : x))} className="w-full px-2 py-1 border border-gray-200 rounded" /></td>
                                    <td className="px-2 py-1.5"><input value={a.nombre} onChange={e => setAprobaciones(p => p.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))} className="w-full px-2 py-1 border border-gray-200 rounded" /></td>
                                    <td className="px-2 py-1.5"><input type="date" value={a.fecha} onChange={e => setAprobaciones(p => p.map((x, j) => j === i ? { ...x, fecha: e.target.value } : x))} className="px-2 py-1 border border-gray-200 rounded" /></td>
                                    <td className="px-2 py-1.5">
                                      <select value={a.estado} onChange={e => setAprobaciones(p => p.map((x, j) => j === i ? { ...x, estado: e.target.value } : x))} className="px-2 py-1 border border-gray-200 rounded text-xs">
                                        {["Pendiente","Firmado","Rechazado"].map(v => <option key={v}>{v}</option>)}
                                      </select>
                                    </td>
                                    <td className="px-2 py-1.5"><button onClick={() => setAprobaciones(p => p.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <button onClick={() => setAprobaciones(p => [...p, { rol: "", nombre: "", fecha: "", estado: "Pendiente" }])} className="flex items-center gap-1.5 text-xs font-semibold text-orange-600">
                            <Plus className="w-3.5 h-3.5" />Agregar aprobador
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100">
              <button className="px-4 py-2 text-xs font-semibold border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Guardar sección</button>
              <button className="px-4 py-2 text-xs font-semibold border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Guardar borrador</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Antecedentes ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-900 mb-1">Antecedentes del proyecto</h2>
              <p className="text-xs text-gray-400">Buscar y asociar antecedentes existentes.</p>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Buscar por código, línea o palabra clave…" className={`${inputCls} pl-9`} />
                </div>
                {["Línea de investigación", "Año", "Tipo de documento", "Nivel de estructuración"].map(f => (
                  <button key={f} className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100">
                    {f} <ChevronDown className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/40 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">Resultados</h3>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-orange-200 text-orange-700 rounded-lg hover:bg-orange-50">
                  <Upload className="w-3.5 h-3.5" />Cargar nuevo antecedente
                </button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60 border-b border-gray-100">
                    {["Código", "Nombre", "Línea", "Tipo", "Año", "Nivel", "Acciones"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {antecedentes.map(ant => (
                    <tr key={ant.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3"><span className="font-mono text-xs font-bold text-orange-700">{ant.id}</span></td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{ant.name}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{ant.line}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{ant.tipo}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{ant.year}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 text-xs font-semibold rounded bg-orange-50 text-orange-700">{ant.nivel}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button className="p-1.5 text-gray-300 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setAssocModal(ant.id)} className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
                            <Link2 className="w-3 h-3" />Asociar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── STEP 4: Seguimiento ── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-bold text-gray-900 mb-1">Seguimiento del proyecto</h2>
              <p className="text-xs text-gray-400">Registre el avance inicial del proyecto.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Avance técnico", value: "0%", color: "text-orange-700", bg: "bg-orange-50", icon: Activity },
                { label: "Avance presupuestal", value: "0%", color: "text-emerald-700", bg: "bg-emerald-50", icon: DollarSign },
                { label: "Indicadores", value: "0%", color: "text-slate-700", bg: "bg-slate-50", icon: Percent },
                { label: "Actividades", value: "0", color: "text-orange-700", bg: "bg-orange-50", icon: CheckCircle },
                { label: "Entregables", value: "0", color: "text-gray-700", bg: "bg-gray-50", icon: FileText },
                { label: "Alertas", value: "0", color: "text-red-700", bg: "bg-red-50", icon: AlertTriangle },
              ].map(k => (
                <div key={k.label} className={`${k.bg} rounded-xl p-3 flex items-center gap-3`}>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{k.label}</p>
                    <p className={`text-2xl font-black mt-0.5 ${k.color}`}>{k.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-gray-100 p-5 bg-white space-y-4">
              <h3 className="text-sm font-bold text-gray-800">Avance técnico</h3>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls + " mb-0"}>Porcentaje de avance</label>
                  <span className="text-lg font-black text-orange-700">{avanceTecnico}%</span>
                </div>
                <input type="range" min={0} max={100} value={avanceTecnico} onChange={e => setAvanceTecnico(+e.target.value)}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600" />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1"><span>0%</span><span>50%</span><span>100%</span></div>
                <Bar2 value={avanceTecnico} color="bg-orange-500" h="h-2" />
              </div>
              <div>
                <label className={labelCls}>Descripción del avance técnico</label>
                <textarea rows={3} placeholder="Describe el estado actual del proyecto..." value={avanceDesc} onChange={e => setAvanceDesc(e.target.value)} className={`${inputCls} resize-none`} />
              </div>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#C2410C] text-white rounded-lg hover:bg-[#9A3412] transition-colors">
                  <Sliders className="w-3.5 h-3.5" />Actualizar avance
                </button>
                <span className="text-xs text-gray-400">Última actualización: —</span>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 5: Revisión ── */}
        {step === 5 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-bold text-gray-900 mb-1">Revisión del proyecto</h2>
              <p className="text-xs text-gray-400">Verifique la información antes de guardar el proyecto.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <h3 className="text-sm font-bold text-gray-800 mb-3">Lista de verificación</h3>
                <div className="space-y-2">
                  {checklistItems.map(item => (
                    <div key={item.label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${item.status === "ok" ? "bg-green-50 border-green-100" : item.status === "warn" ? "bg-amber-50 border-amber-100" : "bg-red-50 border-red-100"}`}>
                      {item.status === "ok"
                        ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        : item.status === "warn"
                        ? <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        : <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                      }
                      <span className={`text-sm font-semibold ${item.status === "ok" ? "text-green-800" : item.status === "warn" ? "text-amber-800" : "text-red-800"}`}>{item.label}</span>
                      <span className={`ml-auto text-xs font-bold ${item.status === "ok" ? "text-green-600" : item.status === "warn" ? "text-amber-600" : "text-red-600"}`}>
                        {item.status === "ok" ? "Completo" : item.status === "warn" ? "Pendiente" : "Error"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-800 mb-3">Resumen del proyecto</h3>
                <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
                  {[
                    { label: "Código", value: form.codigo || "PRY-2026-009" },
                    { label: "Nombre", value: form.nombre || "Sin definir" },
                    { label: "Línea", value: form.linea || "Sin definir" },
                    { label: "Responsable", value: form.responsable || "Sin definir" },
                    { label: "Estado", value: form.estado },
                    { label: "Avance", value: `${avanceTecnico}%` },
                    { label: "Presupuesto", value: form.valorTotal ? `$${form.valorTotal}` : "Sin definir" },
                  ].map(item => (
                    <div key={item.label} className="flex gap-4 px-4 py-2.5">
                      <span className="w-28 text-xs font-semibold text-gray-400 flex-shrink-0">{item.label}</span>
                      <span className="text-sm text-gray-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button className="px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors bg-white">
          Guardar borrador
        </button>
        <div className="flex gap-2">
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)} className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors bg-white">
              Anterior
            </button>
          )}
          {step > 1 && step < 5 && (
            <button onClick={() => setStep(s => s - 1)} className="sr-only">Anterior</button>
          )}
          {step === 1 && (
            <button onClick={onBack} className="px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 bg-white">
              Cancelar
            </button>
          )}
          {step < 5
            ? <button onClick={handleNext} className="px-5 py-2 text-sm font-semibold bg-[#C2410C] text-white rounded-lg hover:bg-[#9A3412] transition-colors shadow-sm">Continuar</button>
            : <button onClick={handleSave} className="px-5 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm">Guardar proyecto</button>
          }
        </div>
      </div>
    </div>
  );
}
