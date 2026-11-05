import { useCallback, useEffect, useState } from "react";
import { Clock, Download, Eye, Paperclip, Upload } from "lucide-react";
import { api, mapDocumento } from "../../api/client";
import { CargandoModule, ErrorModule } from "../../components/DataState";
import type { Document } from "../../types";

export function DocumentosView() {
  const [cat, setCat] = useState("Todos");
  const [documentos, setDocumentos] = useState<Document[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categorias = ["Todos", "Ficha técnica", "Actas", "Informes", "Antecedentes", "Evidencias", "Otros"];

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { documentos: datos } = await api.documentos();
      setDocumentos(datos.map(mapDocumento));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar los documentos.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (cargando) return <CargandoModule mensaje="Cargando repositorio documental…" />;
  if (error) return <ErrorModule mensaje={error} onRetry={() => void cargar()} />;

  const filtered = cat === "Todos" ? documentos : documentos.filter(d => d.type === cat);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Documentos</h1>
          <p className="mt-0.5 text-sm text-gray-500">Repositorio documental de Ingeniería SEI</p>
        </div>
        <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9A3412]">
          <Upload className="h-4 w-4" />Cargar documento
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {categorias.map(c => (
          <button key={c} onClick={() => setCat(c)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${cat === c ? "border-[#C2410C] bg-[#C2410C] text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100"}`}>
            {c}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {["Nombre", "Proyecto", "Tipo", "Versión", "Fecha", "Usuario", "Estado", "Acciones"].map(h => (
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
                      <span className="text-sm font-semibold text-gray-800">{doc.name}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5"><span className="font-mono text-xs font-bold text-orange-700">{doc.projectId}</span></td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{doc.type}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{doc.version}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-400">{doc.date}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-500">{doc.user}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${doc.status === "Aprobado" ? "bg-green-50 text-green-700" : doc.status === "En revisión" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-0.5">
                      <button className="rounded p-1 text-gray-300 transition-colors hover:text-orange-600"><Eye className="h-3.5 w-3.5" /></button>
                      <button className="rounded p-1 text-gray-300 transition-colors hover:text-orange-600"><Download className="h-3.5 w-3.5" /></button>
                      <button className="rounded p-1 text-gray-300 transition-colors hover:text-amber-600" title="Nueva versión"><Clock className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-gray-400">No hay documentos en esta categoría.</p>
        )}
      </div>
    </div>
  );
}
