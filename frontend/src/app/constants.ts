import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, Briefcase, BookOpen, FileText, FolderOpen,
  Activity, ChevronRight, ChevronDown, ChevronUp,
  Plus, Search, Download, Eye, Edit2, Bell, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, DollarSign, ArrowLeft, X, Upload,
  Link2, MoreHorizontal, ChevronLeft, Filter, Tag, Paperclip,
  Clock, BarChart2, Percent, Check, Trash2, Save, FileDown, Sliders, SquareKanban,
  Users, ClipboardList
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend
} from "recharts";
import { ProjectStatus, IndicatorStatus } from "./types";

export const STATUS_CFG: Record<ProjectStatus, { bg: string; text: string; dot: string }> = {
  "En formulación": { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
  "En ejecución":   { bg: "bg-orange-50",text: "text-orange-700",dot: "bg-orange-500"},
  "Suspendido":     { bg: "bg-slate-100",text: "text-slate-600", dot: "bg-slate-400" },
  "Finalizado":     { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  "Cerrado":        { bg: "bg-gray-100", text: "text-gray-600",  dot: "bg-gray-400"  },
};

export const IND_CFG: Record<IndicatorStatus, { bg: string; text: string; bar: string }> = {
  "Cumplido":    { bg: "bg-green-50",  text: "text-green-700",  bar: "bg-green-500" },
  "En riesgo":   { bg: "bg-amber-50",  text: "text-amber-700",  bar: "bg-amber-500" },
  "No cumplido": { bg: "bg-red-50",    text: "text-red-700",    bar: "bg-red-500"   },
  "Pendiente":   { bg: "bg-gray-100",  text: "text-gray-600",   bar: "bg-gray-400"  },
};

export const ACT_STATUS_CFG = {
  "Completada": { bg: "bg-green-50", text: "text-green-700" },
  "En curso":   { bg: "bg-orange-50",  text: "text-orange-700" },
  "Pendiente":  { bg: "bg-gray-100", text: "text-gray-600" },
  "Retrasada":  { bg: "bg-red-50",   text: "text-red-700"  },
};

export const GANTT_MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export const WIZARD_STEPS = ["Información general", "Ficha técnica FR-019", "Antecedentes", "Seguimiento", "Revisión"];

export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  children: NavItem[];
};

export type NavEntry = ({ type: "item" } & NavItem) | ({ type: "group" } & NavGroup);

export const NAV_ENTRIES: NavEntry[] = [
  { type: "item", id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { type: "item", id: "tableros",  label: "Tableros",  icon: SquareKanban  },
  {
    type: "group",
    id: "projects",
    label: "Proyectos",
    icon: Briefcase,
    children: [
      { id: "projects",     label: "Ver proyectos", icon: Briefcase  },
      { id: "seguimiento",  label: "Seguimiento",   icon: Activity   },
      { id: "antecedentes", label: "Antecedentes",  icon: BookOpen   },
      { id: "informes",     label: "Informes",      icon: FileText   },
      { id: "documentos",   label: "Documentos",    icon: FolderOpen },
    ],
  },
  { type: "item", id: "formatos", label: "Formatos", icon: ClipboardList },
  { type: "item", id: "usuarios", label: "Usuarios", icon: Users, adminOnly: true },
];

export const PROJ_TABS = [
  { id: "resumen",      label: "Resumen"            },
  { id: "ficha",        label: "Ficha técnica FR-019"},
  { id: "dashboard",    label: "Dashboard"          },
  { id: "seguimiento",  label: "Seguimiento"        },
  { id: "edt",          label: "EDT"                },
  { id: "gantt",        label: "Gantt"              },
  { id: "presupuesto",  label: "Presupuesto"        },
  { id: "indicadores",  label: "Indicadores"        },
  { id: "documentos",   label: "Documentos"         },
  { id: "antecedentes", label: "Antecedentes"       },
  { id: "informes",     label: "Informes"           },
  { id: "historial",    label: "Historial"          },
  { id: "auditoria",    label: "Auditoría"          },
];
