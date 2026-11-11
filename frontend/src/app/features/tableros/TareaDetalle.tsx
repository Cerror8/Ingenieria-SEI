import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  MessageSquare,
  Paperclip,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { api, type EdtActividadApi, type TableroApi } from "../../api/client";
import type {
  AdjuntoTarea,
  ComentarioTarea,
  TareaTablero,
  Usuario,
  UsuarioAsignable,
} from "../../types";

const ACEPTADOS = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt";

const ESTADO_TAREA: Record<TareaTablero["columna"], { label: string; badge: string }> = {
  "por-hacer": { label: "Por hacer", badge: "bg-slate-100 text-slate-600 border-slate-200" },
  "en-curso": { label: "En curso", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  "en-revision": { label: "En revisión", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  completado: { label: "Completado", badge: "bg-green-50 text-green-700 border-green-200" },
};

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

function fechaHora(iso: string) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function peso(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Avatar({ nombre, foto }: { nombre: string; foto: string | null }) {
  return (
    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1F2937] text-[10px] font-bold text-white">
      {foto ? (
        <img
          src={foto}
          alt={nombre}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : (
        iniciales(nombre)
      )}
    </span>
  );
}

const COLOR_PRIORIDAD: Record<TareaTablero["prioridad"], string> = {
  Alta: "bg-red-50 text-red-700 border-red-200",
  Media: "bg-amber-50 text-amber-700 border-amber-200",
  Baja: "bg-sky-50 text-sky-700 border-sky-200",
};

export function TareaDetalle({
  tableroId,
  tablero,
  tarea,
  usuario,
  usuariosAsignables,
  onCerrar,
  onContadores,
  onTareaActualizada,
  onAviso,
}: {
  tableroId: string;
  tablero: TableroApi;
  tarea: TareaTablero;
  usuario: Usuario;
  usuariosAsignables: UsuarioAsignable[];
  onCerrar: () => void;
  onContadores: (tareaId: string, cambios: { comentarios?: number; adjuntos?: number }) => void;
  onTareaActualizada: (tarea: TareaTablero) => void;
  onAviso: (mensaje: string) => void;
}) {
  const [comentarios, setComentarios] = useState<ComentarioTarea[]>([]);
  const [adjuntos, setAdjuntos] = useState<AdjuntoTarea[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [accion, setAccion] = useState<string | null>(null);
  const [devolviendo, setDevolviendo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [edtActividades, setEdtActividades] = useState<EdtActividadApi[]>([]);
  const archivoRef = useRef<HTMLInputElement>(null);

  const esAdmin = usuario.rol === "admin";
  const esAsignado = Boolean(tarea.responsableId && tarea.responsableId === usuario.id);
  const esGestor =
    esAdmin ||
    tarea.creadoPor === usuario.id ||
    tarea.proyectoLiderId === usuario.id ||
    tarea.tableroCreadoPor === usuario.id;

  const ultimaDevolucionMs = tarea.ultimaDevolucionEn
    ? new Date(tarea.ultimaDevolucionEn).getTime()
    : 0;
  const comentarioValido = comentarios.some(
    (comentario) =>
      comentario.usuarioId === tarea.responsableId &&
      new Date(comentario.creadoEn).getTime() > ultimaDevolucionMs,
  );
  const adjuntoValido = adjuntos.some(
    (adjunto) =>
      adjunto.usuarioId === tarea.responsableId &&
      new Date(adjunto.creadoEn).getTime() > ultimaDevolucionMs,
  );
  const listoParaRevision = comentarioValido && adjuntoValido;

  const cargarColaboracion = useCallback(async () => {
    setCargando(true);
    try {
      const [respuestaComentarios, respuestaAdjuntos] = await Promise.all([
        api.comentariosTarea(tableroId, tarea.id),
        api.adjuntosTarea(tableroId, tarea.id),
      ]);
      setComentarios(respuestaComentarios.comentarios);
      setAdjuntos(respuestaAdjuntos.adjuntos);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el detalle.");
    } finally {
      setCargando(false);
    }
  }, [tableroId, tarea.id]);

  useEffect(() => {
    void cargarColaboracion();
  }, [cargarColaboracion]);

  useEffect(() => {
    if (!tarea.proyectoId) {
      setEdtActividades([]);
      return;
    }
    let cancelado = false;
    void api
      .edt(tarea.proyectoId)
      .then(({ actividades }) => {
        if (!cancelado) setEdtActividades(actividades);
      })
      .catch(() => {
        if (!cancelado) setEdtActividades([]);
      });
    return () => {
      cancelado = true;
    };
  }, [tarea.proyectoId]);

  useEffect(() => {
    const cerrarEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", cerrarEscape);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", cerrarEscape);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onCerrar]);

  async function crearComentario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const contenido = texto.trim();
    if (!contenido || enviando) return;

    setEnviando(true);
    try {
      const { comentario } = await api.crearComentario(tableroId, tarea.id, contenido);
      const siguiente = [...comentarios, comentario];
      setComentarios(siguiente);
      onContadores(tarea.id, { comentarios: siguiente.length });
      setTexto("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo publicar el comentario.");
    } finally {
      setEnviando(false);
    }
  }

  async function borrarComentario(comentarioId: string) {
    try {
      await api.eliminarComentario(tableroId, tarea.id, comentarioId);
      const siguiente = comentarios.filter((item) => item.id !== comentarioId);
      setComentarios(siguiente);
      onContadores(tarea.id, { comentarios: siguiente.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el comentario.");
    }
  }

  async function subirArchivo(archivo: File) {
    setSubiendo(true);
    setError(null);
    try {
      const { adjunto } = await api.subirAdjunto(tableroId, tarea.id, archivo);
      const siguiente = [adjunto, ...adjuntos];
      setAdjuntos(siguiente);
      onContadores(tarea.id, { adjuntos: siguiente.length });
      onAviso(`Archivo “${adjunto.nombre}” adjuntado.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo adjuntar el archivo.");
    } finally {
      setSubiendo(false);
      if (archivoRef.current) archivoRef.current.value = "";
    }
  }

  async function borrarAdjunto(adjuntoId: string) {
    try {
      await api.eliminarAdjunto(tableroId, tarea.id, adjuntoId);
      const siguiente = adjuntos.filter((item) => item.id !== adjuntoId);
      setAdjuntos(siguiente);
      onContadores(tarea.id, { adjuntos: siguiente.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el adjunto.");
    }
  }

  async function ejecutar(nombre: string, fn: () => Promise<{ tarea: TareaTablero }>) {
    setAccion(nombre);
    setError(null);
    try {
      const { tarea: actualizada } = await fn();
      onTareaActualizada(actualizada);
      return actualizada;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
      return null;
    } finally {
      setAccion(null);
    }
  }

  async function asignar(responsableId: string) {
    await ejecutar("asignar", () =>
      api.actualizarTarea(tableroId, tarea.id, {
        responsableId: responsableId || null,
      }),
    );
  }

  async function vincularEdt(edtActividadId: string) {
    await ejecutar("edt", () =>
      api.actualizarTarea(tableroId, tarea.id, {
        edtActividadId: edtActividadId || null,
      }),
    );
  }

  async function devolverTarea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (motivo.trim().length < 5) {
      setError("Explica qué debe corregirse (mínimo 5 caracteres).");
      return;
    }
    const actualizada = await ejecutar("devolver", () =>
      api.devolverTarea(tableroId, tarea.id, motivo.trim()),
    );
    if (actualizada) {
      setMotivo("");
      setDevolviendo(false);
      await cargarColaboracion();
      onAviso("La tarea fue devuelta con las correcciones indicadas.");
    }
  }

  const estado = ESTADO_TAREA[tarea.columna];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-3 sm:p-4"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${tarea.titulo}`}
        onClick={(evento) => evento.stopPropagation()}
        className="my-4 w-full max-w-3xl rounded-xl bg-white shadow-2xl sm:my-8"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9A3412]">
                {tarea.etiqueta}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${estado.badge}`}
              >
                {estado.label}
              </span>
            </div>
            <h2 className="mt-1.5 text-base font-bold leading-snug text-slate-800 sm:text-lg">
              {tarea.titulo}
            </h2>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">
              {tarea.proyectoId
                ? `${tarea.proyectoId} · ${tarea.proyectoNombre ?? "Proyecto"}`
                : "Tarea sin proyecto"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar detalle"
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${COLOR_PRIORIDAD[tarea.prioridad]}`}
            >
              Prioridad {tarea.prioridad.toLowerCase()}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              <CalendarDays className="h-3 w-3" />
              {tarea.fechaLimite ? tarea.fechaLimite.slice(0, 10) : "Sin fecha límite"}
            </span>
            {tarea.completadoEn && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                Completada el {fechaHora(tarea.completadoEn)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              <Avatar nombre={tarea.responsable} foto={tarea.responsableFoto} />
              {tarea.responsable}
            </span>
            {tarea.edtActividadNombre && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-[#9A3412]"
                title={`Actividad EDT de la etapa ${tarea.edtEtapa}`}
              >
                EDT E{tarea.edtEtapa} · {tarea.edtActividadNombre} · {tarea.edtEstado}
              </span>
            )}
          </div>

          <div className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-[11px] sm:grid-cols-3">
            <div>
              <p className="font-bold uppercase tracking-wide text-slate-400">Creada por</p>
              <p className="mt-0.5 font-semibold text-slate-600">
                {tarea.creadoPorNombre ?? "Sin registrar"}
              </p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-wide text-slate-400">Líder del proyecto</p>
              <p className="mt-0.5 font-semibold text-slate-600">
                {tarea.proyectoLiderNombre ?? "Sin asignar"}
              </p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-wide text-slate-400">Líder del tablero</p>
              <p className="mt-0.5 font-semibold text-slate-600">
                {tablero.creadoPorNombre ?? "Sin registrar"}
              </p>
            </div>
          </div>

          {tarea.descripcion && (
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-600">
              {tarea.descripcion}
            </p>
          )}

          {esGestor && tarea.columna !== "completado" && (
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 sm:flex-row sm:items-center">
              <label
                htmlFor="asignar-responsable"
                className="text-[11px] font-bold uppercase tracking-wide text-slate-500"
              >
                Responsable
              </label>
              <select
                id="asignar-responsable"
                value={tarea.responsableId ?? ""}
                disabled={accion !== null}
                onChange={(e) => void asignar(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#EA580C] disabled:opacity-60"
              >
                <option value="">Sin asignar</option>
                {usuariosAsignables.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} · {u.rol}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400">
                Solo el creador o el líder pueden asignar.
              </span>
            </div>
          )}

          {esGestor && tarea.proyectoId && (
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 sm:flex-row sm:items-center">
              <label
                htmlFor="vincular-edt"
                className="text-[11px] font-bold uppercase tracking-wide text-slate-500"
              >
                Actividad EDT
              </label>
              <select
                id="vincular-edt"
                value={tarea.edtActividadId ?? ""}
                disabled={accion !== null}
                onChange={(e) => void vincularEdt(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#EA580C] disabled:opacity-60"
              >
                <option value="">Sin vincular al EDT</option>
                {[...edtActividades]
                  .sort((a, b) => a.etapa - b.etapa || a.orden - b.orden)
                  .map((actividad) => (
                    <option key={actividad.id} value={actividad.id}>
                      {actividad.padreId ? "↳ " : ""}E{actividad.etapa} ·{" "}
                      {actividad.nombre || "Sin nombre"}
                    </option>
                  ))}
              </select>
              <span className="text-[10px] text-slate-400">
                {tarea.edtActividadId
                  ? `Estado actual: ${tarea.edtEstado}`
                  : "Al vincularla, el estado y el avance se sincronizan."}
              </span>
            </div>
          )}

          <section className="rounded-xl border border-[#EA580C]/25 bg-orange-50/40 px-3 py-3">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#9A3412]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Flujo de la tarea
            </h3>

            {tarea.columna === "por-hacer" && (
              <div className="mt-2 space-y-2">
                <p className="text-xs leading-relaxed text-slate-600">
                  La tarea está en <strong>Por hacer</strong>.{" "}
                  {tarea.responsableId
                    ? "La persona asignada debe confirmar que la entendió para pasar a “En curso”."
                    : "Primero asígnale un responsable."}
                </p>
                {esAsignado && (
                  <button
                    type="button"
                    disabled={accion !== null}
                    onClick={() => void ejecutar("entendido", () => api.marcarEntendido(tableroId, tarea.id))}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {accion === "entendido" ? "Iniciando…" : "Entendido, iniciar tarea"}
                  </button>
                )}
              </div>
            )}

            {tarea.columna === "en-curso" && (
              <div className="mt-2 space-y-2.5">
                <p className="text-xs leading-relaxed text-slate-600">
                  Para enviar a revisión se necesita un comentario de lo realizado y al menos una
                  evidencia o documento. Ambos deben ser de la persona asignada.
                </p>

                {esAsignado ? (
                  <>
                    <ul className="space-y-1 text-[11px]">
                      <li
                        className={`flex items-center gap-1.5 ${comentarioValido ? "text-green-700" : "text-slate-500"}`}
                      >
                        <CheckCircle2
                          className={`h-3.5 w-3.5 ${comentarioValido ? "text-green-500" : "text-slate-300"}`}
                        />
                        Comentario de avance {comentarioValido ? "registrado" : "pendiente"}
                      </li>
                      <li
                        className={`flex items-center gap-1.5 ${adjuntoValido ? "text-green-700" : "text-slate-500"}`}
                      >
                        <CheckCircle2
                          className={`h-3.5 w-3.5 ${adjuntoValido ? "text-green-500" : "text-slate-300"}`}
                        />
                        Evidencia adjunta {adjuntoValido ? "registrada" : "pendiente"}
                      </li>
                    </ul>
                    {tarea.ultimaDevolucionEn && (
                      <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                        La tarea fue devuelta el {fechaHora(tarea.ultimaDevolucionEn)}. El comentario
                        y la evidencia deben ser posteriores a esa devolución.
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={accion !== null || !listoParaRevision}
                      title={
                        listoParaRevision
                          ? "Enviar la tarea a revisión"
                          : "Agrega un comentario y una evidencia de la persona asignada"
                      }
                      onClick={() => void ejecutar("revision", () => api.enviarRevision(tableroId, tarea.id))}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {accion === "revision" ? "Enviando…" : "Enviar a revisión"}
                    </button>
                  </>
                ) : (
                  <p className="rounded-lg bg-white px-2.5 py-2 text-[11px] text-slate-500">
                    En curso por {tarea.responsable}. Solo esa persona puede entregar el avance.
                  </p>
                )}
              </div>
            )}

            {tarea.columna === "en-revision" && (
              <div className="mt-2 space-y-2.5">
                <p className="text-xs leading-relaxed text-slate-600">
                  La entrega está en revisión. Quien creó la tarea o lidera el proyecto puede
                  aprobarla o devolverla con correcciones.
                </p>

                {esGestor ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={accion !== null}
                        onClick={() => void ejecutar("aprobar", () => api.aprobarTarea(tableroId, tarea.id))}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {accion === "aprobar" ? "Aprobando…" : "Aprobar y completar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDevolviendo((valor) => !valor)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Devolver con correcciones
                      </button>
                    </div>

                    {devolviendo && (
                      <form onSubmit={devolverTarea} className="space-y-2">
                        <textarea
                          value={motivo}
                          onChange={(e) => setMotivo(e.target.value)}
                          rows={3}
                          maxLength={1000}
                          required
                          minLength={5}
                          placeholder="Explica qué está mal o qué debe corregirse…"
                          aria-label="Motivo de la devolución"
                          className="w-full resize-none rounded-lg border border-red-200 bg-white px-2.5 py-2 text-xs text-slate-700 outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-500/10"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={accion !== null || motivo.trim().length < 5}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                          >
                            {accion === "devolver" ? "Devolviendo…" : "Confirmar devolución"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDevolviendo(false);
                              setMotivo("");
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ) : (
                  <p className="rounded-lg bg-white px-2.5 py-2 text-[11px] text-slate-500">
                    En revisión. La aprobación corresponde a quien creó la tarea o lidera el
                    proyecto.
                  </p>
                )}
              </div>
            )}

            {tarea.columna === "completado" && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Tarea aprobada y completada
                {tarea.completadoEn ? ` el ${fechaHora(tarea.completadoEn)}` : ""}.
              </p>
            )}
          </section>

          {error && (
            <div className="flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-xs font-medium text-red-700">{error}</p>
              <button type="button" onClick={() => setError(null)} aria-label="Cerrar error">
                <X className="h-3.5 w-3.5 text-red-400" />
              </button>
            </div>
          )}

          {cargando ? (
            <p className="py-6 text-center text-xs text-slate-400">Cargando colaboración…</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <section className="flex min-h-0 flex-col">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Comentarios ({comentarios.length})
                </h3>

                <ul className="mt-2 max-h-56 flex-1 space-y-2 overflow-y-auto pr-1">
                  {comentarios.map((comentario) => (
                    <li
                      key={comentario.id}
                      className="rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar nombre={comentario.autor} foto={comentario.autorFoto} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-semibold text-slate-700">
                            {comentario.autor}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {fechaHora(comentario.creadoEn)}
                          </p>
                        </div>
                        {(comentario.usuarioId === usuario.id || esAdmin) && (
                          <button
                            type="button"
                            onClick={() => void borrarComentario(comentario.id)}
                            aria-label="Eliminar comentario"
                            className="rounded p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap break-words text-xs text-slate-600">
                        {comentario.contenido}
                      </p>
                    </li>
                  ))}
                  {!comentarios.length && (
                    <li className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-[11px] text-slate-400">
                      Sin comentarios todavía.
                    </li>
                  )}
                </ul>

                <form onSubmit={crearComentario} className="mt-2 flex items-end gap-2">
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder={
                      tarea.columna === "en-curso" && esAsignado
                        ? "Describe lo realizado…"
                        : "Escribe un comentario…"
                    }
                    aria-label="Comentario"
                    className="min-w-0 flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-2 text-xs text-slate-700 outline-none transition focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-orange-500/10"
                  />
                  <button
                    type="submit"
                    disabled={enviando || !texto.trim()}
                    aria-label="Publicar comentario"
                    className="rounded-lg bg-[#C2410C] p-2 text-white transition hover:bg-[#9A3412] disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </section>

              <section>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <Paperclip className="h-3.5 w-3.5" />
                    Adjuntos ({adjuntos.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => archivoRef.current?.click()}
                    disabled={subiendo}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-[#EA580C] hover:text-[#C2410C] disabled:opacity-50"
                  >
                    {subiendo ? "Subiendo…" : "Adjuntar"}
                  </button>
                  <input
                    ref={archivoRef}
                    type="file"
                    accept={ACEPTADOS}
                    className="hidden"
                    onChange={(e) => {
                      const archivo = e.target.files?.[0];
                      if (archivo) void subirArchivo(archivo);
                    }}
                  />
                </div>

                <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {adjuntos.map((adjunto) => (
                    <li
                      key={adjunto.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2"
                    >
                      <Paperclip className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <a
                          href={api.adjuntoUrl(tableroId, tarea.id, adjunto.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-[11px] font-semibold text-[#9A3412] hover:underline"
                        >
                          {adjunto.nombre}
                        </a>
                        <p className="text-[10px] text-slate-400">
                          {peso(Number(adjunto.tamano))} · {adjunto.subidoPor}
                        </p>
                      </div>
                      <a
                        href={api.adjuntoUrl(tableroId, tarea.id, adjunto.id, true)}
                        aria-label={`Descargar ${adjunto.nombre}`}
                        className="rounded p-1 text-slate-400 transition hover:bg-white hover:text-[#C2410C]"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                      {(adjunto.usuarioId === usuario.id || esAdmin) && (
                        <button
                          type="button"
                          onClick={() => void borrarAdjunto(adjunto.id)}
                          aria-label={`Eliminar ${adjunto.nombre}`}
                          className="rounded p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                  {!adjuntos.length && (
                    <li className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-[11px] text-slate-400">
                      Sin archivos adjuntos.
                    </li>
                  )}
                </ul>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  PDF, Word, Excel, PowerPoint, imágenes o texto · hasta 20 MB.
                </p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
