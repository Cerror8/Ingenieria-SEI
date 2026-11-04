// Cliente HTTP mínimo. Hoy la UI usa datos mock (src/app/data/mock.ts);
// al conectar el backend, reemplaza cada uso de PROJECTS/INDICATORS/... por estas llamadas.
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

// El módulo se integra a la plataforma universitaria: NO hay login propio.
// Mientras no exista SSO, el usuario institucional se envía en una cabecera.
const USUARIO = import.meta.env.VITE_DEV_USER ?? "dev.pmo@universidad.edu.co";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Usuario-Institucional": USUARIO, ...init.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Error de red");
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  listarProyectos: () => request<unknown[]>("/proyectos"),
  obtenerProyecto: (id: string) => request<unknown>(`/proyectos/${id}`),
  crearProyecto: (data: unknown) => request<unknown>("/proyectos", { method: "POST", body: JSON.stringify(data) }),
  actualizarProyecto: (id: string, data: unknown) => request<unknown>(`/proyectos/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  dashboard: (id: string) => request<unknown>(`/proyectos/${id}/dashboard`),
  actividades: (id: string) => request<unknown[]>(`/proyectos/${id}/actividades`),
  crearActividad: (id: string, data: unknown) => request<unknown>(`/proyectos/${id}/actividades`, { method: "POST", body: JSON.stringify(data) }),
  actualizarAvance: (id: string, data: { porcentaje: number; descripcion: string }) =>
    request<unknown>(`/proyectos/${id}/avance`, { method: "POST", body: JSON.stringify(data) }),
  presupuesto: (id: string) => request<unknown>(`/proyectos/${id}/presupuesto`),
  agregarContrapartida: (id: string, data: unknown) => request<unknown>(`/proyectos/${id}/contrapartidas`, { method: "POST", body: JSON.stringify(data) }),
  agregarDesembolso: (id: string, data: unknown) => request<unknown>(`/proyectos/${id}/desembolsos`, { method: "POST", body: JSON.stringify(data) }),
  asociarAntecedente: (id: string, antecedente: string) =>
    request<unknown>(`/proyectos/${id}/antecedentes`, { method: "POST", body: JSON.stringify({ antecedente }) }),
  catalogos: () => request<{ lineas: unknown[]; dependencias: unknown[]; ods: unknown[]; antecedentes: unknown[] }>("/catalogos"),
  validarCodigo: (codigo: string) => request<{ disponible: boolean }>(`/proyectos/validar-codigo/${codigo}`),
  ficha: (id: string) => request<unknown>(`/proyectos/${id}/ficha`),
  guardarFicha: (id: string, data: unknown) => request<unknown>(`/proyectos/${id}/ficha`, { method: "PUT", body: JSON.stringify(data) }),
  documentos: (id: string) => request<unknown[]>(`/proyectos/${id}/documentos`),
  generarInforme: (id: string, tipo: "Diario" | "Semanal" | "Proyecto") =>
    request<unknown>(`/proyectos/${id}/informes`, { method: "POST", body: JSON.stringify({ tipo }) }),
  auditoria: (id: string) => request<unknown[]>(`/proyectos/${id}/auditoria`),
};
