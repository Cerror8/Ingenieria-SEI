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

export const STATUS_DONUT = [
  { name: "En formulación", value: 8, color: "#F59E0B" },
  { name: "En ejecución", value: 19, color: "#2563EB" },
  { name: "Suspendido", value: 3, color: "#F97316" },
  { name: "Finalizado", value: 12, color: "#10B981" },
  { name: "Cerrado", value: 5, color: "#9CA3AF" },
];

export const PROGRESS_BARS = [
  { name: "IA académica", value: 78 },
  { name: "Comp. investigativas", value: 68 },
  { name: "Biodiversidad", value: 55 },
  { name: "Riego inteligente", value: 45 },
  { name: "Salud pública", value: 31 },
  { name: "Residuos sólidos", value: 22 },
];

export const BUDGET_TIMELINE = [
  { mes: "Ene", ejecutado: 8, planificado: 12 },
  { mes: "Feb", ejecutado: 18, planificado: 22 },
  { mes: "Mar", ejecutado: 29, planificado: 33 },
  { mes: "Abr", ejecutado: 38, planificado: 42 },
  { mes: "May", ejecutado: 47, planificado: 52 },
  { mes: "Jun", ejecutado: 55, planificado: 62 },
  { mes: "Jul", ejecutado: 60, planificado: 72 },
  { mes: "Ago", ejecutado: 63, planificado: 80 },
];

export const RESEARCH_LINES = [
  { line: "Educación y Pedagogía", count: 12 },
  { line: "Tecnología e Innovación", count: 10 },
  { line: "Medio Ambiente", count: 8 },
  { line: "Salud y Bienestar", count: 7 },
  { line: "Desarrollo Social", count: 6 },
  { line: "Gestión Universitaria", count: 4 },
];
