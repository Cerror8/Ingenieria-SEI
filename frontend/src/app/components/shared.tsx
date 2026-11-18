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
import { ProjectStatus, IndicatorStatus } from "../types";
import { STATUS_CFG, IND_CFG } from "../constants";

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const c = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 ${c.dot}`} />
      {status}
    </span>
  );
}

export function IndBadge({ status }: { status: IndicatorStatus }) {
  const c = IND_CFG[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] ${c.bg} ${c.text}`}>
      {status}
    </span>
  );
}

export function Bar2({ value, color = "bg-orange-500", h = "h-1.5" }: { value: number; color?: string; h?: string }) {
  return (
    <div className={`w-full bg-slate-100 overflow-hidden ${h}`}>
      <div className={`${h} transition-all ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

export function Crumb({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <nav className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300" />}
          {item.onClick
            ? <button onClick={item.onClick} className="transition-colors hover:text-[#9A3412]">{item.label}</button>
            : <span className={i === items.length - 1 ? "font-medium text-[#1B1B1B]" : ""}>{item.label}</span>
          }
        </span>
      ))}
    </nav>
  );
}

export function KpiCard({ title, value, icon: Icon, trend, trendLabel, color = "text-[#9A3412]", bg = "bg-[#F39200]/10" }: {
  title: string; value: string; icon: React.ElementType;
  trend?: "up" | "down"; trendLabel?: string; color?: string; bg?: string;
}) {
  return (
    <div className="group relative min-w-0 overflow-hidden rounded-lg border border-slate-200/80 bg-white p-4">
      <span className="absolute left-0 top-0 h-6 w-[3px] bg-[#F39200]" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="sei-label text-slate-400">{title}</p>
          <p className={`sei-figure mt-1.5 text-2xl font-semibold leading-none ${color}`}>{value}</p>
        </div>
        <div className={`${bg} flex-shrink-0 p-1.5`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
      {trendLabel && (
        <div className={`mt-3 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide ${trend === "up" ? "text-emerald-600" : "text-red-500"}`}>
          {trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{trendLabel}</span>
        </div>
      )}
    </div>
  );
}
