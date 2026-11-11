import { useState, type FormEvent } from "react";
import { AlertTriangle, HandCoins, Pencil, Plus, Receipt, Trash2, X } from "lucide-react";
import { api, fechaCorta } from "../../api/client";
import { fmt } from "../../lib/format";
import type { Desembolso, Project } from "../../types";

const HOY = new Date().toISOString().slice(0, 10);

function porcentajeTiempo(inicio: string, fin: string) {
  const desde = new Date(`${inicio}T00:00:00`).getTime();
  const hasta = new Date(`${fin}T00:00:00`).getTime();
  const ahora = new Date(`${HOY}T00:00:00`).getTime();
  if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta <= desde) return 0;
  return Math.min(100, Math.max(0, Math.round(((ahora - desde) / (hasta - desde)) * 100)));
}

export function PresupuestoTab({
  proyecto,
  desembolsos,
  onRefresh,
  onShowToast,
}: {
  proyecto: Project;
  desembolsos: Desembolso[];
  onRefresh: () => void;
  onShowToast: (mensaje: string) => void;
}) {
  const [editandoPresupuestos, setEditandoPresupuestos] = useState(false);
  const [mostrarDesembolso, setMostrarDesembolso] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const negociacion = proyecto.budgetNegotiation || proyecto.budget;
  const ejecucion = proyecto.budgetExecution || proyecto.budget;
  const alerta = proyecto.budgetAlert;
  const ejecutado = Math.round((proyecto.budget * proyecto.budgetExecuted) / 100);
  const pctTiempo = porcentajeTiempo(proyecto.startIso, proyecto.endIso);
  const totalDesembolsado = desembolsos
    .filter((d) => d.clase === "Desembolso")
    .reduce((total, d) => total + d.valor, 0);
  const totalActas = desembolsos
    .filter((d) => d.clase === "Acta parcial")
    .reduce((total, d) => total + d.valor, 0);
  const alertaSuperada = alerta > 0 && ejecutado > alerta;

  const eliminar = async (desembolso: Desembolso) => {
    if (!window.confirm(`¿Eliminar el registro "${desembolso.concepto}" por ${fmt(desembolso.valor)}?`)) return;
    setError(null);
    setEliminando(desembolso.id);
    try {
      await api.eliminarDesembolso(proyecto.id, desembolso.id);
      onShowToast("Registro financiero eliminado.");
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el registro.");
    } finally {
      setEliminando(null);
    }
  };

  const comparaciones = [
    { label: "Tiempo transcurrido", valor: pctTiempo, color: "bg-slate-500", nota: `${proyecto.startDate} → ${proyecto.endDate}` },
    { label: "Avance técnico", valor: proyecto.progress, color: "bg-orange-500", nota: "Según seguimiento del proyecto" },
    { label: "Ejecución presupuestal", valor: proyecto.budgetExecuted, color: "bg-emerald-500", nota: `${fmt(ejecutado)} de ${fmt(proyecto.budget)}` },
  ];

  return (
    <div className="space-y-5">
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <p className="flex-1">{error}</p>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar aviso" className="text-red-400 hover:text-red-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Presupuesto de negociación", valor: negociacion, tc: "text-gray-900", bg: "bg-gray-50" },
          { label: "Presupuesto de ejecución", valor: ejecucion, tc: "text-orange-700", bg: "bg-orange-50" },
          { label: "Presupuesto de alerta", valor: alerta, tc: alertaSuperada ? "text-red-700" : "text-amber-700", bg: alertaSuperada ? "bg-red-50" : "bg-amber-50" },
          { label: "Valor total del contrato", valor: proyecto.budget, tc: "text-emerald-700", bg: "bg-emerald-50" },
        ].map((tarjeta) => (
          <div key={tarjeta.label} className={`${tarjeta.bg} rounded-xl border border-gray-100 p-3`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{tarjeta.label}</p>
            <p className={`mt-1 text-lg font-black ${tarjeta.tc}`}>{fmt(tarjeta.valor)}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Presupuesto vs. tiempo y desarrollo</h3>
          <p className="mt-0.5 text-[11px] text-gray-400">
            Compara el tiempo consumido con el avance técnico y la ejecución del presupuesto.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditandoPresupuestos(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          <Pencil className="h-3.5 w-3.5" />Ajustar presupuestos
        </button>
      </div>

      <div className="space-y-3 rounded-xl border border-gray-100 p-4">
        {comparaciones.map((fila) => (
          <div key={fila.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-gray-700">{fila.label}</span>
              <span className="text-xs font-black text-gray-900">{fila.valor}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
              <div className={`h-full rounded-full ${fila.color} transition-all`} style={{ width: `${fila.valor}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-gray-400">{fila.nota}</p>
          </div>
        ))}
        {proyecto.budgetExecuted > proyecto.progress + 10 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            La ejecución presupuestal supera el avance técnico en más de 10 puntos. Revisa los pagos y el avance reportado.
          </p>
        )}
        {alertaSuperada && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            El valor ejecutado ({fmt(ejecutado)}) superó el presupuesto de alerta ({fmt(alerta)}).
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100">
        <div className="flex flex-col gap-2 border-b border-gray-100 bg-gray-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-800">Desembolsos y cobro de actas parciales</h3>
            <p className="mt-0.5 text-[11px] text-gray-400">
              Desembolsado: {fmt(totalDesembolsado)} · Actas parciales: {fmt(totalActas)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMostrarDesembolso(true)}
            className="inline-flex items-center gap-1.5 self-start rounded-lg bg-[#C2410C] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#9A3412] sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" />Registrar movimiento
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/40">
                {["Fecha", "Clase", "N.º acta", "Concepto", "Valor", "Acciones"].map((titulo) => (
                  <th
                    key={titulo}
                    className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 ${titulo === "Valor" ? "text-right" : "text-left"}`}
                  >
                    {titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {desembolsos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">
                    Sin desembolsos ni actas parciales registradas.
                  </td>
                </tr>
              )}
              {[...desembolsos]
                .sort((a, b) => a.fecha.localeCompare(b.fecha))
                .map((desembolso) => (
                  <tr key={desembolso.id} className="hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-500">{fechaCorta(desembolso.fecha)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${desembolso.clase === "Acta parcial" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {desembolso.clase === "Acta parcial" ? <Receipt className="h-3 w-3" /> : <HandCoins className="h-3 w-3" />}
                        {desembolso.clase}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{desembolso.numeroActa ?? "—"}</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-gray-800">{desembolso.concepto}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-semibold text-orange-700">{fmt(desembolso.valor)}</td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => void eliminar(desembolso)}
                        disabled={eliminando === desembolso.id}
                        title="Eliminar registro"
                        className="rounded p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-wait disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={4} className="px-4 py-2.5 text-sm font-bold text-gray-900">Total registrado</td>
                <td className="px-4 py-2.5 text-right text-sm font-bold text-orange-700">{fmt(totalDesembolsado + totalActas)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {editandoPresupuestos && (
        <EditarPresupuestos
          proyecto={proyecto}
          onCerrar={() => setEditandoPresupuestos(false)}
          onGuardado={() => {
            setEditandoPresupuestos(false);
            onShowToast("Presupuestos actualizados.");
            onRefresh();
          }}
        />
      )}

      {mostrarDesembolso && (
        <NuevoDesembolso
          proyectoId={proyecto.id}
          onCerrar={() => setMostrarDesembolso(false)}
          onGuardado={() => {
            setMostrarDesembolso(false);
            onShowToast("Movimiento financiero registrado.");
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

function EditarPresupuestos({
  proyecto,
  onCerrar,
  onGuardado,
}: {
  proyecto: Project;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [negociacion, setNegociacion] = useState(String(proyecto.budgetNegotiation || 0));
  const [ejecucion, setEjecucion] = useState(String(proyecto.budgetExecution || 0));
  const [alerta, setAlerta] = useState(String(proyecto.budgetAlert || 0));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await api.actualizarProyecto(proyecto.id, {
        presupuestoNegociacion: Number(negociacion) || 0,
        presupuestoEjecucion: Number(ejecucion) || 0,
        presupuestoAlerta: Number(alerta) || 0,
      });
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron actualizar los presupuestos.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <form onSubmit={(e) => void guardar(e)} className="w-full max-w-lg rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-bold text-gray-900">Ajustar presupuestos</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <p className="rounded-lg border border-orange-100 bg-orange-50/60 px-3 py-2 text-xs text-orange-900">
            El valor total del contrato se edita desde «Editar proyecto». Aquí se registran los
            presupuestos de negociación, ejecución y el umbral de alerta.
          </p>
          {[
            { id: "negociacion", label: "Presupuesto de negociación", valor: negociacion, set: setNegociacion },
            { id: "ejecucion", label: "Presupuesto de ejecución", valor: ejecucion, set: setEjecucion },
            { id: "alerta", label: "Presupuesto de alerta", valor: alerta, set: setAlerta },
          ].map((campo) => (
            <div key={campo.id}>
              <label htmlFor={`presupuesto-${campo.id}`} className="text-xs font-semibold text-slate-700">
                {campo.label}
              </label>
              <input
                id={`presupuesto-${campo.id}`}
                type="number"
                min={0}
                step={1}
                value={campo.valor}
                onChange={(e) => campo.set(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
              />
            </div>
          ))}
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button type="button" onClick={onCerrar} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9A3412] disabled:cursor-wait disabled:opacity-60">
            {guardando ? "Guardando…" : "Guardar presupuestos"}
          </button>
        </div>
      </form>
    </div>
  );
}

function NuevoDesembolso({
  proyectoId,
  onCerrar,
  onGuardado,
}: {
  proyectoId: string;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [fecha, setFecha] = useState(HOY);
  const [clase, setClase] = useState<Desembolso["clase"]>("Desembolso");
  const [concepto, setConcepto] = useState("");
  const [valor, setValor] = useState("");
  const [numeroActa, setNumeroActa] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (guardando) return;
    if (!fecha) return setError("Indica la fecha del movimiento.");
    if (!concepto.trim()) return setError("Escribe el concepto.");
    const monto = Number(valor);
    if (!Number.isFinite(monto) || monto <= 0) return setError("El valor debe ser mayor que cero.");

    setGuardando(true);
    setError(null);
    try {
      await api.crearDesembolso(proyectoId, {
        fecha,
        concepto: concepto.trim(),
        valor: Math.round(monto),
        clase,
        numeroActa: clase === "Acta parcial" ? numeroActa.trim() || null : null,
      });
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el movimiento.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <form onSubmit={(e) => void guardar(e)} className="w-full max-w-lg rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-bold text-gray-900">Registrar desembolso o acta parcial</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="desembolso-clase" className="text-xs font-semibold text-slate-700">Clase</label>
              <select
                id="desembolso-clase"
                value={clase}
                onChange={(e) => setClase(e.target.value as Desembolso["clase"])}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#EA580C] focus:outline-none focus:ring-4 focus:ring-orange-500/10"
              >
                <option value="Desembolso">Desembolso</option>
                <option value="Acta parcial">Cobro de acta parcial</option>
              </select>
            </div>
            <div>
              <label htmlFor="desembolso-fecha" className="text-xs font-semibold text-slate-700">Fecha</label>
              <input
                id="desembolso-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#EA580C] focus:outline-none focus:ring-4 focus:ring-orange-500/10"
              />
            </div>
          </div>

          {clase === "Acta parcial" && (
            <div>
              <label htmlFor="desembolso-acta" className="text-xs font-semibold text-slate-700">Número de acta</label>
              <input
                id="desembolso-acta"
                value={numeroActa}
                onChange={(e) => setNumeroActa(e.target.value)}
                maxLength={80}
                placeholder="Acta 4"
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#EA580C] focus:outline-none focus:ring-4 focus:ring-orange-500/10"
              />
            </div>
          )}

          <div>
            <label htmlFor="desembolso-concepto" className="text-xs font-semibold text-slate-700">Concepto</label>
            <input
              id="desembolso-concepto"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              maxLength={200}
              required
              placeholder="Anticipo, acta parcial 4, desembolso de obra…"
              className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#EA580C] focus:outline-none focus:ring-4 focus:ring-orange-500/10"
            />
          </div>

          <div>
            <label htmlFor="desembolso-valor" className="text-xs font-semibold text-slate-700">Valor</label>
            <input
              id="desembolso-valor"
              type="number"
              min={1}
              step={1}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              required
              placeholder="0"
              className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#EA580C] focus:outline-none focus:ring-4 focus:ring-orange-500/10"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button type="button" onClick={onCerrar} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9A3412] disabled:cursor-wait disabled:opacity-60">
            {guardando ? "Guardando…" : "Registrar"}
          </button>
        </div>
      </form>
    </div>
  );
}
