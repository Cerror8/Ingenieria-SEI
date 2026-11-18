import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Briefcase,
  CheckCircle,
  DollarSign,
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
import { chartColor } from "../../lib/chartColors";
import { SectionHero } from "../../components/SectionHero";
import { CargandoModule, ErrorModule } from "../../components/DataState";
import type { Indicator, Project } from "../../types";

const COLOR_ESTADO: Record<string, string> = {
  "En formulación": "#F59E0B",
  "En ejecución": "#EA580C",
  "En ejecución, prorrogado en tiempo": "#D97706",
  "En ejecución, adición presupuestal": "#2563EB",
  "En ejecución, modificado": "#7C3AED",
  Suspendido: "#64748B",
  Finalizado: "#10B981",
  Cerrado: "#9CA3AF",
};

export function DashboardView({ onProjectSelect, onOpenReports }: {
  onProjectSelect: (id: string) => void;
  onOpenReports: () => void;
}) {
  const [activeSeg, setActiveSeg] = useState<string | null>(null);
  const [datos, setDatos] = useState<DashboardApi | null>(null);
  const [linea, setLinea] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setDatos(await api.dashboard(linea || undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar el dashboard.");
    } finally {
      setCargando(false);
    }
  }, [linea]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (cargando) return <CargandoModule mensaje="Cargando indicadores del dashboard…" />;
  if (error || !datos) {
    return <ErrorModule mensaje={error ?? "Sin datos disponibles."} onRetry={() => void cargar()} />;
  }

  const kpis = datos.kpis;
  const periodo = datos.periodo.hasta !== datos.periodo.desde
    ? `Período activo: ${datos.periodo.desde} – ${datos.periodo.hasta}`
    : `Período activo: ${datos.periodo.desde}`;
  const estados = datos.estados.map((e) => ({
    name: e.nombre,
    value: e.total,
    color: COLOR_ESTADO[e.nombre] ?? "#94A3B8",
  }));
  const proximos: Project[] = datos.proximos.map(mapProyecto);
  const alertas: Indicator[] = datos.alertas.map(mapIndicador);
  const lineas = datos.lineas.map((l) => ({ line: l.nombre, count: l.total }));
  const opcionesLinea = (datos.lineasDisponibles ?? datos.lineas).map((l) => l.nombre);

  return (
    <div className="space-y-5">
      <SectionHero
        eyebrow="Área proyectos"
        icon={Briefcase}
        title="Resumen proyectos"
        subtitle={periodo}
        actions={
          <button onClick={onOpenReports} className="inline-flex items-center gap-2 rounded-lg bg-[#F39200] px-4 py-2 text-sm font-semibold text-[#1B1B1B] shadow-sm transition-colors hover:bg-[#FFAA2B]">
            <FileText className="h-4 w-4" />Ir a informes
          </button>
        }
        kpis={[
          { label: "Total proyectos", value: kpis.total, icon: Briefcase },
          { label: "Activos", value: kpis.activos, icon: Activity },
          { label: "Finalizados", value: kpis.finalizados, icon: CheckCircle },
          { label: "Retrasados", value: kpis.retrasados, icon: AlertTriangle },
        ]}
      />

      <div className="sei-fade-up flex flex-wrap items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
        <Filter className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
        <label htmlFor="dashboard-linea" className="sei-label text-slate-500">
          Línea de investigación
        </label>
        <select
          id="dashboard-linea"
          value={linea}
          onChange={(e) => setLinea(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 outline-none focus:border-[#F39200]"
        >
          <option value="">Todas las líneas</option>
          {linea && !opcionesLinea.includes(linea) && <option value={linea}>{linea}</option>}
          {opcionesLinea.map((nombre) => (
            <option key={nombre} value={nombre}>{nombre}</option>
          ))}
        </select>
        {linea && (
          <button
            type="button"
            onClick={() => setLinea("")}
            className="text-xs font-semibold text-[#9A3412] hover:underline"
          >
            Limpiar filtro
          </button>
        )}
        <span className="ml-auto text-[11px] text-gray-400">
          {linea ? `Mostrando proyectos de ${linea}.` : "Sin filtro de línea."}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard title="Avance promedio" value={`${kpis.avancePromedio}%`} icon={Percent} color="text-slate-600" bg="bg-slate-50" />
        <KpiCard title="Ejecución presupuestal" value={`${kpis.ejecucionPromedio}%`} icon={DollarSign} color="text-amber-600" bg="bg-amber-50" />
        <KpiCard title="Líneas activas" value={String(kpis.lineasActivas)} icon={Tag} color="text-slate-600" bg="bg-slate-50" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="sei-fade-up rounded-lg border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="sei-label mb-4 text-slate-500">Proyectos por estado</h3>
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
                  <Tooltip key="tooltip" formatter={(v: number, n: string) => [v, n]} contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb" }} />
                </PieChart>
              </div>
              <div className="flex-1 space-y-2">
                {estados.map(d => (
                  <div key={d.name} className="flex cursor-pointer items-center justify-between rounded px-2 py-1 transition-colors hover:bg-gray-50" onClick={() => setActiveSeg(d.name === activeSeg ? null : d.name)}>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-gray-600">{d.name}</span>
                    </div>
                    <span className="sei-figure text-xs font-semibold text-gray-800">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sei-fade-up rounded-lg border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="sei-label mb-4 text-slate-500">Avance de proyectos activos</h3>
          <div className="space-y-3.5">
            {datos.avances.map(d => (
              <div key={d.id}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="max-w-[220px] truncate text-xs text-gray-600">{d.nombre}</span>
                  <span className="sei-figure ml-2 text-xs font-semibold text-gray-800">{d.avance}%</span>
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
        <div className="sei-fade-up rounded-lg border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="sei-label mb-4 text-slate-500">Ejecución presupuestal por proyecto (%)</h3>
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
                <Tooltip key="tooltip" formatter={(v: number) => [`${v}%`, "Ejecución"]} contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb" }} />
                <Bar key="bar" dataKey="ejecucionPct" name="Ejecución" radius={[0, 4, 4, 0]} barSize={13}>
                  {datos.presupuestos.map((d, i) => (
                    <Cell key={`presupuesto-${d.id}`} fill={chartColor(i)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="sei-fade-up rounded-lg border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="sei-label mb-4 text-slate-500">Proyectos por línea de investigación</h3>
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
                <Tooltip key="tooltip" contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb" }} />
                <Bar key="bar" dataKey="count" name="Proyectos" radius={[0, 4, 4, 0]} barSize={13}>
                  {lineas.map((l, i) => (
                    <Cell key={`linea-${l.line}`} fill={chartColor(i)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="sei-fade-up rounded-lg border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="sei-label mb-3 text-slate-500">Próximos a finalizar</h3>
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
                  <span className="sei-figure text-xl font-semibold text-[#9A3412]">{p.daysLeft}</span>
                  <p className="sei-label text-slate-400">días</p>
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

        <div className="sei-fade-up rounded-lg border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="sei-label mb-3 text-slate-500">Alertas de indicadores</h3>
          <div className="space-y-2.5">
            {alertas.map(ind => (
              <div key={ind.id} className={`rounded-lg border p-3 ${ind.status === "No cumplido" ? "border-red-100 bg-red-50/30" : "border-amber-100 bg-amber-50/30"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{ind.name}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{ind.projectId}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-gray-500">Cumplimiento:</span>
                      <span className="sei-figure text-xs font-semibold text-gray-700">{ind.compliance}%</span>
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
