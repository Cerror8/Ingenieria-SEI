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
import { DOCUMENTS } from "../../data/mock";

export function DocumentosView() {
  const [cat, setCat] = useState("Todos");
  const categories = ["Todos", "Ficha técnica", "Actas", "Informes", "Antecedentes", "Evidencias", "Otros"];
  const filtered = cat === "Todos" ? DOCUMENTS : DOCUMENTS.filter(d => d.type === cat);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Documentos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Repositorio documental de Ingeniería SEI</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-[#C2410C] text-white text-sm font-semibold rounded-lg hover:bg-[#9A3412] transition-colors">
          <Upload className="w-4 h-4" />Cargar documento
        </button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button key={c} onClick={() => setCat(c)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${cat === c ? "bg-[#C2410C] text-white border-[#C2410C]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"}`}>
            {c}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/60 border-b border-gray-100">
              {["Nombre", "Proyecto", "Tipo", "Versión", "Fecha", "Usuario", "Estado", "Acciones"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(doc => (
              <tr key={doc.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    <span className="text-sm font-semibold text-gray-800">{doc.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5"><span className="font-mono text-xs font-bold text-orange-700">{doc.projectId}</span></td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{doc.type}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{doc.version}</td>
                <td className="px-4 py-2.5 text-xs text-gray-400">{doc.date}</td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{doc.user}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${doc.status === "Aprobado" ? "bg-green-50 text-green-700" : doc.status === "En revisión" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                    {doc.status}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-0.5">
                    <button className="p-1 text-gray-300 hover:text-orange-600 rounded transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                    <button className="p-1 text-gray-300 hover:text-orange-600 rounded transition-colors"><Download className="w-3.5 h-3.5" /></button>
                    <button className="p-1 text-gray-300 hover:text-amber-600 rounded transition-colors" title="Nueva versión"><Clock className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
