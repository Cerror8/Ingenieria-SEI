import { pool } from "../db.js";

let preparacion: Promise<void> | null = null;

// Columnas agregadas después de la creación inicial; idempotente para bases ya existentes.
export function asegurarEsquema(): Promise<void> {
  if (!preparacion) {
    preparacion = (async () => {
      await pool.query("ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS estructura TEXT");
      await pool.query("ALTER TABLE documentos ADD COLUMN IF NOT EXISTS carpeta TEXT");
    })().catch((error) => {
      preparacion = null;
      throw error;
    });
  }
  return preparacion;
}
