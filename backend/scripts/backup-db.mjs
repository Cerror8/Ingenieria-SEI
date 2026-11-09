import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const backendDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: path.join(backendDir, ".env") });

const marca = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const carpeta = path.resolve(backendDir, "..", "backups");
mkdirSync(carpeta, { recursive: true });

const modo = (process.env.SEI_BACKUP_MODO ?? "").toLowerCase();

function dockerDisponible() {
  const contenedor = process.env.SEI_DB_CONTAINER ?? "sei_rap_db";
  const salida = spawnSync("docker", ["inspect", "-f", "{{.State.Running}}", contenedor], {
    encoding: "utf8",
  });
  return salida.status === 0 && salida.stdout.trim() === "true";
}

function respaldoDocker() {
  const contenedor = process.env.SEI_DB_CONTAINER ?? "sei_rap_db";
  const usuario = process.env.SEI_DB_USER ?? "sei";
  const base = process.env.SEI_DB_NAME ?? "sei_rap";
  const archivo = path.join(carpeta, `sei_rap_${marca}.sql`);

  const resultado = spawnSync(
    "docker",
    ["exec", contenedor, "pg_dump", "-U", usuario, "-d", base, "--no-owner"],
    { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 },
  );

  if (resultado.error || resultado.status !== 0) {
    console.error("No se pudo generar el respaldo con pg_dump.");
    console.error(resultado.error?.message ?? resultado.stderr?.toString() ?? "Error desconocido");
    process.exit(1);
  }

  writeFileSync(archivo, resultado.stdout);
  console.log(`Respaldo completo (esquema y datos) creado: ${archivo}`);
}

function ordenarPorDependencias(tablas, dependencias) {
  const pendientes = new Set(tablas);
  const orden = [];

  while (pendientes.size) {
    const disponibles = [...pendientes].filter((tabla) =>
      (dependencias.get(tabla) ?? []).every(
        (referencia) => !pendientes.has(referencia) || referencia === tabla,
      ),
    );

    // Si hay un ciclo, se agregan las restantes en orden alfabético.
    const siguientes = disponibles.length ? disponibles : [...pendientes].sort();
    for (const tabla of siguientes) {
      orden.push(tabla);
      pendientes.delete(tabla);
    }
  }

  return orden;
}

async function respaldoLogico() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "Falta DATABASE_URL (backend/.env o variable de entorno) para respaldar una base remota.",
    );
    process.exit(1);
  }

  const ssl =
    process.env.PGSSL === "true" || /[?&]sslmode=(require|verify-ca|verify-full)/.test(url);
  const cliente = new pg.Client({
    connectionString: url,
    ...(ssl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  await cliente.connect();
  try {
    const { rows: tablas } = await cliente.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'app' ORDER BY tablename",
    );
    const { rows: claves } = await cliente.query(`
      SELECT tc.table_name AS tabla, ccu.table_name AS referencia
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_schema = tc.constraint_schema
         AND ccu.constraint_name = tc.constraint_name
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'app'
    `);
    const { rows: secuencias } = await cliente.query(`
      SELECT table_name AS tabla, column_name AS columna
        FROM information_schema.columns
       WHERE table_schema = 'app' AND column_default LIKE 'nextval(%'
    `);

    const nombres = tablas.map((fila) => fila.tablename);
    const dependencias = new Map();
    for (const clave of claves) {
      const lista = dependencias.get(clave.tabla) ?? [];
      lista.push(clave.referencia);
      dependencias.set(clave.tabla, lista);
    }
    const orden = ordenarPorDependencias(nombres, dependencias);

    const comillas = (nombre) => `"${nombre.replace(/"/g, '""')}"`;
    const lineas = [
      "-- Respaldo de datos del esquema app (Ingeniería SEI)",
      `-- Generado: ${new Date().toISOString()}`,
      "-- Restauración: aplica primero database/init/*.sql (npm run db:init) sobre una base vacía y luego ejecuta este archivo.",
      "BEGIN;",
      "",
    ];

    if (orden.length) {
      lineas.push(
        `TRUNCATE ${orden.map((tabla) => `app.${comillas(tabla)}`).join(", ")} RESTART IDENTITY CASCADE;`,
        "",
      );
    }

    let totalFilas = 0;
    for (const tabla of orden) {
      const { rows } = await cliente.query(
        `SELECT COALESCE(jsonb_agg(to_jsonb(fila)), '[]'::jsonb) AS datos FROM app.${comillas(tabla)} fila`,
      );
      const filas = rows[0]?.datos ?? [];
      if (!filas.length) continue;
      totalFilas += filas.length;
      for (const fila of filas) {
        const json = JSON.stringify(fila).replace(/'/g, "''");
        lineas.push(
          `INSERT INTO app.${comillas(tabla)} SELECT * FROM jsonb_populate_record(NULL::app.${comillas(tabla)}, '${json}'::jsonb);`,
        );
      }
      lineas.push("");
    }

    for (const { tabla, columna } of secuencias) {
      lineas.push(
        `SELECT setval(pg_get_serial_sequence('app.${comillas(tabla)}', '${columna.replace(/'/g, "''")}'), COALESCE((SELECT MAX(${comillas(columna)}) FROM app.${comillas(tabla)}), 0) + 1, false);`,
      );
    }
    lineas.push("", "COMMIT;", "");

    const archivo = path.join(carpeta, `sei_rap_${marca}_datos.sql`);
    writeFileSync(archivo, lineas.join("\n"));
    console.log(
      `Respaldo lógico creado: ${archivo} (${totalFilas} fila(s) en ${orden.length} tabla(s)).`,
    );
    console.log("El esquema no se incluye: restáuralo con npm run db:init antes de este archivo.");
  } finally {
    await cliente.end();
  }
}

const usarDocker = modo ? modo === "docker" : !process.env.SEI_BACKUP_REMOTO && dockerDisponible();

if (usarDocker) {
  respaldoDocker();
} else {
  await respaldoLogico();
}
