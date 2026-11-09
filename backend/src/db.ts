import "dotenv/config";
import pg from "pg";

// BIGINT/COUNT llegan como texto por defecto; los pasamos a número.
pg.types.setTypeParser(20, (v) => parseInt(v, 10));
// DATE se devuelve como 'YYYY-MM-DD' en lugar de Date para no alterar la zona horaria.
pg.types.setTypeParser(1082, (v) => v);

const url = process.env.DATABASE_URL ?? "";
// Postgres gestionado (Neon, Supabase, Railway) exige TLS y suele usar certificados propios.
const usaSsl =
  process.env.PGSSL === "true" || /[?&]sslmode=(require|verify-ca|verify-full)/.test(url);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ...(usaSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  max: Number(process.env.PG_POOL_MAX ?? (process.env.VERCEL ? 3 : 10)),
});

export type Db = pg.PoolClient;

export async function withTx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const out = await fn(db);
    await db.query("COMMIT");
    return out;
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
}
