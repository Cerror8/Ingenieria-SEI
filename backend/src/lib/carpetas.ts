import fs from "node:fs";
import path from "node:path";

// En Vercel el disco es de solo lectura salvo /tmp; en local se usa backend/uploads.
export const CARPETA_RAIZ = path.resolve(
  process.env.UPLOAD_DIR ?? (process.env.VERCEL ? "/tmp/uploads" : "uploads"),
);

export function carpetaSubidas(...partes: string[]) {
  const ruta = path.resolve(CARPETA_RAIZ, ...partes);
  try {
    fs.mkdirSync(ruta, { recursive: true });
  } catch (error) {
    console.warn(`[subidas] No se pudo crear ${ruta}:`, (error as Error).message);
  }
  return ruta;
}
