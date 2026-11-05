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

export type UsuarioAsignable = Pick<Usuario, "id" | "nombre" | "fotoUrl" | "rol">;

export type UsuarioAdmin = Usuario & {
  activo: boolean;
  creadoEn: string;
  tareasAsignadas: number;
  tareasCompletadas: number;
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
  | "tableros"
  | "calendario"
  | "usuarios"
  | "perfil";

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
  fileName: string | null;
  fileSize: number | null;
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
  responsableId: string | null;
  responsableFoto: string | null;
  prioridad: PrioridadTablero;
  fechaLimite: string;
  etiqueta: string;
  completadoEn: string | null;
  comentarios: number;
  adjuntos: number;
}

export type ComentarioTarea = {
  id: string;
  contenido: string;
  autor: string;
  usuarioId: string | null;
  autorFoto: string | null;
  creadoEn: string;
};

export type AdjuntoTarea = {
  id: string;
  nombre: string;
  mime: string | null;
  tamano: number;
  usuarioId: string | null;
  subidoPor: string;
  autorFoto: string | null;
  creadoEn: string;
};

export type AlcanceNotificaciones = "todas" | "mias";

export type NotificacionTarea = {
  id: string;
  titulo: string;
  prioridad: PrioridadTablero;
  columna: ColumnaTablero;
  responsable: string;
  fechaLimite: string;
  tableroId: string;
  tablero: string;
  diasRestantes: number;
};

export type EventoCalendario = {
  id: string;
  titulo: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string;
  todoElDia: boolean;
  usuarioId: string;
  creadoEn: string;
};

export type TareaCalendario = {
  id: string;
  titulo: string;
  descripcion: string;
  prioridad: PrioridadTablero;
  columna: ColumnaTablero;
  fechaLimite: string;
  tableroId: string;
  tablero: string;
};

export type CalendarioDatos = {
  tareas: TareaCalendario[];
  eventos: EventoCalendario[];
};

export type NuevoEvento = {
  titulo: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string;
  todoElDia: boolean;
};
