import { gzipSync } from "node:zlib";
import { del, list, put } from "@vercel/blob";
import { pool } from "../db.js";
import { almacenEnBlob } from "./almacen.js";

const CARPETA = "respaldos/";
const RETENCION = 14;

export type ContenidoRespaldo = {
  generadoEn: string;
  esquema: "app";
  tablas: Record<string, unknown[]>;
};

function comillas(nombre: string): string {
  return `"${nombre.replaceAll('"', '""')}"`;
}

export async function generarRespaldo(): Promise<{
  contenido: Buffer;
  tablas: number;
  filas: number;
}> {
  const { rows: nombres } = await pool.query<{ nombre: string }>(
    `SELECT table_name AS nombre
       FROM information_schema.tables
      WHERE table_schema = 'app'
        AND table_type = 'BASE TABLE'
        AND table_name <> 'sesiones'
      ORDER BY table_name`,
  );

  const datos: ContenidoRespaldo = {
    generadoEn: new Date().toISOString(),
    esquema: "app",
    tablas: {},
  };

  let filas = 0;
  for (const { nombre } of nombres) {
    const { rows } = await pool.query(`SELECT * FROM app.${comillas(nombre)}`);
    datos.tablas[nombre] = rows;
    filas += rows.length;
  }

  return {
    contenido: gzipSync(Buffer.from(JSON.stringify(datos))),
    tablas: nombres.length,
    filas,
  };
}

export function almacenDeRespaldos(): boolean {
  return almacenEnBlob;
}

export async function crearRespaldo(): Promise<{
  nombre: string;
  bytes: number;
  tablas: number;
  filas: number;
  eliminados: number;
}> {
  if (!almacenEnBlob) {
    throw new Error("Vercel Blob no está configurado");
  }

  const { contenido, tablas, filas } = await generarRespaldo();
  const marca = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  const nombre = `${CARPETA}sei-${marca}.json.gz`;

  await put(nombre, contenido, {
    access: "private",
    contentType: "application/gzip",
    addRandomSuffix: false,
  });

  const eliminados = await limpiarAntiguos();
  return { nombre, bytes: contenido.byteLength, tablas, filas, eliminados };
}

async function limpiarAntiguos(): Promise<number> {
  const { blobs } = await list({ prefix: CARPETA, limit: 1000 });
  const ordenados = [...blobs].sort(
    (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime(),
  );
  const sobran = ordenados.slice(RETENCION);
  if (!sobran.length) return 0;

  await del(sobran.map((blob) => blob.url));
  return sobran.length;
}
