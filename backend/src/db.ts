import "dotenv/config";
import pg from "pg";

// BIGINT/COUNT llegan como texto por defecto; los pasamos a número.
pg.types.setTypeParser(20, (v) => parseInt(v, 10));

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.on("connect", (c) => {
  void c.query("SET search_path = app, public");
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
