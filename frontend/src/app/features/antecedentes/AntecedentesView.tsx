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

export function AntecedentesView() {
  const [expanded, setExpanded] = useState<string | null>("Tecnología e Innovación");

  const tree = [
    { line: "Tecnología e Innovación", projects: [{ id: "PRY-2024-008", name: "Sistema de riego inteligente", items: ["Antecedentes", "Ficha técnica", "Informes", "Documentos"] }, { id: "PRY-2023-011", name: "IA en educación rural", items: ["Antecedentes", "Informes"] }] },
    { line: "Educación y Pedagogía", projects: [{ id: "PRY-2023-015", name: "Competencias docentes digitales", items: ["Antecedentes", "Ficha técnica", "Informes", "Documentos"] }] },
    { line: "Medio Ambiente", projects: [{ id: "PRY-2022-007", name: "Humedales y biodiversidad", items: ["Antecedentes", "Informes"] }] },
  ];

  const docs = [
    { name: "Informe final riego", code: "PRY-2024-008", line: "Tec. e Innovación", type: "Informe", date: "15/12/2024", responsible: "Ing. Luis Herrera" },
    { name: "Ficha técnica v2.0", code: "PRY-2024-008", line: "Tec. e Innovación", type: "Ficha técnica", date: "10/01/2024", responsible: "Ing. Luis Herrera" },
    { name: "Marco teórico educación", code: "PRY-2023-015", line: "Educación", type: "Antecedente", date: "20/09/2023", responsible: "Dra. Carmen López" },
    { name: "Resultados humedales 2022", code: "PRY-2022-007", line: "Medio Ambiente", type: "Informe", date: "30/06/2022", responsible: "Dra. María Ospina" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Antecedentes de proyectos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Repositorio histórico de investigación institucional</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Buscar por código, línea o palabra clave…" className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-gray-50/50" />
          </div>
          {["Línea de investigación", "Tipo de documento", "Año", "Nivel"].map(f => (
            <button key={f} className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100">
              {f} <ChevronDown className="w-3 h-3" />
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Estructura</h3>
          <div className="space-y-1">
            {tree.map(g => (
              <div key={g.line}>
                <button onClick={() => setExpanded(expanded === g.line ? null : g.line)} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left">
                  {expanded === g.line ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                  <Tag className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs font-semibold text-gray-700">{g.line}</span>
                </button>
                {expanded === g.line && (
                  <div className="ml-5 space-y-0.5">
                    {g.projects.map(p => (
                      <div key={p.id}>
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                          <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-xs font-mono font-semibold text-gray-600">{p.id}</span>
                        </div>
                        <div className="ml-5 space-y-0.5">
                          {p.items.map(it => (
                            <div key={it} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                              <FileText className="w-3 h-3 text-gray-300" />
                              <span className="text-xs text-gray-500">{it}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/40">
            <h3 className="text-sm font-bold text-gray-800">Documentos</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/60 border-b border-gray-100">
                {["Nombre", "Código", "Línea", "Tipo", "Fecha", "Responsable", "Acciones"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {docs.map((doc, i) => (
                <tr key={i} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 text-sm font-semibold text-gray-800">{doc.name}</td>
                  <td className="px-4 py-2.5"><span className="font-mono text-xs font-bold text-blue-700">{doc.code}</span></td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{doc.line}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{doc.type}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{doc.date}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{doc.responsible}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-0.5">
                      <button className="p-1 text-gray-300 hover:text-blue-600 rounded transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                      <button className="p-1 text-gray-300 hover:text-blue-600 rounded transition-colors"><Download className="w-3.5 h-3.5" /></button>
                      <button className="p-1 text-gray-300 hover:text-green-600 rounded transition-colors"><Link2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
