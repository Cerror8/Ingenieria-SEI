import { pool } from "../db.js";

let preparacion: Promise<void> | null = null;

// Columnas agregadas después de la creación inicial; idempotente para bases ya existentes.
export function asegurarEsquema(): Promise<void> {
  if (!preparacion) {
    preparacion = (async () => {
      await pool.query("ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS estructura TEXT");
      await pool.query("ALTER TABLE documentos ADD COLUMN IF NOT EXISTS carpeta TEXT");
      await pool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono TEXT");
      await pool.query(
        "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT false",
      );
      await pool.query(`
        CREATE TABLE IF NOT EXISTS edt_actividades (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          proyecto_id TEXT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
          etapa SMALLINT NOT NULL CHECK (etapa BETWEEN 1 AND 3),
          padre_id UUID REFERENCES edt_actividades(id) ON DELETE CASCADE,
          actividad TEXT NOT NULL DEFAULT '',
          responsable TEXT,
          fecha_cumplimiento DATE,
          estado TEXT NOT NULL DEFAULT 'No realizado'
            CHECK (estado IN ('Completado', 'En ejecución', 'No realizado')),
          orden INTEGER NOT NULL DEFAULT 0,
          creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
          actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await pool.query(
        "CREATE INDEX IF NOT EXISTS ix_edt_proyecto ON edt_actividades (proyecto_id, etapa, orden)",
      );
    })().catch((error) => {
      preparacion = null;
      throw error;
    });
  }
  return preparacion;
}
