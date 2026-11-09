import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx-js-style";
import { Check, FileSpreadsheet, Table2, Trash2, X } from "lucide-react";
import {
  api,
  fechaCorta,
  type ValorReferenciaApi,
  type ValorTablaApi,
} from "../../api/client";
import { detectarCabecera, extraerTabla, limitesHoja } from "./tablasExcel";

const EXTENSIONES = [".xls", ".xlsx", ".csv"];

const extensionDe = (nombre: string) => {
  const punto = nombre.lastIndexOf(".");
  return punto === -1 ? "" : nombre.slice(punto).toLowerCase();
};

type Carga =
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; libro: XLSX.WorkBook };

function resumenFila(hoja: XLSX.WorkSheet, fila: number, maxColumnas: number) {
  const partes: string[] = [];
  for (let c = 0; c < maxColumnas && partes.length < 3; c++) {
    const celda = hoja[XLSX.utils.encode_cell({ r: fila, c })] as { w?: string; v?: unknown } | undefined;
    const texto = String(celda?.w ?? celda?.v ?? "").replace(/\s+/g, " ").trim();
    if (texto) partes.push(texto.slice(0, 28));
  }
  return partes.join(" · ");
}

export function AnalizarValorModal({
  valor,
  onCerrar,
  onCambio,
}: {
  valor: ValorReferenciaApi;
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const [carga, setCarga] = useState<Carga>({ tipo: "cargando" });
  const [tablas, setTablas] = useState<ValorTablaApi[] | null>(null);
  const [hojaActiva, setHojaActiva] = useState("");
  const [filaCabecera, setFilaCabecera] = useState(1);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargarTablas = useCallback(async () => {
    try {
      const { tablas: lista } = await api.valorTablas(valor.id);
      setTablas(lista);
    } catch {
      setTablas([]);
    }
  }, [valor.id]);

  useEffect(() => {
    void cargarTablas();
  }, [cargarTablas]);

  useEffect(() => {
    const soportado = EXTENSIONES.includes(extensionDe(valor.archivoNombre));
    if (!soportado) {
      setCarga({ tipo: "error", mensaje: "La tabla solo se puede extraer de archivos Excel (.xls, .xlsx) o CSV." });
      return;
    }

    let cancelado = false;
    const leer = async () => {
      try {
        const respuesta = await fetch(api.valorArchivoUrl(valor.id), { credentials: "include" });
        if (!respuesta.ok) {
          setCarga({ tipo: "error", mensaje: "No se pudo descargar el archivo de referencia." });
          return;
        }
        const buffer = await respuesta.arrayBuffer();
        if (cancelado) return;
        await new Promise((resolver) => window.setTimeout(resolver, 30));
        const libro = XLSX.read(buffer, { type: "array", cellStyles: false, cellDates: false });
        if (cancelado) return;
        setCarga({ tipo: "listo", libro });
        setHojaActiva(libro.SheetNames[0] ?? "");
      } catch {
        if (!cancelado) setCarga({ tipo: "error", mensaje: "No se pudo leer el archivo." });
      }
    };

    void leer();
    return () => {
      cancelado = true;
    };
  }, [valor]);

  const hoja = carga.tipo === "listo" && hojaActiva ? carga.libro.Sheets[hojaActiva] : null;

  useEffect(() => {
    if (!hoja) return;
    setFilaCabecera(detectarCabecera(hoja));
    setAviso(null);
  }, [hoja]);

  const filasCandidatas = useMemo(() => {
    if (!hoja) return [] as { numero: number; resumen: string }[];
    const limites = limitesHoja(hoja);
    const tope = Math.min(limites.filas, 60);
    const ancho = Math.min(limites.columnas, 10);
    return Array.from({ length: tope }, (_, f) => ({
      numero: f + 1,
      resumen: resumenFila(hoja, f, ancho) || "(fila vacía)",
    }));
  }, [hoja]);

  const previa = useMemo(
    () => (hoja && hojaActiva ? extraerTabla(hoja, hojaActiva, filaCabecera) : null),
    [hoja, hojaActiva, filaCabecera],
  );

  const guardar = async () => {
    if (!hoja || !hojaActiva) return;
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const datos = extraerTabla(hoja, hojaActiva, filaCabecera);
      if (datos.filas.length === 0) {
        setError("La hoja no tiene filas de datos debajo de la cabecera seleccionada.");
        return;
      }
      const { tabla } = await api.guardarValorTabla(valor.id, datos);
      setAviso(`Tabla “${tabla.hoja}” guardada con ${tabla.totalFilas} fila(s).`);
      await cargarTablas();
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la tabla.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarTabla = async (tabla: ValorTablaApi) => {
    if (!window.confirm(`¿Eliminar la tabla analizada de la hoja “${tabla.hoja}”?`)) return;
    try {
      await api.eliminarValorTabla(valor.id, tabla.id);
      setAviso(`Tabla “${tabla.hoja}” eliminada.`);
      await cargarTablas();
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar la tabla.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <Table2 className="h-4 w-4 text-[#C2410C]" />
              Analizar tablas de “{valor.nombre}”
            </h3>
            <p className="mt-0.5 truncate text-xs text-gray-400">{valor.archivoNombre}</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {tablas && tablas.length > 0 && (
            <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
              <p className="text-xs font-bold text-emerald-800">Tablas ya analizadas</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {tablas.map((tabla) => (
                  <li
                    key={tabla.id}
                    className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-xs font-semibold text-gray-700">
                      {tabla.hoja} · {tabla.totalFilas} fila(s) · {tabla.columnas.length} col.
                    </span>
                    <span className="text-[11px] text-gray-400">{fechaCorta(tabla.actualizadoEn)}</span>
                    <button
                      type="button"
                      onClick={() => void eliminarTabla(tabla)}
                      aria-label={`Eliminar tabla ${tabla.hoja}`}
                      className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {carga.tipo === "cargando" && (
            <p className="flex h-48 items-center justify-center text-sm text-gray-400">
              Leyendo el archivo…
            </p>
          )}

          {carga.tipo === "error" && (
            <p className="flex h-48 items-center justify-center px-6 text-center text-sm font-medium text-red-600">
              {carga.mensaje}
            </p>
          )}

          {carga.tipo === "listo" && carga.libro.SheetNames.length === 0 && (
            <p className="flex h-48 items-center justify-center text-sm text-gray-400">
              El archivo no tiene hojas para analizar.
            </p>
          )}

          {carga.tipo === "listo" && carga.libro.SheetNames.length > 0 && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-600">Hoja</label>
                  <select
                    value={hojaActiva}
                    onChange={(e) => setHojaActiva(e.target.value)}
                    className={INPUT}
                  >
                    {carga.libro.SheetNames.map((nombre) => (
                      <option key={nombre} value={nombre}>
                        {nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-600">
                    Fila de cabecera
                  </label>
                  <select
                    value={filaCabecera}
                    onChange={(e) => setFilaCabecera(Number(e.target.value))}
                    className={INPUT}
                  >
                    {filasCandidatas.map((fila) => (
                      <option key={fila.numero} value={fila.numero}>
                        Fila {fila.numero} — {fila.resumen}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {previa && (
                <div>
                  <p className="mb-1 text-xs font-bold text-gray-600">
                    Vista previa · {previa.columnas.length} columna(s)
                  </p>
                  <div className="max-h-64 overflow-auto rounded-lg border border-gray-200">
                    <table className="w-max border-collapse bg-white text-xs">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr>
                          {previa.columnas.slice(0, 8).map((columna) => (
                            <th
                              key={columna.letra}
                              className="border-b border-gray-200 px-2 py-1.5 text-left font-bold text-gray-700"
                            >
                              {columna.etiqueta}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previa.filas.slice(0, 5).map((fila, indice) => (
                          <tr key={indice} className="even:bg-gray-50/60">
                            {fila.slice(0, 8).map((valorCelda, c) => (
                              <td
                                key={c}
                                className="max-w-[220px] truncate border-b border-gray-100 px-2 py-1 text-gray-600"
                                title={valorCelda}
                              >
                                {valorCelda || "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previa.columnas.length > 8 && (
                    <p className="mt-1 text-[11px] text-gray-400">
                      Se muestran las primeras 8 columnas de {previa.columnas.length}.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-gray-500">
                  {previa
                    ? `${previa.totalFilas} fila(s) leída(s) debajo de la cabecera.`
                    : "Selecciona una hoja."}
                  {previa?.truncada ? " Se guardarán las primeras 1500 filas." : ""}
                </p>
                <button
                  type="button"
                  onClick={() => void guardar()}
                  disabled={guardando || !hoja}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#C2410C] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#9A3412] disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {guardando ? "Guardando…" : "Guardar tabla"}
                </button>
              </div>

              {aviso && <p className="text-xs font-semibold text-green-700">{aviso}</p>}
              {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const INPUT =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-[#C2410C] focus:ring-2 focus:ring-[#C2410C]/20";
