import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Briefcase,
  CheckCircle,
  ChevronDown,
  DollarSign,
  Download,
  FileText,
  Filter,
  Percent,
  Tag,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, mapIndicador, mapProyecto, type DashboardApi } from "../../api/client";
import { StatusBadge, IndBadge, Bar2, KpiCard } from "../../components/shared";
import { CargandoModule, ErrorModule } from "../../components/DataState";
import type { Indicator, Project } from "../../types";

const COLOR_ESTADO: Record<string, string> = {
  "En formulación": "#F59E0B",
  "En ejecución": "#EA580C",
  Suspendido: "#64748B",
  Finalizado: "#10B981",
  Cerrado: "#9CA3AF",
};

export function DashboardView({ onProjectSelect, onGenerateReport }: {
  onProjectSelect: (id: string) => void;
  onGenerateReport: () => void;
}) {
  const [activeSeg, setActiveSeg] = useState<string | null>(null);
  const [datos, setDatos] = useState<DashboardApi | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setDatos(await api.dashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar el dashboard.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (cargando) return <CargandoModule mensaje="Cargando indicadores del dashboard…" />;
  if (error || !datos) {
    return <ErrorModule mensaje={error ?? "Sin datos disponibles."} onRetry={() => void cargar()} />;
  }

  const kpis = datos.kpis;
  const estados = datos.estados.map((e) => ({
    name: e.nombre,
    value: e.total,
    color: COLOR_ESTADO[e.nombre] ?? "#94A3B8",
  }));
  const proximos: Project[] = datos.proximos.map(mapProyecto);
  const alertas: Indicator[] = datos.alertas.map(mapIndicador);
  const lineas = datos.lineas.map((l) => ({ line: l.nombre, count: l.total }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard de Ingeniería SEI</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Período activo: {datos.periodo.desde}
            {datos.periodo.hasta !== datos.periodo.desde ? ` – ${datos.periodo.hasta}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onGenerateReport} className="inline-flex items-center gap-2 rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#9A3412]">
            <FileText className="h-4 w-4" />Generar informe
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
            <Download className="h-4 w-4" />Descargar PDF
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
        <Filter className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
        {[`Año ${new Date().getFullYear()}`, "Línea de investigación", "Estado", "Responsable", "Período del informe"].map(f => (
          <button key={f} className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100">
            {f} <ChevronDown className="h-3 w-3" />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <KpiCard title="Total Proyectos" value={String(kpis.total)} icon={Briefcase} color="text-[#C2410C]" bg="bg-orange-50" />
        <KpiCard title="Activos" value={String(kpis.activos)} icon={Activity} color="text-orange-600" bg="bg-orange-50" />
        <KpiCard title="Finalizados" value={String(kpis.finalizados)} icon={CheckCircle} color="text-green-600" bg="bg-green-50" />
        <KpiCard title="Retrasados" value={String(kpis.retrasados)} icon={AlertTriangle} color="text-red-600" bg="bg-red-50" />
        <KpiCard title="Avance Prom." value={`${kpis.avancePromedio}%`} icon={Percent} color="text-slate-600" bg="bg-slate-50" />
        <KpiCard title="Ejec. Presup." value={`${kpis.ejecucionPromedio}%`} icon={DollarSign} color="text-amber-600" bg="bg-amber-50" />
        <KpiCard title="Líneas Activas" value={String(kpis.lineasActivas)} icon={Tag} color="text-slate-600" bg="bg-slate-50" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-gray-800">Proyectos por estado</h3>
          {kpis.total === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 px-3 py-10 text-center text-xs text-gray-400">
              Sin proyectos registrados.
            </p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <PieChart width={170} height={170}>
                  <Pie key="pie" data={estados} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={2} dataKey="value" onClick={d => setActiveSeg(d.name === activeSeg ? null : d.name)}>
                    {estados.map((e, i) => (
                      <Cell key={`donut-${i}`} fill={e.color} opacity={activeSeg && activeSeg !== e.name ? 0.35 : 1} cursor="pointer" />
                    ))}
                  </Pie>
                  <Tooltip key="tooltip" formatter={(v: number, n: string) => [v, n]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                </PieChart>
              </div>
              <div className="flex-1 space-y-2">
                {estados.map(d => (
                  <div key={d.name} className="flex cursor-pointer items-center justify-between rounded px-2 py-1 transition-colors hover:bg-gray-50" onClick={() => setActiveSeg(d.name === activeSeg ? null : d.name)}>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-gray-600">{d.name}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-800">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-gray-800">Avance de proyectos activos</h3>
          <div className="space-y-3.5">
            {datos.avances.map(d => (
              <div key={d.id}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="max-w-[220px] truncate text-xs text-gray-600">{d.nombre}</span>
                  <span className="ml-2 text-xs font-bold text-gray-800">{d.avance}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-2 rounded-full" style={{ width: `${d.avance}%`, backgroundColor: d.avance >= 70 ? "#10B981" : d.avance >= 40 ? "#EA580C" : "#F59E0B" }} />
                </div>
              </div>
            ))}
            {datos.avances.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-400">
                Sin proyectos activos.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-gray-800">Ejecución presupuestal por proyecto (%)</h3>
          {datos.presupuestos.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 px-3 py-10 text-center text-xs text-gray-400">
              Sin proyectos con presupuesto registrado.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={datos.presupuestos} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid key="grid" strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis key="xaxis" type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis key="yaxis" type="category" dataKey="id" tick={{ fontSize: 10 }} width={118} />
                <Tooltip key="tooltip" formatter={(v: number) => [`${v}%`, "Ejecución"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                <Bar key="bar" dataKey="ejecucionPct" name="Ejecución" fill="#EA580C" radius={[0, 4, 4, 0]} barSize={13} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-gray-800">Proyectos por línea de investigación</h3>
          {lineas.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 px-3 py-10 text-center text-xs text-gray-400">
              Sin líneas de investigación registradas.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={lineas} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid key="grid" strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis key="xaxis" type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis key="yaxis" type="category" dataKey="line" tick={{ fontSize: 10 }} width={138} />
                <Tooltip key="tooltip" contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                <Bar key="bar" dataKey="count" name="Proyectos" fill="#C2410C" radius={[0, 4, 4, 0]} barSize={13} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-gray-800">Próximos a finalizar</h3>
          <div className="space-y-3">
            {proximos.map(p => (
              <div key={p.id} onClick={() => onProjectSelect(p.id)} className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-100 p-3 transition-all hover:border-orange-100 hover:bg-orange-50/20">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-orange-700">{p.id}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">{p.name}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Bar2 value={p.progress} color="bg-orange-500" h="h-1.5" />
                    <span className="flex-shrink-0 text-xs font-bold text-gray-700">{p.progress}%</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                    <span>{p.responsible}</span><span>·</span><span>{p.endDate}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 px-2 text-center">
                  <span className="text-xl font-black text-orange-700">{p.daysLeft}</span>
                  <p className="text-[10px] font-medium text-gray-400">días</p>
                </div>
              </div>
            ))}
            {proximos.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-400">
                No hay proyectos en ejecución.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-gray-800">Alertas de indicadores</h3>
          <div className="space-y-2.5">
            {alertas.map(ind => (
              <div key={ind.id} className={`rounded-lg border p-3 ${ind.status === "No cumplido" ? "border-red-100 bg-red-50/30" : "border-amber-100 bg-amber-50/30"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{ind.name}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{ind.projectId}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-gray-500">Cumplimiento:</span>
                      <span className="text-xs font-bold text-gray-700">{ind.compliance}%</span>
                      <div className="flex-1">
                        <Bar2 value={ind.compliance} color={ind.status === "No cumplido" ? "bg-red-500" : "bg-amber-500"} h="h-1.5" />
                      </div>
                    </div>
                  </div>
                  <IndBadge status={ind.status} />
                </div>
              </div>
            ))}
            {alertas.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-400">
                No hay alertas de indicadores.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
