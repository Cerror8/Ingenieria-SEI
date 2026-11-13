import { pool } from "../db.js";

let preparacion: Promise<void> | null = null;

// Columnas agregadas después de la creación inicial; idempotente para bases ya existentes.
export function asegurarEsquema(): Promise<void> {
  if (!preparacion) {
    preparacion = (async () => {
      await pool.query("ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS estructura TEXT");
      await pool.query("ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS nombre_corto TEXT NOT NULL DEFAULT ''");
      await pool.query("ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS numero_contrato TEXT NOT NULL DEFAULT ''");
      await pool.query("ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS organizadores TEXT NOT NULL DEFAULT ''");
      await pool.query("ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS entidad_contratante TEXT NOT NULL DEFAULT ''");
      await pool.query("ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS entidad_contratista TEXT NOT NULL DEFAULT ''");
      await pool.query("ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS fecha_asignacion DATE");
      await pool.query("ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS creado_por TEXT");
      await pool.query(
        "ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS avance_origen TEXT NOT NULL DEFAULT 'Manual'",
      );
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
             WHERE conrelid = 'proyectos'::regclass
               AND conname = 'proyectos_avance_origen_check'
          ) THEN
            ALTER TABLE proyectos ADD CONSTRAINT proyectos_avance_origen_check
              CHECK (avance_origen IN ('Manual', 'EDT', 'Gantt'));
          END IF;
        END $$;
      `);
      await pool.query(
        "ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS presupuesto_negociacion BIGINT NOT NULL DEFAULT 0",
      );
      await pool.query(
        "ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS presupuesto_ejecucion BIGINT NOT NULL DEFAULT 0",
      );
      await pool.query(
        "ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS presupuesto_alerta BIGINT NOT NULL DEFAULT 0",
      );
      await pool.query("ALTER TABLE documentos ADD COLUMN IF NOT EXISTS carpeta TEXT");
      await pool.query("ALTER TABLE documentos ADD COLUMN IF NOT EXISTS fecha_documento DATE");
      await pool.query("ALTER TABLE documentos ADD COLUMN IF NOT EXISTS numero_documento TEXT");

      // El CHECK original sólo admitía cinco estados; se reemplaza sin perder filas.
      await pool.query(`
        DO $$
        DECLARE restriccion record;
        BEGIN
          FOR restriccion IN
            SELECT conname FROM pg_constraint
             WHERE conrelid = 'proyectos'::regclass
               AND contype = 'c'
               AND pg_get_constraintdef(oid) LIKE '%estado%'
          LOOP
            EXECUTE format('ALTER TABLE proyectos DROP CONSTRAINT %I', restriccion.conname);
          END LOOP;
        END $$;
      `);
      await pool.query(`
        ALTER TABLE proyectos ADD CONSTRAINT proyectos_estado_check
          CHECK (estado IN (
            'En formulación',
            'En ejecución',
            'En ejecución, prorrogado en tiempo',
            'En ejecución, adición presupuestal',
            'En ejecución, modificado',
            'Suspendido',
            'Finalizado',
            'Cerrado'
          ))
      `);

      // Reordenó «Control de obra»: anticipo salió del presupuesto y las fases se renumeraron.
      // Sólo cambia metadatos; los archivos físicos y los blobs conservan su ruta.
      const prefijo = "'2.Control de obra/";
      await pool.query(`
        UPDATE documentos d SET carpeta = '2.Control de obra/1.Anticipo'
          FROM proyectos p
         WHERE d.proyecto_id = p.id AND p.estructura = 'construccion'
           AND (d.carpeta = ${prefijo}1.Cronograma y presupuesto/1.Ppto ejecucion/0.Anticipo'
                OR d.carpeta LIKE ${prefijo}1.Cronograma y presupuesto/1.Ppto ejecucion/0.Anticipo/%')
      `);
      for (const cambio of [
        ["1.Cronograma y presupuesto", "2.Cronograma y presupuesto"],
        ["2.Registro fotografico", "3.Registro fotografico"],
        ["3.Modificaciones al proyecto", "5.Modificaciones al proyecto"],
      ]) {
        const [viejo, nuevo] = cambio;
        await pool.query(
          `UPDATE documentos d
              SET carpeta = $1 || substr(d.carpeta, $2::int)
             FROM proyectos p
            WHERE d.proyecto_id = p.id AND p.estructura = 'construccion'
              AND (d.carpeta = $3 OR d.carpeta LIKE $3 || '/%')`,
          [`2.Control de obra/${nuevo}`, `2.Control de obra/${viejo}`.length + 1, `2.Control de obra/${viejo}`],
        );
      }

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
      await pool.query(
        "ALTER TABLE edt_actividades ADD COLUMN IF NOT EXISTS responsable_id UUID REFERENCES usuarios(id) ON DELETE SET NULL",
      );
      // Vincula responsables históricos escritos a mano con usuarios registrados del mismo nombre.
      await pool.query(`
        UPDATE edt_actividades e
           SET responsable_id = u.id
          FROM usuarios u
         WHERE e.responsable_id IS NULL
           AND e.responsable IS NOT NULL
           AND lower(btrim(e.responsable)) = lower(btrim(u.nombre))
           AND u.activo = true
      `);
      await pool.query(
        "ALTER TABLE tareas_tablero ADD COLUMN IF NOT EXISTS edt_actividad_id UUID REFERENCES edt_actividades(id) ON DELETE SET NULL",
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS ix_tareas_tablero_edt ON tareas_tablero (edt_actividad_id)",
      );

      await pool.query(`
        DO $$
        DECLARE nueva BOOLEAN;
        BEGIN
          SELECT NOT EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema()
               AND table_name = 'proyectos' AND column_name = 'tipo_contrato'
          ) INTO nueva;
          IF nueva THEN
            ALTER TABLE proyectos ADD COLUMN tipo_contrato TEXT NOT NULL DEFAULT 'Interventoría';
            -- La estructura de construcción identifica los contratos de obra existentes.
            UPDATE proyectos SET tipo_contrato = 'Obra' WHERE estructura = 'construccion';
          END IF;
        END $$;
      `);
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
             WHERE conrelid = 'proyectos'::regclass
               AND conname = 'proyectos_tipo_contrato_check'
          ) THEN
            ALTER TABLE proyectos ADD CONSTRAINT proyectos_tipo_contrato_check
              CHECK (tipo_contrato IN ('Obra', 'Interventoría'));
          END IF;
        END $$;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS edt_fases (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          proyecto_id TEXT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
          nombre TEXT NOT NULL,
          descripcion TEXT NOT NULL DEFAULT '',
          clave TEXT,
          orden INTEGER NOT NULL DEFAULT 1,
          es_principal BOOLEAN NOT NULL DEFAULT false,
          depende_de_fase_id UUID REFERENCES edt_fases(id) ON DELETE SET NULL,
          creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
          actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await pool.query(
        "CREATE INDEX IF NOT EXISTS ix_edt_fases_proyecto ON edt_fases (proyecto_id, orden)",
      );
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS ux_edt_fases_clave
          ON edt_fases (proyecto_id, clave) WHERE clave IS NOT NULL
      `);
      await pool.query("ALTER TABLE edt_actividades ADD COLUMN IF NOT EXISTS fase_id UUID REFERENCES edt_fases(id) ON DELETE CASCADE");
      await pool.query("ALTER TABLE edt_actividades ADD COLUMN IF NOT EXISTS descripcion TEXT NOT NULL DEFAULT ''");
      await pool.query("ALTER TABLE edt_actividades ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'Actividad'");
      await pool.query("ALTER TABLE edt_actividades ADD COLUMN IF NOT EXISTS plantilla_clave TEXT");
      await pool.query("ALTER TABLE edt_actividades ADD COLUMN IF NOT EXISTS prioridad TEXT NOT NULL DEFAULT 'Alta'");
      await pool.query("ALTER TABLE edt_actividades ADD COLUMN IF NOT EXISTS requiere_documento BOOLEAN NOT NULL DEFAULT false");
      await pool.query("ALTER TABLE edt_actividades ADD COLUMN IF NOT EXISTS no_aplica BOOLEAN NOT NULL DEFAULT false");
      await pool.query("ALTER TABLE edt_actividades ADD COLUMN IF NOT EXISTS carpeta TEXT");
      await pool.query("ALTER TABLE edt_actividades ALTER COLUMN etapa SET DEFAULT 1");
      await pool.query(
        "CREATE INDEX IF NOT EXISTS ix_edt_fase ON edt_actividades (fase_id, orden)",
      );
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS ux_edt_actividad_clave
          ON edt_actividades (proyecto_id, plantilla_clave) WHERE plantilla_clave IS NOT NULL
      `);
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
             WHERE conrelid = 'edt_actividades'::regclass
               AND conname = 'edt_actividades_tipo_check'
          ) THEN
            ALTER TABLE edt_actividades ADD CONSTRAINT edt_actividades_tipo_check
              CHECK (tipo IN ('Actividad', 'Documento', 'Acta'));
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
             WHERE conrelid = 'edt_actividades'::regclass
               AND conname = 'edt_actividades_prioridad_check'
          ) THEN
            ALTER TABLE edt_actividades ADD CONSTRAINT edt_actividades_prioridad_check
              CHECK (prioridad IN ('Alta', 'Media', 'Baja'));
          END IF;
        END $$;
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS edt_requisitos (
          actividad_id UUID NOT NULL REFERENCES edt_actividades(id) ON DELETE CASCADE,
          requisito_id UUID NOT NULL REFERENCES edt_actividades(id) ON DELETE CASCADE,
          PRIMARY KEY (actividad_id, requisito_id),
          CHECK (actividad_id <> requisito_id)
        )
      `);
      await pool.query(
        "ALTER TABLE documentos ADD COLUMN IF NOT EXISTS edt_actividad_id UUID REFERENCES edt_actividades(id) ON DELETE SET NULL",
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS ix_documentos_edt ON documentos (edt_actividad_id)",
      );

      await pool.query(
        "ALTER TABLE tableros ADD COLUMN IF NOT EXISTS proyecto_id TEXT REFERENCES proyectos(id) ON DELETE CASCADE",
      );
      await pool.query(
        "ALTER TABLE tableros ADD COLUMN IF NOT EXISTS fase_id UUID REFERENCES edt_fases(id) ON DELETE CASCADE",
      );
      await pool.query(
        "ALTER TABLE tableros ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'Manual'",
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS ix_tableros_proyecto ON tableros (proyecto_id, fase_id)",
      );
      await pool.query(
        "ALTER TABLE tareas_personales ADD COLUMN IF NOT EXISTS proyecto_id TEXT REFERENCES proyectos(id) ON DELETE SET NULL",
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS ix_tareas_personales_proyecto ON tareas_personales (proyecto_id)",
      );

      await pool.query(`
        CREATE TABLE IF NOT EXISTS proyecto_valores (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          proyecto_id TEXT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
          valor_id TEXT REFERENCES valores_referencia(id) ON DELETE SET NULL,
          tabla_id TEXT REFERENCES valores_tablas(id) ON DELETE SET NULL,
          fila_indice INTEGER,
          nombre TEXT NOT NULL,
          categoria TEXT NOT NULL DEFAULT 'Otro'
            CHECK (categoria IN ('Material', 'Instrumento', 'Otro')),
          unidad TEXT NOT NULL DEFAULT '',
          cantidad NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
          valor_unitario BIGINT NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
          valor_total BIGINT GENERATED ALWAYS AS ((cantidad * valor_unitario)::bigint) STORED,
          tipo_proyecto TEXT NOT NULL DEFAULT '',
          origen TEXT NOT NULL DEFAULT 'Manual' CHECK (origen IN ('Manual', 'Tabla')),
          creado_por TEXT,
          creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
          actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await pool.query(
        "CREATE INDEX IF NOT EXISTS ix_proyecto_valores_proyecto ON proyecto_valores (proyecto_id, categoria)",
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS ix_proyecto_valores_tipo ON proyecto_valores (tipo_proyecto)",
      );

      // Informes: el semanal es el registro base; mensual y trimestral son consolidaciones.
      await pool.query("ALTER TABLE informes ADD COLUMN IF NOT EXISTS periodo_inicio DATE");
      await pool.query("ALTER TABLE informes ADD COLUMN IF NOT EXISTS periodo_fin DATE");
      await pool.query(
        "ALTER TABLE informes ADD COLUMN IF NOT EXISTS contenido TEXT NOT NULL DEFAULT ''",
      );
      await pool.query(
        "ALTER TABLE informes ADD COLUMN IF NOT EXISTS consolidado BOOLEAN NOT NULL DEFAULT false",
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS ix_informes_periodo
           ON informes (proyecto, tipo, periodo_inicio, periodo_fin)`,
      );

      await pool.query(`
        CREATE TABLE IF NOT EXISTS desembolsos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          proyecto_id TEXT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
          fecha DATE NOT NULL,
          concepto TEXT NOT NULL,
          valor BIGINT NOT NULL CHECK (valor >= 0),
          clase TEXT NOT NULL DEFAULT 'Desembolso'
            CHECK (clase IN ('Desembolso', 'Acta parcial')),
          numero_acta TEXT,
          creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await pool.query(
        "CREATE INDEX IF NOT EXISTS ix_desembolsos_proyecto ON desembolsos (proyecto_id, fecha)",
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
