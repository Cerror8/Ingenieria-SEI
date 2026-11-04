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
import { NAV_ITEMS } from "../constants";

export function Sidebar({ currentView, onNavigate }: { currentView: string; onNavigate: (v: string) => void }) {
  const isActive = (id: string) => currentView === id || (id === "projects" && (currentView === "project-detail" || currentView === "create-project"));

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-[#1B3C6B] select-none">
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
            <BarChart2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-black text-white leading-tight tracking-wide">GESTIÓN DE</p>
            <p className="text-xs font-black text-white/70 leading-tight tracking-wide">PROYECTOS</p>
          </div>
        </div>
        <p className="text-[10px] text-white/40 mt-2">Módulo PMO · Plataforma Inst.</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <button key={item.id} onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${isActive(item.id) ? "bg-white/15 text-white" : "text-white/55 hover:bg-white/8 hover:text-white/85"}`}>
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
            {item.id === "informes" && (
              <span className="ml-auto text-[10px] font-black bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full">3</span>
            )}
          </button>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-black text-white">CL</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">Dra. Carmen López</p>
            <p className="text-[10px] text-white/45 truncate">Investigadora principal</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
