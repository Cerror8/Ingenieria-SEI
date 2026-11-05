import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  MessageSquare,
  Paperclip,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { api } from "../../api/client";
import type { AdjuntoTarea, ComentarioTarea, TareaTablero, Usuario } from "../../types";

const ACEPTADOS = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt";

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
  tarea,
  usuario,
  onCerrar,
  onContadores,
  onAviso,
}: {
  tableroId: string;
  tarea: TareaTablero;
  usuario: Usuario;
  onCerrar: () => void;
  onContadores: (tareaId: string, cambios: { comentarios?: number; adjuntos?: number }) => void;
  onAviso: (mensaje: string) => void;
}) {
  const [comentarios, setComentarios] = useState<ComentarioTarea[]>([]);
  const [adjuntos, setAdjuntos] = useState<AdjuntoTarea[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);
  const esAdmin = usuario.rol === "admin";

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    Promise.all([api.comentariosTarea(tableroId, tarea.id), api.adjuntosTarea(tableroId, tarea.id)])
      .then(([respuestaComentarios, respuestaAdjuntos]) => {
        if (!vigente) return;
        setComentarios(respuestaComentarios.comentarios);
        setAdjuntos(respuestaAdjuntos.adjuntos);
        setError(null);
      })
      .catch((e: unknown) => {
        if (vigente) setError(e instanceof Error ? e.message : "No se pudo cargar el detalle.");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [tableroId, tarea.id]);

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
        className="my-4 w-full max-w-2xl rounded-xl bg-white shadow-2xl sm:my-8"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9A3412]">
              {tarea.etiqueta}
            </span>
            <h2 className="mt-1.5 text-base font-bold leading-snug text-slate-800 sm:text-lg">
              {tarea.titulo}
            </h2>
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
          </div>

          {tarea.descripcion && (
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-600">
              {tarea.descripcion}
            </p>
          )}

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
                          <p className="text-[10px] text-slate-400">{fechaHora(comentario.creadoEn)}</p>
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
                    placeholder="Escribe un comentario…"
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
