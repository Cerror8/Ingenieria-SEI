import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { get, list } from "@vercel/blob";
import dotenv from "dotenv";

const backendDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: path.join(backendDir, ".env") });

const marca = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const destino = path.resolve(backendDir, "..", "backups", `archivos_${marca}`);
const uploads = path.join(backendDir, "uploads");

function contarArchivos(carpeta) {
  let total = 0;
  for (const entrada of fs.readdirSync(carpeta, { withFileTypes: true })) {
    const ruta = path.join(carpeta, entrada.name);
    total += entrada.isDirectory() ? contarArchivos(ruta) : 1;
  }
  return total;
}

if (fs.existsSync(uploads)) {
  const copia = path.join(destino, "uploads");
  fs.cpSync(uploads, copia, { recursive: true });
  console.log(`Archivos locales respaldados: ${contarArchivos(copia)} → ${copia}`);
} else {
  console.log("No hay carpeta backend/uploads; no se copiaron archivos locales.");
}

const token = process.env.BLOB_READ_WRITE_TOKEN;
const blobConfigurado = Boolean(token || (process.env.VERCEL && process.env.BLOB_STORE_ID));

if (!blobConfigurado) {
  console.log("Vercel Blob no está configurado; el respaldo solo cubre archivos locales.");
  process.exit(0);
}

try {
  let cursor;
  let descargados = 0;
  do {
    const pagina = await list({ cursor, limit: 1000, ...(token ? { token } : {}) });
    for (const blob of pagina.blobs) {
      const relativo = blob.pathname
        .split("/")
        .filter(Boolean)
        .map((segmento) => segmento.replace(/[^a-zA-Z0-9._-]/g, "_"))
        .join("/");
      if (!relativo) continue;

      const resultado = await get(blob.pathname, {
        access: "private",
        ...(token ? { token } : {}),
      });
      if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
        console.warn(`No se pudo descargar el blob: ${blob.pathname}`);
        process.exitCode = 1;
        continue;
      }

      const archivo = path.join(destino, "blob", relativo);
      fs.mkdirSync(path.dirname(archivo), { recursive: true });
      fs.writeFileSync(
        archivo,
        Buffer.from(await new Response(resultado.stream).arrayBuffer()),
      );
      descargados += 1;
    }
    cursor = pagina.hasMore ? pagina.cursor : undefined;
  } while (cursor);

  console.log(`Archivos de Blob respaldados: ${descargados} → ${path.join(destino, "blob")}`);
} catch (error) {
  console.error("No se pudieron respaldar los archivos de Blob.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
