import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import type { Response } from "express";
import { del, get, head, put } from "@vercel/blob";
import { z } from "zod";
import { HttpError } from "../http.js";

// Un store de Vercel Blob conectado inyecta BLOB_READ_WRITE_TOKEN (o BLOB_STORE_ID con OIDC).
const PREFIJO = "blob:";

export const almacenEnBlob = Boolean(
  process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL && process.env.BLOB_STORE_ID),
);

export const archivoDirectoSchema = z.object({
  nombre: z.string().trim().min(1).max(255),
  ruta: z.string().trim().min(1).max(600),
  mime: z.string().trim().max(150).nullable().optional(),
});

export function esClaveBlob(clave: string | null | undefined): clave is string {
  return Boolean(clave?.startsWith(PREFIJO));
}

// Confirma que la ruta enviada por el navegador existe en el store y pertenece a la carpeta esperada.
export async function verificarSubidaDirecta(
  clave: string,
  subcarpeta: string,
): Promise<{ tamano: number; mime: string | null }> {
  if (!almacenEnBlob) throw new HttpError(400, "El almacenamiento en Blob no está configurado");
  if (!esClaveBlob(clave)) throw new HttpError(400, "La ruta del archivo no es válida");

  const pathname = clave.slice(PREFIJO.length);
  if (!pathname.startsWith(`${subcarpeta}/`)) {
    throw new HttpError(400, "La ruta del archivo no es válida");
  }

  try {
    const info = await head(pathname);
    return { tamano: info.size, mime: info.contentType ?? null };
  } catch {
    throw new HttpError(400, "El archivo no se encuentra en el almacenamiento");
  }
}

type ArchivoRecibido = { filename: string; path: string; mimetype?: string };

// Devuelve la clave que se guarda en PostgreSQL: el nombre local o "blob:<ruta>".
export async function guardarArchivo(archivo: ArchivoRecibido, subcarpeta: string): Promise<string> {
  if (!almacenEnBlob) return archivo.filename;

  const pathname = `${subcarpeta}/${archivo.filename}`;
  await put(pathname, fs.createReadStream(archivo.path), {
    access: "private",
    addRandomSuffix: false,
    ...(archivo.mimetype ? { contentType: archivo.mimetype } : {}),
  });
  await fs.promises.unlink(archivo.path).catch(() => undefined);
  return `${PREFIJO}${pathname}`;
}

// Guarda contenido ya en memoria (por ejemplo, archivos extraídos de un ZIP).
export async function guardarBuffer(
  contenido: Buffer,
  nombreOriginal: string,
  mime: string | null,
  subcarpeta: string,
  carpeta: string,
): Promise<string> {
  const extension = path.extname(nombreOriginal).toLowerCase();
  const clave = `${crypto.randomUUID()}${extension}`;

  if (!almacenEnBlob) {
    await fs.promises.mkdir(carpeta, { recursive: true });
    await fs.promises.writeFile(path.join(carpeta, clave), contenido);
    return clave;
  }

  const pathname = `${subcarpeta}/${clave}`;
  await put(pathname, contenido, {
    access: "private",
    addRandomSuffix: false,
    ...(mime ? { contentType: mime } : {}),
  });
  return `${PREFIJO}${pathname}`;
}

export async function leerArchivo(clave: string, carpeta: string): Promise<Buffer> {
  if (esClaveBlob(clave)) {
    const resultado = await get(clave.slice(PREFIJO.length), { access: "private" });
    if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
      throw new HttpError(404, "Archivo no encontrado");
    }
    return Buffer.from(await new Response(resultado.stream).arrayBuffer());
  }

  const ruta = path.resolve(carpeta, clave);
  if (!ruta.startsWith(`${carpeta}${path.sep}`)) throw new HttpError(400, "Ruta inválida");
  if (!fs.existsSync(ruta)) throw new HttpError(404, "Archivo no encontrado");
  return fs.promises.readFile(ruta);
}

export async function eliminarArchivo(clave: string | null | undefined, carpeta: string) {
  if (!clave) return;
  if (esClaveBlob(clave)) {
    await del(clave.slice(PREFIJO.length)).catch(() => undefined);
    return;
  }
  await fs.promises.unlink(path.resolve(carpeta, clave)).catch(() => undefined);
}

export async function servirArchivo(
  res: Response,
  opciones: {
    clave: string;
    carpeta: string;
    nombre: string;
    mime: string | null;
    descargar: boolean;
  },
) {
  const { clave, carpeta, nombre, mime, descargar } = opciones;

  if (esClaveBlob(clave)) {
    const resultado = await get(clave.slice(PREFIJO.length), { access: "private" });
    if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
      throw new HttpError(404, "Archivo no encontrado");
    }
    const nombreSeguro = nombre.replace(/["\r\n]/g, "_");
    res.setHeader(
      "Content-Disposition",
      `${descargar ? "attachment" : "inline"}; filename="${nombreSeguro}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
    );
    res.setHeader("Content-Type", mime ?? resultado.blob.contentType ?? "application/octet-stream");
    if (resultado.blob.size) res.setHeader("Content-Length", String(resultado.blob.size));
    Readable.fromWeb(resultado.stream as unknown as WebReadableStream<Uint8Array>).pipe(res);
    return;
  }

  const ruta = path.resolve(carpeta, clave);
  if (!ruta.startsWith(`${carpeta}${path.sep}`)) throw new HttpError(400, "Ruta inválida");
  if (!fs.existsSync(ruta)) throw new HttpError(404, "Archivo no encontrado");

  if (descargar) {
    res.download(ruta, nombre);
    return;
  }

  const nombreSeguro = nombre.replace(/["\r\n]/g, "_");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${nombreSeguro}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
  );
  res.type(mime ?? "application/octet-stream");
  res.sendFile(ruta);
}

// Descarga una copia local de un blob (para ExcelJS) y la reutiliza mientras exista.
export async function rutaLocalParaLeer(clave: string, carpeta: string): Promise<string> {
  if (!esClaveBlob(clave)) {
    const ruta = path.resolve(carpeta, clave);
    if (!ruta.startsWith(`${carpeta}${path.sep}`)) throw new HttpError(400, "Ruta inválida");
    if (!fs.existsSync(ruta)) throw new HttpError(404, "Archivo no encontrado");
    return ruta;
  }

  const pathname = clave.slice(PREFIJO.length);
  const destino = path.join(os.tmpdir(), "sei-archivos", pathname.replace(/[^a-zA-Z0-9._-]/g, "_"));
  if (fs.existsSync(destino)) return destino;

  const resultado = await get(pathname, { access: "private" });
  if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
    throw new HttpError(404, "Archivo no encontrado");
  }
  const contenido = Buffer.from(await new Response(resultado.stream).arrayBuffer());
  await fs.promises.mkdir(path.dirname(destino), { recursive: true });
  await fs.promises.writeFile(destino, contenido);
  return destino;
}
