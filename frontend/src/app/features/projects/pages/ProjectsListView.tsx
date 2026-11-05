import { useCallback, useEffect, useState } from "react";
import {
  BarChart2,
  Edit2,
  Eye,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { api, mapProyecto } from "../../../api/client";
import { fmt } from "../../../lib/format";
import { StatusBadge, Bar2 } from "../../../components/shared";
import { CargandoModule, ErrorModule } from "../../../components/DataState";
import type { Project } from "../../../types";

export function ProjectsListView({ onSelectProject, onCreateProject }: {
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
}) {
  const [proyectos, setProyectos] = useState<Project[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { proyectos: datos } = await api.proyectos();
      setProyectos(datos.map(mapProyecto));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar los proyectos.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filtered = proyectos.filter(p => {
    const ms = p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase());
    const mf = statusFilter === "Todos" || p.status === statusFilter;
    return ms && mf;
  });

  if (cargando) return <CargandoModule mensaje="Cargando proyectos…" />;
  if (error) return <ErrorModule mensaje={error} onRetry={() => void cargar()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Proyectos de Ingeniería SEI</h1>
          <p className="mt-0.5 text-sm text-gray-500">{proyectos.length} proyectos registrados</p>
        </div>
        <button onClick={onCreateProject} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#9A3412]">
          <Plus className="h-4 w-4" />Nuevo proyecto
        </button>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="relative min-w-0 flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar por código o nombre..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["Todos", "En ejecución", "En formulación", "Suspendido", "Finalizado"] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${statusFilter === s ? "bg-[#C2410C] text-white border-[#C2410C]" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}>
                {s}
              </button>
            ))}
            <button className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100">
              <Filter className="h-3 w-3" /> Más filtros
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {["Código", "Proyecto", "Línea", "Responsable", "Estado", "Avance", "Presupuesto", "Finaliza", "Acciones"].map(h => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50/80">
              {filtered.map(p => (
                <tr key={p.id} className="transition-colors hover:bg-orange-50/10">
                  <td className="whitespace-nowrap px-4 py-3"><span className="font-mono text-xs font-bold text-orange-700">{p.id}</span></td>
                  <td className="px-4 py-3"><p className="max-w-[200px] truncate text-sm font-semibold text-gray-900">{p.name}</p></td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{p.line.split(" ").slice(0, 2).join(" ")}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{p.responsible}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-[100px] items-center gap-2">
                      <Bar2 value={p.progress} color="bg-orange-500" h="h-1.5" />
                      <span className="flex-shrink-0 text-xs font-bold text-gray-700">{p.progress}%</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">{fmt(p.budget)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{p.endDate}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => onSelectProject(p.id)} className="rounded p-1.5 text-gray-400 transition-colors hover:bg-orange-50 hover:text-orange-600" title="Ver"><Eye className="h-3.5 w-3.5" /></button>
                      <button className="rounded p-1.5 text-gray-400 transition-colors hover:bg-orange-50 hover:text-orange-600" title="Editar"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => onSelectProject(p.id)} className="rounded p-1.5 text-gray-400 transition-colors hover:bg-orange-50 hover:text-orange-600" title="Dashboard"><BarChart2 className="h-3.5 w-3.5" /></button>
                      <button className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"><MoreHorizontal className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-gray-400">Mostrando {filtered.length} de {proyectos.length} proyectos</span>
        </div>
      </div>
    </div>
  );
}
