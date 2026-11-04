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
import { PROJECTS } from "../../data/mock";
import { StatusBadge, Bar2 } from "../../components/shared";

export function SeguimientoView({ onSelectProject }: { onSelectProject: (id: string) => void }) {
  const active = PROJECTS.filter(p => p.status === "En ejecución" || p.status === "En formulación");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Seguimiento</h1>
        <p className="text-sm text-gray-500 mt-0.5">Estado en tiempo real de los proyectos en curso</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {active.map(p => (
          <div key={p.id} onClick={() => onSelectProject(p.id)} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-orange-100 hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="font-mono text-xs font-black text-orange-700">{p.id}</span>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{p.name}</p>
                <p className="text-xs text-gray-400">{p.responsible}</p>
              </div>
              <StatusBadge status={p.status} />
            </div>
            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500 font-medium">Avance técnico</span>
                  <span className="font-bold text-gray-800">{p.progress}%</span>
                </div>
                <Bar2 value={p.progress} color="bg-orange-500" h="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500 font-medium">Ejec. presupuestal</span>
                  <span className="font-bold text-gray-800">{p.budgetExecuted}%</span>
                </div>
                <Bar2 value={p.budgetExecuted} color="bg-emerald-500" h="h-2" />
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-xs">
              <span className="text-gray-400">Finaliza: {p.endDate}</span>
              {p.daysLeft > 0
                ? <span className={`font-bold ${p.daysLeft < 30 ? "text-red-600" : p.daysLeft < 90 ? "text-amber-600" : "text-green-600"}`}>{p.daysLeft} días restantes</span>
                : <span className="font-bold text-green-600">Finalizado</span>
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
