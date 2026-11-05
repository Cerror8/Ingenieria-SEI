import bcrypt from "bcryptjs";
import { pool } from "../db.js";

export async function asegurarAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn("[auth] ADMIN_EMAIL/ADMIN_PASSWORD no configurados; no se creó el administrador.");
    return;
  }

  const { rowCount } = await pool.query(
    "SELECT 1 FROM usuarios WHERE lower(email) = lower($1)",
    [email],
  );

  if (rowCount) {
    console.log(`[auth] Usuario administrador ya existe: ${email}`);
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO usuarios (email, nombre, proveedor, password_hash, rol)
     VALUES ($1, 'Administrador', 'local', $2, 'admin')`,
    [email, hash],
  );
  console.log(`[auth] Administrador creado: ${email}`);
}
