import * as XLSX from "xlsx-js-style";
import type { NuevaValorTabla } from "../../api/client";

const MAX_COLUMNAS = 60;
const MAX_FILAS = 1500;
const MAX_LARGO_CELDA = 400;
const FILAS_EXPLORADAS = 60;
const FILAS_ARRIBA = 6;

const NUMERICO = /^[$€]?\s*[-+(]?\d[\d.,\s()%/-]*\)?$/;
const PALABRA_CABECERA =
  /^(no\.?|n[°º]|c[oó]digo|item|ítem|descripci[oó]n|actividad|unidad|und\.?|cantidad|valor|precio|responsable|estado|fecha)$/i;

const recortar = (texto: string) =>
  texto.length > MAX_LARGO_CELDA ? `${texto.slice(0, MAX_LARGO_CELDA - 1)}…` : texto;

export function normalizarEtiqueta(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function textoCelda(hoja: XLSX.WorkSheet, fila: number, columna: number): string {
  const celda = hoja[XLSX.utils.encode_cell({ r: fila, c: columna })] as
    | { w?: string; v?: unknown }
    | undefined;
  if (!celda) return "";
  const valor = celda.w ?? celda.v;
  if (valor === null || valor === undefined) return "";
  return String(valor).replace(/\s+/g, " ").trim();
}

export function limitesHoja(hoja: XLSX.WorkSheet): { filas: number; columnas: number } {
  let maxFila = -1;
  let maxColumna = -1;
  for (const clave of Object.keys(hoja)) {
    if (clave.startsWith("!")) continue;
    const celda = hoja[clave] as { v?: unknown } | undefined;
    const valor = celda?.v;
    if (valor === null || valor === undefined || String(valor).trim() === "") continue;
    const { r, c } = XLSX.utils.decode_cell(clave);
    if (r > maxFila) maxFila = r;
    if (c > maxColumna) maxColumna = c;
  }
  return { filas: maxFila + 1, columnas: maxColumna + 1 };
}

export function detectarCabecera(hoja: XLSX.WorkSheet): number {
  const { filas, columnas } = limitesHoja(hoja);
  const tope = Math.min(filas, FILAS_EXPLORADAS);
  const ancho = Math.min(columnas, MAX_COLUMNAS);
  let mejor = -1;
  let mejorPuntaje = -1;

  for (let f = 0; f < tope; f++) {
    const celdas: string[] = [];
    for (let c = 0; c < ancho; c++) {
      const texto = textoCelda(hoja, f, c);
      if (texto) celdas.push(texto);
    }
    if (celdas.length < 2) continue;
    const numericas = celdas.filter((texto) => NUMERICO.test(texto)).length;
    if (numericas / celdas.length >= 0.5) continue;

    const puntaje = celdas.length + (celdas.some((texto) => PALABRA_CABECERA.test(texto)) ? 4 : 0);
    if (puntaje > mejorPuntaje) {
      mejor = f;
      mejorPuntaje = puntaje;
    }
  }

  if (mejor >= 0) return mejor + 1;

  for (let f = 0; f < tope; f++) {
    for (let c = 0; c < ancho; c++) {
      if (textoCelda(hoja, f, c)) return f + 1;
    }
  }
  return 1;
}

function etiquetasDeFila(hoja: XLSX.WorkSheet, fila: number, columnas: number): string[] {
  const etiquetas = Array.from({ length: columnas }, (_, c) => textoCelda(hoja, fila, c));

  for (const merge of hoja["!merges"] ?? []) {
    if (merge.s.r !== fila) continue;
    const ancla = etiquetas[merge.s.c];
    if (!ancla) continue;
    for (let c = merge.s.c + 1; c <= Math.min(merge.e.c, columnas - 1); c++) {
      if (!etiquetas[c]) etiquetas[c] = ancla;
    }
  }

  for (let c = 0; c < columnas; c++) {
    if (etiquetas[c]) continue;
    for (let f = fila - 1; f >= Math.max(0, fila - FILAS_ARRIBA); f--) {
      const texto = textoCelda(hoja, f, c);
      if (texto) {
        etiquetas[c] = texto;
        break;
      }
    }
  }

  return etiquetas;
}

function deduplicar(etiquetas: string[]): string[] {
  const vistos = new Map<string, number>();
  return etiquetas.map((etiqueta) => {
    const clave = normalizarEtiqueta(etiqueta);
    const veces = (vistos.get(clave) ?? 0) + 1;
    vistos.set(clave, veces);
    return veces === 1 ? etiqueta : `${etiqueta} (${veces})`;
  });
}

export function extraerTabla(
  hoja: XLSX.WorkSheet,
  nombreHoja: string,
  filaCabecera: number,
  maxFilas = MAX_FILAS,
): NuevaValorTabla & { totalFilas: number } {
  const limites = limitesHoja(hoja);
  const indiceCabecera = Math.max(0, Math.min(filaCabecera - 1, Math.max(0, limites.filas - 1)));
  const ancho = Math.max(1, Math.min(limites.columnas, MAX_COLUMNAS));
  const etiquetasBrutas = etiquetasDeFila(hoja, indiceCabecera, ancho);

  let ultimaColumna = -1;
  for (let c = 0; c < ancho; c++) {
    if (etiquetasBrutas[c]) ultimaColumna = c;
  }
  const totalColumnas = Math.max(ultimaColumna + 1, 1);

  const etiquetas = deduplicar(
    etiquetasBrutas
      .slice(0, totalColumnas)
      .map((etiqueta, c) => etiqueta || `Columna ${XLSX.utils.encode_col(c)}`),
  );

  const filas: string[][] = [];
  let truncada = false;
  for (let f = indiceCabecera + 1; f < limites.filas; f++) {
    const fila = etiquetas.map((_, c) => recortar(textoCelda(hoja, f, c)));
    if (!fila.some((valor) => valor)) continue;
    if (filas.length >= maxFilas) {
      truncada = true;
      break;
    }
    filas.push(fila);
  }

  return {
    hoja: nombreHoja,
    filaCabecera: indiceCabecera + 1,
    columnas: etiquetas.map((etiqueta, c) => ({ letra: XLSX.utils.encode_col(c), etiqueta })),
    filas,
    truncada,
    totalFilas: filas.length,
  };
}
