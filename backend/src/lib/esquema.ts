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
      // Sin default al agregarla: así las filas existentes no quedan marcadas como "actualizadas" hoy.
      await pool.query("ALTER TABLE valores_referencia ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ");
      await pool.query(
        "UPDATE valores_referencia SET actualizado_en = creado_en WHERE actualizado_en IS NULL",
      );
      await pool.query(
        "ALTER TABLE valores_referencia ALTER COLUMN actualizado_en SET DEFAULT now(), ALTER COLUMN actualizado_en SET NOT NULL",
      );
      await pool.query(
        "ALTER TABLE formatos ADD COLUMN IF NOT EXISTS es_referencia BOOLEAN NOT NULL DEFAULT false",
      );
      await pool.query(
        `INSERT INTO formatos (id, nombre, descripcion, campos, valor_id, creado_por, es_referencia)
         VALUES (
           'formato-referencia-sac-pi031',
           'SAC-PI031 · EDT interventoría y consultoría',
           'Formato de referencia v1.0 (23/06/2022) del proceso Gestión de la calidad. Registra actividades y subproductos de las tres etapas del EDT; cada registro conserva su histórico.',
           $1::jsonb,
           (SELECT id FROM valores_referencia WHERE archivo_nombre ILIKE '%SAC-PI031%' ORDER BY creado_en LIMIT 1),
           'Sistema',
           true
         )
         ON CONFLICT (id) DO NOTHING`,
        [
          JSON.stringify([
            "Proyecto",
            "Etapa",
            "No.",
            "Actividad",
            "Responsable",
            "Fecha de cumplimiento",
            "Estado de cumplimiento",
            "Subproducto de",
            "Observaciones",
          ]),
        ],
      );
    })().catch((error) => {
      preparacion = null;
      throw error;
    });
  }
  return preparacion;
}
