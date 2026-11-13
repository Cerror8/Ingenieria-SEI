import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Circle, FileText, FolderOpen, ListChecks, RefreshCw, Upload, X } from "lucide-react";
import { api, ApiError, type DocumentoApi, type EdtActividadApi, type EdtApi } from "../../api/client";
import { fechaCorta } from "../../lib/urgencia";
import { SubirDocumentoModal } from "../documentos/SubirDocumentoModal";

type Props = {
  abierto: boolean;
  proyectoId: string;
  onCerrar: () => void;
  onActualizado: () => void;
  onShowToast: (mensaje: string) => void;
};

type FiltroChecklist = "todos" | "recibidos" | "pendientes" | "no-aplica";

const esDocumental = (actividad: EdtActividadApi) =>
  actividad.tipo !== "Actividad" || actividad.requiereDocumento || actividad.documentos > 0;

const COLOR_ESTADO: Record<string, string> = {
  Aprobado: "text-emerald-700",
  "En revisión": "text-amber-700",
  Rechazado: "text-rose-700",
  Borrador: "text-slate-500",
};

export function ChecklistDocumentalModal({ abierto, proyectoId, onCerrar, onActualizado, onShowToast }: Props) {
  const [edt, setEdt] = useState<EdtApi | null>(null);
  const [documentosProyecto, setDocumentosProyecto] = useState<DocumentoApi[]>([]);
  const [filtro, setFiltro] = useState<FiltroChecklist>("todos");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [subida, setSubida] = useState<EdtActividadApi | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [datosEdt, { documentos }] = await Promise.all([
        api.edt(proyectoId),
        api.documentos(proyectoId),
      ]);
      setEdt(datosEdt);
      setDocumentosProyecto(documentos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el checklist.");
    } finally {
      setCargando(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    if (abierto) void cargar();
    else {
      setEdt(null);
      setDocumentosProyecto([]);
      setFiltro("todos");
      setError(null);
      setSubida(null);
    }
  }, [abierto, cargar]);

  const documentosPorActividad = useMemo(() => {
    const mapa = new Map<string, DocumentoApi[]>();
    for (const documento of documentosProyecto) {
      if (!documento.edtActividadId) continue;
      const lista = mapa.get(documento.edtActividadId) ?? [];
      lista.push(documento);
      mapa.set(documento.edtActividadId, lista);
    }
    return mapa;
  }, [documentosProyecto]);

  const recibidosDe = (actividad: EdtActividadApi) =>
    documentosPorActividad.get(actividad.id)?.length ?? actividad.documentos;

  const grupos = useMemo(() => {
    if (!edt) return [];
    const items = edt.actividades.filter((actividad) => {
      if (!esDocumental(actividad)) return false;
      const recibidos = documentosPorActividad.get(actividad.id)?.length ?? actividad.documentos;
      if (filtro === "recibidos") return !actividad.noAplica && recibidos > 0;
      if (filtro === "pendientes") return !actividad.noAplica && recibidos === 0;
      if (filtro === "no-aplica") return actividad.noAplica;
      return true;
    });
    const fases = [...edt.fases].sort((a, b) => a.orden - b.orden);
    const resultado = fases
      .map((fase) => ({
        fase,
        actividades: items
          .filter((actividad) => actividad.faseId === fase.id)
          .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre)),
      }))
      .filter((grupo) => grupo.actividades.length > 0);
    const sinFase = items.filter((actividad) => !fases.some((fase) => fase.id === actividad.faseId));
    if (sinFase.length) {
      resultado.push({
        fase: { id: "sin-fase", orden: 999, nombre: "Sin fase", descripcion: "", proyectoId, clave: null, esPrincipal: false, dependeDeFaseId: null },
        actividades: sinFase,
      });
    }
    return resultado;
  }, [edt, proyectoId, filtro, documentosPorActividad]);

  const documentos = useMemo(() => (edt?.actividades ?? []).filter(esDocumental), [edt]);
  const aplicables = documentos.filter((actividad) => !actividad.noAplica);
  const noAplicaCount = documentos.length - aplicables.length;
  const completadas = aplicables.filter((actividad) => actividad.estado === "Completado").length;
  const cargados = aplicables.filter((actividad) => recibidosDe(actividad) > 0).length;
  const porcentaje = aplicables.length ? Math.round((completadas / aplicables.length) * 100) : 0;

  const opcionesFiltro: { id: FiltroChecklist; titulo: string; total: number }[] = [
    { id: "todos", titulo: "Todos", total: documentos.length },
    { id: "recibidos", titulo: "Recibidos", total: cargados },
    { id: "pendientes", titulo: "Pendientes", total: aplicables.length - cargados },
    ...(noAplicaCount > 0
      ? [{ id: "no-aplica" as FiltroChecklist, titulo: "No aplica", total: noAplicaCount }]
      : []),
  ];

  const marcar = async (actividad: EdtActividadApi, completar: boolean) => {
    setOcupado(actividad.id);
    setError(null);
    try {
      await api.actualizarEdtActividad(actividad.id, {
        estado: completar ? "Completado" : "No realizado",
      });
      onShowToast(completar ? "Actividad documental marcada como completada." : "Actividad reabierta.");
      await cargar();
      onActualizado();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo actualizar la actividad.");
    } finally {
      setOcupado(null);
    }
  };

  const alternarNoAplica = async (actividad: EdtActividadApi) => {
    setOcupado(actividad.id);
    setError(null);
    try {
      await api.actualizarEdtActividad(actividad.id, { noAplica: !actividad.noAplica });
      onShowToast(
        actividad.noAplica
          ? "El requisito vuelve a aplicar al proyecto."
          : "Requisito marcado como no aplica; deja de contar en el avance.",
      );
      await cargar();
      onActualizado();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo cambiar el estado de aplicación.");
    } finally {
      setOcupado(null);
    }
  };

  const alternar = async (actividad: EdtActividadApi) => {
    if (ocupado || actividad.noAplica) return;
    const completada = actividad.estado === "Completado";
    if (completada) {
      await marcar(actividad, false);
      return;
    }
    const exigeArchivo =
      actividad.requiereDocumento || actividad.tipo === "Documento" || actividad.tipo === "Acta";
    if (exigeArchivo && actividad.documentos === 0) {
      setSubida(actividad);
      return;
    }
    await marcar(actividad, true);
  };

  const trasSubir = async (actividad: EdtActividadApi) => {
    setOcupado(actividad.id);
    setError(null);
    try {
      await api.actualizarEdtActividad(actividad.id, { estado: "Completado" });
      onShowToast("Documento cargado y actividad completada.");
    } catch (e) {
      const detalle = e instanceof ApiError ? e.message : "No se pudo completar la actividad.";
      setError(`El documento se cargó, pero la actividad sigue pendiente: ${detalle}`);
    } finally {
      onActualizado();
      await cargar();
      setOcupado(null);
    }
  };

  if (!abierto) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[86vh] sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <ListChecks className="h-4 w-4 text-[#C2410C]" /> Checklist documental
            </h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Lista los documentos del proyecto: lo que ya se recibió (archivo, versión, fecha y estado) y lo que falta. Se sincroniza con el EDT.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void cargar()}
              disabled={cargando}
              aria-label="Actualizar checklist"
              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="border-b border-gray-100 px-5 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
            <span><strong className="text-gray-800">{completadas}</strong> de {aplicables.length} completadas</span>
            <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> {cargados} con documento</span>
            {noAplicaCount > 0 && <span className="font-semibold text-gray-400">{noAplicaCount} no aplica</span>}
            <span className="ml-auto font-bold text-orange-700">{porcentaje}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-[#C2410C] transition-all" style={{ width: `${porcentaje}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {opcionesFiltro.map((opcion) => (
              <button
                key={opcion.id}
                type="button"
                onClick={() => setFiltro(opcion.id)}
                aria-pressed={filtro === opcion.id}
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
                  filtro === opcion.id
                    ? "border-[#C2410C] bg-[#C2410C] text-white"
                    : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {opcion.titulo} ({opcion.total})
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {error}
            </p>
          )}

          {cargando && !edt && <p className="py-10 text-center text-xs text-gray-400">Cargando checklist…</p>}

          {!cargando && edt && documentos.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center">
              <p className="text-sm font-semibold text-gray-700">Este proyecto aún no tiene un checklist EDT.</p>
              <p className="mt-1 text-xs text-gray-500">Carga la plantilla del contrato desde la pestaña EDT para generar los documentos.</p>
            </div>
          )}

          {!cargando && edt && documentos.length > 0 && grupos.length === 0 && (
            <p className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-xs text-gray-500">
              No hay actividades con este filtro.
            </p>
          )}

          {grupos.map(({ fase, actividades }) => (
            <section key={fase.id}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">{fase.nombre}</h3>
                <span className="text-[10px] font-semibold text-gray-400">
                  {actividades.filter((a) => !a.noAplica && a.estado === "Completado").length}/
                  {actividades.filter((a) => !a.noAplica).length}
                </span>
              </div>
              <ul className="divide-y divide-gray-50 overflow-hidden rounded-xl border border-gray-100">
                {actividades.map((actividad) => {
                  const completada = actividad.estado === "Completado";
                  const recibidos = documentosPorActividad.get(actividad.id) ?? [];
                  const conDocumento = recibidos.length > 0;
                  const exigeArchivo = actividad.requiereDocumento || actividad.tipo === "Documento" || actividad.tipo === "Acta";
                  const noAplica = actividad.noAplica;
                  return (
                    <li
                      key={actividad.id}
                      className={`flex items-start gap-3 px-3 py-2.5 transition-colors ${
                        noAplica
                          ? "bg-gray-50/80 opacity-70"
                          : completada
                            ? "bg-emerald-50/40"
                            : "bg-white hover:bg-gray-50/60"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void alternar(actividad)}
                        disabled={ocupado === actividad.id || noAplica}
                        aria-label={`${completada ? "Reabrir" : "Completar"} ${actividad.nombre}`}
                        className="mt-0.5 flex-shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {completada ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <Circle className={`h-5 w-5 transition-colors ${noAplica ? "text-gray-300" : "text-gray-300 hover:text-orange-500"}`} />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-semibold ${noAplica ? "text-gray-500 line-through" : completada ? "text-emerald-900" : "text-gray-800"}`}>{actividad.nombre}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-400">
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-semibold text-gray-500">{actividad.tipo}</span>
                          {actividad.carpeta && (
                            <span className="inline-flex items-center gap-0.5"><FolderOpen className="h-2.5 w-2.5" /> {actividad.carpeta}</span>
                          )}
                          {noAplica ? (
                            <span className="font-semibold text-gray-500">No aplica a este proyecto · no cuenta en el avance</span>
                          ) : (
                            <>
                              {!conDocumento && exigeArchivo && (
                                <span className="font-semibold text-amber-600">Documento pendiente</span>
                              )}
                              {!conDocumento && !exigeArchivo && (
                                <span className="text-gray-400">Sin documento · se completa desde el EDT</span>
                              )}
                            </>
                          )}
                        </div>
                        {recibidos.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {recibidos.map((documento) => (
                              <li
                                key={documento.id}
                                className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-gray-500"
                              >
                                <FileText className="h-2.5 w-2.5 flex-shrink-0 text-sky-700" />
                                <span className="font-semibold text-gray-700">{documento.nombre}</span>
                                <span className="font-mono text-gray-400">{documento.version}</span>
                                <span>{fechaCorta(documento.fecha)}</span>
                                <span className={`font-semibold ${COLOR_ESTADO[documento.estado] ?? "text-gray-500"}`}>
                                  {documento.estado}
                                </span>
                                <a
                                  href={api.documentoArchivoUrl(documento.id)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold text-orange-700 underline underline-offset-2 hover:text-orange-900"
                                >
                                  Abrir
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void alternarNoAplica(actividad)}
                          disabled={ocupado === actividad.id}
                          title={noAplica ? "Volver a aplicar" : "Marcar como no aplica"}
                          aria-label={`${noAplica ? "Volver a aplicar" : "Marcar como no aplica"} ${actividad.nombre}`}
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-colors disabled:opacity-40 ${
                            noAplica
                              ? "border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
                              : "border-transparent text-gray-400 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-600"
                          }`}
                        >
                          {noAplica ? "Aplicar" : "No aplica"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubida(actividad)}
                          disabled={noAplica}
                          title="Cargar documento"
                          aria-label={`Cargar documento de ${actividad.nombre}`}
                          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-orange-50 hover:text-[#C2410C] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                        >
                          <Upload className="h-3.5 w-3.5" />
                        </button>
                        {noAplica ? (
                          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-500">No aplica</span>
                        ) : completada ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Completado</span>
                        ) : recibidos.length > 0 ? (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">Recibido</span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-400">Pendiente</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
          <p className="text-[10px] text-gray-400">
            Cada fila reúne la actividad documental del EDT con los archivos ya recibidos (versión, fecha y estado). “No aplica” saca el requisito del avance.
          </p>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            Cerrar
          </button>
        </footer>
      </div>

      <SubirDocumentoModal
        abierto={Boolean(subida)}
        proyectoId={proyectoId}
        edtActividadId={subida?.id ?? null}
        carpetaInicial={subida?.carpeta ?? null}
        nombreInicial={subida?.nombre}
        onCerrar={() => setSubida(null)}
        onSubido={() => {
          if (subida) void trasSubir(subida);
        }}
      />
    </div>,
    document.body,
  );
}
