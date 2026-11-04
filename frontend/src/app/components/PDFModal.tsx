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
import { PROJECTS } from "../data/mock";

export function PDFModal({ onClose, onGenerate }: { onClose: () => void; onGenerate: () => void }) {
  const [generated, setGenerated] = useState(false);
  const [sections, setSections] = useState({
    resumen: true, kpis: true, avance: true, presupuesto: true,
    indicadores: true, alertas: true, documentos: false, antecedentes: false,
  });

  const handleGen = () => { setGenerated(true); onGenerate(); };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Generar informe</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {!generated ? (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Tipo de informe</label>
                <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-gray-50/50">
                  {["Informe ejecutivo", "Informe mensual", "Informe semanal"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Proyecto</label>
                <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-gray-50/50">
                  <option>Todos los proyectos</option>
                  {PROJECTS.slice(0, 5).map(p => <option key={p.id}>{p.id}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Período desde</label>
                <input type="date" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-gray-50/50" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Período hasta</label>
                <input type="date" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-gray-50/50" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Secciones a incluir</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: "resumen", label: "Resumen ejecutivo" },
                  { key: "kpis", label: "KPIs" },
                  { key: "avance", label: "Avance técnico" },
                  { key: "presupuesto", label: "Ejecución presupuestal" },
                  { key: "indicadores", label: "Indicadores" },
                  { key: "alertas", label: "Alertas" },
                  { key: "documentos", label: "Documentos" },
                  { key: "antecedentes", label: "Antecedentes" },
                ] as const).map(s => (
                  <label key={s.key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={sections[s.key]} onChange={() => setSections(p => ({ ...p, [s.key]: !p[s.key] }))} className="w-4 h-4 accent-blue-600 rounded" />
                    <span className="text-sm text-gray-700">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={handleGen} className="flex-1 py-2.5 text-sm font-semibold bg-[#1B3C6B] text-white rounded-lg hover:bg-[#152f54] transition-colors shadow-sm">Generar</button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Informe generado correctamente</h3>
            <p className="text-sm text-gray-400 mb-6">El informe está listo para visualizar y descargar.</p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                <Eye className="w-4 h-4" />Ver PDF
              </button>
              <button onClick={onClose} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-[#1B3C6B] text-white rounded-lg hover:bg-[#152f54] transition-colors">
                <Download className="w-4 h-4" />Descargar PDF
              </button>
              <button onClick={onClose} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors">
                <FileDown className="w-4 h-4" />Word
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
