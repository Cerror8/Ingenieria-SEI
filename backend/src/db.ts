import "dotenv/config";
import pg from "pg";
import type { Request } from "express";

// NUMERIC y COUNT llegan como texto por defecto; los pasamos a número. DATE queda como "YYYY-MM-DD".
pg.types.setTypeParser(1700, (v) => parseFloat(v));
pg.types.setTypeParser(20, (v) => parseInt(v, 10));
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
// Todas las tablas viven en el esquema "pmo"
pool.on("connect", (c) => { c.query("SET search_path = pmo, public"); });

export type Db = pg.PoolClient;

/** Usuario institucional. En producción lo entrega el SSO / gateway de la plataforma
 *  universitaria; aquí se lee de una cabecera. NO existe login propio. */
export const usuarioDe = (req: Request) =>
  (req.header("x-usuario-institucional") ?? "").trim() || "sistema";

/** Ejecuta fn en una transacción y deja el usuario disponible para el trigger de auditoría. */
export async function withTx<T>(req: Request, fn: (db: Db) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT set_config('app.usuario', $1, true)", [usuarioDe(req)]);
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
