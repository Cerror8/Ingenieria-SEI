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
import { PROJECTS } from "../../../data/mock";
import { fmt } from "../../../lib/format";
import { StatusBadge, Bar2 } from "../../../components/shared";

export function ProjectsListView({ onSelectProject, onCreateProject }: {
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");

  const filtered = PROJECTS.filter(p => {
    const ms = p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase());
    const mf = statusFilter === "Todos" || p.status === statusFilter;
    return ms && mf;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestión de Proyectos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{PROJECTS.length} proyectos registrados</p>
        </div>
        <button onClick={onCreateProject} className="inline-flex items-center gap-2 px-4 py-2 bg-[#1B3C6B] text-white text-sm font-semibold rounded-lg hover:bg-[#152f54] transition-colors shadow-sm">
          <Plus className="w-4 h-4" />Nuevo proyecto
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Buscar por código o nombre..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-gray-50" />
          </div>
          {(["Todos", "En ejecución", "En formulación", "Suspendido", "Finalizado"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${statusFilter === s ? "bg-[#1B3C6B] text-white border-[#1B3C6B]" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}>
              {s}
            </button>
          ))}
          <button className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100">
            <Filter className="w-3 h-3" /> Más filtros
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {["Código", "Proyecto", "Línea", "Responsable", "Estado", "Avance", "Presupuesto", "Finaliza", "Acciones"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50/80">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-blue-50/10 transition-colors">
                  <td className="px-4 py-3"><span className="font-mono text-xs font-bold text-blue-700">{p.id}</span></td>
                  <td className="px-4 py-3"><p className="font-semibold text-gray-900 max-w-[200px] truncate text-sm">{p.name}</p></td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{p.line.split(" ").slice(0, 2).join(" ")}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{p.responsible}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <Bar2 value={p.progress} color="bg-blue-500" h="h-1.5" />
                      <span className="text-xs font-bold text-gray-700 flex-shrink-0">{p.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{fmt(p.budget)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{p.endDate}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => onSelectProject(p.id)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Ver"><Eye className="w-3.5 h-3.5" /></button>
                      <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editar"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Dashboard"><BarChart2 className="w-3.5 h-3.5" /></button>
                      <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"><MoreHorizontal className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/40">
          <span className="text-xs text-gray-400">Mostrando {filtered.length} de {PROJECTS.length} proyectos</span>
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-100 transition-colors"><ChevronLeft className="w-3.5 h-3.5" /></button>
            <button className="w-7 h-7 rounded-lg text-xs font-bold bg-[#1B3C6B] text-white">1</button>
            <button className="w-7 h-7 rounded-lg text-xs text-gray-600 hover:bg-gray-100">2</button>
            <button className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-100 transition-colors"><ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
