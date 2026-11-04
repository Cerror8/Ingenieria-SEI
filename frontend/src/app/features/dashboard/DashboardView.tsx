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
import { PROJECTS, INDICATORS } from "../../data/mock";
import { STATUS_DONUT, PROGRESS_BARS, BUDGET_TIMELINE, RESEARCH_LINES } from "../../data/charts";
import { StatusBadge, IndBadge, Bar2, KpiCard } from "../../components/shared";

export function DashboardView({ onProjectSelect, onGenerateReport }: {
  onProjectSelect: (id: string) => void;
  onGenerateReport: () => void;
}) {
  const [activeSeg, setActiveSeg] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard de Gestión de Proyectos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Período activo: Enero – Agosto 2026</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onGenerateReport} className="inline-flex items-center gap-2 px-4 py-2 bg-[#1B3C6B] text-white text-sm font-semibold rounded-lg hover:bg-[#152f54] transition-colors shadow-sm">
            <FileText className="w-4 h-4" />Generar informe
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />Descargar PDF
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
        <Filter className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        {["Año 2026", "Línea de investigación", "Estado", "Responsable", "Período del informe"].map(f => (
          <button key={f} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
            {f} <ChevronDown className="w-3 h-3" />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard title="Total Proyectos"   value="47"   icon={Briefcase}       color="text-[#1B3C6B]"    bg="bg-blue-50"   />
        <KpiCard title="Activos"           value="19"   icon={Activity}        color="text-blue-600"     bg="bg-blue-50"   trend="up"   trendLabel="+8% vs mes ant." />
        <KpiCard title="Finalizados"       value="17"   icon={CheckCircle}     color="text-green-600"    bg="bg-green-50"  trend="up"   trendLabel="+2 este mes" />
        <KpiCard title="Retrasados"        value="5"    icon={AlertTriangle}   color="text-red-600"      bg="bg-red-50"    trend="down" trendLabel="-3% vs mes ant." />
        <KpiCard title="Avance Prom."      value="58%"  icon={Percent}         color="text-indigo-600"   bg="bg-indigo-50" />
        <KpiCard title="Ejec. Presup."     value="63%"  icon={DollarSign}      color="text-emerald-600"  bg="bg-emerald-50" trend="up" trendLabel="+5% vs mes ant." />
        <KpiCard title="Líneas Activas"    value="6"    icon={Tag}             color="text-purple-600"   bg="bg-purple-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Proyectos por estado</h3>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <PieChart width={170} height={170}>
                <Pie key="pie" data={STATUS_DONUT} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={2} dataKey="value" onClick={d => setActiveSeg(d.name === activeSeg ? null : d.name)}>
                  {STATUS_DONUT.map((e, i) => (
                    <Cell key={`donut-${i}`} fill={e.color} opacity={activeSeg && activeSeg !== e.name ? 0.35 : 1} cursor="pointer" />
                  ))}
                </Pie>
                <Tooltip key="tooltip" formatter={(v: number, n: string) => [v, n]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
              </PieChart>
            </div>
            <div className="flex-1 space-y-2">
              {STATUS_DONUT.map(d => (
                <div key={d.name} className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded px-2 py-1 transition-colors" onClick={() => setActiveSeg(d.name === activeSeg ? null : d.name)}>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-xs text-gray-600">{d.name}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-800">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Avance de proyectos activos</h3>
          <div className="space-y-3.5">
            {PROGRESS_BARS.map(d => (
              <div key={d.name}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-gray-600 truncate max-w-[160px]">{d.name}</span>
                  <span className="text-xs font-bold text-gray-800 ml-2">{d.value}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="h-2 rounded-full" style={{ width: `${d.value}%`, backgroundColor: d.value >= 70 ? "#10B981" : d.value >= 40 ? "#2563EB" : "#F59E0B" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Ejecución presupuestal acumulada (%)</h3>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={BUDGET_TIMELINE} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis key="xaxis" dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis key="yaxis" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip key="tooltip" contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
              <Legend key="legend" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Area key="area-plan" type="monotone" dataKey="planificado" name="Planificado" stroke="#CBD5E1" strokeWidth={1.5} fill="none" strokeDasharray="4 2" />
              <Area key="area-exec" type="monotone" dataKey="ejecutado" name="Ejecutado" stroke="#2563EB" strokeWidth={2} fill="url(#gE)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Proyectos por línea de investigación</h3>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={RESEARCH_LINES} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid key="grid" strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis key="xaxis" type="number" tick={{ fontSize: 11 }} />
              <YAxis key="yaxis" type="category" dataKey="line" tick={{ fontSize: 10 }} width={138} />
              <Tooltip key="tooltip" contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
              <Bar key="bar" dataKey="count" name="Proyectos" fill="#1B3C6B" radius={[0, 4, 4, 0]} barSize={13} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Próximos a finalizar</h3>
          <div className="space-y-3">
            {PROJECTS.filter(p => p.status === "En ejecución").slice(0, 3).map(p => (
              <div key={p.id} onClick={() => onProjectSelect(p.id)} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-100 hover:bg-blue-50/20 transition-all cursor-pointer">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-semibold text-blue-700">{p.id}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Bar2 value={p.progress} color="bg-blue-500" h="h-1.5" />
                    <span className="text-xs font-bold text-gray-700 flex-shrink-0">{p.progress}%</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>{p.responsible}</span><span>·</span><span>{p.endDate}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 text-center px-2">
                  <span className="text-xl font-black text-blue-700">{p.daysLeft}</span>
                  <p className="text-[10px] text-gray-400 font-medium">días</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Alertas de indicadores</h3>
          <div className="space-y-2.5">
            {INDICATORS.filter(i => i.status !== "Cumplido" && i.status !== "Pendiente").map(ind => (
              <div key={ind.id} className={`p-3 rounded-lg border ${ind.status === "No cumplido" ? "border-red-100 bg-red-50/30" : "border-amber-100 bg-amber-50/30"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{ind.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{ind.projectId}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-500">Cumplimiento:</span>
                      <span className="text-xs font-bold text-gray-700">{ind.compliance}%</span>
                      <div className="flex-1">
                        <Bar2 value={ind.compliance} color={ind.status === "No cumplido" ? "bg-red-500" : "bg-amber-500"} h="h-1.5" />
                      </div>
                    </div>
                  </div>
                  <IndBadge status={ind.status} />
                </div>
              </div>
            ))}
          </div>
          <button className="mt-3 w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors py-1">
            Ver todos los indicadores →
          </button>
        </div>
      </div>
    </div>
  );
}
