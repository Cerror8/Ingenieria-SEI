import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const contenedor = process.env.SEI_DB_CONTAINER ?? "sei_rap_db";
const usuario = process.env.SEI_DB_USER ?? "sei";
const base = process.env.SEI_DB_NAME ?? "sei_rap";

const marca = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const carpeta = resolve("backups");
mkdirSync(carpeta, { recursive: true });

const archivo = resolve(carpeta, `sei_rap_${marca}.sql`);
const resultado = spawnSync(
  "docker",
  ["exec", contenedor, "pg_dump", "-U", usuario, "-d", base, "--no-owner"],
  { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 },
);

if (resultado.error || resultado.status !== 0) {
  console.error("No se pudo generar el respaldo.");
  console.error(resultado.error?.message ?? resultado.stderr?.toString() ?? "Error desconocido");
  process.exit(1);
}

writeFileSync(archivo, resultado.stdout);
console.log(`Respaldo creado: ${archivo}`);
