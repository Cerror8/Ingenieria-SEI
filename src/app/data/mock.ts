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
import { Project, Indicator, Document, AuditEntry, Report, GanttActivity } from "../types";

export const PROJECTS: Project[] = [
  { id: "PRY-2026-001", name: "Competencias Investigativas en Educación Superior", line: "Educación y Pedagogía", responsible: "Dra. Carmen López", status: "En ejecución", progress: 68, budget: 150000000, budgetExecuted: 63, startDate: "15/01/2026", endDate: "15/12/2026", daysLeft: 123, dependency: "Facultad de Ciencias de la Educación", objective: "Fortalecer las competencias investigativas de docentes y estudiantes mediante metodologías activas y herramientas tecnológicas innovadoras." },
  { id: "PRY-2026-002", name: "Salud Pública Comunitaria en Zonas Rurales", line: "Salud y Bienestar", responsible: "Dr. Andrés Morales", status: "En ejecución", progress: 31, budget: 120000000, budgetExecuted: 45, startDate: "01/03/2026", endDate: "20/10/2026", daysLeft: 67, dependency: "Facultad de Ciencias de la Salud", objective: "Implementar estrategias de atención primaria en salud para comunidades rurales del departamento." },
  { id: "PRY-2026-003", name: "Sistema de Riego Inteligente con IoT", line: "Tecnología e Innovación", responsible: "Ing. Luis Herrera", status: "En ejecución", progress: 45, budget: 85000000, budgetExecuted: 38, startDate: "01/02/2026", endDate: "30/11/2026", daysLeft: 88, dependency: "Facultad de Ingeniería", objective: "Desarrollar un sistema de riego inteligente basado en sensores IoT para optimizar el uso del agua en cultivos." },
  { id: "PRY-2026-004", name: "Gestión de Residuos Sólidos Urbanos", line: "Medio Ambiente", responsible: "Dra. Ana Vargas", status: "En formulación", progress: 22, budget: 95000000, budgetExecuted: 12, startDate: "01/04/2026", endDate: "28/02/2027", daysLeft: 187, dependency: "Facultad de Ciencias Ambientales", objective: "Diseñar un modelo de gestión integral de residuos sólidos para municipios de mediana capacidad institucional." },
  { id: "PRY-2026-005", name: "IA para Personalización Académica", line: "Tecnología e Innovación", responsible: "Dr. Pablo Rincón", status: "En ejecución", progress: 78, budget: 200000000, budgetExecuted: 75, startDate: "10/01/2026", endDate: "30/06/2026", daysLeft: 12, dependency: "Facultad de Ing. de Sistemas", objective: "Implementar un sistema de inteligencia artificial para personalizar rutas de aprendizaje en el aula universitaria." },
  { id: "PRY-2026-006", name: "Biodiversidad Regional del Piedemonte", line: "Medio Ambiente", responsible: "Dra. María Ospina", status: "Suspendido", progress: 55, budget: 110000000, budgetExecuted: 52, startDate: "15/02/2026", endDate: "15/09/2026", daysLeft: 21, dependency: "Facultad de Ciencias Naturales", objective: "Catalogar y analizar la biodiversidad del piedemonte llanero como línea base para su conservación." },
  { id: "PRY-2026-007", name: "Economía Solidaria y Desarrollo Social", line: "Desarrollo Social", responsible: "Dr. Jorge Castillo", status: "Finalizado", progress: 100, budget: 75000000, budgetExecuted: 98, startDate: "01/01/2026", endDate: "30/06/2026", daysLeft: 0, dependency: "Facultad de Ciencias Económicas", objective: "Fortalecer las economías locales mediante modelos de asociatividad y economía solidaria." },
  { id: "PRY-2026-008", name: "Cultura Institucional y Bienestar Universitario", line: "Gestión Universitaria", responsible: "Dra. Rosa Méndez", status: "Finalizado", progress: 100, budget: 60000000, budgetExecuted: 94, startDate: "01/01/2026", endDate: "31/05/2026", daysLeft: 0, dependency: "Vicerrectoría Académica", objective: "Consolidar una cultura organizacional orientada al bienestar y el desempeño institucional." },
];

export const INDICATORS: Indicator[] = [
  { id: "IND-001", name: "Artículos publicados en revistas indexadas", goal: "4 artículos", advance: "2 artículos", compliance: 50, status: "En riesgo", responsible: "Dra. Carmen López", date: "15/12/2026", projectId: "PRY-2026-001" },
  { id: "IND-002", name: "Instrumentos de evaluación validados", goal: "6 instrumentos", advance: "3 instrumentos", compliance: 50, status: "No cumplido", responsible: "Dr. Juan Pérez", date: "30/09/2026", projectId: "PRY-2026-001" },
  { id: "IND-003", name: "Docentes capacitados en metodologías activas", goal: "80 docentes", advance: "65 docentes", compliance: 81, status: "Cumplido", responsible: "Dra. Carmen López", date: "30/11/2026", projectId: "PRY-2026-001" },
  { id: "IND-004", name: "Documentos entregables del proyecto", goal: "8 documentos", advance: "5 documentos", compliance: 62, status: "En riesgo", responsible: "Dra. Carmen López", date: "15/12/2026", projectId: "PRY-2026-001" },
  { id: "IND-005", name: "Talleres de formación realizados", goal: "12 talleres", advance: "10 talleres", compliance: 83, status: "Cumplido", responsible: "Dra. Carmen López", date: "30/11/2026", projectId: "PRY-2026-001" },
];

export const DOCUMENTS: Document[] = [
  { id: "DOC-001", name: "Ficha Técnica FR-019", type: "Ficha técnica", version: "v2.1", date: "15/01/2026", user: "Dra. Carmen López", status: "Aprobado", projectId: "PRY-2026-001" },
  { id: "DOC-002", name: "Acta de inicio del proyecto", type: "Actas", version: "v1.0", date: "20/01/2026", user: "Dra. Carmen López", status: "Aprobado", projectId: "PRY-2026-001" },
  { id: "DOC-003", name: "Informe de avance – Febrero 2026", type: "Informes", version: "v1.0", date: "28/02/2026", user: "Dra. Carmen López", status: "Aprobado", projectId: "PRY-2026-001" },
  { id: "DOC-004", name: "Informe de avance – Marzo 2026", type: "Informes", version: "v1.0", date: "31/03/2026", user: "Dra. Carmen López", status: "En revisión", projectId: "PRY-2026-001" },
  { id: "DOC-005", name: "Presupuesto actualizado Q1 2026", type: "Antecedentes", version: "v1.2", date: "05/04/2026", user: "Admin PMO", status: "Aprobado", projectId: "PRY-2026-001" },
  { id: "DOC-006", name: "Marco conceptual investigación", type: "Evidencias", version: "v1.0", date: "10/01/2026", user: "Dra. Carmen López", status: "Aprobado", projectId: "PRY-2026-001" },
];

export const AUDIT_LOG: AuditEntry[] = [
  { date: "01/09/2026 10:21", user: "Dra. Carmen López", action: "Actualización", entity: "Avance técnico", record: "PRY-2026-001", prevValue: "55%", newValue: "68%" },
  { date: "01/09/2026 10:35", user: "Dra. Carmen López", action: "Actualización", entity: "Proyecto", record: "PRY-2026-001", prevValue: "Estado: Revisión", newValue: "Estado: Ejecución" },
  { date: "18/08/2026 14:20", user: "Admin PMO", action: "Carga documento", entity: "Documento", record: "DOC-004", prevValue: "—", newValue: "Informe Marzo 2026" },
  { date: "15/08/2026 09:15", user: "Dr. Andrés Morales", action: "Actualización", entity: "Indicador", record: "IND-001", prevValue: "Cumplimiento: 40%", newValue: "Cumplimiento: 50%" },
  { date: "12/08/2026 11:40", user: "Admin PMO", action: "Creación", entity: "Proyecto", record: "PRY-2026-004", prevValue: "—", newValue: "En formulación" },
  { date: "10/08/2026 16:05", user: "Ing. Luis Herrera", action: "Actualización", entity: "Presupuesto", record: "PRY-2026-003", prevValue: "Ejecutado: 32%", newValue: "Ejecutado: 38%" },
  { date: "08/08/2026 08:30", user: "Dra. Ana Vargas", action: "Carga documento", entity: "Documento", record: "DOC-005", prevValue: "—", newValue: "Ficha técnica inicial" },
  { date: "05/08/2026 15:00", user: "Dr. Pablo Rincón", action: "Actualización", entity: "Indicador", record: "IND-003", prevValue: "Avance: 58 docentes", newValue: "Avance: 65 docentes" },
];

export const REPORTS: Report[] = [
  { id: "RPT-001", date: "20/08/2026", type: "Informe semanal", period: "14 – 20 agosto", project: "PRY-2026-001", generatedBy: "Dra. Carmen López", format: "PDF" },
  { id: "RPT-002", date: "31/07/2026", type: "Informe mensual", period: "Julio 2026", project: "Todos", generatedBy: "Admin PMO", format: "PDF" },
  { id: "RPT-003", date: "15/08/2026", type: "Informe ejecutivo", period: "Ene – Ago 2026", project: "PRY-2026-005", generatedBy: "Dr. Pablo Rincón", format: "PDF" },
  { id: "RPT-004", date: "13/08/2026", type: "Informe semanal", period: "7 – 13 agosto", project: "PRY-2026-003", generatedBy: "Ing. Luis Herrera", format: "PDF" },
  { id: "RPT-005", date: "31/07/2026", type: "Informe mensual", period: "Julio 2026", project: "PRY-2026-002", generatedBy: "Dr. Andrés Morales", format: "PDF" },
];

export const GANTT_ACTIVITIES: GanttActivity[] = [
  { id: "A-001", name: "Revisión bibliográfica y estado del arte", responsible: "Dra. Carmen López", startMonth: 1, endMonth: 3, progress: 100, status: "Completada" },
  { id: "A-002", name: "Diseño metodológico e instrumentos", responsible: "Dr. Juan Pérez", startMonth: 2, endMonth: 5, progress: 85, status: "En curso" },
  { id: "A-003", name: "Recolección de datos – fase 1", responsible: "Dra. Carmen López", startMonth: 4, endMonth: 6, progress: 70, status: "En curso" },
  { id: "M-001", name: "Entrega informe parcial", responsible: "Admin PMO", startMonth: 6, endMonth: 6, progress: 0, status: "Pendiente", isMilestone: true },
  { id: "A-004", name: "Análisis de resultados", responsible: "Dr. Juan Pérez", startMonth: 7, endMonth: 9, progress: 20, status: "En curso" },
  { id: "A-005", name: "Validación y ajustes", responsible: "Dra. Carmen López", startMonth: 8, endMonth: 10, progress: 0, status: "Pendiente" },
  { id: "A-006", name: "Difusión y publicaciones", responsible: "Dra. Carmen López", startMonth: 10, endMonth: 12, progress: 0, status: "Pendiente" },
  { id: "M-002", name: "Cierre del proyecto", responsible: "Admin PMO", startMonth: 12, endMonth: 12, progress: 0, status: "Pendiente", isMilestone: true },
];
