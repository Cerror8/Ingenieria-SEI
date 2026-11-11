import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Boxes,
  FileSpreadsheet,
  HandCoins,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  X,
} from "lucide-react";
import {
  api,
  fechaCorta,
  type CategoriaValorProyecto,
  type ColumnaTablaApi,
  type ProyectoValorApi,
  type ResumenValoresProyectoApi,
  type ValorReferenciaApi,
  type ValorTablaApi,
} from "../../api/client";
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

      <OtrosValores proyecto={proyecto} onShowToast={onShowToast} />

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

const CATEGORIAS: CategoriaValorProyecto[] = ["Material", "Instrumento", "Otro"];

const CATEGORIA_CFG: Record<CategoriaValorProyecto, { badge: string; card: string; tc: string }> = {
  Material: { badge: "bg-sky-50 text-sky-700", card: "bg-sky-50", tc: "text-sky-700" },
  Instrumento: { badge: "bg-violet-50 text-violet-700", card: "bg-violet-50", tc: "text-violet-700" },
  Otro: { badge: "bg-gray-100 text-gray-600", card: "bg-gray-50", tc: "text-gray-700" },
};

const fmtCantidad = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 3 });

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function numeroDeCelda(valor: string): number {
  const limpio = valor.replace(/[^\d,.-]/g, "").replace(/-/g, "").trim();
  if (!limpio) return 0;
  const tieneComa = limpio.includes(",");
  const tienePunto = limpio.includes(".");
  let normalizado = limpio;
  if (tieneComa && tienePunto) {
    normalizado =
      limpio.lastIndexOf(",") > limpio.lastIndexOf(".")
        ? limpio.replace(/\./g, "").replace(",", ".")
        : limpio.replace(/,/g, "");
  } else if (tieneComa) {
    normalizado = limpio.replace(/\./g, "").replace(",", ".");
  } else if (tienePunto) {
    const partes = limpio.split(".");
    normalizado =
      partes.length > 2 || partes[partes.length - 1].length === 3 ? limpio.replace(/\./g, "") : limpio;
  }
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

function columnaSugerida(columnas: ColumnaTablaApi[], patrones: RegExp[]) {
  for (const patron of patrones) {
    const encontrada = columnas.find((columna) => patron.test(normalizarTexto(columna.etiqueta)));
    if (encontrada) return encontrada.letra;
  }
  return "";
}

function OtrosValores({
  proyecto,
  onShowToast,
}: {
  proyecto: Project;
  onShowToast: (mensaje: string) => void;
}) {
  const [valores, setValores] = useState<ProyectoValorApi[]>([]);
  const [resumen, setResumen] = useState<ResumenValoresProyectoApi | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("todos");
  const [dialogo, setDialogo] = useState<{ valor: ProyectoValorApi | null } | null>(null);
  const [importando, setImportando] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await api.proyectoValores(proyecto.id);
      setValores(datos.valores);
      setResumen(datos.resumen);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los valores del proyecto.");
    } finally {
      setCargando(false);
    }
  }, [proyecto.id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const linea = proyecto.line.trim();
  const visibles = valores.filter((valor) => {
    if (filtro === "linea") return valor.tipoProyecto !== "";
    if (filtro === "sin") return valor.tipoProyecto === "";
    return true;
  });

  const eliminar = async (valor: ProyectoValorApi) => {
    if (!window.confirm(`¿Quitar "${valor.nombre}" del presupuesto del proyecto?`)) return;
    setEliminando(valor.id);
    setError(null);
    try {
      const datos = await api.eliminarProyectoValor(proyecto.id, valor.id);
      setValores((prev) => prev.filter((fila) => fila.id !== valor.id));
      setResumen(datos.resumen);
      onShowToast("Valor eliminado del presupuesto.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el valor.");
    } finally {
      setEliminando(null);
    }
  };

  const total = resumen?.total ?? 0;
  const presupuesto = resumen?.presupuesto ?? proyecto.budget;
  const diferencia = resumen?.diferencia ?? presupuesto - total;

  return (
    <section className="overflow-hidden rounded-xl border border-gray-100">
      <div className="flex flex-col gap-2 border-b border-gray-100 bg-gray-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-gray-800">
            <Boxes className="h-4 w-4 text-orange-600" />
            Otros valores del proyecto
          </h3>
          <p className="mt-0.5 text-[11px] text-gray-400">
            Materiales, instrumentos y otros conceptos que componen el presupuesto, filtrados por el tipo de proyecto.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setImportando(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />Importar de análisis
          </button>
          <button
            type="button"
            onClick={() => setDialogo({ valor: null })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#C2410C] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#9A3412]"
          >
            <Plus className="h-3.5 w-3.5" />Agregar valor
          </button>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <p className="flex-1">{error}</p>
            <button type="button" onClick={() => setError(null)} aria-label="Cerrar aviso" className="text-red-400 hover:text-red-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {cargando ? (
          <p className="py-6 text-center text-sm text-gray-400">Cargando valores del proyecto…</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {CATEGORIAS.map((categoria) => {
                const cfg = CATEGORIA_CFG[categoria];
                const dato = resumen?.porCategoria[categoria] ?? { items: 0, total: 0 };
                return (
                  <div key={categoria} className={`${cfg.card} rounded-xl border border-gray-100 p-3`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{categoria}</p>
                    <p className={`mt-1 text-lg font-black ${cfg.tc}`}>{fmt(dato.total)}</p>
                    <p className="mt-0.5 text-[10px] text-gray-400">{dato.items} valor(es)</p>
                  </div>
                );
              })}
              <div className={`rounded-xl border p-3 ${diferencia < 0 ? "border-red-200 bg-red-50" : "border-emerald-100 bg-emerald-50"}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Total valores</p>
                <p className={`mt-1 text-lg font-black ${diferencia < 0 ? "text-red-700" : "text-emerald-700"}`}>{fmt(total)}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-gray-500">
                  {diferencia < 0
                    ? `Excede el contrato en ${fmt(Math.abs(diferencia))}`
                    : `${fmt(diferencia)} disponibles del contrato`}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <label htmlFor="valores-filtro-tipo" className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Tipo de proyecto
                </label>
                <select
                  id="valores-filtro-tipo"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 outline-none transition focus:border-[#EA580C] sm:w-64"
                >
                  <option value="todos">Todas las líneas aplicables</option>
                  {linea && <option value="linea">Solo {linea}</option>}
                  <option value="sin">Sin tipo (aplican a todos)</option>
                </select>
              </div>
              <p className="text-[10px] text-gray-400 sm:text-right">
                Los valores sin tipo aplican a cualquier proyecto; los tipados solo a la línea coincidente.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/40">
                    {["Valor", "Categoría", "Unidad", "Cantidad", "Valor unitario", "Valor total", "Tipo", "Acciones"].map((titulo) => (
                      <th
                        key={titulo}
                        className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 ${
                          ["Valor unitario", "Valor total"].includes(titulo) ? "text-right" : "text-left"
                        }`}
                      >
                        {titulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visibles.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-xs text-gray-400">
                        {valores.length === 0
                          ? "Sin materiales, instrumentos u otros valores. Agrégalos manualmente o importa una tabla analizada."
                          : "No hay valores para el filtro seleccionado."}
                      </td>
                    </tr>
                  )}
                  {visibles.map((valor) => (
                    <tr key={valor.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2.5">
                        <p className="text-sm font-semibold text-gray-800">{valor.nombre}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-400">
                          {valor.origen === "Tabla" ? <FileSpreadsheet className="h-3 w-3" /> : null}
                          {valor.origen === "Tabla" ? "Importado de tabla analizada" : "Registro manual"}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${CATEGORIA_CFG[valor.categoria].badge}`}>
                          {valor.categoria}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{valor.unidad || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{fmtCantidad(valor.cantidad)}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-gray-600">{fmt(valor.valorUnitario)}</td>
                      <td className="px-3 py-2.5 text-right text-sm font-semibold text-orange-700">{fmt(valor.valorTotal)}</td>
                      <td className="px-3 py-2.5 text-[11px] text-gray-500">{valor.tipoProyecto || "Todas las líneas"}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => setDialogo({ valor })}
                            title="Editar valor"
                            className="rounded p-1 text-gray-300 transition-colors hover:bg-orange-50 hover:text-orange-600"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void eliminar(valor)}
                            disabled={eliminando === valor.id}
                            title="Eliminar valor"
                            className="rounded p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-wait disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={5} className="px-3 py-2.5 text-sm font-bold text-gray-900">
                      Total visualizado ({visibles.length})
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-bold text-orange-700">
                      {fmt(visibles.reduce((suma, valor) => suma + valor.valorTotal, 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {dialogo && (
        <EditorValorProyecto
          key={dialogo.valor?.id ?? "nuevo"}
          proyecto={proyecto}
          valor={dialogo.valor}
          onCerrar={() => setDialogo(null)}
          onGuardado={() => {
            setDialogo(null);
            onShowToast(dialogo.valor ? "Valor actualizado." : "Valor agregado al presupuesto.");
            void cargar();
          }}
        />
      )}

      {importando && (
        <ImportarValores
          proyecto={proyecto}
          onCerrar={() => setImportando(false)}
          onImportado={(cantidad) => {
            setImportando(false);
            onShowToast(`${cantidad} valor(es) importado(s) al presupuesto.`);
            void cargar();
          }}
        />
      )}
    </section>
  );
}

function EditorValorProyecto({
  proyecto,
  valor,
  onCerrar,
  onGuardado,
}: {
  proyecto: Project;
  valor: ProyectoValorApi | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const linea = proyecto.line.trim();
  const [nombre, setNombre] = useState(valor?.nombre ?? "");
  const [categoria, setCategoria] = useState<CategoriaValorProyecto>(valor?.categoria ?? "Material");
  const [unidad, setUnidad] = useState(valor?.unidad ?? "");
  const [cantidad, setCantidad] = useState(String(valor?.cantidad ?? 1));
  const [valorUnitario, setValorUnitario] = useState(String(valor?.valorUnitario ?? 0));
  const [tipoProyecto, setTipoProyecto] = useState(valor ? valor.tipoProyecto : linea);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montoCantidad = Number(cantidad);
  const montoUnitario = Number(valorUnitario);
  const total =
    Number.isFinite(montoCantidad) && Number.isFinite(montoUnitario)
      ? montoCantidad * montoUnitario
      : 0;

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (guardando) return;
    if (!nombre.trim()) return setError("Escribe el nombre del valor.");
    if (!Number.isFinite(montoCantidad) || montoCantidad < 0) {
      return setError("La cantidad debe ser cero o mayor.");
    }
    if (!Number.isFinite(montoUnitario) || montoUnitario < 0) {
      return setError("El valor unitario debe ser cero o mayor.");
    }

    setGuardando(true);
    setError(null);
    const datos = {
      nombre: nombre.trim(),
      categoria,
      unidad: unidad.trim(),
      cantidad: montoCantidad,
      valorUnitario: Math.round(montoUnitario),
      tipoProyecto,
    };

    try {
      if (valor) {
        await api.actualizarProyectoValor(proyecto.id, valor.id, datos);
      } else {
        await api.crearProyectoValores(proyecto.id, [datos]);
      }
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el valor.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <form onSubmit={(e) => void guardar(e)} className="w-full max-w-lg rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-bold text-gray-900">
            {valor ? "Editar valor del proyecto" : "Agregar valor al proyecto"}
          </h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="valor-nombre" className="text-xs font-semibold text-slate-700">Nombre</label>
            <input
              id="valor-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={200}
              required
              placeholder="Cemento, multímetro, transporte…"
              className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="valor-categoria" className="text-xs font-semibold text-slate-700">Categoría</label>
              <select
                id="valor-categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaValorProyecto)}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#EA580C] focus:outline-none focus:ring-4 focus:ring-orange-500/10"
              >
                {CATEGORIAS.map((opcion) => (
                  <option key={opcion} value={opcion}>{opcion}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="valor-unidad" className="text-xs font-semibold text-slate-700">Unidad</label>
              <input
                id="valor-unidad"
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                maxLength={40}
                placeholder="Und, m², kg…"
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
              />
            </div>
            <div>
              <label htmlFor="valor-cantidad" className="text-xs font-semibold text-slate-700">Cantidad</label>
              <input
                id="valor-cantidad"
                type="number"
                min={0}
                step="0.001"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
              />
            </div>
            <div>
              <label htmlFor="valor-unitario" className="text-xs font-semibold text-slate-700">Valor unitario</label>
              <input
                id="valor-unitario"
                type="number"
                min={0}
                step={1}
                value={valorUnitario}
                onChange={(e) => setValorUnitario(e.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="valor-tipo" className="text-xs font-semibold text-slate-700">Tipo de proyecto</label>
            <select
              id="valor-tipo"
              value={tipoProyecto}
              onChange={(e) => setTipoProyecto(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#EA580C] focus:outline-none focus:ring-4 focus:ring-orange-500/10"
            >
              <option value="">Aplica a todos los tipos</option>
              {linea && <option value={linea}>Solo {linea}</option>}
            </select>
            <p className="mt-1 text-[10px] text-gray-400">
              El tipo vacío queda disponible para cualquier proyecto; si eliges la línea, solo se verá en proyectos de esa línea.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-orange-100 bg-orange-50/60 px-3 py-2">
            <span className="text-xs font-semibold text-orange-900">Valor total</span>
            <span className="text-sm font-black text-orange-700">{fmt(Math.round(total))}</span>
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
            {guardando ? "Guardando…" : "Guardar valor"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ImportarValores({
  proyecto,
  onCerrar,
  onImportado,
}: {
  proyecto: Project;
  onCerrar: () => void;
  onImportado: (cantidad: number) => void;
}) {
  const linea = proyecto.line.trim();
  const [referencias, setReferencias] = useState<ValorReferenciaApi[]>([]);
  const [cargandoReferencias, setCargandoReferencias] = useState(true);
  const [valorId, setValorId] = useState("");
  const [tablas, setTablas] = useState<ValorTablaApi[]>([]);
  const [cargandoTablas, setCargandoTablas] = useState(false);
  const [tablaId, setTablaId] = useState("");
  const [tabla, setTabla] = useState<(ValorTablaApi & { filas: string[][] }) | null>(null);
  const [cargandoFilas, setCargandoFilas] = useState(false);
  const [colNombre, setColNombre] = useState("");
  const [colUnidad, setColUnidad] = useState("");
  const [colCantidad, setColCantidad] = useState("");
  const [colValor, setColValor] = useState("");
  const [categoria, setCategoria] = useState<CategoriaValorProyecto>("Material");
  const [tipoProyecto, setTipoProyecto] = useState(linea);
  const [busqueda, setBusqueda] = useState("");
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .valores()
      .then(({ valores }) => setReferencias(valores))
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar los valores de referencia."))
      .finally(() => setCargandoReferencias(false));
  }, []);

  const elegirTabla = useCallback(async (idValor: string, idTabla: string) => {
    setTablaId(idTabla);
    setTabla(null);
    setColNombre("");
    setColUnidad("");
    setColCantidad("");
    setColValor("");
    if (!idTabla) return;
    setCargandoFilas(true);
    setError(null);
    try {
      const { tabla: datos } = await api.valorTablaFilas(idValor, idTabla);
      setTabla(datos);
      setColNombre(
        columnaSugerida(datos.columnas, [/nombre/, /descripcion/, /material/, /insumo/, /elemento/, /concepto/]),
      );
      setColUnidad(columnaSugerida(datos.columnas, [/unidad/, /^und/, /^un$/, /^um$/, /medida/]));
      setColCantidad(columnaSugerida(datos.columnas, [/cantidad/, /^cant/, /^qty/]));
      setColValor(
        columnaSugerida(datos.columnas, [
          /valor.*unit/,
          /precio.*unit/,
          /unitario/,
          /vr.*unit/,
          /precio/,
          /valor/,
        ]),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las filas de la tabla.");
    } finally {
      setCargandoFilas(false);
    }
  }, []);

  const elegirReferencia = async (idValor: string) => {
    setValorId(idValor);
    setTablas([]);
    setTablaId("");
    setTabla(null);
    if (!idValor) return;
    setCargandoTablas(true);
    setError(null);
    try {
      const { tablas: filas } = await api.valorTablas(idValor);
      setTablas(filas);
      if (filas.length === 1) await elegirTabla(idValor, filas[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las tablas del archivo.");
    } finally {
      setCargandoTablas(false);
    }
  };

  const filasMapeadas = useMemo(() => {
    if (!tabla || !colNombre) return [];
    const indice = (letra: string) =>
      letra ? tabla.columnas.findIndex((columna) => columna.letra === letra) : -1;
    const iNombre = indice(colNombre);
    const iUnidad = indice(colUnidad);
    const iCantidad = indice(colCantidad);
    const iValor = indice(colValor);
    if (iNombre < 0) return [];
    const termino = normalizarTexto(busqueda);

    return tabla.filas
      .map((fila, indiceFila) => ({
        filaIndice: indiceFila,
        nombre: (fila[iNombre] ?? "").trim(),
        unidad: iUnidad >= 0 ? (fila[iUnidad] ?? "").trim().slice(0, 40) : "",
        cantidad: iCantidad >= 0 ? numeroDeCelda(fila[iCantidad] ?? "") : 1,
        valorUnitario: iValor >= 0 ? Math.round(numeroDeCelda(fila[iValor] ?? "")) : 0,
      }))
      .filter((fila) => fila.nombre.length > 0)
      .filter((fila) => !termino || normalizarTexto(`${fila.nombre} ${fila.unidad}`).includes(termino));
  }, [tabla, colNombre, colUnidad, colCantidad, colValor, busqueda]);

  const totalImportacion = filasMapeadas.reduce(
    (suma, fila) => suma + fila.cantidad * fila.valorUnitario,
    0,
  );

  const importar = async () => {
    if (importando) return;
    if (!valorId || !tablaId || !tabla) return setError("Selecciona un archivo de referencia y una tabla.");
    if (!colNombre) return setError("Indica qué columna contiene el nombre del valor.");
    if (filasMapeadas.length === 0) return setError("No hay filas con nombre para importar.");
    if (filasMapeadas.length > 500) {
      return setError(
        `La tabla tiene ${filasMapeadas.length} filas y el máximo por carga es 500. Usa la búsqueda para reducir la selección.`,
      );
    }

    setImportando(true);
    setError(null);
    try {
      await api.crearProyectoValores(
        proyecto.id,
        filasMapeadas.map((fila) => ({
          nombre: fila.nombre,
          categoria,
          unidad: fila.unidad,
          cantidad: fila.cantidad,
          valorUnitario: fila.valorUnitario,
          tipoProyecto,
          valorId,
          tablaId,
          filaIndice: fila.filaIndice,
        })),
      );
      onImportado(filasMapeadas.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron importar los valores.");
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-label="Importar valores de una tabla analizada" className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Importar valores de una tabla analizada</h2>
            <p className="mt-0.5 text-[11px] text-gray-400">
              Toma los materiales o instrumentos de un archivo de referencia y los suma al presupuesto del proyecto.
            </p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="importar-referencia" className="text-xs font-semibold text-slate-700">
                Archivo de referencia
              </label>
              <select
                id="importar-referencia"
                value={valorId}
                disabled={cargandoReferencias}
                onChange={(e) => void elegirReferencia(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#EA580C] focus:outline-none focus:ring-4 focus:ring-orange-500/10 disabled:opacity-60"
              >
                <option value="">{cargandoReferencias ? "Cargando archivos…" : "Selecciona un archivo"}</option>
                {referencias.map((referencia) => (
                  <option key={referencia.id} value={referencia.id}>
                    {referencia.nombre} · {referencia.totalTablas} tabla(s)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="importar-tabla" className="text-xs font-semibold text-slate-700">
                Tabla analizada
              </label>
              <select
                id="importar-tabla"
                value={tablaId}
                disabled={!valorId || cargandoTablas}
                onChange={(e) => void elegirTabla(valorId, e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#EA580C] focus:outline-none focus:ring-4 focus:ring-orange-500/10 disabled:opacity-60"
              >
                <option value="">
                  {!valorId
                    ? "Primero elige un archivo"
                    : cargandoTablas
                      ? "Cargando tablas…"
                      : tablas.length === 0
                        ? "Sin tablas analizadas"
                        : "Selecciona una tabla"}
                </option>
                {tablas.map((opcion) => (
                  <option key={opcion.id} value={opcion.id}>
                    {opcion.hoja} · {opcion.totalFilas} fila(s)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {cargandoFilas && <p className="py-4 text-center text-sm text-gray-400">Cargando tabla…</p>}

          {tabla && !cargandoFilas && (
            <>
              <div className="rounded-xl border border-gray-100 p-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Mapeo de columnas</h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {[
                    { id: "importar-col-nombre", label: "Nombre (obligatorio)", valor: colNombre, set: setColNombre },
                    { id: "importar-col-unidad", label: "Unidad", valor: colUnidad, set: setColUnidad },
                    { id: "importar-col-cantidad", label: "Cantidad", valor: colCantidad, set: setColCantidad },
                    { id: "importar-col-valor", label: "Valor unitario", valor: colValor, set: setColValor },
                  ].map((campo) => (
                    <div key={campo.id}>
                      <label htmlFor={campo.id} className="text-[11px] font-semibold text-slate-600">
                        {campo.label}
                      </label>
                      <select
                        id={campo.id}
                        value={campo.valor}
                        onChange={(e) => campo.set(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:border-[#EA580C] focus:outline-none"
                      >
                        <option value="">— Sin columna —</option>
                        {tabla.columnas.map((columna) => (
                          <option key={columna.letra} value={columna.letra}>
                            {columna.letra}: {columna.etiqueta}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-gray-400">
                  Las cifras se interpretan con separadores de miles y decimales (por ejemplo, 1.234,56 o 1,234.56).
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="importar-categoria" className="text-xs font-semibold text-slate-700">Categoría</label>
                  <select
                    id="importar-categoria"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value as CategoriaValorProyecto)}
                    className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#EA580C] focus:outline-none"
                  >
                    {CATEGORIAS.map((opcion) => (
                      <option key={opcion} value={opcion}>{opcion}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="importar-tipo" className="text-xs font-semibold text-slate-700">Tipo de proyecto</label>
                  <select
                    id="importar-tipo"
                    value={tipoProyecto}
                    onChange={(e) => setTipoProyecto(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#EA580C] focus:outline-none"
                  >
                    <option value="">Aplica a todos los tipos</option>
                    {linea && <option value={linea}>Solo {linea}</option>}
                  </select>
                </div>
                <div>
                  <label htmlFor="importar-busqueda" className="text-xs font-semibold text-slate-700">Filtrar filas</label>
                  <input
                    id="importar-busqueda"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    maxLength={120}
                    placeholder="Buscar por nombre o unidad"
                    className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#EA580C] focus:ring-4 focus:ring-orange-500/10"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-100 bg-orange-50/60 px-3 py-2">
                <p className="text-xs font-semibold text-orange-900">
                  {filasMapeadas.length} fila(s) por importar · máximo 500
                </p>
                <p className="text-sm font-black text-orange-700">{fmt(Math.round(totalImportacion))}</p>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full min-w-[560px] text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      {["Nombre", "Unidad", "Cantidad", "Valor unitario", "Valor total"].map((titulo) => (
                        <th
                          key={titulo}
                          className={`px-3 py-2 font-bold uppercase tracking-wider text-gray-500 ${
                            ["Valor unitario", "Valor total"].includes(titulo) ? "text-right" : "text-left"
                          }`}
                        >
                          {titulo}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filasMapeadas.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                          No hay filas que coincidan con el mapeo y el filtro.
                        </td>
                      </tr>
                    )}
                    {filasMapeadas.slice(0, 50).map((fila) => (
                      <tr key={fila.filaIndice} className="hover:bg-gray-50/50">
                        <td className="px-3 py-1.5 font-semibold text-gray-800">{fila.nombre}</td>
                        <td className="px-3 py-1.5 text-gray-500">{fila.unidad || "—"}</td>
                        <td className="px-3 py-1.5 text-gray-600">{fmtCantidad(fila.cantidad)}</td>
                        <td className="px-3 py-1.5 text-right text-gray-600">{fmt(fila.valorUnitario)}</td>
                        <td className="px-3 py-1.5 text-right font-semibold text-orange-700">
                          {fmt(Math.round(fila.cantidad * fila.valorUnitario))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filasMapeadas.length > 50 && (
                <p className="text-[10px] text-gray-400">
                  Se muestran las primeras 50 filas; la importación incluye las {filasMapeadas.length} filas filtradas.
                </p>
              )}
            </>
          )}

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
          <button
            type="button"
            onClick={() => void importar()}
            disabled={importando || !tabla || filasMapeadas.length === 0}
            className="rounded-lg bg-[#C2410C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importando ? "Importando…" : `Importar ${filasMapeadas.length || ""}`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
}
