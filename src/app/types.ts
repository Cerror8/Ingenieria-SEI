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

export type ProjectStatus = "En formulación" | "En ejecución" | "Suspendido" | "Finalizado" | "Cerrado";
export type IndicatorStatus = "Cumplido" | "En riesgo" | "No cumplido" | "Pendiente";
export type DocStatus = "Aprobado" | "En revisión" | "Borrador" | "Rechazado";
export type ViewType = "dashboard" | "projects" | "create-project" | "project-detail" |
  "antecedentes" | "informes" | "documentos" | "seguimiento";

export interface Project {
  id: string; name: string; line: string; responsible: string;
  status: ProjectStatus; progress: number; budget: number;
  budgetExecuted: number; startDate: string; endDate: string;
  daysLeft: number; dependency: string; objective: string;
}
export interface Indicator {
  id: string; name: string; goal: string; advance: string;
  compliance: number; status: IndicatorStatus; responsible: string;
  date: string; projectId: string;
}
export interface Document {
  id: string; name: string; type: string; version: string;
  date: string; user: string; status: DocStatus; projectId: string;
}
export interface AuditEntry {
  date: string; user: string; action: string; entity: string;
  record: string; prevValue: string; newValue: string;
}
export interface Report {
  id: string; date: string; type: string; period: string;
  project: string; generatedBy: string; format: string;
}
export interface GanttActivity {
  id: string; name: string; responsible: string;
  startMonth: number; endMonth: number; progress: number;
  status: "Pendiente" | "En curso" | "Completada" | "Retrasada";
  isMilestone?: boolean;
}
