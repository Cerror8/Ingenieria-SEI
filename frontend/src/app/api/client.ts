import type {
  AdjuntoTarea,
  AlcanceNotificaciones,
  AuditEntry,
  CalendarioDatos,
  ComentarioTarea,
  Desembolso,
  Document,
  EventoCalendario,
  GanttActivity,
  Indicator,
  IndicatorStatus,
  NotificacionTarea,
  NuevoEvento,
  Project,
  ProjectStatus,
  Report,
  Rol,
  TareaPersonal,
  TareaTablero,
  Usuario,
  UsuarioAdmin,
  UsuarioAsignable,
} from "../types";

const API_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.PROD ? "/api" : "http://localhost:4000/api")
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

const tareaPath = (tableroId: string, tareaId: string) =>
  `/tableros/${encodeURIComponent(tableroId)}/tareas/${encodeURIComponent(tareaId)}`;

async function subirArchivo<T>(
  path: string,
  datos: FormData,
  metodo: "POST" | "PATCH" = "POST",
): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_URL}${path}`, {
      method: metodo,
      credentials: "include",
      body: datos,
    });
  } catch {
    throw new ApiError(0, "No se pudo conectar con el servidor. Verifica que el backend esté activo.");
  }

  const json = (await respuesta.json().catch(() => ({}))) as { error?: string };
  if (!respuesta.ok) throw new ApiError(respuesta.status, json.error ?? "No se pudo subir el archivo");
  return json as T;
}

type ArchivoEnBlob = { nombre: string; ruta: string; mime: string | null; tamano: number };
type CarpetaSubida = "documentos" | "valores" | "tareas" | "paquetes";

let soporteSubidaDirecta: Promise<boolean> | null = null;

function admiteSubidaDirecta() {
  if (!soporteSubidaDirecta) {
    soporteSubidaDirecta = request<{ directo: boolean }>("/archivos/config")
      .then((r) => r.directo)
      .catch(() => false);
  }
  return soporteSubidaDirecta;
}

// Con Blob conectado el navegador sube directo al store y evita el límite de cuerpo de Vercel.
async function subirEnBlob(archivo: File, carpeta: CarpetaSubida): Promise<ArchivoEnBlob | null> {
  if (!(await admiteSubidaDirecta())) return null;

  try {
    const { upload } = await import("@vercel/blob/client");
    const extension = archivo.name.match(/\.[a-z0-9]+$/i)?.[0].toLowerCase() ?? "";
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const blob = await upload(`${carpeta}/${id}${extension}`, archivo, {
      access: "private",
      handleUploadUrl: `${API_URL}/archivos`,
      clientPayload: JSON.stringify({ carpeta }),
      contentType: archivo.type || undefined,
    });
    return {
      nombre: archivo.name,
      ruta: `blob:${blob.pathname}`,
      mime: archivo.type || null,
      tamano: archivo.size,
    };
  } catch {
    return null;
  }
}

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [anio, mes, dia] = iso.slice(0, 10).split("-");
  return dia && mes && anio ? `${dia}/${mes}/${anio}` : iso;
}

export type EstructuraApi = {
  id: string;
  nombre: string;
  raiz: string;
  carpetas: string[];
};

export type ProyectoApi = {
  id: string;
  nombre: string;
  nombreCorto: string;
  numeroContrato: string;
  organizadores: string;
  entidadContratante: string;
  entidadContratista: string;
  fechaAsignacion: string | null;
  creadoPor: string | null;
  creadoEn: string;
  linea: string;
  estructura: string | null;
  responsable: string;
  liderId: string | null;
  estado: ProjectStatus;
  avance: number;
  presupuesto: number;
  presupuestoNegociacion: number;
  presupuestoEjecucion: number;
  presupuestoAlerta: number;
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
  carpeta: string | null;
  version: string;
  fecha: string;
  fechaDocumento: string | null;
  numeroDocumento: string | null;
  usuario: string;
  estado: Document["status"];
  proyectoId: string;
  archivoNombre: string | null;
  archivoMime: string | null;
  archivoTamano: number | null;
};

export type EdtEstado = "Completado" | "En ejecución" | "No realizado";

export type EdtActividadApi = {
  id: string;
  proyectoId: string;
  etapa: number;
  padreId: string | null;
  nombre: string;
  responsable: string | null;
  fechaCumplimiento: string | null;
  estado: EdtEstado;
  orden: number;
};

export type NuevaEdtActividad = {
  etapa: number;
  padreId?: string | null;
  nombre: string;
  responsable?: string | null;
  fechaCumplimiento?: string | null;
  estado?: EdtEstado;
};

export type ResumenZipApi = {
  ok: boolean;
  actualizados: number;
  creados: number;
  sinCambios: number;
  omitidos: number;
  advertencias: Array<{ archivo: string; motivo: string }>;
};

export type InformeApi = {
  id: string;
  fecha: string;
  tipo: string;
  periodo: string;
  proyecto: string;
  generadoPor: string;
  formato: "PDF" | "Word";
  periodoInicio: string | null;
  periodoFin: string | null;
  contenido: string;
  consolidado: boolean;
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

export type DesembolsoApi = {
  id: string;
  fecha: string;
  concepto: string;
  valor: number;
  clase: "Desembolso" | "Acta parcial";
  numeroActa: string | null;
  proyectoId: string;
};

export type NuevaActividad = {
  nombre: string;
  responsable?: string;
  mesInicio: number;
  mesFin: number;
  avance?: number;
  estado?: GanttActivity["status"];
  hito?: boolean;
};

export type NuevoDesembolso = {
  fecha: string;
  concepto: string;
  valor: number;
  clase?: DesembolsoApi["clase"];
  numeroActa?: string | null;
};

export type DetalleProyectoApi = {
  proyecto: ProyectoApi;
  indicadores: IndicadorApi[];
  documentos: DocumentoApi[];
  actividades: ActividadApi[];
  desembolsos: DesembolsoApi[];
};

export type ValorReferenciaApi = {
  id: string;
  nombre: string;
  tipo: string;
  descripcion: string | null;
  subidoPor: string;
  archivoNombre: string;
  archivoMime: string | null;
  archivoTamano: number;
  creadoEn: string;
  actualizadoEn: string;
  totalTablas: number;
};

export type ColumnaTablaApi = { letra: string; etiqueta: string };

export type ValorTablaApi = {
  id: string;
  hoja: string;
  filaCabecera: number;
  columnas: ColumnaTablaApi[];
  totalFilas: number;
  truncada: boolean;
  analizadaPor: string;
  actualizadoEn: string;
};

export type NuevaValorTabla = {
  hoja: string;
  filaCabecera: number;
  columnas: ColumnaTablaApi[];
  filas: string[][];
  truncada?: boolean;
};

export type EstiloCeldaApi = {
  bold?: boolean;
  italic?: boolean;
  sz?: number;
  color?: string;
  fondo?: string;
  alinear?: string;
  valign?: string;
  envolver?: boolean;
  bordes?: { top?: string; right?: string; bottom?: string; left?: string };
};

export type EstilosLibroApi = Record<string, EstiloCeldaApi>;

export type FormatoApi = {
  id: string;
  nombre: string;
  descripcion: string | null;
  campos: string[];
  activo: boolean;
  esReferencia: boolean;
  valorId: string | null;
  valorNombre: string | null;
  creadoPor: string;
  creadoEn: string;
  totalRegistros: number;
};

export type RegistroFormatoApi = {
  id: string;
  valores: Record<string, string>;
  diligenciadoPor: string;
  creadoEn: string;
};

export type TableroApi = {
  id: string;
  nombre: string;
  descripcion: string;
  creadoPor?: string | null;
  creadoPorNombre?: string | null;
};

export type NuevaTarea = {
  titulo: string;
  descripcion: string;
  proyectoId: string;
  responsableId: string | null;
  prioridad: TareaTablero["prioridad"];
  fechaLimite: string | null;
  etiqueta: string;
};

export type NuevaTareaPersonal = {
  titulo: string;
  descripcion: string;
  prioridad: TareaPersonal["prioridad"];
  fechaLimite: string | null;
  etiqueta: string;
  columna?: TareaPersonal["columna"];
};

export type NuevoProyecto = {
  id: string;
  nombre: string;
  nombreCorto: string;
  numeroContrato: string;
  organizadores: string;
  entidadContratante: string;
  entidadContratista: string;
  fechaAsignacion: string;
  linea: string;
  estructura?: string | null;
  responsable: string;
  liderId?: string | null;
  estado: ProjectStatus;
  dependencia: string;
  objetivo: string;
  presupuesto: number;
  presupuestoNegociacion?: number;
  presupuestoEjecucion?: number;
  presupuestoAlerta?: number;
  fechaInicio?: string;
  fechaFin?: string;
  avance?: number;
  ejecucionPct?: number;
};

export type EliminacionProyectoApi = {
  relacionados: { documentos: number; indicadores: number; actividades: number; edt: number; tareas: number; informes: number };
  puedeEliminar: boolean;
};

export const mapProyecto = (p: ProyectoApi): Project => ({
  id: p.id,
  name: p.nombre,
  nombreCorto: p.nombreCorto,
  numeroContrato: p.numeroContrato,
  organizadores: p.organizadores,
  entidadContratante: p.entidadContratante,
  entidadContratista: p.entidadContratista,
  fechaAsignacion: fechaCorta(p.fechaAsignacion),
  creadoPor: p.creadoPor,
  creadoEn: fechaCorta(p.creadoEn),
  liderId: p.liderId,
  estructura: p.estructura,
  line: p.linea,
  responsible: p.responsable,
  status: p.estado,
  progress: p.avance,
  budget: p.presupuesto,
  budgetNegotiation: p.presupuestoNegociacion,
  budgetExecution: p.presupuestoEjecucion,
  budgetAlert: p.presupuestoAlerta,
  budgetExecuted: p.ejecucionPct,
  startDate: fechaCorta(p.fechaInicio),
  endDate: fechaCorta(p.fechaFin),
  startIso: p.fechaInicio,
  endIso: p.fechaFin,
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
  documentDate: fechaCorta(d.fechaDocumento),
  documentNumber: d.numeroDocumento,
  user: d.usuario,
  status: d.estado,
  projectId: d.proyectoId,
  fileName: d.archivoNombre,
  fileSize: d.archivoTamano,
  folder: d.carpeta,
});

export const mapInforme = (r: InformeApi): Report => ({
  id: r.id,
  date: fechaCorta(r.fecha),
  type: r.tipo,
  period: r.periodo,
  project: r.proyecto,
  generatedBy: r.generadoPor,
  format: r.formato,
  periodStart: r.periodoInicio,
  periodEnd: r.periodoFin,
  content: r.contenido,
  consolidated: r.consolidado,
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

export const mapDesembolso = (d: DesembolsoApi): Desembolso => ({
  id: d.id,
  fecha: d.fecha,
  concepto: d.concepto,
  valor: d.valor,
  clase: d.clase,
  numeroActa: d.numeroActa,
  projectId: d.proyectoId,
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
  registrar: (datos: { nombre: string; email: string; password: string }) =>
    request<{ solicitud: { id: string; email: string; nombre: string } }>("/auth/registro", {
      method: "POST",
      body: datos,
    }),
  usuarioActual: () => request<{ usuario: Usuario }>("/auth/me"),
  actualizarPerfil: (datos: {
    nombre: string;
    fotoUrl: string | null;
    telefono: string | null;
    whatsappOptIn: boolean;
  }) => request<{ usuario: Usuario }>("/auth/me", { method: "PATCH", body: datos }),
  cambiarCorreo: (datos: { email: string; password: string }) =>
    request<{ usuario: Usuario }>("/auth/me/correo", { method: "PATCH", body: datos }),
  cambiarPassword: (datos: { actual: string; nueva: string }) =>
    request<{ ok: boolean }>("/auth/me/password", { method: "PATCH", body: datos }),
  urlGoogle: `${API_URL}/auth/google`,

  dashboard: () => request<DashboardApi>("/dashboard"),

  proyectos: () => request<{ proyectos: ProyectoApi[] }>("/proyectos"),
  proyecto: (id: string) => request<DetalleProyectoApi>(`/proyectos/${encodeURIComponent(id)}`),
  crearProyectoEjemplo: () =>
    request<{ proyecto: ProyectoApi; creado: boolean }>("/proyectos/ejemplo", { method: "POST" }),
  crearProyecto: (datos: NuevoProyecto) =>
    request<{ proyecto: ProyectoApi }>("/proyectos", { method: "POST", body: datos }),
  actualizarProyecto: (id: string, datos: Partial<Omit<NuevoProyecto, "id">>) =>
    request<{ proyecto: ProyectoApi }>(`/proyectos/${encodeURIComponent(id)}`, { method: "PATCH", body: datos }),
  prepararEliminacionProyecto: (id: string) =>
    request<EliminacionProyectoApi>(`/proyectos/${encodeURIComponent(id)}/eliminacion`),
  eliminarProyecto: (id: string, confirmacion: string) =>
    request<{ ok: boolean }>(`/proyectos/${encodeURIComponent(id)}`, { method: "DELETE", body: { confirmacion } }),

  crearActividad: (proyectoId: string, datos: NuevaActividad) =>
    request<{ actividad: ActividadApi }>(
      `/proyectos/${encodeURIComponent(proyectoId)}/actividades`,
      { method: "POST", body: datos },
    ),
  actualizarActividad: (proyectoId: string, actividadId: string, datos: Partial<NuevaActividad>) =>
    request<{ actividad: ActividadApi }>(
      `/proyectos/${encodeURIComponent(proyectoId)}/actividades/${encodeURIComponent(actividadId)}`,
      { method: "PATCH", body: datos },
    ),
  eliminarActividad: (proyectoId: string, actividadId: string) =>
    request<{ ok: boolean }>(
      `/proyectos/${encodeURIComponent(proyectoId)}/actividades/${encodeURIComponent(actividadId)}`,
      { method: "DELETE" },
    ),

  crearDesembolso: (proyectoId: string, datos: NuevoDesembolso) =>
    request<{ desembolso: DesembolsoApi }>(
      `/proyectos/${encodeURIComponent(proyectoId)}/desembolsos`,
      { method: "POST", body: datos },
    ),
  eliminarDesembolso: (proyectoId: string, desembolsoId: string) =>
    request<{ ok: boolean }>(
      `/proyectos/${encodeURIComponent(proyectoId)}/desembolsos/${encodeURIComponent(desembolsoId)}`,
      { method: "DELETE" },
    ),

  estructuras: () => request<{ estructuras: EstructuraApi[] }>("/estructuras"),
  estructura: (id: string) =>
    request<{ estructura: EstructuraApi }>(`/estructuras/${encodeURIComponent(id)}`),

  indicadores: (proyectoId?: string) =>
    request<{ indicadores: IndicadorApi[] }>(`/indicadores${query({ proyectoId })}`),
  documentos: (proyectoId?: string, tipo?: string) =>
    request<{ documentos: DocumentoApi[] }>(`/documentos${query({ proyectoId, tipo })}`),
  subirDocumento: async (
    archivo: File,
    datos: {
      proyectoId: string;
      tipo: string;
      fechaDocumento: string;
      numeroDocumento?: string | null;
      carpeta?: string | null;
      estado: string;
      version?: string;
      nombre?: string;
    },
  ) => {
    const meta = await subirEnBlob(archivo, "documentos");
    if (meta) {
      return request<{ documento: DocumentoApi }>("/documentos", {
        method: "POST",
        body: { ...datos, version: datos.version ?? "v1.0", archivo: meta },
      });
    }

    const formulario = new FormData();
    formulario.append("proyectoId", datos.proyectoId);
    formulario.append("tipo", datos.tipo);
    formulario.append("fechaDocumento", datos.fechaDocumento);
    if (datos.numeroDocumento) formulario.append("numeroDocumento", datos.numeroDocumento);
    if (datos.carpeta) formulario.append("carpeta", datos.carpeta);
    formulario.append("estado", datos.estado);
    formulario.append("version", datos.version ?? "v1.0");
    if (datos.nombre?.trim()) formulario.append("nombre", datos.nombre.trim());
    formulario.append("archivo", archivo);
    return subirArchivo<{ documento: DocumentoApi }>("/documentos", formulario);
  },
  actualizarDocumento: async (
    id: string,
    datos: {
      tipo?: string;
      fechaDocumento?: string | null;
      numeroDocumento?: string | null;
      carpeta?: string | null;
      estado?: string;
      version?: string;
      nombre?: string;
    },
    archivo?: File,
  ) => {
    if (archivo) {
      const meta = await subirEnBlob(archivo, "documentos");
      if (meta) {
        return request<{ documento: DocumentoApi }>(`/documentos/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: { ...datos, archivo: meta },
        });
      }

      const formulario = new FormData();
      if (datos.nombre?.trim()) formulario.append("nombre", datos.nombre.trim());
      if (datos.tipo) formulario.append("tipo", datos.tipo);
      if (datos.carpeta !== undefined) formulario.append("carpeta", datos.carpeta ?? "");
      if (datos.estado) formulario.append("estado", datos.estado);
      if (datos.version) formulario.append("version", datos.version);
      if (datos.fechaDocumento !== undefined) {
        formulario.append("fechaDocumento", datos.fechaDocumento ?? "");
      }
      if (datos.numeroDocumento !== undefined) {
        formulario.append("numeroDocumento", datos.numeroDocumento ?? "");
      }
      formulario.append("archivo", archivo);
      return subirArchivo<{ documento: DocumentoApi }>(
        `/documentos/${encodeURIComponent(id)}`,
        formulario,
        "PATCH",
      );
    }

    return request<{ documento: DocumentoApi }>(`/documentos/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: datos,
    });
  },
  documentoArchivoUrl: (id: string, descargar = false) =>
    `${API_URL}/documentos/${encodeURIComponent(id)}/archivo${descargar ? "?descargar=1" : ""}`,
  documentosZipUrl: (proyectoId: string) =>
    `${API_URL}/documentos/zip?proyectoId=${encodeURIComponent(proyectoId)}`,
  importarDocumentosZip: async (archivo: File, proyectoId: string) => {
    const meta = await subirEnBlob(archivo, "paquetes");
    if (meta) {
      return request<ResumenZipApi>("/documentos/zip", {
        method: "POST",
        body: { proyectoId, archivo: meta },
      });
    }

    const formulario = new FormData();
    formulario.append("proyectoId", proyectoId);
    formulario.append("archivo", archivo);
    return subirArchivo<ResumenZipApi>("/documentos/zip", formulario);
  },
  edt: (proyectoId: string) =>
    request<{ actividades: EdtActividadApi[] }>(`/edt/${encodeURIComponent(proyectoId)}`),
  crearEdtActividad: (proyectoId: string, datos: NuevaEdtActividad) =>
    request<{ actividad: EdtActividadApi }>(`/edt/${encodeURIComponent(proyectoId)}`, {
      method: "POST",
      body: datos,
    }),
  actualizarEdtActividad: (
    id: string,
    datos: Partial<NuevaEdtActividad>,
  ) =>
    request<{ actividad: EdtActividadApi }>(`/edt/actividades/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: datos,
    }),
  eliminarEdtActividad: (id: string) =>
    request<{ ok: boolean }>(`/edt/actividades/${encodeURIComponent(id)}`, { method: "DELETE" }),
  cargarPlantillaEdt: (proyectoId: string) =>
    request<{ actividades: EdtActividadApi[]; creados: number }>(
      `/edt/${encodeURIComponent(proyectoId)}/plantilla`,
      { method: "POST" },
    ),

  informes: (proyecto?: string) =>
    request<{ informes: InformeApi[] }>(`/informes${query({ proyecto })}`),
  crearInforme: (datos: {
    tipo: "Semanal";
    proyecto: string;
    periodoInicio: string;
    periodoFin: string;
    contenido: string;
  }) => request<{ informe: InformeApi }>("/informes", { method: "POST", body: datos }),
  consolidarInforme: (
    datos:
      | { tipo: "Mensual"; proyecto: string; anio: number; mes: number }
      | { tipo: "Trimestral"; proyecto: string; anio: number; trimestre: number },
  ) =>
    request<{ informe: InformeApi; orígenes: number }>("/informes/consolidar", {
      method: "POST",
      body: datos,
    }),
  auditoria: (registro?: string) =>
    request<{ auditoria: AuditoriaApi[] }>(`/auditoria${query({ registro })}`),

  valores: () => request<{ valores: ValorReferenciaApi[] }>("/valores"),
  subirValor: async (
    archivo: File,
    datos: { tipo: string; nombre?: string; descripcion?: string },
  ) => {
    const meta = await subirEnBlob(archivo, "valores");
    if (meta) {
      return request<{ valor: ValorReferenciaApi }>("/valores", {
        method: "POST",
        body: { ...datos, archivo: meta },
      });
    }

    const formulario = new FormData();
    formulario.append("tipo", datos.tipo);
    if (datos.nombre?.trim()) formulario.append("nombre", datos.nombre.trim());
    if (datos.descripcion?.trim()) formulario.append("descripcion", datos.descripcion.trim());
    formulario.append("archivo", archivo);
    return subirArchivo<{ valor: ValorReferenciaApi }>("/valores", formulario);
  },
  valorArchivoUrl: (id: string, descargar = false) =>
    `${API_URL}/valores/${encodeURIComponent(id)}/archivo${descargar ? "?descargar=1" : ""}`,
  actualizarValor: (
    id: string,
    datos: { nombre?: string; tipo?: string; descripcion?: string | null },
  ) =>
    request<{ valor: ValorReferenciaApi }>(`/valores/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: datos,
    }),
  reemplazarValorArchivo: async (id: string, archivo: File) => {
    const meta = await subirEnBlob(archivo, "valores");
    if (meta) {
      return request<{ valor: ValorReferenciaApi }>(
        `/valores/${encodeURIComponent(id)}/archivo`,
        { method: "POST", body: { archivo: meta } },
      );
    }

    const formulario = new FormData();
    formulario.append("archivo", archivo);
    return subirArchivo<{ valor: ValorReferenciaApi }>(
      `/valores/${encodeURIComponent(id)}/archivo`,
      formulario,
    );
  },
  valorEstilos: (id: string, hoja: string) =>
    request<{ estilos: EstilosLibroApi }>(
      `/valores/${encodeURIComponent(id)}/estilos${query({ hoja })}`,
    ),
  valorTablas: (id: string) =>
    request<{ tablas: ValorTablaApi[] }>(`/valores/${encodeURIComponent(id)}/tablas`),
  valorTablaFilas: (id: string, tablaId: string) =>
    request<{ tabla: ValorTablaApi & { filas: string[][] } }>(
      `/valores/${encodeURIComponent(id)}/tablas/${encodeURIComponent(tablaId)}/filas`,
    ),
  guardarValorTabla: (id: string, datos: NuevaValorTabla) =>
    request<{ tabla: ValorTablaApi }>(`/valores/${encodeURIComponent(id)}/tablas`, {
      method: "POST",
      body: datos,
    }),
  eliminarValorTabla: (id: string, tablaId: string) =>
    request<{ ok: boolean }>(
      `/valores/${encodeURIComponent(id)}/tablas/${encodeURIComponent(tablaId)}`,
      { method: "DELETE" },
    ),
  eliminarValor: (id: string) =>
    request<{ ok: boolean }>(`/valores/${encodeURIComponent(id)}`, { method: "DELETE" }),
  formatos: () => request<{ formatos: FormatoApi[] }>("/formatos"),
  crearFormato: (datos: { nombre: string; descripcion?: string; campos: string[]; valorId?: string | null }) =>
    request<{ formato: FormatoApi }>("/formatos", { method: "POST", body: datos }),
  actualizarFormato: (
    id: string,
    datos: { nombre?: string; descripcion?: string | null; campos?: string[]; valorId?: string | null },
  ) =>
    request<{ formato: FormatoApi }>(`/formatos/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: datos,
    }),
  eliminarFormato: (id: string) =>
    request<{ ok: boolean }>(`/formatos/${encodeURIComponent(id)}`, { method: "DELETE" }),
  registrosFormato: (formatoId: string) =>
    request<{ registros: RegistroFormatoApi[] }>(`/formatos/${encodeURIComponent(formatoId)}/registros`),
  crearRegistroFormato: (formatoId: string, valores: Record<string, string>) =>
    request<{ registro: RegistroFormatoApi }>(`/formatos/${encodeURIComponent(formatoId)}/registros`, {
      method: "POST",
      body: { valores },
    }),

  tableros: () => request<{ tableros: (TableroApi & { totalTareas: number })[] }>("/tableros"),
  crearTablero: (datos: { nombre: string; descripcion: string }) =>
    request<{ tablero: TableroApi & { totalTareas: number } }>("/tableros", {
      method: "POST",
      body: datos,
    }),
  tablero: (id: string) => request<{ tablero: TableroApi; tareas: TareaTablero[] }>(`/tableros/${id}`),
  miTablero: () =>
    request<{ tareasProyecto: TareaTablero[]; tareasPersonales: TareaPersonal[] }>("/mi-tablero"),
  crearTareaPersonal: (datos: NuevaTareaPersonal) =>
    request<{ tarea: TareaPersonal }>("/mi-tablero/personales", { method: "POST", body: datos }),
  actualizarTareaPersonal: (id: string, datos: Partial<NuevaTareaPersonal>) =>
    request<{ tarea: TareaPersonal }>(`/mi-tablero/personales/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: datos,
    }),
  eliminarTareaPersonal: (id: string) =>
    request<{ ok: boolean }>(`/mi-tablero/personales/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  crearTarea: (tableroId: string, datos: NuevaTarea) =>
    request<{ tarea: TareaTablero }>(`/tableros/${tableroId}/tareas`, { method: "POST", body: datos }),
  actualizarTarea: (tableroId: string, tareaId: string, datos: Partial<NuevaTarea>) =>
    request<{ tarea: TareaTablero }>(`/tableros/${tableroId}/tareas/${tareaId}`, {
      method: "PATCH",
      body: datos,
    }),
  eliminarTarea: (tableroId: string, tareaId: string) =>
    request<{ ok: boolean }>(tareaPath(tableroId, tareaId), { method: "DELETE" }),
  marcarEntendido: (tableroId: string, tareaId: string) =>
    request<{ tarea: TareaTablero }>(`${tareaPath(tableroId, tareaId)}/entendido`, {
      method: "POST",
    }),
  enviarRevision: (tableroId: string, tareaId: string) =>
    request<{ tarea: TareaTablero }>(`${tareaPath(tableroId, tareaId)}/enviar-revision`, {
      method: "POST",
    }),
  aprobarTarea: (tableroId: string, tareaId: string) =>
    request<{ tarea: TareaTablero }>(`${tareaPath(tableroId, tareaId)}/aprobar`, {
      method: "POST",
    }),
  devolverTarea: (tableroId: string, tareaId: string, motivo: string) =>
    request<{ tarea: TareaTablero }>(`${tareaPath(tableroId, tareaId)}/devolver`, {
      method: "POST",
      body: { motivo },
    }),

  comentariosTarea: (tableroId: string, tareaId: string) =>
    request<{ comentarios: ComentarioTarea[] }>(`${tareaPath(tableroId, tareaId)}/comentarios`),
  crearComentario: (tableroId: string, tareaId: string, contenido: string) =>
    request<{ comentario: ComentarioTarea }>(`${tareaPath(tableroId, tareaId)}/comentarios`, {
      method: "POST",
      body: { contenido },
    }),
  eliminarComentario: (tableroId: string, tareaId: string, comentarioId: string) =>
    request<{ ok: boolean }>(
      `${tareaPath(tableroId, tareaId)}/comentarios/${encodeURIComponent(comentarioId)}`,
      { method: "DELETE" },
    ),
  adjuntosTarea: (tableroId: string, tareaId: string) =>
    request<{ adjuntos: AdjuntoTarea[] }>(`${tareaPath(tableroId, tareaId)}/adjuntos`),
  subirAdjunto: async (tableroId: string, tareaId: string, archivo: File) => {
    const ruta = `${tareaPath(tableroId, tareaId)}/adjuntos`;
    const meta = await subirEnBlob(archivo, "tareas");
    if (meta) {
      return request<{ adjunto: AdjuntoTarea }>(ruta, { method: "POST", body: { archivo: meta } });
    }

    const datos = new FormData();
    datos.append("archivo", archivo);
    return subirArchivo<{ adjunto: AdjuntoTarea }>(ruta, datos);
  },
  eliminarAdjunto: (tableroId: string, tareaId: string, adjuntoId: string) =>
    request<{ ok: boolean }>(
      `${tareaPath(tableroId, tareaId)}/adjuntos/${encodeURIComponent(adjuntoId)}`,
      { method: "DELETE" },
    ),
  adjuntoUrl: (tableroId: string, tareaId: string, adjuntoId: string, descargar = false) =>
    `${API_URL}${tareaPath(tableroId, tareaId)}/adjuntos/${encodeURIComponent(adjuntoId)}/archivo${
      descargar ? "?descargar=1" : ""
    }`,

  usuariosAsignables: () =>
    request<{ usuarios: UsuarioAsignable[] }>("/usuarios/asignables"),
  usuarios: () => request<{ usuarios: UsuarioAdmin[] }>("/usuarios"),
  crearUsuario: (datos: { email: string; nombre: string; rol: Rol; password: string }) =>
    request<{ usuario: UsuarioAdmin }>("/usuarios", { method: "POST", body: datos }),
  actualizarUsuario: (id: string, datos: { nombre?: string; rol?: Rol; activo?: boolean }) =>
    request<{ usuario: UsuarioAdmin }>(`/usuarios/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: datos,
    }),
  aprobarUsuario: (id: string, rol: Rol) =>
    request<{ usuario: UsuarioAdmin }>(`/usuarios/${encodeURIComponent(id)}/aprobar`, {
      method: "POST",
      body: { rol },
    }),
  rechazarSolicitud: (id: string) =>
    request<{ ok: boolean }>(`/usuarios/${encodeURIComponent(id)}/solicitud`, {
      method: "DELETE",
    }),

  notificaciones: () =>
    request<{
      notificaciones: NotificacionTarea[];
      total: number;
      alcance: AlcanceNotificaciones;
    }>("/notificaciones"),

  calendario: (desde: string, hasta: string) =>
    request<CalendarioDatos>(`/calendario${query({ desde, hasta })}`),
  crearEvento: (datos: NuevoEvento) =>
    request<{ evento: EventoCalendario }>("/calendario/eventos", { method: "POST", body: datos }),
  actualizarEvento: (id: string, datos: Partial<NuevoEvento>) =>
    request<{ evento: EventoCalendario }>(`/calendario/eventos/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: datos,
    }),
  eliminarEvento: (id: string) =>
    request<{ ok: boolean }>(`/calendario/eventos/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
