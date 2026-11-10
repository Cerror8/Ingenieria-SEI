import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import dotenv from "dotenv";
import pg from "pg";

const backendDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: path.join(backendDir, ".env") });

const archivo = process.argv[2];
if (!archivo) {
  console.error("Uso: CONFIRMAR_RESTAURACION=si npm run db:restore -- ruta/al/respaldo.json.gz");
  process.exit(1);
}

if (process.env.CONFIRMAR_RESTAURACION !== "si") {
  console.error("La restauración borra y reemplaza los datos actuales.");
  console.error("Ejecuta de nuevo con CONFIRMAR_RESTAURACION=si cuando estés seguro.");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL (backend/.env o variable de entorno).");
  process.exit(1);
}

let destino;
try {
  const parsed = new URL(url);
  destino = `${parsed.hostname}${parsed.pathname}`;
} catch {
  destino = "base configurada en DATABASE_URL";
}

const datos = JSON.parse(gunzipSync(fs.readFileSync(archivo)).toString("utf8"));
const tablas = Object.keys(datos?.tablas ?? {});
if (!tablas.length) {
  console.error("El archivo no contiene tablas para restaurar.");
  process.exit(1);
}

console.log(`Restaurando ${tablas.length} tablas en ${destino}`);
console.log(`Respaldo generado: ${datos.generadoEn ?? "fecha desconocida"}`);

const ssl =
  process.env.PGSSL === "true" || /[?&]sslmode=(require|verify-ca|verify-full)/.test(url);
const cliente = new pg.Client({
  connectionString: url,
  ...(ssl ? { ssl: { rejectUnauthorized: false } } : {}),
});

const comillas = (nombre) => `"${nombre.replaceAll('"', '""')}"`;

await cliente.connect();
try {
  const { rows: columnas } = await cliente.query(
    `SELECT table_name AS tabla, column_name AS columna
       FROM information_schema.columns
      WHERE table_schema = 'app'
        AND is_generated = 'NEVER'
        AND is_identity = 'NO'
      ORDER BY table_name, ordinal_position`,
  );

  const porTabla = new Map();
  for (const { tabla, columna } of columnas) {
    const lista = porTabla.get(tabla) ?? [];
    lista.push(columna);
    porTabla.set(tabla, lista);
  }

  const nombres = tablas.map((tabla) => `app.${comillas(tabla)}`);
  const conSesiones = nombres.concat("app.sesiones");

  await cliente.query("BEGIN");
  for (const tabla of nombres) {
    await cliente.query(`ALTER TABLE ${tabla} DISABLE TRIGGER ALL`);
  }
  await cliente.query(`TRUNCATE TABLE ${conSesiones.join(", ")} CASCADE`);

  let filas = 0;
  for (const tabla of tablas) {
    const registros = datos.tablas[tabla];
    const columnasTabla = porTabla.get(tabla) ?? [];
    if (!Array.isArray(registros) || !registros.length || !columnasTabla.length) continue;

    const lista = columnasTabla.map(comillas).join(", ");
    const seleccion = columnasTabla.map((columna) => `(r).${comillas(columna)}`).join(", ");

    await cliente.query(
      `INSERT INTO app.${comillas(tabla)} (${lista})
       SELECT ${seleccion}
         FROM json_populate_recordset(NULL::app.${comillas(tabla)}, $1::json) AS r`,
      [JSON.stringify(registros)],
    );
    filas += registros.length;
  }

  for (const tabla of nombres) {
    await cliente.query(`ALTER TABLE ${tabla} ENABLE TRIGGER ALL`);
  }
  await cliente.query("COMMIT");

  console.log(`✓ Restauración completa: ${filas} filas en ${tablas.length} tablas.`);
  console.log("Las sesiones se vaciaron: todos deberán iniciar sesión de nuevo.");
} catch (error) {
  await cliente.query("ROLLBACK").catch(() => undefined);
  console.error("La restauración falló y no se aplicó ningún cambio:", error.message);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
