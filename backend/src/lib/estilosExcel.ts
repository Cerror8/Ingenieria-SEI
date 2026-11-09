import fs from "node:fs";
import JSZip from "jszip";
import ExcelJS from "exceljs";

export type EstiloCelda = {
  bold?: boolean;
  italic?: boolean;
  sz?: number;
  color?: string;
  fondo?: string;
  alinear?: string;
  valign?: string;
  envolver?: boolean;
  bordes?: { top?: string; right?: string; bottom?: string; left?: string };
};

export type EstilosLibro = Record<string, Record<string, EstiloCelda>>;

type ColorExcel = {
  argb?: string;
  rgb?: string;
  theme?: number;
  indexed?: number;
  tint?: number;
};

const INDEXADOS: Record<number, string> = {
  0: "000000", 1: "FFFFFF", 2: "FF0000", 3: "00FF00", 4: "0000FF", 5: "FFFF00",
  6: "FF00FF", 7: "00FFFF", 8: "000000", 9: "FFFFFF", 10: "FF0000", 11: "00FF00",
  12: "0000FF", 13: "FFFF00", 14: "FF00FF", 15: "00FFFF", 16: "800000", 17: "008000",
  18: "000080", 19: "808000", 20: "800080", 21: "008080", 22: "C0C0C0", 23: "808080",
};

function paletaDeTema(xml: string): string[] | null {
  const esquema = xml.match(/<a:clrScheme[^>]*>([\s\S]*?)<\/a:clrScheme>/)?.[1];
  if (!esquema) return null;
  const tomar = (etiqueta: string): string | undefined => {
    const bloque = esquema.match(new RegExp(`<a:${etiqueta}>([\\s\\S]*?)</a:${etiqueta}>`))?.[1];
    if (!bloque) return undefined;
    return bloque.match(/val="([0-9A-Fa-f]{6})"/)?.[1] ?? bloque.match(/lastClr="([0-9A-Fa-f]{6})"/)?.[1];
  };
  const lt1 = tomar("lt1") ?? "FFFFFF";
  const dk1 = tomar("dk1") ?? "000000";
  const lt2 = tomar("lt2") ?? "E7E6E6";
  const dk2 = tomar("dk2") ?? "44546A";
  const acentos = [1, 2, 3, 4, 5, 6].map((i) => tomar(`accent${i}`) ?? "4472C4");
  return [lt1, dk1, lt2, dk2, ...acentos];
}

function cssColor(c: ColorExcel | undefined, paleta: string[] | null): string | undefined {
  if (!c) return undefined;
  let base: string | undefined;
  if (c.argb && /^[0-9A-Fa-f]{8}$/.test(c.argb)) base = c.argb.slice(2);
  else if (c.rgb && /^[0-9A-Fa-f]{6}$/.test(c.rgb)) base = c.rgb;
  else if (c.theme !== undefined) base = paleta?.[[0, 1, 2, 3, 4, 5, 6, 7, 8, 9][c.theme] ?? 0];
  else if (c.indexed !== undefined && c.indexed !== 64) base = INDEXADOS[c.indexed];
  if (!base) return undefined;
  const n = parseInt(base, 16);
  const tinte = c.tint ?? 0;
  const canal = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v + (tinte < 0 ? v * tinte : (255 - v) * tinte))));
  const r = canal((n >> 16) & 255);
  const g = canal((n >> 8) & 255);
  const b = canal(n & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function estiloDeCelda(celda: ExcelJS.Cell, paleta: string[] | null): EstiloCelda | undefined {
  const estilo: EstiloCelda = {};
  if (celda.font?.bold) estilo.bold = true;
  if (celda.font?.italic) estilo.italic = true;
  if (celda.font?.size) estilo.sz = Math.min(Math.max(celda.font.size, 8), 26);
  const color = cssColor(celda.font?.color as ColorExcel | undefined, paleta);
  if (color) estilo.color = color;
  if (celda.fill?.type === "pattern" && celda.fill.pattern !== "none") {
    const fondo = cssColor(celda.fill.fgColor as ColorExcel | undefined, paleta);
    if (fondo) estilo.fondo = fondo;
  }
  if (celda.alignment?.horizontal) estilo.alinear = celda.alignment.horizontal;
  if (celda.alignment?.vertical) estilo.valign = celda.alignment.vertical;
  if (celda.alignment?.wrapText) estilo.envolver = true;

  const bordeCss = (lado?: Partial<ExcelJS.Border>): string | undefined => {
    const estilo = lado?.style;
    if (!estilo) return undefined;
    const colorBorde = cssColor(lado.color as ColorExcel | undefined, paleta) ?? "#64748b";
    if (lado.style === "double") return `3px double ${colorBorde}`;
    if (lado.style === "thick") return `3px solid ${colorBorde}`;
    if (lado.style === "medium") return `2px solid ${colorBorde}`;
    if (lado.style === "dashed" || lado.style === "dotted" || lado.style === "hair") return `1px dashed ${colorBorde}`;
    return `1px solid ${colorBorde}`;
  };
  const bordes = {
    top: bordeCss(celda.border?.top),
    right: bordeCss(celda.border?.right),
    bottom: bordeCss(celda.border?.bottom),
    left: bordeCss(celda.border?.left),
  };
  if (bordes.top || bordes.right || bordes.bottom || bordes.left) estilo.bordes = bordes;

  return Object.keys(estilo).length ? estilo : undefined;
}

export async function extraerEstilos(buffer: Buffer): Promise<EstilosLibro> {
  const resultado: EstilosLibro = {};

  let paleta: string[] | null = null;
  try {
    const zip = await JSZip.loadAsync(buffer);
    const rutaTema = Object.keys(zip.files).find((f) => /theme\d*\.xml$/.test(f));
    if (rutaTema) {
      const xml = await zip.files[rutaTema].async("string");
      paleta = paletaDeTema(xml);
    }
  } catch {
    paleta = null;
  }

  const wb = new ExcelJS.Workbook();
  // ExcelJS declara load() con el Buffer de su @types/node; el cast evita el
  // choque de tipos entre versiones de Node en el editor.
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  wb.eachSheet((ws) => {
    const mapa: Record<string, EstiloCelda> = {};
    ws.eachRow((fila) => {
      fila.eachCell({ includeEmpty: true }, (celda) => {
        const estilo = estiloDeCelda(celda, paleta);
        if (estilo) mapa[celda.address] = estilo;
      });
    });
    resultado[ws.name] = mapa;
  });

  return resultado;
}

const cache = new Map<string, { mtimeMs: number; libro: EstilosLibro }>();
const MAX_CACHE = 3;

export async function estilosDeHoja(
  ruta: string,
  hoja: string,
  maxFila: number,
): Promise<Record<string, EstiloCelda>> {
  const info = await fs.promises.stat(ruta);
  let entrada = cache.get(ruta);
  if (!entrada || entrada.mtimeMs !== info.mtimeMs) {
    const libro = await extraerEstilos(await fs.promises.readFile(ruta));
    entrada = { mtimeMs: info.mtimeMs, libro };
    cache.set(ruta, entrada);
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value as string);
  }

  const filtrado: Record<string, EstiloCelda> = {};
  for (const [ref, estilo] of Object.entries(entrada.libro[hoja] ?? {})) {
    const fila = Number(ref.match(/^\D+(\d+)$/)?.[1]);
    if (Number.isFinite(fila) && fila <= maxFila) filtrado[ref] = estilo;
  }
  return filtrado;
}
