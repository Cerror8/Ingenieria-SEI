import type {
  AuditEntry,
  Document,
  GanttActivity,
  Indicator,
  IndicatorStatus,
  Project,
  ProjectStatus,
  Report,
  TareaTablero,
  Usuario,
} from "../types";

const API_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000/api"
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Opciones = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

async function request<T>(path: string, opciones: Opciones = {}): Promise<T> {
  let respuesta: Response;

  try {
    respuesta = await fetch(`${API_URL}${path}`, {
      method: opciones.method ?? "GET",
      credentials: "include",
      headers: opciones.body ? { "Content-Type": "application/json" } : undefined,
      body: opciones.body ? JSON.stringify(opciones.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "No se pudo conectar con el servidor. Verifica que el backend esté activo.");
  }

  const datos = (await respuesta.json().catch(() => ({}))) as { error?: string };

  if (!respuesta.ok) {
    throw new ApiError(respuesta.status, datos.error ?? "Ocurrió un error inesperado");
  }

  return datos as T;
}

const query = (params: Record<string, string | undefined>) => {
  const activos = Object.entries(params).filter(([, v]) => v) as [string, string][];
  return activos.length ? `?${new URLSearchParams(activos).toString()}` : "";
};

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [anio, mes, dia] = iso.slice(0, 10).split("-");
  return dia && mes && anio ? `${dia}/${mes}/${anio}` : iso;
}

export type ProyectoApi = {
  id: string;
  nombre: string;
  linea: string;
  responsable: string;
  estado: ProjectStatus;
  avance: number;
  presupuesto: number;
  ejecucionPct: number;
  fechaInicio: string;
  fechaFin: string;
  diasRestantes: number;
  dependencia: string;
  objetivo: string;
};

export type IndicadorApi = {
  id: string;
  nombre: string;
  meta: string;
  avance: string;
  cumplimiento: number;
  estado: IndicatorStatus;
  responsable: string;
  fecha: string;
  proyectoId: string;
};

export type DocumentoApi = {
  id: string;
  nombre: string;
  tipo: string;
  version: string;
  fecha: string;
  usuario: string;
  estado: Document["status"];
  proyectoId: string;
};

export type InformeApi = {
  id: string;
  fecha: string;
  tipo: string;
  periodo: string;
  proyecto: string;
  generadoPor: string;
  formato: "PDF" | "Word";
};

export type AuditoriaApi = {
  fecha: string;
  usuario: string;
  accion: string;
  entidad: string;
  registro: string;
  previo: string;
  nuevo: string;
};

export type ActividadApi = {
  id: string;
  nombre: string;
  responsable: string;
  mesInicio: number;
  mesFin: number;
  avance: number;
  estado: GanttActivity["status"];
  hito: boolean;
  proyectoId: string;
};

export type DashboardApi = {
  kpis: {
    total: number;
    activos: number;
    finalizados: number;
    retrasados: number;
    avancePromedio: number;
    ejecucionPromedio: number;
    lineasActivas: number;
  };
  estados: { nombre: string; total: number }[];
  avances: { id: string; nombre: string; avance: number }[];
  lineas: { nombre: string; total: number }[];
  proximos: ProyectoApi[];
  alertas: IndicadorApi[];
  periodo: { desde: number; hasta: number };
  presupuestos: { id: string; nombre: string; presupuesto: number; ejecucionPct: number }[];
};

export type DetalleProyectoApi = {
  proyecto: ProyectoApi;
  indicadores: IndicadorApi[];
  documentos: DocumentoApi[];
  actividades: ActividadApi[];
};

export type TableroApi = { id: string; nombre: string; descripcion: string };

export type NuevaTarea = {
  titulo: string;
  descripcion: string;
  columna: TareaTablero["columna"];
  responsable: string;
  prioridad: TareaTablero["prioridad"];
  fechaLimite: string | null;
  etiqueta: string;
};

export type NuevoProyecto = {
  id: string;
  nombre: string;
  linea: string;
  responsable: string;
  estado: ProjectStatus;
  dependencia: string;
  objetivo: string;
  presupuesto: number;
  fechaInicio?: string;
  avance?: number;
};

export const mapProyecto = (p: ProyectoApi): Project => ({
  id: p.id,
  name: p.nombre,
  line: p.linea,
  responsible: p.responsable,
  status: p.estado,
  progress: p.avance,
  budget: p.presupuesto,
  budgetExecuted: p.ejecucionPct,
  startDate: fechaCorta(p.fechaInicio),
  endDate: fechaCorta(p.fechaFin),
  daysLeft: p.diasRestantes,
  dependency: p.dependencia,
  objective: p.objetivo,
});

export const mapIndicador = (i: IndicadorApi): Indicator => ({
  id: i.id,
  name: i.nombre,
  goal: i.meta,
  advance: i.avance,
  compliance: i.cumplimiento,
  status: i.estado,
  responsible: i.responsable,
  date: fechaCorta(i.fecha),
  projectId: i.proyectoId,
});

export const mapDocumento = (d: DocumentoApi): Document => ({
  id: d.id,
  name: d.nombre,
  type: d.tipo,
  version: d.version,
  date: fechaCorta(d.fecha),
  user: d.usuario,
  status: d.estado,
  projectId: d.proyectoId,
});

export const mapInforme = (r: InformeApi): Report => ({
  id: r.id,
  date: fechaCorta(r.fecha),
  type: r.tipo,
  period: r.periodo,
  project: r.proyecto,
  generatedBy: r.generadoPor,
  format: r.formato,
});

export const mapAuditoria = (a: AuditoriaApi): AuditEntry => ({
  date: a.fecha,
  user: a.usuario,
  action: a.accion,
  entity: a.entidad,
  record: a.registro,
  prevValue: a.previo,
  newValue: a.nuevo,
});

export const mapActividad = (a: ActividadApi): GanttActivity => ({
  id: a.id,
  name: a.nombre,
  responsible: a.responsable,
  startMonth: a.mesInicio,
  endMonth: a.mesFin,
  progress: a.avance,
  status: a.estado,
  isMilestone: a.hito,
});

export const api = {
  iniciarSesion: (email: string, password: string) =>
    request<{ usuario: Usuario }>("/auth/login", { method: "POST", body: { email, password } }),
  cerrarSesion: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  usuarioActual: () => request<{ usuario: Usuario }>("/auth/me"),
  urlGoogle: `${API_URL}/auth/google`,

  dashboard: () => request<DashboardApi>("/dashboard"),

  proyectos: () => request<{ proyectos: ProyectoApi[] }>("/proyectos"),
  proyecto: (id: string) => request<DetalleProyectoApi>(`/proyectos/${encodeURIComponent(id)}`),
  crearProyecto: (datos: NuevoProyecto) =>
    request<{ proyecto: ProyectoApi }>("/proyectos", { method: "POST", body: datos }),

  indicadores: (proyectoId?: string) =>
    request<{ indicadores: IndicadorApi[] }>(`/indicadores${query({ proyectoId })}`),
  documentos: (proyectoId?: string, tipo?: string) =>
    request<{ documentos: DocumentoApi[] }>(`/documentos${query({ proyectoId, tipo })}`),
  informes: () => request<{ informes: InformeApi[] }>("/informes"),
  crearInforme: (datos: { tipo: string; periodo: string; proyecto?: string; formato?: "PDF" | "Word" }) =>
    request<{ informe: InformeApi }>("/informes", { method: "POST", body: datos }),
  auditoria: (registro?: string) =>
    request<{ auditoria: AuditoriaApi[] }>(`/auditoria${query({ registro })}`),

  tableros: () => request<{ tableros: (TableroApi & { totalTareas: number })[] }>("/tableros"),
  crearTablero: (datos: { nombre: string; descripcion: string }) =>
    request<{ tablero: TableroApi & { totalTareas: number } }>("/tableros", {
      method: "POST",
      body: datos,
    }),
  tablero: (id: string) => request<{ tablero: TableroApi; tareas: TareaTablero[] }>(`/tableros/${id}`),
  crearTarea: (tableroId: string, datos: NuevaTarea) =>
    request<{ tarea: TareaTablero }>(`/tableros/${tableroId}/tareas`, { method: "POST", body: datos }),
  actualizarTarea: (tableroId: string, tareaId: string, datos: Partial<NuevaTarea>) =>
    request<{ tarea: TareaTablero }>(`/tableros/${tableroId}/tareas/${tareaId}`, {
      method: "PATCH",
      body: datos,
    }),
  eliminarTarea: (tableroId: string, tareaId: string) =>
    request<{ ok: boolean }>(`/tableros/${tableroId}/tareas/${tareaId}`, { method: "DELETE" }),
};
