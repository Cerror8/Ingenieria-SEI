import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  CornerDownRight,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  api,
  fechaCorta,
  type EdtActividadApi,
  type EdtEstado,
} from "../../api/client";

const ETAPAS = [
  {
    numero: 1,
    nombre: "Preconstructiva o información básica",
    descripcion: "Actividades previas al inicio de la obra o contrato.",
  },
  {
    numero: 2,
    nombre: "Constructiva o ejecución",
    descripcion: "Informes, actas y entregables de la ejecución.",
  },
  {
    numero: 3,
    nombre: "De cierre o retroalimentación",
    descripcion: "Liquidación, informe final y lecciones aprendidas.",
  },
];

const ESTADOS: EdtEstado[] = ["Completado", "En ejecución", "No realizado"];

const ESTADO_CFG: Record<EdtEstado, { clases: string; icono: typeof CheckCircle2 }> = {
  Completado: {
    clases: "border-green-200 bg-green-50 text-green-700",
    icono: CheckCircle2,
  },
  "En ejecución": {
    clases: "border-orange-200 bg-orange-50 text-orange-700",
    icono: Clock,
  },
  "No realizado": {
    clases: "border-gray-200 bg-gray-100 text-gray-600",
    icono: CircleDashed,
  },
};

type EditorState = { etapa: number; actividad: EdtActividadApi | null };

export function EdtTab({
  proyectoId,
  onShowToast,
}: {
  proyectoId: string;
  onShowToast: (mensaje: string) => void;
}) {
  const [actividades, setActividades] = useState<EdtActividadApi[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { actividades: filas } = await api.edt(proyectoId);
      setActividades(filas);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el checklist EDT.");
    } finally {
      setCargando(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const raices = useCallback(
    (etapa: number) =>
      actividades
        .filter((a) => a.etapa === etapa && !a.padreId)
        .sort((a, b) => a.orden - b.orden),
    [actividades],
  );

  const hijos = useCallback(
    (padreId: string) =>
      actividades
        .filter((a) => a.padreId === padreId)
        .sort((a, b) => a.orden - b.orden),
    [actividades],
  );

  const hoy = new Date().toISOString().slice(0, 10);
  const resumen = useMemo(() => {
    const total = actividades.length;
    const completadas = actividades.filter((a) => a.estado === "Completado").length;
    return { total, completadas, pct: total ? Math.round((completadas / total) * 100) : 0 };
  }, [actividades]);

  const resumenEtapa = useCallback(
    (etapa: number) => {
      const filas = actividades.filter((a) => a.etapa === etapa);
      const completadas = filas.filter((a) => a.estado === "Completado").length;
      const vencidas = filas.filter(
        (a) =>
          a.estado !== "Completado" &&
          a.fechaCumplimiento !== null &&
          a.fechaCumplimiento < hoy,
      ).length;
      return {
        total: filas.length,
        completadas,
        vencidas,
        pct: filas.length ? Math.round((completadas / filas.length) * 100) : 0,
      };
    },
    [actividades, hoy],
  );

  const cambiarEstado = async (actividad: EdtActividadApi, estado: EdtEstado) => {
    setError(null);
    setOcupado(actividad.id);
    try {
      const { actividad: actualizada } = await api.actualizarEdtActividad(actividad.id, { estado });
      setActividades((prev) => prev.map((a) => (a.id === actualizada.id ? actualizada : a)));
      onShowToast(
        estado === "Completado"
          ? "Actividad completada."
          : `Estado actualizado a "${estado}".`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar el estado.");
    } finally {
      setOcupado(null);
    }
  };

  const eliminar = async (actividad: EdtActividadApi) => {
    const nombre = actividad.nombre || "esta actividad sin nombre";
    const tieneHijos = hijos(actividad.id).length > 0;
    const mensaje = tieneHijos
      ? `¿Eliminar "${nombre}"? También se eliminarán sus subproductos.`
      : `¿Eliminar "${nombre}"?`;
    if (!window.confirm(mensaje)) return;

    setError(null);
    setOcupado(actividad.id);
    try {
      await api.eliminarEdtActividad(actividad.id);
      setActividades((prev) =>
        prev.filter((a) => a.id !== actividad.id && a.padreId !== actividad.id),
      );
      onShowToast("Actividad eliminada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar la actividad.");
    } finally {
      setOcupado(null);
    }
  };

  const cargarPlantilla = async () => {
    setError(null);
    setOcupado("plantilla");
    try {
      const { actividades: filas, creados } = await api.cargarPlantillaEdt(proyectoId);
      setActividades(filas);
      onShowToast(
        creados > 0
          ? `Plantilla EDT actualizada: ${creados} actividad(es) nueva(s).`
          : "La plantilla EDT ya estaba completa.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la plantilla EDT.");
    } finally {
      setOcupado(null);
    }
  };

  const guardado = (actividad: EdtActividadApi) => {
    setActividades((prev) =>
      prev.some((a) => a.id === actividad.id)
        ? prev.map((a) => (a.id === actividad.id ? actividad : a))
        : [...prev, actividad],
    );
    setEditor(null);
    onShowToast("Actividad del EDT guardada.");
  };

  const fila = (actividad: EdtActividadApi, numero: string, esHijo: boolean) => {
    const cfg = ESTADO_CFG[actividad.estado];
    const Icono = cfg.icono;
    const vencida =
      actividad.estado !== "Completado" &&
      actividad.fechaCumplimiento !== null &&
      actividad.fechaCumplimiento < new Date().toISOString().slice(0, 10);

    return (
      <tr key={actividad.id} className={esHijo ? "bg-orange-50/20" : "bg-white"}>
        <td className="px-3 py-2.5 font-mono text-[11px] text-gray-400 align-top">{numero}</td>
        <td className="px-3 py-2.5 align-top">
          <div className={`flex items-start gap-2 ${esHijo ? "pl-4" : ""}`}>
            {esHijo && (
              <CornerDownRight className="mt-0.5 h-3 w-3 flex-shrink-0 text-orange-300" />
            )}
            <div className="min-w-0">
              <p
                className={`${
                  esHijo ? "text-xs font-medium" : "text-sm font-semibold"
                } ${actividad.nombre ? "text-gray-800" : "italic text-gray-400"}`}
              >
                {actividad.nombre || "Sin nombre"}
              </p>
              {esHijo && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-orange-500">
                  Subproducto
                </span>
              )}
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5 align-top text-xs text-gray-500">
          {actividad.responsable || "Sin asignar"}
        </td>
        <td className={`px-3 py-2.5 align-top text-xs ${vencida ? "font-semibold text-red-600" : "text-gray-500"}`}>
          {actividad.fechaCumplimiento ? fechaCorta(actividad.fechaCumplimiento) : "Sin definir"}
          {vencida && <span className="ml-1.5 text-[10px] font-bold uppercase">Vencida</span>}
        </td>
        <td className="px-3 py-2.5 align-top">
          <label className="sr-only" htmlFor={`edt-estado-${actividad.id}`}>
            Estado de {actividad.nombre || "la actividad"}
          </label>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.clases}`}
          >
            <Icono className="h-3 w-3" />
            <select
              id={`edt-estado-${actividad.id}`}
              value={actividad.estado}
              disabled={ocupado === actividad.id}
              onChange={(e) => void cambiarEstado(actividad, e.target.value as EdtEstado)}
              className="cursor-pointer appearance-none bg-transparent pr-0.5 text-[11px] font-semibold outline-none disabled:cursor-wait disabled:opacity-60"
            >
              {ESTADOS.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
          </span>
        </td>
        <td className="px-3 py-2.5 align-top">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setEditor({ etapa: actividad.etapa, actividad })}
              title="Editar actividad"
              className="rounded p-1 text-gray-300 transition-colors hover:bg-amber-50 hover:text-amber-600"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void eliminar(actividad)}
              disabled={ocupado === actividad.id}
              title="Eliminar actividad"
              className="rounded p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-wait disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  if (cargando) {
    return <p className="py-10 text-center text-sm text-gray-400">Cargando checklist EDT…</p>;
  }

  const candidatos = editor
    ? raices(editor.etapa).filter(
        (a) => a.id !== editor.actividad?.id && (!editor.actividad || !hijos(editor.actividad.id).length),
      )
    : [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-800">Checklist EDT · SAC-PI031</h2>
            <p className="mt-0.5 text-[11px] text-gray-400">
              Interventoría y consultoría · versión 1 · 23/06/2022 · tres etapas fijas por proyecto
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex-shrink-0 rounded-full bg-gray-50 px-3 py-1 text-[11px] font-bold text-gray-600">
              {resumen.completadas} de {resumen.total} completadas
            </span>
            {resumen.total > 0 && (
              <button
                type="button"
                onClick={() => void cargarPlantilla()}
                disabled={ocupado === "plantilla"}
                title="Agrega las actividades de la plantilla que falten en las tres etapas"
                className="flex-shrink-0 rounded-lg border border-orange-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-orange-700 transition-colors hover:bg-orange-50 disabled:cursor-wait disabled:opacity-60"
              >
                {ocupado === "plantilla" ? "Completando…" : "Completar plantilla"}
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-[#C2410C] transition-all"
              style={{ width: `${resumen.pct}%` }}
            />
          </div>
          <span className="w-9 text-right text-xs font-black text-orange-700">{resumen.pct}%</span>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <p className="flex-1">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Cerrar aviso"
            className="text-red-400 hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {resumen.total === 0 && (
        <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50/40 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ListChecks className="h-6 w-6 flex-shrink-0 text-orange-400" />
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-800">Este proyecto aún no tiene checklist EDT</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Carga la plantilla con las actividades diligenciadas del formato SAC-PI031 v1.0
                (etapa constructiva y subproductos). Las etapas 1 y 3 se completan según el proyecto.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void cargarPlantilla()}
              disabled={ocupado === "plantilla"}
              className="flex-shrink-0 rounded-lg bg-[#C2410C] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#9A3412] disabled:cursor-wait disabled:opacity-60"
            >
              {ocupado === "plantilla" ? "Cargando…" : "Cargar plantilla EDT"}
            </button>
          </div>
        </div>
      )}

      {ETAPAS.map((etapa) => {
        const principales = raices(etapa.numero);
        const progreso = resumenEtapa(etapa.numero);
        return (
          <section
            key={etapa.numero}
            className="overflow-hidden rounded-xl border border-gray-100 bg-white"
          >
            <header className="flex flex-col gap-2 border-b border-gray-100 bg-gray-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#C2410C]/10 text-xs font-black text-[#9A3412]">
                  {etapa.numero}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">{etapa.nombre}</h3>
                  <p className="text-[11px] text-gray-400">{etapa.descripcion}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <div className="text-right">
                  <p className="text-[11px] font-bold text-gray-600">
                    {progreso.completadas}/{progreso.total} completadas
                  </p>
                  {progreso.vencidas > 0 && (
                    <p className="text-[10px] font-semibold text-red-500">
                      {progreso.vencidas} vencida(s)
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setEditor({ etapa: etapa.numero, actividad: null })}
                  className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-orange-700 transition-colors hover:bg-orange-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Actividad
                </button>
              </div>
            </header>
            <div className="h-1 bg-gray-100">
              <div
                className="h-full bg-[#C2410C] transition-all"
                style={{ width: `${progreso.pct}%` }}
              />
            </div>

            {principales.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-gray-400">
                Sin actividades en esta etapa.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/40">
                      {["No.", "Actividad", "Responsable", "Cumplimiento", "Estado", "Acciones"].map(
                        (titulo) => (
                          <th
                            key={titulo}
                            className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500"
                          >
                            {titulo}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {principales.map((principal, indice) => (
                      <Fragment key={principal.id}>
                        {fila(principal, String(indice + 1), false)}
                        {hijos(principal.id).map((hijo, indiceHijo) =>
                          fila(hijo, `${indice + 1}.${indiceHijo + 1}`, true),
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {editor && (
        <EditorActividad
          key={editor.actividad?.id ?? `nueva-${editor.etapa}`}
          proyectoId={proyectoId}
          etapa={editor.etapa}
          actividad={editor.actividad}
          candidatos={candidatos}
          onCerrar={() => setEditor(null)}
          onGuardado={guardado}
        />
      )}
    </div>
  );
}

function EditorActividad({
  proyectoId,
  etapa,
  actividad,
  candidatos,
  onCerrar,
  onGuardado,
}: {
  proyectoId: string;
  etapa: number;
  actividad: EdtActividadApi | null;
  candidatos: EdtActividadApi[];
  onCerrar: () => void;
  onGuardado: (actividad: EdtActividadApi) => void;
}) {
  const [nombre, setNombre] = useState(actividad?.nombre ?? "");
  const [responsable, setResponsable] = useState(actividad?.responsable ?? "");
  const [fecha, setFecha] = useState(actividad?.fechaCumplimiento ?? "");
  const [estado, setEstado] = useState<EdtEstado>(actividad?.estado ?? "No realizado");
  const [padreId, setPadreId] = useState(actividad?.padreId ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nombreEtapa = ETAPAS.find((item) => item.numero === etapa)?.nombre ?? `Etapa ${etapa}`;

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError(null);
    setGuardando(true);
    const datos = {
      etapa,
      padreId: padreId || null,
      nombre: nombre.trim(),
      responsable: responsable.trim() || null,
      fechaCumplimiento: fecha || null,
      estado,
    };

    try {
      const respuesta = actividad
        ? await api.actualizarEdtActividad(actividad.id, datos)
        : await api.crearEdtActividad(proyectoId, datos);
      onGuardado(respuesta.actividad);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la actividad.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={(evento) => void guardar(evento)}
        className="w-full max-w-lg rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              {actividad ? "Editar actividad del EDT" : "Nueva actividad del EDT"}
            </h2>
            <p className="mt-0.5 text-[11px] text-gray-400">{nombreEtapa}</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="edt-nombre" className="text-xs font-semibold text-slate-700">
              Actividad
            </label>
            <input
              id="edt-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={300}
              placeholder="Nombre de la actividad o subproducto"
              className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Puedes dejarla vacía si el formato aún no define el nombre; aparecerá como “Sin nombre”.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="edt-responsable" className="text-xs font-semibold text-slate-700">
                Responsable
              </label>
              <input
                id="edt-responsable"
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                maxLength={120}
                placeholder="Sin asignar"
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
              />
            </div>
            <div>
              <label htmlFor="edt-fecha" className="text-xs font-semibold text-slate-700">
                Fecha de cumplimiento
              </label>
              <input
                id="edt-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="edt-estado" className="text-xs font-semibold text-slate-700">
                Estado de cumplimiento
              </label>
              <select
                id="edt-estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value as EdtEstado)}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
              >
                {ESTADOS.map((valor) => (
                  <option key={valor} value={valor}>
                    {valor}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="edt-padre" className="text-xs font-semibold text-slate-700">
                Subproducto de
              </label>
              <select
                id="edt-padre"
                value={padreId}
                onChange={(e) => setPadreId(e.target.value)}
                disabled={Boolean(actividad && candidatos.length === 0)}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">Actividad principal</option>
                {candidatos.map((candidato) => (
                  <option key={candidato.id} value={candidato.id}>
                    {candidato.nombre || "Sin nombre"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="flex items-start gap-2 rounded-lg border border-orange-100 bg-orange-50/60 px-3 py-2.5 text-[11px] leading-relaxed text-orange-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            Una actividad principal no puede marcarse como completada mientras sus subproductos
            sigan pendientes.
          </p>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
            >
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9A3412] disabled:cursor-wait disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Guardar actividad"}
          </button>
        </div>
      </form>
    </div>
  );
}
