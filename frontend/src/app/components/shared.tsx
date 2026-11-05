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
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  );
}

export function IndBadge({ status }: { status: IndicatorStatus }) {
  const c = IND_CFG[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      {status}
    </span>
  );
}

export function Bar2({ value, color = "bg-orange-500", h = "h-1.5" }: { value: number; color?: string; h?: string }) {
  return (
    <div className={`w-full bg-gray-100 rounded-full overflow-hidden ${h}`}>
      <div className={`${h} rounded-full transition-all ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

export function Crumb({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-gray-500">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="w-3 h-3 text-gray-300" />}
          {item.onClick
            ? <button onClick={item.onClick} className="hover:text-orange-700 transition-colors">{item.label}</button>
            : <span className={i === items.length - 1 ? "text-gray-800 font-semibold" : ""}>{item.label}</span>
          }
        </span>
      ))}
    </nav>
  );
}

export function KpiCard({ title, value, icon: Icon, trend, trendLabel, color = "text-orange-700", bg = "bg-orange-50" }: {
  title: string; value: string; icon: React.ElementType;
  trend?: "up" | "down"; trendLabel?: string; color?: string; bg?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-gray-400 uppercase leading-tight tracking-widest">{title}</p>
          <p className={`text-2xl font-bold mt-1 leading-none ${color}`}>{value}</p>
        </div>
        <div className={`${bg} rounded-lg p-2 flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      {trendLabel && (
        <div className={`flex items-center gap-1 mt-3 text-[11px] font-medium ${trend === "up" ? "text-green-600" : "text-red-500"}`}>
          {trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{trendLabel}</span>
        </div>
      )}
    </div>
  );
}
