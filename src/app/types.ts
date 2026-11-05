export type Rol = "admin" | "docente" | "estudiante" | "usuario";

export type Proveedor = "google" | "local";

export type Usuario = {
  id: string;
  email: string;
  nombre: string;
  fotoUrl: string | null;
  proveedor: Proveedor;
  rol: Rol;
  ultimoAcceso: string | null;
};

export type ProjectStatus = "En formulación" | "En ejecución" | "Suspendido" | "Finalizado" | "Cerrado";
export type IndicatorStatus = "Cumplido" | "En riesgo" | "No cumplido" | "Pendiente";
export type DocStatus = "Aprobado" | "En revisión" | "Borrador" | "Rechazado";
export type ViewType =
  | "dashboard"
  | "projects"
  | "create-project"
  | "project-detail"
  | "antecedentes"
  | "informes"
  | "documentos"
  | "seguimiento"
  | "tableros";

export interface Project {
  id: string;
  name: string;
  line: string;
  responsible: string;
  status: ProjectStatus;
  progress: number;
  budget: number;
  budgetExecuted: number;
  startDate: string;
  endDate: string;
  daysLeft: number;
  dependency: string;
  objective: string;
}

export interface Indicator {
  id: string;
  name: string;
  goal: string;
  advance: string;
  compliance: number;
  status: IndicatorStatus;
  responsible: string;
  date: string;
  projectId: string;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  version: string;
  date: string;
  user: string;
  status: DocStatus;
  projectId: string;
}

export interface AuditEntry {
  date: string;
  user: string;
  action: string;
  entity: string;
  record: string;
  prevValue: string;
  newValue: string;
}

export interface Report {
  id: string;
  date: string;
  type: string;
  period: string;
  project: string;
  generatedBy: string;
  format: string;
}

export interface GanttActivity {
  id: string;
  name: string;
  responsible: string;
  startMonth: number;
  endMonth: number;
  progress: number;
  status: "Pendiente" | "En curso" | "Completada" | "Retrasada";
  isMilestone?: boolean;
}

export type PrioridadTablero = "Alta" | "Media" | "Baja";

export type ColumnaTablero = "por-hacer" | "en-curso" | "en-revision" | "completado";

export interface TareaTablero {
  id: string;
  titulo: string;
  descripcion: string;
  columna: ColumnaTablero;
  responsable: string;
  prioridad: PrioridadTablero;
  fechaLimite: string;
  etiqueta: string;
}
