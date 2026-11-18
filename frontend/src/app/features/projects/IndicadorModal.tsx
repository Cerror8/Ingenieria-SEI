import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Target, X } from "lucide-react";
import { api, ApiError, type EdtActividadApi, type EdtFaseApi, type NuevoIndicador } from "../../api/client";
import { IND_CFG } from "../../constants";
import type { Indicator, IndicatorStatus } from "../../types";

const ESTADOS: IndicatorStatus[] = ["Pendiente", "En riesgo", "Cumplido", "No cumplido"];

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#F39200] focus:bg-white focus:ring-4 focus:ring-[#F39200]/15 disabled:opacity-60";

const hoyLocal = () => {
  const fecha = new Date();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
};

export function IndicadorModal({
  abierto,
  proyectoId,
  indicador,
  onCerrar,
  onGuardado,
  onShowToast,
}: {
  abierto: boolean;
  proyectoId: string;
  indicador: Indicator | null;
  onCerrar: () => void;
  onGuardado: () => void;
  onShowToast: (msg: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [meta, setMeta] = useState("");
  const [avance, setAvance] = useState("");
  const [cumplimiento, setCumplimiento] = useState("0");
  const [estado, setEstado] = useState<IndicatorStatus>("Pendiente");
  const [responsable, setResponsable] = useState("");
  const [fecha, setFecha] = useState(hoyLocal());
  const [origen, setOrigen] = useState<"Manual" | "EDT">("EDT");
  const [edtFaseId, setEdtFaseId] = useState("");
  const [edtActividades, setEdtActividades] = useState<EdtActividadApi[]>([]);
  const [actividadesSel, setActividadesSel] = useState<string[]>([]);
  const [fases, setFases] = useState<EdtFaseApi[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setNombre(indicador?.name ?? "");
    setMeta(indicador?.goal ?? "");
    setAvance(indicador?.advance ?? "");
    setCumplimiento(String(indicador?.compliance ?? 0));
    setEstado(indicador?.status ?? "Pendiente");
    setResponsable(indicador?.responsible ?? "");
    setFecha(indicador?.dateIso ?? hoyLocal());
    setOrigen(indicador?.origen ?? "EDT");
    setEdtFaseId(indicador?.edtFaseId ?? "");
    setActividadesSel(indicador?.edtActividadesIds ?? []);
    setEnviando(false);
    setError(null);
  }, [abierto, indicador]);

  useEffect(() => {
    if (!abierto || origen !== "EDT") return;
    let vigente = true;
    api
      .edt(proyectoId)
      .then(({ fases: lista, actividades }) => {
        if (!vigente) return;
        setFases(lista);
        setEdtActividades(actividades);
      })
      .catch(() => {
        if (!vigente) return;
        setFases([]);
        setEdtActividades([]);
      });
    return () => {
      vigente = false;
    };
  }, [abierto, proyectoId, origen]);

  if (!abierto) return null;

  const esEdt = origen === "EDT";
  const actividadesFase = edtActividades.filter((actividad) => actividad.faseId === edtFaseId);

  const alternarActividad = (actividadId: string) => {
    setActividadesSel((actual) =>
      actual.includes(actividadId)
        ? actual.filter((id) => id !== actividadId)
        : [...actual, actividadId],
    );
  };

  const cambiarFase = (faseId: string) => {
    setEdtFaseId(faseId);
    setActividadesSel([]);
  };

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (enviando) return;

    if (!nombre.trim()) return setError("El nombre del indicador es obligatorio.");
    if (!meta.trim()) return setError("Define la meta del indicador.");
    if (!fecha) return setError("Indica la fecha del indicador.");
    if (esEdt && !edtFaseId) return setError("Selecciona la fase del EDT para el cumplimiento automático.");

    const porcentaje = Number(cumplimiento);
    if (!esEdt && (!Number.isInteger(porcentaje) || porcentaje < 0 || porcentaje > 100)) {
      return setError("El cumplimiento debe ser un número entero entre 0 y 100.");
    }

    const datos: NuevoIndicador = {
      nombre: nombre.trim(),
      meta: meta.trim(),
      avance: avance.trim() || "Sin reportar",
      estado,
      responsable: responsable.trim() || "Sin asignar",
      fecha,
      origen,
      edtFaseId: esEdt ? edtFaseId : null,
      actividadesIds: esEdt ? actividadesSel : [],
      ...(esEdt ? {} : { cumplimiento: porcentaje }),
    };

    setEnviando(true);
    setError(null);
    try {
      if (indicador) {
        await api.actualizarIndicador(indicador.id, datos);
        onShowToast("Indicador actualizado.");
      } else {
        await api.crearIndicador(proyectoId, datos);
        onShowToast("Indicador creado.");
      }
      onGuardado();
      onCerrar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar el indicador.");
    } finally {
      setEnviando(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl bg-white shadow-xl sm:rounded-lg">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              {indicador ? "Editar indicador" : "Nuevo indicador"}
            </h2>
            {indicador && (
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400">
                {indicador.id} · {proyectoId}
              </p>
            )}
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

        <form className="space-y-4 px-5 py-4" onSubmit={guardar}>
          <div className="space-y-1.5">
            <label htmlFor="indicador-nombre" className="text-xs font-semibold text-slate-700">Nombre</label>
            <input
              id="indicador-nombre"
              type="text"
              required
              maxLength={200}
              disabled={enviando}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej.: Capacitar al personal en seguridad industrial"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="indicador-meta" className="text-xs font-semibold text-slate-700">Meta</label>
              <input
                id="indicador-meta"
                type="text"
                required
                maxLength={200}
                disabled={enviando}
                value={meta}
                onChange={(e) => setMeta(e.target.value)}
                placeholder="Ej.: 40 trabajadores capacitados"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="indicador-avance" className="text-xs font-semibold text-slate-700">
                Avance <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <input
                id="indicador-avance"
                type="text"
                maxLength={200}
                disabled={enviando}
                value={avance}
                onChange={(e) => setAvance(e.target.value)}
                placeholder="Ej.: 28 trabajadores"
                className={inputCls}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Origen del cumplimiento</span>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
              {(["Manual", "EDT"] as const).map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  disabled={enviando}
                  onClick={() => setOrigen(opcion)}
                  aria-pressed={origen === opcion}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                    origen === opcion ? "bg-white text-[#C2410C] shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {opcion === "Manual" ? "Manual" : "Automático (EDT)"}
                </button>
              ))}
            </div>
            {esEdt && (
              <>
                <select
                  id="indicador-fase"
                  value={edtFaseId}
                  disabled={enviando}
                  onChange={(e) => cambiarFase(e.target.value)}
                  aria-label="Fase del EDT"
                  className={inputCls}
                >
                  <option value="">Selecciona la fase del EDT</option>
                  {fases.map((fase) => (
                    <option key={fase.id} value={fase.id}>{fase.nombre}</option>
                  ))}
                </select>

                {edtFaseId && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">Actividades incluidas</span>
                      <span className="text-[11px] text-slate-400">
                        {actividadesSel.length === 0
                          ? "Toda la fase"
                          : `${actividadesSel.length} seleccionada(s)`}
                      </span>
                    </div>
                    <div className="max-h-44 divide-y divide-gray-50 overflow-y-auto rounded-lg border border-slate-200">
                      {actividadesFase.map((actividad) => (
                        <label
                          key={actividad.id}
                          className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={actividadesSel.includes(actividad.id)}
                            onChange={() => alternarActividad(actividad.id)}
                            disabled={enviando}
                            className="accent-[#C2410C]"
                          />
                          <span className="flex-1">{actividad.nombre}</span>
                          <span className="font-mono text-[10px] text-slate-400">{actividad.estado}</span>
                        </label>
                      ))}
                      {actividadesFase.length === 0 && (
                        <p className="px-3 py-3 text-xs text-slate-400">
                          La fase no tiene actividades registradas.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-slate-400">
                  El porcentaje es la proporción de actividades completadas; las marcadas «No aplica» no
                  cuentan. Sin seleccionar actividades, cubre toda la fase. Se actualiza solo al cambiar el EDT.
                </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="indicador-estado" className="text-xs font-semibold text-slate-700">Estado</label>
              <select
                id="indicador-estado"
                value={estado}
                disabled={enviando}
                onChange={(e) => setEstado(e.target.value as IndicatorStatus)}
                className={inputCls}
              >
                {ESTADOS.map((opcion) => (
                  <option key={opcion} value={opcion}>{opcion}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="indicador-cumplimiento" className="text-xs font-semibold text-slate-700">
                Cumplimiento (%)
              </label>
              <input
                id="indicador-cumplimiento"
                type="number"
                required={!esEdt}
                min={0}
                max={100}
                step={1}
                disabled={enviando || esEdt}
                value={cumplimiento}
                onChange={(e) => setCumplimiento(e.target.value)}
                aria-describedby="indicador-cumplimiento-ayuda"
                className={inputCls}
              />
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full ${IND_CFG[estado].bar}`}
                    style={{ width: `${Math.min(100, Math.max(0, Number(cumplimiento) || 0))}%` }}
                  />
                </div>
                <span id="indicador-cumplimiento-ayuda" className="text-[11px] text-slate-400">
                  {esEdt ? "Calculado desde el EDT" : "Barra según el estado"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="indicador-responsable" className="text-xs font-semibold text-slate-700">
                Responsable <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <input
                id="indicador-responsable"
                type="text"
                maxLength={120}
                disabled={enviando}
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                placeholder="Sin asignar"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="indicador-fecha" className="text-xs font-semibold text-slate-700">Fecha</label>
              <input
                id="indicador-fecha"
                type="date"
                required
                disabled={enviando}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="inline-flex items-center gap-2 rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Target className="h-4 w-4" />
              {enviando ? "Guardando…" : indicador ? "Guardar cambios" : "Crear indicador"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
