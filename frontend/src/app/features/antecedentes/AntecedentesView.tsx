import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Download, Eye, FileText, FolderOpen, Link2, Search, Tag } from "lucide-react";
import { api, mapDocumento, mapProyecto } from "../../api/client";
import { CargandoModule, ErrorModule } from "../../components/DataState";
import type { Document, Project } from "../../types";

export function AntecedentesView() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [proyectos, setProyectos] = useState<Project[]>([]);
  const [documentos, setDocumentos] = useState<Document[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [linea, setLinea] = useState("Todas");
  const [tipo, setTipo] = useState("Todos");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [proyectosRes, documentosRes] = await Promise.all([api.proyectos(), api.documentos()]);
      setProyectos(proyectosRes.proyectos.map(mapProyecto));
      setDocumentos(documentosRes.documentos.map(mapDocumento));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar los antecedentes.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (cargando) return <CargandoModule mensaje="Cargando repositorio histórico…" />;
  if (error) return <ErrorModule mensaje={error} onRetry={() => void cargar()} />;

  const finalizados = proyectos.filter(p => p.status === "Finalizado" || p.status === "Cerrado");
  const lineas = Array.from(new Set(finalizados.map(p => p.line)));
  const tree = lineas.map(nombreLinea => ({
    line: nombreLinea,
    projects: finalizados.filter(p => p.line === nombreLinea),
  }));

  const tipos = Array.from(new Set(documentos.map(d => d.type)));
  const filas = documentos
    .map(doc => ({
      ...doc,
      linea: proyectos.find(p => p.id === doc.projectId)?.line ?? "Sin línea",
    }))
    .filter(doc => {
      const texto = busqueda.trim().toLowerCase();
      const coincideTexto = !texto || [doc.name, doc.projectId, doc.linea, doc.user].join(" ").toLowerCase().includes(texto);
      const coincideLinea = linea === "Todas" || doc.linea === linea;
      const coincideTipo = tipo === "Todos" || doc.type === tipo;
      return coincideTexto && coincideLinea && coincideTipo;
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Antecedentes de proyectos</h1>
          <p className="mt-0.5 text-sm text-gray-500">Repositorio histórico de investigación institucional</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="relative min-w-0 flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por código, línea o palabra clave…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50/50 py-2 pl-9 pr-3 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
          </div>
          <select value={linea} onChange={e => setLinea(e.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 outline-none focus:border-orange-400">
            <option value="Todas">Todas las líneas</option>
            {Array.from(new Set(documentos.map(d => proyectos.find(p => p.id === d.projectId)?.line).filter(Boolean))).map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <select value={tipo} onChange={e => setTipo(e.target.value)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 outline-none focus:border-orange-400">
            <option value="Todos">Todos los tipos</option>
            {tipos.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Estructura</h3>
          {tree.length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-400">
              Aún no hay proyectos finalizados.
            </p>
          )}
          <div className="space-y-1">
            {tree.map(g => (
              <div key={g.line}>
                <button onClick={() => setExpanded(expanded === g.line ? null : g.line)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50">
                  {expanded === g.line ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                  <Tag className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-xs font-semibold text-gray-700">{g.line}</span>
                </button>
                {expanded === g.line && (
                  <div className="ml-5 space-y-0.5">
                    {g.projects.map(p => (
                      <button key={p.id} onClick={() => setBusqueda(p.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-gray-50">
                        <FolderOpen className="h-3.5 w-3.5 text-amber-500" />
                        <span className="font-mono text-xs font-semibold text-gray-600">{p.id}</span>
                        <span className="truncate text-xs text-gray-400">{p.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-gray-100 bg-gray-50/40 px-4 py-3">
            <h3 className="text-sm font-bold text-gray-800">Documentos ({filas.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {["Nombre", "Código", "Línea", "Tipo", "Fecha", "Responsable", "Acciones"].map(h => (
                    <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filas.map((doc, i) => (
                  <tr key={`${doc.id}-${i}`} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-sm font-semibold text-gray-800">{doc.name}</td>
                    <td className="whitespace-nowrap px-4 py-2.5"><span className="font-mono text-xs font-bold text-orange-700">{doc.projectId}</span></td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{doc.linea}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{doc.type}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-400">{doc.date}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{doc.user}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-0.5">
                        <button className="rounded p-1 text-gray-300 transition-colors hover:text-orange-600"><Eye className="h-3.5 w-3.5" /></button>
                        <button className="rounded p-1 text-gray-300 transition-colors hover:text-orange-600"><Download className="h-3.5 w-3.5" /></button>
                        <button className="rounded p-1 text-gray-300 transition-colors hover:text-green-600"><Link2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filas.length === 0 && (
            <p className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-gray-400">
              <FileText className="h-4 w-4" /> No hay documentos con estos filtros.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
