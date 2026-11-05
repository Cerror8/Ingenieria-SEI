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

export function ProjectCreatedModal({ project, onGoToProject, onGoToDashboard }: {
  project: { id: string; nombre: string; estado: string };
  onGoToProject: () => void;
  onGoToDashboard: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <h2 className="mb-1 text-lg font-bold text-gray-900">Proyecto creado correctamente</h2>
          <div className="my-5 space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-4 text-left">
            <div className="flex items-center gap-3">
              <span className="w-16 flex-shrink-0 text-xs font-bold text-gray-400">Código</span>
              <span className="font-mono text-sm font-black text-orange-700">{project.id}</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-16 flex-shrink-0 text-xs font-bold text-gray-400">Nombre</span>
              <span className="text-sm text-gray-800">{project.nombre}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-16 flex-shrink-0 text-xs font-bold text-gray-400">Estado</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{project.estado}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onGoToDashboard} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50">
              Ver proyectos
            </button>
            <button onClick={onGoToProject} className="flex-1 rounded-lg bg-[#C2410C] py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#9A3412]">
              Ir al proyecto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
