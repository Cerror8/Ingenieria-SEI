import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Download,
  Eye,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  FolderOpen,
  Presentation,
  RotateCcw,
  Search,
  Upload,
} from "lucide-react";
import {
  api,
  mapDocumento,
  type EstructuraApi,
  type ProyectoApi,
} from "../../api/client";
import { CargandoModule, ErrorModule } from "../../components/DataState";
import { SectionHero } from "../../components/SectionHero";
import { SegmentedTabs } from "../../components/SegmentedTabs";
import type { Document } from "../../types";
import { SubirDocumentoModal } from "./SubirDocumentoModal";
import { ActualizarDocumentoModal } from "./ActualizarDocumentoModal";

const SIN_CARPETA = "__sin-carpeta";

const CATEGORIAS = [
  "Todos",
  "Actas",
  "Informes",
  "Antecedentes",
  "Evidencias",
  "Documentación técnica",
  "Comunicaciones",
  "Otros",
];

type TipoArchivo = "pdf" | "word" | "excel" | "powerpoint" | "imagen" | "texto" | "otro";

function tipoArchivo(fileName: string | null): TipoArchivo {
  const ext = fileName?.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "doc" || ext === "docx") return "word";
  if (ext === "xls" || ext === "xlsx") return "excel";
  if (ext === "ppt" || ext === "pptx") return "powerpoint";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "imagen";
  if (["txt", "csv", "md"].includes(ext)) return "texto";
  return "otro";
}

const ESTILO_ARCHIVO: Record<TipoArchivo, { etiqueta: string; clase: string }> = {
  pdf: { etiqueta: "PDF", clase: "border-red-100 bg-red-50 text-red-600" },
  word: { etiqueta: "Word", clase: "border-blue-100 bg-blue-50 text-blue-600" },
  excel: { etiqueta: "Excel", clase: "border-emerald-100 bg-emerald-50 text-emerald-600" },
  powerpoint: { etiqueta: "PPT", clase: "border-orange-100 bg-orange-50 text-orange-600" },
  imagen: { etiqueta: "IMG", clase: "border-violet-100 bg-violet-50 text-violet-600" },
  texto: { etiqueta: "TXT", clase: "border-slate-200 bg-slate-100 text-slate-600" },
  otro: { etiqueta: "DOC", clase: "border-slate-200 bg-slate-100 text-slate-500" },
};

const ESTADO_CLASE: Record<Document["status"], string> = {
  Aprobado: "border-emerald-100 bg-emerald-50 text-emerald-700",
  "En revisión": "border-amber-100 bg-amber-50 text-amber-700",
  Borrador: "border-slate-200 bg-slate-100 text-slate-600",
  Rechazado: "border-red-100 bg-red-50 text-red-700",
};

function IconoArchivo({ tipo, className }: { tipo: TipoArchivo; className?: string }) {
  if (tipo === "excel") return <FileSpreadsheet className={className} />;
  if (tipo === "powerpoint") return <Presentation className={className} />;
  if (tipo === "imagen") return <FileImage className={className} />;
  if (tipo === "pdf" || tipo === "word" || tipo === "texto") return <FileText className={className} />;
  return <File className={className} />;
}

function tamanoLegible(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentosView() {
  const [cat, setCat] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [proyectoFiltro, setProyectoFiltro] = useState("");
  const [carpetaFiltro, setCarpetaFiltro] = useState("");
  const [documentos, setDocumentos] = useState<Document[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoApi[]>([]);
  const [estructuras, setEstructuras] = useState<Record<string, EstructuraApi>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarSubida, setMostrarSubida] = useState(false);
  const [docEditando, setDocEditando] = useState<Document | null>(null);

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

  const conteos = useMemo(
    () =>
      Object.fromEntries(
        CATEGORIAS.map((categoria) => [
          categoria,
          categoria === "Todos"
            ? docsProyecto.length
            : docsProyecto.filter((documento) => documento.type === categoria).length,
        ]),
      ) as Record<string, number>,
    [docsProyecto],
  );

  const resumen = useMemo(
    () => ({
      total: docsProyecto.length,
      proyectos: new Set(docsProyecto.map((documento) => documento.projectId)).size,
      aprobados: docsProyecto.filter((documento) => documento.status === "Aprobado").length,
      revision: docsProyecto.filter((documento) => documento.status === "En revisión").length,
    }),
    [docsProyecto],
  );

  const termino = busqueda.trim().toLocaleLowerCase("es");
  const filtered = docsProyecto.filter((documento) => {
    const coincideTipo = cat === "Todos" || documento.type === cat;
    const coincideCarpeta =
      !carpetaFiltro ||
      (carpetaFiltro === SIN_CARPETA ? !documento.folder : documento.folder === carpetaFiltro);
    const coincideTexto =
      !termino ||
      [
        documento.name,
        documento.documentNumber,
        documento.fileName,
        documento.folder,
        documento.type,
        documento.user,
        documento.projectId,
      ].some((valor) => (valor ?? "").toLocaleLowerCase("es").includes(termino));
    return coincideTipo && coincideCarpeta && coincideTexto;
  });

  const hayFiltros = cat !== "Todos" || busqueda.trim() !== "" || Boolean(proyectoFiltro) || Boolean(carpetaFiltro);
  const limpiarFiltros = () => {
    setCat("Todos");
    setBusqueda("");
    setProyectoFiltro("");
    setCarpetaFiltro("");
  };

  if (cargando) return <CargandoModule mensaje="Cargando repositorio documental…" />;
  if (error) return <ErrorModule mensaje={error} onRetry={() => void cargar()} />;

  return (
    <div className="space-y-5">
      <SectionHero
        eyebrow="Repositorio documental"
        icon={FolderOpen}
        title="Documentos"
        subtitle="Actas, informes, antecedentes y evidencias de cada proyecto, con versiones y trazabilidad."
        actions={
          <button
            onClick={() => setMostrarSubida(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F39200] px-4 py-2 text-sm font-bold text-[#1B1B1B] shadow-sm transition-colors hover:bg-[#FFAA2B]"
          >
            <Upload className="h-4 w-4" />Cargar documento
          </button>
        }
        kpis={[
          { label: "Documentos", value: resumen.total, icon: FileText },
          { label: "Proyectos con archivos", value: resumen.proyectos, icon: FolderKanban },
          { label: "Aprobados", value: resumen.aprobados, icon: CheckCircle2 },
          { label: "En revisión", value: resumen.revision, icon: Clock },
        ]}
      />

      <div className="sei-fade-up rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <label htmlFor="buscar-documentos" className="mb-1.5 block text-xs font-semibold text-gray-700">Buscar documentos</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="buscar-documentos"
                type="search"
                placeholder="Nombre, acta, archivo, usuario…"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
          </div>
          <div>
            <label htmlFor="filtrar-proyecto-documentos" className="mb-1.5 block text-xs font-semibold text-gray-700">Proyecto</label>
            <select
              id="filtrar-proyecto-documentos"
              value={proyectoFiltro}
              onChange={(event) => {
                setProyectoFiltro(event.target.value);
                setCarpetaFiltro("");
              }}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
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
          </div>
          <div>
            <label htmlFor="filtrar-carpeta-documentos" className="mb-1.5 block text-xs font-semibold text-gray-700">Carpeta</label>
            <select
              id="filtrar-carpeta-documentos"
              value={carpetaFiltro}
              onChange={(event) => setCarpetaFiltro(event.target.value)}
              disabled={!proyectoFiltro}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:opacity-50"
            >
              <option value="">Todas las carpetas</option>
              {carpetas.map((carpeta) => (
                <option key={carpeta.ruta} value={carpeta.ruta}>
                  {carpeta.ruta} ({carpeta.total})
                </option>
              ))}
              {sinCarpeta > 0 && <option value={SIN_CARPETA}>Sin carpeta ({sinCarpeta})</option>}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <SegmentedTabs
            ariaLabel="Filtrar documentos por tipo"
            value={cat}
            onChange={setCat}
            tabs={CATEGORIAS.map((categoria) => ({
              id: categoria,
              label: categoria,
              count: conteos[categoria] ?? 0,
            }))}
          />
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

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-50 pt-3">
          <p className="text-xs text-gray-500">{filtered.length} de {docsProyecto.length} documentos visibles</p>
          <button
            type="button"
            onClick={limpiarFiltros}
            disabled={!hayFiltros}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />Limpiar filtros
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="sei-fade-up rounded-xl border border-dashed border-gray-200 bg-white px-4 py-14 text-center">
          <FolderOpen className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-semibold text-gray-600">No hay documentos con estos filtros.</p>
          <p className="mt-1 text-xs text-gray-500">Ajusta la búsqueda o carga un documento nuevo.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((doc, indice) => {
            const tipo = tipoArchivo(doc.fileName);
            const estilo = ESTILO_ARCHIVO[tipo];
            const peso = tamanoLegible(doc.fileSize);
            return (
              <article
                key={doc.id}
                style={{ animationDelay: `${Math.min(indice, 12) * 35}ms` }}
                className="sei-fade-up sei-lift flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
              >
                <div className="flex items-start gap-3 border-b border-gray-50 p-4">
                  <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border ${estilo.clase}`}>
                    {tipo === "imagen" && doc.fileName && (
                      <img
                        src={api.documentoArchivoUrl(doc.id)}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 z-10 h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                    <IconoArchivo tipo={tipo} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 text-sm font-bold leading-snug text-gray-900" title={doc.name}>
                        {doc.name}
                      </h3>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${ESTADO_CLASE[doc.status]}`}>
                        {doc.status}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-gray-400" title={doc.fileName ?? undefined}>
                      {doc.fileName ?? "Sin archivo adjunto"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                      <span className={`rounded border px-1.5 py-0.5 ${estilo.clase}`}>{estilo.etiqueta}</span>
                      <span className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-gray-500">{doc.type}</span>
                      <span className="font-mono text-gray-400">{doc.version}</span>
                      {peso && <span className="text-gray-400">{peso}</span>}
                    </div>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 px-4 py-3 text-[11px]">
                  <div className="min-w-0">
                    <dt className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Proyecto</dt>
                    <dd className="truncate font-mono font-bold text-orange-700">{doc.projectId}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[9px] font-bold uppercase tracking-wider text-gray-400">N.º acta / doc.</dt>
                    <dd className="truncate font-mono text-gray-600" title={doc.documentNumber ?? undefined}>
                      {doc.documentNumber ?? "—"}
                    </dd>
                  </div>
                  <div className="col-span-2 min-w-0">
                    <dt className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Carpeta</dt>
                    <dd className={`inline-flex max-w-full items-center gap-1 truncate ${doc.folder ? "text-orange-700/80" : "text-amber-700"}`} title={doc.folder ?? "Sin carpeta"}>
                      <FolderOpen className="h-3 w-3 shrink-0" />
                      <span className="truncate">{doc.folder ?? "Sin carpeta"}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Fecha documento</dt>
                    <dd className="text-gray-600">{doc.documentDate}</dd>
                  </div>
                  <div>
                    <dt className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Subido</dt>
                    <dd className="text-gray-500">{doc.date}</dd>
                  </div>
                  <div className="col-span-2 min-w-0">
                    <dt className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Usuario</dt>
                    <dd className="truncate text-gray-600">{doc.user}</dd>
                  </div>
                </dl>

                <div className="mt-auto flex items-center gap-1.5 border-t border-gray-50 px-3 py-2">
                  <button
                    type="button"
                    disabled={!doc.fileName}
                    onClick={() => window.open(api.documentoArchivoUrl(doc.id), "_blank", "noopener,noreferrer")}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] font-semibold text-gray-600 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Eye className="h-3.5 w-3.5" />Ver
                  </button>
                  <button
                    type="button"
                    disabled={!doc.fileName}
                    onClick={() => { window.location.href = api.documentoArchivoUrl(doc.id, true); }}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] font-semibold text-gray-600 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Download className="h-3.5 w-3.5" />Descargar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocEditando(doc)}
                    title="Editar documento / nueva versión"
                    aria-label={`Editar ${doc.name} o cargar una nueva versión`}
                    className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition-colors hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                  >
                    <Clock className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <SubirDocumentoModal
        abierto={mostrarSubida}
        proyectoId={proyectoFiltro || undefined}
        carpetaInicial={carpetaFiltro && carpetaFiltro !== SIN_CARPETA ? carpetaFiltro : null}
        tipoInicial={cat !== "Todos" ? cat : undefined}
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
