import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const backendDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const raiz = path.dirname(backendDir);
dotenv.config({ path: path.join(backendDir, ".env") });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL (backend/.env o variable de entorno).");
  process.exit(1);
}

const ssl =
  process.env.PGSSL === "true" || /[?&]sslmode=(require|verify-ca|verify-full)/.test(url);

const archivos = ["01_schema.sql", "02_dominio.sql", "03_seed.sql"];
const cliente = new pg.Client({ connectionString: url, ...(ssl ? { ssl: { rejectUnauthorized: false } } : {}) });

await cliente.connect();
try {
  for (const archivo of archivos) {
    const sql = await readFile(path.join(raiz, "database", "init", archivo), "utf8");
    await cliente.query(sql);
    console.log(`✓ ${archivo}`);
  }
} finally {
  await cliente.end();
}

console.log("Base de datos inicializada (esquema app listo).");
