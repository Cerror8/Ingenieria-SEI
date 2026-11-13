import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Download, Eye, FolderOpen, Paperclip, Upload } from "lucide-react";
import {
  api,
  mapDocumento,
  type EstructuraApi,
  type ProyectoApi,
} from "../../api/client";
import { CargandoModule, ErrorModule } from "../../components/DataState";
import type { Document } from "../../types";
import { SubirDocumentoModal } from "./SubirDocumentoModal";
import { ActualizarDocumentoModal } from "./ActualizarDocumentoModal";

const SIN_CARPETA = "__sin-carpeta";

export function DocumentosView() {
  const [cat, setCat] = useState("Todos");
  const [proyectoFiltro, setProyectoFiltro] = useState("");
  const [carpetaFiltro, setCarpetaFiltro] = useState("");
  const [documentos, setDocumentos] = useState<Document[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoApi[]>([]);
  const [estructuras, setEstructuras] = useState<Record<string, EstructuraApi>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarSubida, setMostrarSubida] = useState(false);
  const [docEditando, setDocEditando] = useState<Document | null>(null);

  const categorias = ["Todos", "Actas", "Informes", "Antecedentes", "Evidencias", "Documentación técnica", "Comunicaciones", "Otros"];

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [{ documentos: datos }, { proyectos: listaProyectos }, { estructuras: listaEstructuras }] =
        await Promise.all([api.documentos(), api.proyectos(), api.estructuras()]);
      setDocumentos(datos.map(mapDocumento));
      setProyectos(listaProyectos);
      setEstructuras(
        Object.fromEntries(listaEstructuras.map((estructura) => [estructura.id, estructura])),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar los documentos.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const docsProyecto = useMemo(
    () =>
      proyectoFiltro
        ? documentos.filter((documento) => documento.projectId === proyectoFiltro)
        : documentos,
    [documentos, proyectoFiltro],
  );

  const proyectoActivo = proyectos.find((proyecto) => proyecto.id === proyectoFiltro) ?? null;
  const estructuraActiva = proyectoActivo?.estructura
    ? estructuras[proyectoActivo.estructura] ?? null
    : null;
  const carpetasPlantilla = estructuraActiva?.carpetas ?? [];

  const carpetas = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const documento of docsProyecto) {
      if (!documento.folder) continue;
      conteo.set(documento.folder, (conteo.get(documento.folder) ?? 0) + 1);
    }
    const dePlantilla = carpetasPlantilla.map((ruta) => ({
      ruta,
      total: conteo.get(ruta) ?? 0,
      enPlantilla: true,
    }));
    const fueraDePlantilla = [...conteo.keys()]
      .filter((ruta) => !carpetasPlantilla.includes(ruta))
      .sort((a, b) => a.localeCompare(b))
      .map((ruta) => ({ ruta, total: conteo.get(ruta) ?? 0, enPlantilla: false }));
    return [...dePlantilla, ...fueraDePlantilla];
  }, [docsProyecto, carpetasPlantilla]);

  const sinCarpeta = docsProyecto.filter((documento) => !documento.folder).length;
  const carpetasConDocumentos = carpetas.filter((carpeta) => carpeta.total > 0).length;

  if (cargando) return <CargandoModule mensaje="Cargando repositorio documental…" />;
  if (error) return <ErrorModule mensaje={error} onRetry={() => void cargar()} />;

  const filtered = docsProyecto.filter((documento) => {
    const coincideTipo = cat === "Todos" || documento.type === cat;
    const coincideCarpeta =
      !carpetaFiltro ||
      (carpetaFiltro === SIN_CARPETA ? !documento.folder : documento.folder === carpetaFiltro);
    return coincideTipo && coincideCarpeta;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Documentos</h1>
          <p className="mt-0.5 text-sm text-gray-500">Repositorio documental de Ingeniería SEI</p>
        </div>
        <button
          onClick={() => setMostrarSubida(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9A3412]"
        >
          <Upload className="h-4 w-4" />Cargar documento
        </button>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            value={proyectoFiltro}
            onChange={(event) => {
              setProyectoFiltro(event.target.value);
              setCarpetaFiltro("");
            }}
            aria-label="Filtrar por proyecto"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 outline-none focus:border-[#EA580C]"
          >
            <option value="">Todos los proyectos</option>
            {proyectos.map((proyecto) => {
              const total = documentos.filter((documento) => documento.projectId === proyecto.id).length;
              return (
                <option key={proyecto.id} value={proyecto.id}>
                  {proyecto.id} · {proyecto.nombre} ({total})
                </option>
              );
            })}
          </select>
          <select
            value={carpetaFiltro}
            onChange={(event) => setCarpetaFiltro(event.target.value)}
            aria-label="Filtrar por carpeta"
            disabled={!proyectoFiltro}
            className="max-w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 outline-none focus:border-[#EA580C] disabled:opacity-50"
          >
            <option value="">Todas las carpetas</option>
            {carpetas.map((carpeta) => (
              <option key={carpeta.ruta} value={carpeta.ruta}>
                {carpeta.ruta} ({carpeta.total})
              </option>
            ))}
            {sinCarpeta > 0 && (
              <option value={SIN_CARPETA}>Sin carpeta ({sinCarpeta})</option>
            )}
          </select>
          <span className="text-xs font-medium text-gray-400 sm:ml-auto">
            {filtered.length} de {docsProyecto.length} documento(s)
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {categorias.map((categoria) => (
            <button
              key={categoria}
              onClick={() => setCat(categoria)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                cat === categoria
                  ? "border-[#C2410C] bg-[#C2410C] text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              {categoria}
            </button>
          ))}
        </div>

        {proyectoActivo && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <FolderOpen className="h-3.5 w-3.5" />
                Carpetas de {proyectoActivo.id}
              </span>
              <span className="text-[11px] font-medium text-slate-400">
                {carpetasConDocumentos} de {carpetas.length} con documentos
                {estructuraActiva ? ` · ${estructuraActiva.nombre}` : " · sin plantilla asignada"}
              </span>
            </div>

            {carpetas.length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed border-gray-200 px-3 py-3 text-xs text-gray-500">
                El proyecto no tiene plantilla de carpetas. Se asigna al crearlo o editarlo con una
                estructura documental.
              </p>
            ) : (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-lg bg-gray-50/60">
                <ul className="divide-y divide-gray-100">
                  <li>
                    <button
                      type="button"
                      onClick={() => setCarpetaFiltro("")}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[11px] transition-colors ${
                        !carpetaFiltro
                          ? "bg-orange-50 font-bold text-[#9A3412]"
                          : "font-medium text-gray-600 hover:bg-white"
                      }`}
                    >
                      <span>Todas las carpetas</span>
                      <span className="font-mono text-[10px]">{docsProyecto.length}</span>
                    </button>
                  </li>
                  {carpetas.map((carpeta) => {
                    const nivel = carpeta.ruta.split("/").length - 1;
                    const nombre = carpeta.ruta.split("/").pop();
                    const activa = carpetaFiltro === carpeta.ruta;
                    return (
                      <li key={carpeta.ruta}>
                        <button
                          type="button"
                          onClick={() => setCarpetaFiltro(activa ? "" : carpeta.ruta)}
                          title={carpeta.ruta}
                          style={{ paddingLeft: `${12 + nivel * 14}px` }}
                          className={`flex w-full items-center justify-between gap-2 py-1.5 pr-3 text-left text-[11px] transition-colors ${
                            activa
                              ? "bg-orange-50 font-bold text-[#9A3412]"
                              : carpeta.total > 0
                                ? "font-semibold text-gray-700 hover:bg-white"
                                : "font-medium text-gray-400 hover:bg-white"
                          }`}
                        >
                          <span className="truncate">
                            {nivel > 0 && <span className="mr-1 text-gray-300">└</span>}
                            {nombre}
                          </span>
                          <span
                            className={`font-mono text-[10px] ${
                              carpeta.total > 0 ? "text-emerald-700" : "text-gray-300"
                            }`}
                          >
                            {carpeta.total}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {sinCarpeta > 0 && (
                    <li>
                      <button
                        type="button"
                        onClick={() => setCarpetaFiltro(SIN_CARPETA)}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[11px] transition-colors ${
                          carpetaFiltro === SIN_CARPETA
                            ? "bg-orange-50 font-bold text-[#9A3412]"
                            : "font-medium text-amber-700 hover:bg-white"
                        }`}
                      >
                        <span>Sin carpeta</span>
                        <span className="font-mono text-[10px]">{sinCarpeta}</span>
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {["Nombre", "Número acta/documento", "Proyecto", "Tipo", "Versión", "Fecha documento", "Fecha subida", "Usuario", "Estado", "Acciones"].map(h => (
                  <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(doc => (
                <tr key={doc.id} className="hover:bg-gray-50/50">
                  <td className="min-w-[220px] px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
                      <div>
                        <span className="text-sm font-semibold text-gray-800">{doc.name}</span>
                        {doc.fileName && <p className="text-[10px] text-gray-400">{doc.fileName}</p>}
                        {doc.folder && (
                          <p className="inline-flex items-center gap-1 text-[10px] font-medium text-orange-700/80">
                            <FolderOpen className="h-2.5 w-2.5" />{doc.folder}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[200px] break-words px-4 py-2.5 font-mono text-xs text-gray-500">{doc.documentNumber ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5"><span className="font-mono text-xs font-bold text-orange-700">{doc.projectId}</span></td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{doc.type}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{doc.version}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-500">{doc.documentDate}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-400">{doc.date}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-500">{doc.user}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${doc.status === "Aprobado" ? "bg-green-50 text-green-700" : doc.status === "En revisión" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        disabled={!doc.fileName}
                        onClick={() => window.open(api.documentoArchivoUrl(doc.id), "_blank", "noopener,noreferrer")}
                        title="Ver"
                        className="rounded p-1 text-gray-300 transition-colors hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={!doc.fileName}
                        onClick={() => { window.location.href = api.documentoArchivoUrl(doc.id, true); }}
                        title="Descargar"
                        className="rounded p-1 text-gray-300 transition-colors hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setDocEditando(doc)} className="rounded p-1 text-gray-300 transition-colors hover:text-amber-600" title="Editar documento / nueva versión"><Clock className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-gray-400">
            No hay documentos con estos filtros.
          </p>
        )}
      </div>

      <SubirDocumentoModal
        abierto={mostrarSubida}
        onCerrar={() => setMostrarSubida(false)}
        onSubido={() => void cargar()}
      />

      <ActualizarDocumentoModal
        abierto={Boolean(docEditando)}
        documento={docEditando}
        onCerrar={() => setDocEditando(null)}
        onActualizado={() => void cargar()}
      />
    </div>
  );
}
