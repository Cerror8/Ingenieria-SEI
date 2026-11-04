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

export function ProjectCreatedModal({ onGoToProject, onGoToDashboard }: {
  onGoToProject: () => void;
  onGoToDashboard: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Proyecto creado correctamente</h2>
          <div className="space-y-2 my-5 text-left bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-400 w-16 flex-shrink-0">Código</span>
              <span className="font-mono text-sm font-black text-blue-700">PRY-2026-009</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xs font-bold text-gray-400 w-16 flex-shrink-0">Nombre</span>
              <span className="text-sm text-gray-800">Sistema de fortalecimiento de la investigación institucional</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-400 w-16 flex-shrink-0">Estado</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Estructuración
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onGoToDashboard} className="flex-1 py-2.5 text-sm font-semibold border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              Ver dashboard
            </button>
            <button onClick={onGoToProject} className="flex-1 py-2.5 text-sm font-semibold bg-[#1B3C6B] text-white rounded-lg hover:bg-[#152f54] transition-colors shadow-sm">
              Ir al proyecto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
