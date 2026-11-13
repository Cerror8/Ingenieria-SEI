-- =====================================================================
-- Ingeniería SEI · Esquema de dominio
-- Proyectos, indicadores, documentos, informes, actividades, auditoría
-- y tableros de trabajo estilo Monday. Incluye entidades RAP.
-- =====================================================================
CREATE SCHEMA IF NOT EXISTS app;
SET search_path = app, public;

-- ---------------------------------------------------------------------
-- Proyectos de investigación / PMO
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proyectos (
  id              TEXT PRIMARY KEY,
  nombre          TEXT NOT NULL,
  linea           TEXT NOT NULL,
  responsable     TEXT NOT NULL,
  lider_id        UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre_corto        TEXT NOT NULL DEFAULT '',
  numero_contrato     TEXT NOT NULL DEFAULT '',
  organizadores       TEXT NOT NULL DEFAULT '',
  entidad_contratante TEXT NOT NULL DEFAULT '',
  entidad_contratista TEXT NOT NULL DEFAULT '',
  fecha_asignacion    DATE,
  creado_por          TEXT,
  estado          TEXT NOT NULL CHECK (estado IN (
    'En formulación',
    'En ejecución',
    'En ejecución, prorrogado en tiempo',
    'En ejecución, adición presupuestal',
    'En ejecución, modificado',
    'Suspendido',
    'Finalizado',
    'Cerrado'
  )),
  avance          INTEGER NOT NULL DEFAULT 0 CHECK (avance BETWEEN 0 AND 100),
  avance_origen   TEXT NOT NULL DEFAULT 'Manual'
                  CHECK (avance_origen IN ('Manual', 'EDT', 'Gantt')),
  presupuesto     BIGINT NOT NULL DEFAULT 0 CHECK (presupuesto >= 0),
  ejecucion_pct   INTEGER NOT NULL DEFAULT 0 CHECK (ejecucion_pct BETWEEN 0 AND 100),
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE NOT NULL,
  dias_restantes  INTEGER NOT NULL DEFAULT 0,
  dependencia     TEXT NOT NULL,
  objetivo        TEXT NOT NULL DEFAULT '',
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS ix_proyectos_estado ON proyectos (estado);
CREATE INDEX IF NOT EXISTS ix_proyectos_linea ON proyectos (linea);
CREATE INDEX IF NOT EXISTS ix_proyectos_lider ON proyectos (lider_id);

DROP TRIGGER IF EXISTS proyectos_touch ON proyectos;
CREATE TRIGGER proyectos_touch
BEFORE UPDATE ON proyectos
FOR EACH ROW EXECUTE FUNCTION app.touch_actualizado_en();

-- ---------------------------------------------------------------------
-- Indicadores por proyecto
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS indicadores (
  id             TEXT PRIMARY KEY,
  nombre         TEXT NOT NULL,
  meta           TEXT NOT NULL,
  avance         TEXT NOT NULL,
  cumplimiento   INTEGER NOT NULL DEFAULT 0 CHECK (cumplimiento BETWEEN 0 AND 100),
  estado         TEXT NOT NULL CHECK (estado IN ('Cumplido', 'En riesgo', 'No cumplido', 'Pendiente')),
  responsable    TEXT NOT NULL,
  fecha          DATE NOT NULL,
  proyecto_id    TEXT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_indicadores_proyecto ON indicadores (proyecto_id);
CREATE INDEX IF NOT EXISTS ix_indicadores_estado ON indicadores (estado);

DROP TRIGGER IF EXISTS indicadores_touch ON indicadores;
CREATE TRIGGER indicadores_touch
BEFORE UPDATE ON indicadores
FOR EACH ROW EXECUTE FUNCTION app.touch_actualizado_en();

-- ---------------------------------------------------------------------
-- Documentos del repositorio
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documentos (
  id             TEXT PRIMARY KEY,
  nombre         TEXT NOT NULL,
  tipo           TEXT NOT NULL,
  version        TEXT NOT NULL DEFAULT 'v1.0',
  fecha          DATE NOT NULL,
  usuario        TEXT NOT NULL,
  estado         TEXT NOT NULL CHECK (estado IN ('Aprobado', 'En revisión', 'Borrador', 'Rechazado')),
  proyecto_id    TEXT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  archivo_nombre TEXT,
  archivo_ruta   TEXT,
  archivo_mime   TEXT,
  archivo_tamano BIGINT,
  fecha_documento DATE,
  numero_documento TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_documentos_proyecto ON documentos (proyecto_id);
CREATE INDEX IF NOT EXISTS ix_documentos_tipo ON documentos (tipo);

-- Plantilla documental: estructura elegida por proyecto y carpeta de cada documento.
-- Idempotente para bases creadas antes de esta función.
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS estructura TEXT;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS nombre_corto TEXT NOT NULL DEFAULT '';
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS numero_contrato TEXT NOT NULL DEFAULT '';
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS organizadores TEXT NOT NULL DEFAULT '';
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS entidad_contratante TEXT NOT NULL DEFAULT '';
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS entidad_contratista TEXT NOT NULL DEFAULT '';
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS fecha_asignacion DATE;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS creado_por TEXT;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS avance_origen TEXT NOT NULL DEFAULT 'Manual';
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS tipo_contrato TEXT NOT NULL DEFAULT 'Interventoría';
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS carpeta TEXT;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS fecha_documento DATE;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS numero_documento TEXT;

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

DROP TRIGGER IF EXISTS documentos_touch ON documentos;
CREATE TRIGGER documentos_touch
BEFORE UPDATE ON documentos
FOR EACH ROW EXECUTE FUNCTION app.touch_actualizado_en();

-- ---------------------------------------------------------------------
-- EDT por fases: las tres etapas principales son tableros editables y se
-- pueden agregar fases conectadas a una fase anterior. Cada actividad es
-- una tarjeta del tablero de su fase y puede exigir documentos.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS edt_fases (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id        TEXT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre             TEXT NOT NULL,
  descripcion        TEXT NOT NULL DEFAULT '',
  clave              TEXT,
  orden              INTEGER NOT NULL DEFAULT 1,
  es_principal       BOOLEAN NOT NULL DEFAULT false,
  depende_de_fase_id UUID REFERENCES edt_fases(id) ON DELETE SET NULL,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_edt_fases_proyecto ON edt_fases (proyecto_id, orden);
CREATE UNIQUE INDEX IF NOT EXISTS ux_edt_fases_clave
  ON edt_fases (proyecto_id, clave) WHERE clave IS NOT NULL;

DROP TRIGGER IF EXISTS edt_fases_touch ON edt_fases;
CREATE TRIGGER edt_fases_touch
BEFORE UPDATE ON edt_fases
FOR EACH ROW EXECUTE FUNCTION app.touch_actualizado_en();

CREATE TABLE IF NOT EXISTS edt_actividades (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id        TEXT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  fase_id            UUID REFERENCES edt_fases(id) ON DELETE CASCADE,
  etapa              SMALLINT NOT NULL DEFAULT 1 CHECK (etapa BETWEEN 1 AND 3),
  padre_id           UUID REFERENCES edt_actividades(id) ON DELETE CASCADE,
  actividad          TEXT NOT NULL DEFAULT '',
  descripcion        TEXT NOT NULL DEFAULT '',
  tipo               TEXT NOT NULL DEFAULT 'Actividad'
                     CHECK (tipo IN ('Actividad', 'Documento', 'Acta')),
  plantilla_clave    TEXT,
  prioridad          TEXT NOT NULL DEFAULT 'Alta'
                     CHECK (prioridad IN ('Alta', 'Media', 'Baja')),
  requiere_documento BOOLEAN NOT NULL DEFAULT false,
  no_aplica          BOOLEAN NOT NULL DEFAULT false,
  carpeta            TEXT,
  responsable        TEXT,
  responsable_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_cumplimiento DATE,
  estado             TEXT NOT NULL DEFAULT 'No realizado'
                     CHECK (estado IN ('Completado', 'En ejecución', 'No realizado')),
  orden              INTEGER NOT NULL DEFAULT 0,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE edt_actividades ADD COLUMN IF NOT EXISTS responsable_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE edt_actividades ADD COLUMN IF NOT EXISTS fase_id UUID REFERENCES edt_fases(id) ON DELETE CASCADE;
ALTER TABLE edt_actividades ADD COLUMN IF NOT EXISTS descripcion TEXT NOT NULL DEFAULT '';
ALTER TABLE edt_actividades ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'Actividad';
ALTER TABLE edt_actividades ADD COLUMN IF NOT EXISTS plantilla_clave TEXT;
ALTER TABLE edt_actividades ADD COLUMN IF NOT EXISTS prioridad TEXT NOT NULL DEFAULT 'Alta';
ALTER TABLE edt_actividades ADD COLUMN IF NOT EXISTS requiere_documento BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE edt_actividades ADD COLUMN IF NOT EXISTS no_aplica BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE edt_actividades ADD COLUMN IF NOT EXISTS carpeta TEXT;
ALTER TABLE edt_actividades ALTER COLUMN etapa SET DEFAULT 1;

CREATE INDEX IF NOT EXISTS ix_edt_proyecto ON edt_actividades (proyecto_id, etapa, orden);
CREATE INDEX IF NOT EXISTS ix_edt_fase ON edt_actividades (fase_id, orden);
CREATE UNIQUE INDEX IF NOT EXISTS ux_edt_actividad_clave
  ON edt_actividades (proyecto_id, plantilla_clave) WHERE plantilla_clave IS NOT NULL;

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

DROP TRIGGER IF EXISTS edt_actividades_touch ON edt_actividades;
CREATE TRIGGER edt_actividades_touch
BEFORE UPDATE ON edt_actividades
FOR EACH ROW EXECUTE FUNCTION app.touch_actualizado_en();

-- Un documento del checklist puede exigir que otro esté completo y cargado
-- antes de poder completarse (por ejemplo, el acta de inicio necesita el
-- contrato, las pólizas y el RP).
CREATE TABLE IF NOT EXISTS edt_requisitos (
  actividad_id UUID NOT NULL REFERENCES edt_actividades(id) ON DELETE CASCADE,
  requisito_id UUID NOT NULL REFERENCES edt_actividades(id) ON DELETE CASCADE,
  PRIMARY KEY (actividad_id, requisito_id),
  CHECK (actividad_id <> requisito_id)
);

ALTER TABLE documentos ADD COLUMN IF NOT EXISTS edt_actividad_id UUID
  REFERENCES edt_actividades(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_documentos_edt ON documentos (edt_actividad_id);

-- ---------------------------------------------------------------------
-- Informes generados
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS informes (
  id            TEXT PRIMARY KEY,
  fecha         DATE NOT NULL,
  tipo          TEXT NOT NULL,
  periodo       TEXT NOT NULL,
  proyecto      TEXT NOT NULL DEFAULT 'Todos',
  generado_por  TEXT NOT NULL,
  formato       TEXT NOT NULL DEFAULT 'PDF' CHECK (formato IN ('PDF', 'Word')),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_informes_fecha ON informes (fecha DESC);

-- ---------------------------------------------------------------------
-- Actividades (cronograma / Gantt)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS actividades (
  id             TEXT PRIMARY KEY,
  nombre         TEXT NOT NULL,
  responsable    TEXT NOT NULL,
  mes_inicio     INTEGER NOT NULL CHECK (mes_inicio BETWEEN 1 AND 12),
  mes_fin        INTEGER NOT NULL CHECK (mes_fin BETWEEN 1 AND 12),
  avance         INTEGER NOT NULL DEFAULT 0 CHECK (avance BETWEEN 0 AND 100),
  estado         TEXT NOT NULL CHECK (estado IN ('Pendiente', 'En curso', 'Completada', 'Retrasada')),
  hito           BOOLEAN NOT NULL DEFAULT false,
  proyecto_id    TEXT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (mes_fin >= mes_inicio)
);

CREATE INDEX IF NOT EXISTS ix_actividades_proyecto ON actividades (proyecto_id);

DROP TRIGGER IF EXISTS actividades_touch ON actividades;
CREATE TRIGGER actividades_touch
BEFORE UPDATE ON actividades
FOR EACH ROW EXECUTE FUNCTION app.touch_actualizado_en();

-- ---------------------------------------------------------------------
-- Auditoría de cambios
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
  id            BIGSERIAL PRIMARY KEY,
  fecha         TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario       TEXT NOT NULL,
  accion        TEXT NOT NULL,
  entidad       TEXT NOT NULL,
  registro      TEXT NOT NULL,
  valor_previo  TEXT NOT NULL DEFAULT '—',
  valor_nuevo   TEXT NOT NULL DEFAULT '—'
);

CREATE INDEX IF NOT EXISTS ix_auditoria_fecha ON auditoria (fecha DESC);
CREATE INDEX IF NOT EXISTS ix_auditoria_registro ON auditoria (registro);

-- ---------------------------------------------------------------------
-- Tableros de trabajo (estilo Monday)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tableros (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         TEXT NOT NULL,
  descripcion    TEXT NOT NULL DEFAULT '',
  proyecto_id    TEXT REFERENCES proyectos(id) ON DELETE CASCADE,
  fase_id        UUID REFERENCES edt_fases(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL DEFAULT 'Manual'
                 CHECK (tipo IN ('Manual', 'Fase')),
  creado_por     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tableros ADD COLUMN IF NOT EXISTS proyecto_id TEXT REFERENCES proyectos(id) ON DELETE CASCADE;
ALTER TABLE tableros ADD COLUMN IF NOT EXISTS fase_id UUID REFERENCES edt_fases(id) ON DELETE CASCADE;
ALTER TABLE tableros ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'Manual';

CREATE INDEX IF NOT EXISTS ix_tableros_proyecto ON tableros (proyecto_id, fase_id);

DROP TRIGGER IF EXISTS tableros_touch ON tableros;
CREATE TRIGGER tableros_touch
BEFORE UPDATE ON tableros
FOR EACH ROW EXECUTE FUNCTION app.touch_actualizado_en();

CREATE TABLE IF NOT EXISTS tareas_tablero (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tablero_id     UUID NOT NULL REFERENCES tableros(id) ON DELETE CASCADE,
  proyecto_id    TEXT REFERENCES proyectos(id) ON DELETE SET NULL,
  titulo         TEXT NOT NULL,
  descripcion    TEXT NOT NULL DEFAULT '',
  columna        TEXT NOT NULL DEFAULT 'por-hacer'
                 CHECK (columna IN ('por-hacer', 'en-curso', 'en-revision', 'completado')),
  responsable    TEXT NOT NULL DEFAULT 'Sin asignar',
  responsable_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  edt_actividad_id UUID REFERENCES edt_actividades(id) ON DELETE SET NULL,
  creado_por     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  prioridad      TEXT NOT NULL DEFAULT 'Media' CHECK (prioridad IN ('Alta', 'Media', 'Baja')),
  fecha_limite   DATE,
  etiqueta       TEXT NOT NULL DEFAULT 'General',
  orden          INTEGER NOT NULL DEFAULT 0,
  completado_en  TIMESTAMPTZ,
  ultima_devolucion_en TIMESTAMPTZ,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_tareas_tablero ON tareas_tablero (tablero_id, columna, orden);
CREATE INDEX IF NOT EXISTS ix_tareas_tablero_responsable ON tareas_tablero (responsable_id);
CREATE INDEX IF NOT EXISTS ix_tareas_tablero_creador ON tareas_tablero (creado_por);
CREATE INDEX IF NOT EXISTS ix_tareas_tablero_proyecto ON tareas_tablero (proyecto_id);
CREATE INDEX IF NOT EXISTS ix_tareas_tablero_completado ON tareas_tablero (completado_en);
ALTER TABLE tareas_tablero ADD COLUMN IF NOT EXISTS edt_actividad_id UUID REFERENCES edt_actividades(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_tareas_tablero_edt ON tareas_tablero (edt_actividad_id);

DROP TRIGGER IF EXISTS tareas_tablero_touch ON tareas_tablero;
CREATE TRIGGER tareas_tablero_touch
BEFORE UPDATE ON tareas_tablero
FOR EACH ROW EXECUTE FUNCTION app.touch_actualizado_en();

-- ---------------------------------------------------------------------
-- Tablero personal: tareas propias de cada usuario, privadas para su dueño
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tareas_personales (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  proyecto_id    TEXT REFERENCES proyectos(id) ON DELETE SET NULL,
  titulo         TEXT NOT NULL,
  descripcion    TEXT NOT NULL DEFAULT '',
  columna        TEXT NOT NULL DEFAULT 'por-hacer'
                 CHECK (columna IN ('por-hacer', 'en-curso', 'completado')),
  prioridad      TEXT NOT NULL DEFAULT 'Media' CHECK (prioridad IN ('Alta', 'Media', 'Baja')),
  fecha_limite   DATE,
  etiqueta       TEXT NOT NULL DEFAULT 'Personal',
  orden          INTEGER NOT NULL DEFAULT 0,
  completado_en  TIMESTAMPTZ,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_tareas_personales_usuario
  ON tareas_personales (usuario_id, columna, fecha_limite);
ALTER TABLE tareas_personales ADD COLUMN IF NOT EXISTS proyecto_id TEXT REFERENCES proyectos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_tareas_personales_proyecto ON tareas_personales (proyecto_id);

DROP TRIGGER IF EXISTS tareas_personales_touch ON tareas_personales;
CREATE TRIGGER tareas_personales_touch
BEFORE UPDATE ON tareas_personales
FOR EACH ROW EXECUTE FUNCTION app.touch_actualizado_en();

-- ---------------------------------------------------------------------
-- Colaboración por tarea: comentarios y archivos adjuntos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comentarios_tarea (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id   UUID NOT NULL REFERENCES tareas_tablero(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  autor      TEXT NOT NULL,
  contenido  TEXT NOT NULL,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_comentarios_tarea ON comentarios_tarea (tarea_id, creado_en);

CREATE TABLE IF NOT EXISTS adjuntos_tarea (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id   UUID NOT NULL REFERENCES tareas_tablero(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre     TEXT NOT NULL,
  ruta       TEXT NOT NULL,
  mime       TEXT,
  tamano     BIGINT NOT NULL DEFAULT 0,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_adjuntos_tarea ON adjuntos_tarea (tarea_id, creado_en);

-- ---------------------------------------------------------------------
-- Calendario personal: reuniones y horario propio de cada usuario
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eventos_calendario (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo         TEXT NOT NULL,
  descripcion    TEXT NOT NULL DEFAULT '',
  fecha_inicio   TIMESTAMPTZ NOT NULL,
  fecha_fin      TIMESTAMPTZ NOT NULL,
  todo_el_dia    BOOLEAN NOT NULL DEFAULT false,
  usuario_id     UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS ix_eventos_calendario_usuario
  ON eventos_calendario (usuario_id, fecha_inicio);

DROP TRIGGER IF EXISTS eventos_calendario_touch ON eventos_calendario;
CREATE TRIGGER eventos_calendario_touch
BEFORE UPDATE ON eventos_calendario
FOR EACH ROW EXECUTE FUNCTION app.touch_actualizado_en();

-- ---------------------------------------------------------------------
-- Dominio RAP: programas, asignaturas, resultados, evaluaciones y evidencias
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS programas (
  id             TEXT PRIMARY KEY,
  codigo         TEXT NOT NULL UNIQUE,
  nombre         TEXT NOT NULL,
  nivel          TEXT NOT NULL CHECK (nivel IN ('Técnico', 'Tecnológico', 'Pregrado', 'Especialización', 'Maestría')),
  facultad       TEXT NOT NULL,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asignaturas (
  id             TEXT PRIMARY KEY,
  programa_id    TEXT NOT NULL REFERENCES programas(id) ON DELETE CASCADE,
  codigo         TEXT NOT NULL,
  nombre         TEXT NOT NULL,
  semestre       INTEGER NOT NULL CHECK (semestre BETWEEN 1 AND 12),
  creditos       INTEGER NOT NULL CHECK (creditos > 0),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (programa_id, codigo)
);

CREATE INDEX IF NOT EXISTS ix_asignaturas_programa ON asignaturas (programa_id);

CREATE TABLE IF NOT EXISTS resultados_aprendizaje (
  id             TEXT PRIMARY KEY,
  asignatura_id  TEXT NOT NULL REFERENCES asignaturas(id) ON DELETE CASCADE,
  codigo         TEXT NOT NULL,
  descripcion    TEXT NOT NULL,
  nivel          TEXT NOT NULL CHECK (nivel IN ('Básico', 'Intermedio', 'Avanzado')),
  estado         TEXT NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo', 'En revisión', 'Archivado')),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asignatura_id, codigo)
);

CREATE INDEX IF NOT EXISTS ix_resultados_asignatura ON resultados_aprendizaje (asignatura_id);

CREATE TABLE IF NOT EXISTS evaluaciones (
  id             TEXT PRIMARY KEY,
  resultado_id   TEXT NOT NULL REFERENCES resultados_aprendizaje(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,
  tipo           TEXT NOT NULL CHECK (tipo IN ('Diagnóstica', 'Formativa', 'Sumativa')),
  peso           NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (peso BETWEEN 0 AND 100),
  fecha          DATE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_evaluaciones_resultado ON evaluaciones (resultado_id);

CREATE TABLE IF NOT EXISTS evidencias (
  id             TEXT PRIMARY KEY,
  evaluacion_id  TEXT NOT NULL REFERENCES evaluaciones(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,
  tipo           TEXT NOT NULL CHECK (tipo IN ('Rúbrica', 'Acta', 'Producto', 'Informe', 'Otro')),
  url            TEXT,
  cargada_por    TEXT NOT NULL,
  fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_evidencias_evaluacion ON evidencias (evaluacion_id);

-- ---------------------------------------------------------------------
-- Valores de referencia (carpeta de valores preestablecidos)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS valores_referencia (
  id             TEXT PRIMARY KEY,
  nombre         TEXT NOT NULL,
  tipo           TEXT NOT NULL,
  descripcion    TEXT,
  archivo_nombre TEXT NOT NULL,
  archivo_ruta   TEXT NOT NULL,
  archivo_mime   TEXT,
  archivo_tamano BIGINT,
  subido_por     TEXT NOT NULL,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_valores_referencia_tipo ON valores_referencia (tipo);

-- ---------------------------------------------------------------------
-- Formatos (plantillas que se diligencian desde la plataforma)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS formatos (
  id             TEXT PRIMARY KEY,
  nombre         TEXT NOT NULL,
  descripcion    TEXT,
  campos         JSONB NOT NULL DEFAULT '[]',
  valor_id       TEXT REFERENCES valores_referencia(id) ON DELETE SET NULL,
  creado_por     TEXT NOT NULL,
  activo         BOOLEAN NOT NULL DEFAULT true,
  es_referencia  BOOLEAN NOT NULL DEFAULT false,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS formatos_touch ON formatos;
CREATE TRIGGER formatos_touch
BEFORE UPDATE ON formatos
FOR EACH ROW EXECUTE FUNCTION app.touch_actualizado_en();

-- Registros diligenciados de cada formato
CREATE TABLE IF NOT EXISTS formatos_registros (
  id               TEXT PRIMARY KEY,
  formato_id       TEXT NOT NULL REFERENCES formatos(id) ON DELETE CASCADE,
  valores          JSONB NOT NULL DEFAULT '{}',
  diligenciado_por TEXT NOT NULL,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_formatos_registros_formato ON formatos_registros (formato_id);

-- Tablas extraídas de los Excel de referencia (rubros, APU, EDT) para prellenar formatos
CREATE TABLE IF NOT EXISTS valores_tablas (
  id              TEXT PRIMARY KEY,
  valor_id        TEXT NOT NULL REFERENCES valores_referencia(id) ON DELETE CASCADE,
  hoja            TEXT NOT NULL,
  fila_cabecera   INT NOT NULL,
  columnas        JSONB NOT NULL DEFAULT '[]',
  filas           JSONB NOT NULL DEFAULT '[]',
  total_filas     INT NOT NULL DEFAULT 0,
  truncada        BOOLEAN NOT NULL DEFAULT false,
  analizada_por   TEXT NOT NULL,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_valores_tablas_valor_hoja ON valores_tablas (valor_id, hoja);
CREATE INDEX IF NOT EXISTS ix_valores_tablas_valor ON valores_tablas (valor_id);

-- ---------------------------------------------------------------------
-- Otros valores del proyecto: materiales, instrumentos y demás rubros
-- tomados de las tablas analizadas de Formatos. El tipo vacío aplica a
-- cualquier tipo de proyecto; si tiene valor, filtra por proyectos.linea.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proyecto_valores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     TEXT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  valor_id        TEXT REFERENCES valores_referencia(id) ON DELETE SET NULL,
  tabla_id        TEXT REFERENCES valores_tablas(id) ON DELETE SET NULL,
  fila_indice     INTEGER,
  nombre          TEXT NOT NULL,
  categoria       TEXT NOT NULL DEFAULT 'Otro'
                  CHECK (categoria IN ('Material', 'Instrumento', 'Otro')),
  unidad          TEXT NOT NULL DEFAULT '',
  cantidad        NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  valor_unitario  BIGINT NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
  valor_total     BIGINT GENERATED ALWAYS AS ((cantidad * valor_unitario)::bigint) STORED,
  tipo_proyecto   TEXT NOT NULL DEFAULT '',
  origen          TEXT NOT NULL DEFAULT 'Manual' CHECK (origen IN ('Manual', 'Tabla')),
  creado_por      TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_proyecto_valores_proyecto ON proyecto_valores (proyecto_id, categoria);
CREATE INDEX IF NOT EXISTS ix_proyecto_valores_tipo ON proyecto_valores (tipo_proyecto);
