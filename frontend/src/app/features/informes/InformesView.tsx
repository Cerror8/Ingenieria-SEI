import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarRange, ChevronDown, ChevronUp, FileText, Layers, Send } from "lucide-react";
import { api, fechaCorta, mapInforme, mapProyecto, ApiError } from "../../api/client";
import { SectionHero } from "../../components/SectionHero";
import { SegmentedTabs } from "../../components/SegmentedTabs";
import { CargandoModule, ErrorModule } from "../../components/DataState";
import type { Project, Report } from "../../types";

type TipoFiltro = "Todos" | "Semanal" | "Mensual" | "Trimestral";

const TIPOS: TipoFiltro[] = ["Todos", "Semanal", "Mensual", "Trimestral"];

function isoLocal(fecha: Date) {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function semanaActual() {
  const hoy = new Date();
  const dia = (hoy.getDay() + 6) % 7;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - dia);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  return { inicio: isoLocal(lunes), fin: isoLocal(domingo) };
}

export function InformesView({ proyectoId }: { proyectoId?: string }) {
  const [informes, setInformes] = useState<Report[]>([]);
  const [proyectos, setProyectos] = useState<Project[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<TipoFiltro>("Todos");
  const [abierto, setAbierto] = useState<string | null>(null);
  const semana = useMemo(() => semanaActual(), []);
  const hoy = useMemo(() => new Date(), []);
  const [proyectoSemanal, setProyectoSemanal] = useState(proyectoId ?? "");
  const [desde, setDesde] = useState(semana.inicio);
  const [hasta, setHasta] = useState(semana.fin);
  const [contenido, setContenido] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorSemanal, setErrorSemanal] = useState<string | null>(null);
  const [proyectoConsolidar, setProyectoConsolidar] = useState(proyectoId ?? "");
  const [tipoConsolidar, setTipoConsolidar] = useState<"Mensual" | "Trimestral">("Mensual");
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [trimestre, setTrimestre] = useState(Math.floor(hoy.getMonth() / 3) + 1);
  const [consolidando, setConsolidando] = useState(false);
  const [errorConsolidar, setErrorConsolidar] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [informesRes, proyectosRes] = await Promise.all([
        api.informes(proyectoId),
        api.proyectos(),
      ]);
      setInformes(informesRes.informes.map(mapInforme));
      setProyectos(proyectosRes.proyectos.map(mapProyecto));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar los informes.");
    } finally {
      setCargando(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (proyectoId) {
      setProyectoSemanal(proyectoId);
      setProyectoConsolidar(proyectoId);
    }
  }, [proyectoId]);

  const visibles = useMemo(
    () => (filtro === "Todos" ? informes : informes.filter((r) => r.type === filtro)),
    [informes, filtro],
  );
  const resumen = useMemo(
    () => ({
      semanales: informes.filter((r) => r.type === "Semanal").length,
      mensuales: informes.filter((r) => r.type === "Mensual").length,
      trimestrales: informes.filter((r) => r.type === "Trimestral").length,
    }),
    [informes],
  );
  const nombreProyecto = (id: string) =>
    proyectos.find((p) => p.id === id)?.nombreCorto || id;

  const guardarSemanal = async (evento: FormEvent) => {
    evento.preventDefault();
    if (guardando) return;
    if (!proyectoSemanal) return setErrorSemanal("Selecciona el proyecto.");
    if (!desde || !hasta) return setErrorSemanal("Indica el período del informe.");
    if (hasta < desde) return setErrorSemanal("La fecha final no puede ser anterior a la inicial.");
    if (!contenido.trim()) return setErrorSemanal("Describe las actividades de la semana.");

    setGuardando(true);
    setErrorSemanal(null);
    setAviso(null);
    try {
      await api.crearInforme({
        tipo: "Semanal",
        proyecto: proyectoSemanal,
        periodoInicio: desde,
        periodoFin: hasta,
        contenido: contenido.trim(),
      });
      setContenido("");
      setAviso("Informe semanal guardado. Ya puede consolidarse en el mensual.");
      setFiltro("Semanal");
      await cargar();
    } catch (e) {
      setErrorSemanal(e instanceof ApiError ? e.message : "No se pudo guardar el informe semanal.");
    } finally {
      setGuardando(false);
    }
  };

  const consolidar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (consolidando) return;
    if (!proyectoConsolidar) return setErrorConsolidar("Selecciona el proyecto.");

    setConsolidando(true);
    setErrorConsolidar(null);
    setAviso(null);
    try {
      const { informe, orígenes } = await api.consolidarInforme(
        tipoConsolidar === "Mensual"
          ? { tipo: "Mensual", proyecto: proyectoConsolidar, anio, mes }
          : { tipo: "Trimestral", proyecto: proyectoConsolidar, anio, trimestre },
      );
      setAviso(
        `${informe.tipo} ${informe.periodo} consolidado con ${orígenes} informe(s) de origen.`,
      );
      setFiltro(tipoConsolidar);
      await cargar();
    } catch (e) {
      setErrorConsolidar(
        e instanceof ApiError ? e.message : "No se pudo consolidar el informe.",
      );
    } finally {
      setConsolidando(false);
    }
  };

  if (cargando) return <CargandoModule mensaje="Cargando informes…" />;
  if (error) return <ErrorModule mensaje={error} onRetry={() => void cargar()} />;

  return (
    <div className="space-y-5">
      <SectionHero
        eyebrow="Área proyectos"
        icon={FileText}
        title="Informes de proyectos"
        subtitle="El informe semanal es el registro base; el mensual reúne los semanales y el trimestral reúne los mensuales."
        kpis={[
          { label: "Informes", value: informes.length, icon: FileText },
          { label: "Semanales", value: resumen.semanales, icon: CalendarRange },
          { label: "Mensuales", value: resumen.mensuales, icon: Layers },
          { label: "Trimestrales", value: resumen.trimestrales, icon: Send },
        ]}
      />

      {aviso && (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {aviso}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-4 rounded-lg border border-slate-200/80 bg-white p-5 shadow-sm">
          <form onSubmit={(e) => void guardarSemanal(e)} className="space-y-4">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-orange-600" />
            <h3 className="text-sm font-bold text-gray-800">Nuevo informe semanal</h3>
          </div>

          <div>
            <label htmlFor="informe-proyecto" className="mb-1.5 block sei-label text-slate-500">Proyecto</label>
            <select
              id="informe-proyecto"
              value={proyectoSemanal}
              onChange={(e) => setProyectoSemanal(e.target.value)}
              disabled={Boolean(proyectoId)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#F39200] focus:outline-none focus:ring-4 focus:ring-[#F39200]/15 disabled:opacity-70"
            >
              <option value="">Selecciona un proyecto</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>{p.id} – {p.nombreCorto || p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="informe-desde" className="mb-1.5 block sei-label text-slate-500">Desde</label>
              <input
                id="informe-desde"
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#F39200] focus:outline-none focus:ring-4 focus:ring-[#F39200]/15"
              />
            </div>
            <div>
              <label htmlFor="informe-hasta" className="mb-1.5 block sei-label text-slate-500">Hasta</label>
              <input
                id="informe-hasta"
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#F39200] focus:outline-none focus:ring-4 focus:ring-[#F39200]/15"
              />
            </div>
          </div>

          <div>
            <label htmlFor="informe-contenido" className="mb-1.5 block sei-label text-slate-500">Actividades de la semana</label>
            <textarea
              id="informe-contenido"
              rows={6}
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              maxLength={8000}
              placeholder="Describe avances, entregables, visitas y pendientes…"
              className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#F39200] focus:outline-none focus:ring-4 focus:ring-[#F39200]/15"
            />
          </div>

          {errorSemanal && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {errorSemanal}
            </p>
          )}

          <button
            type="submit"
            disabled={guardando}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#C2410C] py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9A3412] disabled:cursor-wait disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" />{guardando ? "Guardando…" : "Guardar informe semanal"}
          </button>
          </form>

          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-orange-600" />
              <h3 className="text-sm font-bold text-gray-800">Consolidar informes</h3>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
              El mensual reúne los semanales del mes. El trimestral reúne los mensuales del trimestre.
            </p>
            <form onSubmit={(e) => void consolidar(e)} className="mt-3 space-y-3">
              <div>
                <label htmlFor="consolidar-proyecto" className="mb-1.5 block sei-label text-slate-500">Proyecto</label>
                <select
                  id="consolidar-proyecto"
                  value={proyectoConsolidar}
                  onChange={(e) => setProyectoConsolidar(e.target.value)}
                  disabled={Boolean(proyectoId)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#F39200] focus:outline-none focus:ring-4 focus:ring-[#F39200]/15 disabled:opacity-70"
                >
                  <option value="">Selecciona un proyecto</option>
                  {proyectos.map((p) => (
                    <option key={p.id} value={p.id}>{p.id} – {p.nombreCorto || p.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="consolidar-tipo" className="mb-1.5 block sei-label text-slate-500">Tipo</label>
                  <select
                    id="consolidar-tipo"
                    value={tipoConsolidar}
                    onChange={(e) => setTipoConsolidar(e.target.value as "Mensual" | "Trimestral")}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#F39200] focus:outline-none focus:ring-4 focus:ring-[#F39200]/15"
                  >
                    <option value="Mensual">Mensual</option>
                    <option value="Trimestral">Trimestral</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="consolidar-anio" className="mb-1.5 block sei-label text-slate-500">Año</label>
                  <input
                    id="consolidar-anio"
                    type="number"
                    min={2000}
                    max={2100}
                    value={anio}
                    onChange={(e) => setAnio(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#F39200] focus:outline-none focus:ring-4 focus:ring-[#F39200]/15"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="consolidar-periodo" className="mb-1.5 block sei-label text-slate-500">
                  {tipoConsolidar === "Mensual" ? "Mes" : "Trimestre"}
                </label>
                <select
                  id="consolidar-periodo"
                  value={tipoConsolidar === "Mensual" ? mes : trimestre}
                  onChange={(e) =>
                    tipoConsolidar === "Mensual"
                      ? setMes(Number(e.target.value))
                      : setTrimestre(Number(e.target.value))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#F39200] focus:outline-none focus:ring-4 focus:ring-[#F39200]/15"
                >
                  {(tipoConsolidar === "Mensual"
                    ? ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
                    : ["Trimestre 1", "Trimestre 2", "Trimestre 3", "Trimestre 4"]
                  ).map((etiqueta, indice) => (
                    <option key={etiqueta} value={indice + 1}>{etiqueta}</option>
                  ))}
                </select>
              </div>
              {errorConsolidar && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {errorConsolidar}
                </p>
              )}
              <button
                type="submit"
                disabled={consolidando}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50/60 py-2 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-50 disabled:cursor-wait disabled:opacity-60"
              >
                <Layers className="h-3.5 w-3.5" />{consolidando ? "Consolidando…" : `Generar ${tipoConsolidar.toLowerCase()}`}
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <SegmentedTabs
            ariaLabel="Filtrar informes por tipo"
            value={filtro}
            onChange={(id) => setFiltro(id as TipoFiltro)}
            tabs={TIPOS.map((tipo) => ({
              id: tipo,
              label: tipo,
              count: tipo === "Todos" ? informes.length : resumen[`${tipo.toLowerCase()}es` as "semanales" | "mensuales" | "trimestrales"],
            }))}
          />

          {visibles.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-gray-400">
              {filtro === "Todos"
                ? "Aún no hay informes registrados. Empieza por el informe semanal."
                : `No hay informes ${filtro.toLowerCase()}es registrados.`}
            </p>
          ) : (
            <div className="space-y-3">
              {visibles.map((informe) => {
                const expandido = abierto === informe.id;
                return (
                  <article key={informe.id} className="overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => setAbierto(expandido ? null : informe.id)}
                      aria-expanded={expandido}
                      className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50/60"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${informe.type === "Semanal" ? "bg-orange-50 text-orange-700" : informe.type === "Mensual" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}>
                            {informe.type}
                          </span>
                          {informe.consolidated && (
                            <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500">
                              Consolidado
                            </span>
                          )}
                          <span className="font-mono text-[11px] font-bold text-orange-700">{informe.project}</span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                          {informe.period}
                          {!proyectoId && (
                            <span className="ml-2 text-xs font-normal text-gray-400">{nombreProyecto(informe.project)}</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-400">
                          Registrado: {informe.date} · {informe.generatedBy}
                          {informe.periodStart && informe.periodEnd
                            ? ` · ${fechaCorta(informe.periodStart)} a ${fechaCorta(informe.periodEnd)}`
                            : ""}
                        </p>
                      </div>
                      {expandido ? (
                        <ChevronUp className="mt-1 h-4 w-4 flex-shrink-0 text-gray-400" />
                      ) : (
                        <ChevronDown className="mt-1 h-4 w-4 flex-shrink-0 text-gray-400" />
                      )}
                    </button>
                    {expandido && (
                      <div className="border-t border-gray-100 bg-gray-50/40 px-4 py-3">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                          {informe.content || "Sin contenido registrado."}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
