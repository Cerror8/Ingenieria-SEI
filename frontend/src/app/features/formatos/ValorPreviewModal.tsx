import { useEffect, useState, type CSSProperties } from "react";
import * as XLSX from "xlsx-js-style";
import { Download, X } from "lucide-react";
import { api, type EstiloCeldaApi, type ValorReferenciaApi } from "../../api/client";

const MAX_FILAS = 300;
const ANCHO_MIN = 42;
const ANCHO_MAX = 340;
const ANCHO_DEFECTO = 72;

const extensionDe = (nombre: string) => {
  const punto = nombre.lastIndexOf(".");
  return punto === -1 ? "" : nombre.slice(punto).toLowerCase();
};

type Vista =
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "pdf" | "imagen"; url: string }
  | { tipo: "libro"; libro: XLSX.WorkBook }
  | { tipo: "no-soportado" };

type Celda = { texto: string; colSpan: number; rowSpan: number; oculta: boolean; estilo?: EstiloCeldaApi };

function construirGrilla(
  hoja: XLSX.WorkSheet,
  estilos: Record<string, EstiloCeldaApi> | undefined,
): { celdas: Celda[][]; anchos: number[] } {
  const filas = XLSX.utils.sheet_to_json<string[]>(hoja, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  }).slice(0, MAX_FILAS) as string[][];
  const nFilas = filas.length;
  const nCols = Math.max(1, ...filas.map((f) => f.length));

  const anchos: number[] = Array.from({ length: nCols }, (_, c) => {
    const col = hoja["!cols"]?.[c];
    const px = col?.wpx ?? (col?.wch ? Math.round(col.wch * 7) + 6 : undefined);
    return Math.min(Math.max(px ?? ANCHO_DEFECTO, ANCHO_MIN), ANCHO_MAX);
  });

  const celdas: Celda[][] = filas.map((fila) =>
    Array.from({ length: nCols }, (_, c) => ({
      texto: String(fila[c] ?? ""),
      colSpan: 1,
      rowSpan: 1,
      oculta: false,
    })),
  );

  for (const merge of hoja["!merges"] ?? []) {
    if (merge.s.r >= MAX_FILAS) continue;
    const ancla = celdas[merge.s.r]?.[merge.s.c];
    if (!ancla) continue;
    const filaFin = Math.min(merge.e.r, MAX_FILAS - 1);
    ancla.colSpan = merge.e.c - merge.s.c + 1;
    ancla.rowSpan = filaFin - merge.s.r + 1;
    for (let r = merge.s.r; r <= filaFin; r++) {
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        if (r === merge.s.r && c === merge.s.c) continue;
        if (celdas[r]?.[c]) celdas[r][c].oculta = true;
      }
    }
  }

  if (estilos) {
    for (let r = 0; r < nFilas; r++) {
      for (let c = 0; c < nCols; c++) {
        if (celdas[r][c].oculta) continue;
        const ref = XLSX.utils.encode_cell({ r, c });
        celdas[r][c].estilo = estilos[ref];
      }
    }
  }

  return { celdas, anchos };
}

const cssDe = (estilo?: EstiloCeldaApi): CSSProperties => ({
  fontWeight: estilo?.bold ? 700 : 400,
  fontStyle: estilo?.italic ? "italic" : "normal",
  fontSize: estilo?.sz ? `${estilo.sz}px` : undefined,
  color: estilo?.color,
  backgroundColor: estilo?.fondo,
  textAlign: (estilo?.alinear as CSSProperties["textAlign"]) ?? "left",
  verticalAlign: estilo?.valign === "top" ? "top" : estilo?.valign === "bottom" ? "bottom" : "middle",
  whiteSpace: estilo?.envolver ? "normal" : "nowrap",
  borderTop: estilo?.bordes?.top,
  borderRight: estilo?.bordes?.right,
  borderBottom: estilo?.bordes?.bottom,
  borderLeft: estilo?.bordes?.left,
});

export function ValorPreviewModal({
  valor,
  onCerrar,
}: {
  valor: ValorReferenciaApi;
  onCerrar: () => void;
}) {
  const [vista, setVista] = useState<Vista>({ tipo: "cargando" });
  const [hojaActiva, setHojaActiva] = useState(0);
  const [estilosPorHoja, setEstilosPorHoja] = useState<Record<string, Record<string, EstiloCeldaApi>>>({});

  useEffect(() => {
    let blobUrl: string | null = null;
    let cancelado = false;

    const cargar = async () => {
      try {
        const respuesta = await fetch(api.valorArchivoUrl(valor.id), { credentials: "include" });
        if (!respuesta.ok) {
          setVista({ tipo: "error", mensaje: "No se pudo cargar el documento." });
          return;
        }
        const buffer = await respuesta.arrayBuffer();
        if (cancelado) return;

        const extension = extensionDe(valor.archivoNombre);

        if (extension === ".pdf") {
          blobUrl = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
          setVista({ tipo: "pdf", url: blobUrl });
          return;
        }

        if ([".png", ".jpg", ".jpeg"].includes(extension)) {
          blobUrl = URL.createObjectURL(new Blob([buffer]));
          setVista({ tipo: "imagen", url: blobUrl });
          return;
        }

        if ([".xls", ".xlsx", ".csv", ".txt"].includes(extension)) {
          setVista({ tipo: "libro", libro: XLSX.read(buffer, { type: "array" }) });
          return;
        }

        setVista({ tipo: "no-soportado" });
      } catch {
        if (!cancelado) setVista({ tipo: "error", mensaje: "No se pudo leer el documento." });
      }
    };

    void cargar();
    return () => {
      cancelado = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [valor]);

  useEffect(() => {
    setHojaActiva(0);
    setEstilosPorHoja({});
  }, [vista]);

  const nombreHoja = vista.tipo === "libro" ? vista.libro.SheetNames[hojaActiva] : null;
  const hoja = vista.tipo === "libro" && nombreHoja ? vista.libro.Sheets[nombreHoja] : null;
  const estilosHoja = nombreHoja ? estilosPorHoja[nombreHoja] : undefined;
  const grilla = useMemoGrilla(hoja, estilosHoja);

  useEffect(() => {
    if (vista.tipo !== "libro" || !nombreHoja) return;
    if (estilosPorHoja[nombreHoja]) return;
    if (extensionDe(valor.archivoNombre) !== ".xlsx") return;

    let cancelado = false;
    api
      .valorEstilos(valor.id, nombreHoja)
      .then(({ estilos }) => {
        if (!cancelado) setEstilosPorHoja((prev) => ({ ...prev, [nombreHoja]: estilos }));
      })
      .catch(() => {
        if (!cancelado) setEstilosPorHoja((prev) => ({ ...prev, [nombreHoja]: {} }));
      });
    return () => {
      cancelado = true;
    };
  }, [vista, nombreHoja, estilosPorHoja, valor]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-gray-900">{valor.nombre}</h3>
            <p className="truncate text-xs text-gray-400">{valor.archivoNombre}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <a
              href={api.valorArchivoUrl(valor.id, true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar
            </a>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar vista previa"
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-gray-100">
          {vista.tipo === "cargando" && (
            <p className="flex h-64 items-center justify-center text-sm text-gray-400">
              Cargando documento…
            </p>
          )}

          {vista.tipo === "error" && (
            <p className="flex h-64 items-center justify-center text-sm font-medium text-red-600">
              {vista.mensaje}
            </p>
          )}

          {vista.tipo === "no-soportado" && (
            <p className="flex h-64 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-gray-500">
              Este tipo de archivo no se puede previsualizar aquí.
              <a href={api.valorArchivoUrl(valor.id, true)} className="font-bold text-[#C2410C] underline">
                Descárgalo para abrirlo
              </a>
            </p>
          )}

          {vista.tipo === "pdf" && (
            <iframe title={`Vista previa de ${valor.nombre}`} src={vista.url} className="h-[75vh] w-full" />
          )}

          {vista.tipo === "imagen" && (
            <div className="flex h-[75vh] items-center justify-center p-4">
              <img src={vista.url} alt={valor.nombre} className="max-h-full max-w-full object-contain" />
            </div>
          )}

          {vista.tipo === "libro" && grilla && (
            <div className="flex h-[75vh] flex-col">
              {vista.libro.SheetNames.length > 1 && (
                <div className="flex flex-wrap gap-1 border-b border-gray-200 bg-white px-3 pt-2">
                  {vista.libro.SheetNames.map((nombre, indice) => (
                    <button
                      key={nombre}
                      type="button"
                      onClick={() => setHojaActiva(indice)}
                      className={`rounded-t-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                        indice === hojaActiva
                          ? "bg-[#C2410C] text-white"
                          : "text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {nombre}
                    </button>
                  ))}
                </div>
              )}
              {grilla.celdas.length === 0 ? (
                <p className="flex flex-1 items-center justify-center text-sm text-gray-400">
                  Esta hoja está vacía.
                </p>
              ) : (
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="w-max border-collapse bg-white">
                    <colgroup>
                      {grilla.anchos.map((ancho, i) => (
                        <col key={i} style={{ width: ancho }} />
                      ))}
                    </colgroup>
                    <tbody>
                      {grilla.celdas.map((fila, r) => (
                        <tr key={r}>
                          {fila.map((celda, c) =>
                            celda.oculta ? null : (
                              <td
                                key={c}
                                colSpan={celda.colSpan}
                                rowSpan={celda.rowSpan}
                                style={cssDe(celda.estilo)}
                                className="h-5 overflow-hidden border border-gray-300 px-1.5 py-0.5 leading-tight text-gray-800"
                              >
                                {celda.texto}
                              </td>
                            ),
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {grilla.recortada && (
                    <p className="bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                      Se muestran las primeras {MAX_FILAS} filas. Descarga el archivo para verlo completo.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function useMemoGrilla(hoja: XLSX.WorkSheet | null, estilos: Record<string, EstiloCeldaApi> | undefined) {
  const [grilla, setGrilla] = useState<{ celdas: Celda[][]; anchos: number[]; recortada: boolean } | null>(null);

  useEffect(() => {
    if (!hoja) {
      setGrilla(null);
      return;
    }
    const id = window.setTimeout(() => {
      const datos = construirGrilla(hoja, estilos);
      const ref = hoja["!ref"] ? XLSX.utils.decode_range(hoja["!ref"]) : null;
      setGrilla({ ...datos, recortada: !!ref && ref.e.r + 1 > MAX_FILAS });
    }, 30);
    return () => window.clearTimeout(id);
  }, [hoja, estilos]);

  return grilla;
}
