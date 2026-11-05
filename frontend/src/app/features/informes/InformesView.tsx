import { useCallback, useEffect, useState } from "react";
import { Download, Eye, FileDown } from "lucide-react";
import { api, mapInforme, mapProyecto } from "../../api/client";
import { STATUS_CFG } from "../../constants";
import { ProjectStatus, Report, Project } from "../../types";
import { CargandoModule, ErrorModule } from "../../components/DataState";

export function InformesView({ onGenerate }: { onGenerate: () => void }) {
  const [informes, setInformes] = useState<Report[]>([]);
  const [proyectos, setProyectos] = useState<Project[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [informesRes, proyectosRes] = await Promise.all([api.informes(), api.proyectos()]);
      setInformes(informesRes.informes.map(mapInforme));
      setProyectos(proyectosRes.proyectos.map(mapProyecto));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar los informes.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (cargando) return <CargandoModule mensaje="Cargando informes…" />;
  if (error) return <ErrorModule mensaje={error} onRetry={() => void cargar()} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Informes de proyectos</h1>
        <p className="mt-0.5 text-sm text-gray-500">Generación y consulta de informes institucionales</p>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800">Generar informe</h3>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-700">Tipo de informe</label>
            <select className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20">
              {["Informe diario", "Informe semanal", "Informe mensual", "Informe por proyecto", "Informe ejecutivo"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">Desde</label>
              <input type="date" className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">Hasta</label>
              <input type="date" className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-700">Proyecto</label>
            <select className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20">
              <option>Todos los proyectos</option>
              {proyectos.map(p => <option key={p.id}>{p.id} – {p.name.slice(0, 28)}…</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-700">Estado</label>
            <select className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20">
              <option>Todos</option>
              {(Object.keys(STATUS_CFG) as ProjectStatus[]).map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={onGenerate} className="min-w-0 flex-1 rounded-lg bg-[#C2410C] py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9A3412]">
              Generar informe
            </button>
            <button className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50">
              <Download className="h-4 w-4" />PDF
            </button>
            <button className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50">
              <FileDown className="h-4 w-4" />Word
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-gray-100 bg-gray-50/40 px-4 py-3">
            <h3 className="text-sm font-bold text-gray-800">Historial de informes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {["Fecha", "Tipo", "Período", "Proyecto", "Generado por", "Formato", "Acciones"].map(h => (
                    <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {informes.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{r.date}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">{r.type}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{r.period}</td>
                    <td className="whitespace-nowrap px-4 py-3"><span className="font-mono text-xs font-bold text-orange-700">{r.project}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.generatedBy}</td>
                    <td className="px-4 py-3"><span className="rounded bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">{r.format}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button className="rounded p-1.5 text-gray-300 transition-colors hover:bg-orange-50 hover:text-orange-600"><Eye className="h-3.5 w-3.5" /></button>
                        <button className="rounded p-1.5 text-gray-300 transition-colors hover:bg-orange-50 hover:text-orange-600" title="Descargar PDF"><Download className="h-3.5 w-3.5" /></button>
                        <button className="rounded p-1.5 text-gray-300 transition-colors hover:bg-orange-50 hover:text-orange-600" title="Descargar Word"><FileDown className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
