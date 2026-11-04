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
import { ProjectStatus } from "../../types";
import { PROJECTS, REPORTS } from "../../data/mock";
import { STATUS_CFG } from "../../constants";

export function InformesView({ onGenerate }: { onGenerate: () => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Informes de proyectos</h1>
        <p className="text-sm text-gray-500 mt-0.5">Generación y consulta de informes institucionales</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-800">Generar informe</h3>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Tipo de informe</label>
            <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-gray-50/50">
              {["Informe diario", "Informe semanal", "Informe mensual", "Informe por proyecto", "Informe ejecutivo"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Desde</label>
              <input type="date" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-gray-50/50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Hasta</label>
              <input type="date" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-gray-50/50" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Proyecto</label>
            <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-gray-50/50">
              <option>Todos los proyectos</option>
              {PROJECTS.map(p => <option key={p.id}>{p.id} – {p.name.slice(0, 28)}…</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Estado</label>
            <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-gray-50/50">
              <option>Todos</option>
              {(Object.keys(STATUS_CFG) as ProjectStatus[]).map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onGenerate} className="flex-1 py-2 text-sm font-semibold bg-[#1B3C6B] text-white rounded-lg hover:bg-[#152f54] transition-colors">
              Generar informe
            </button>
            <button className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors bg-white">
              <Download className="w-4 h-4" />PDF
            </button>
            <button className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors bg-white">
              <FileDown className="w-4 h-4" />Word
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/40">
            <h3 className="text-sm font-bold text-gray-800">Historial de informes</h3>
          </div>
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
                      <button className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Descargar PDF"><Download className="w-3.5 h-3.5" /></button>
                      <button className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Descargar Word"><FileDown className="w-3.5 h-3.5" /></button>
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
