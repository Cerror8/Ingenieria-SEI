import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Activity } from "lucide-react";
import { api, mapProyecto } from "../../api/client";
import { StatusBadge, Bar2 } from "../../components/shared";
import { CargandoModule, ErrorModule } from "../../components/DataState";
import type { Project } from "../../types";

export function SeguimientoView({ onSelectProject }: { onSelectProject: (id: string) => void }) {
  const [proyectos, setProyectos] = useState<Project[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { proyectos: datos } = await api.proyectos();
      setProyectos(datos.map(mapProyecto));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar el seguimiento.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (cargando) return <CargandoModule mensaje="Cargando seguimiento de proyectos…" />;
  if (error) return <ErrorModule mensaje={error} onRetry={() => void cargar()} />;

  const active = proyectos.filter(p => p.status.startsWith("En ejecución") || p.status === "En formulación");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Seguimiento</h1>
        <p className="mt-0.5 text-sm text-gray-500">Estado en tiempo real de los proyectos en curso</p>
      </div>

      {active.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
          <Activity className="h-8 w-8 text-gray-300" />
          <p className="text-sm font-semibold text-gray-600">No hay proyectos en ejecución</p>
          <p className="text-xs text-gray-400">Los proyectos activos aparecerán aquí automáticamente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {active.map(p => (
            <div key={p.id} onClick={() => onSelectProject(p.id)} className="cursor-pointer rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-orange-100 hover:shadow-md">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-mono text-xs font-black text-orange-700">{p.id}</span>
                  <p className="mt-0.5 text-sm font-bold text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.responsible}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="space-y-2.5">
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-gray-500">Avance técnico</span>
                    <span className="font-bold text-gray-800">{p.progress}%</span>
                  </div>
                  <Bar2 value={p.progress} color="bg-orange-500" h="h-2" />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-gray-500">Ejec. presupuestal</span>
                    <span className="font-bold text-gray-800">{p.budgetExecuted}%</span>
                  </div>
                  <Bar2 value={p.budgetExecuted} color="bg-emerald-500" h="h-2" />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs">
                <span className="text-gray-400">Finaliza: {p.endDate}</span>
                {p.daysLeft > 0
                  ? <span className={`font-bold ${p.daysLeft < 30 ? "text-red-600" : p.daysLeft < 90 ? "text-amber-600" : "text-green-600"}`}>{p.daysLeft} días restantes</span>
                  : <span className="font-bold text-green-600">Finalizado</span>
                }
              </div>
            </div>
          ))}
          {active.some(p => p.daysLeft < 30) && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3 text-xs text-amber-800 lg:col-span-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              Hay proyectos con menos de 30 días restantes. Revisa los indicadores asociados.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
