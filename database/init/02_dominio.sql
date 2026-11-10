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
  estado          TEXT NOT NULL CHECK (estado IN ('En formulación', 'En ejecución', 'Suspendido', 'Finalizado', 'Cerrado')),
  avance          INTEGER NOT NULL DEFAULT 0 CHECK (avance BETWEEN 0 AND 100),
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
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_documentos_proyecto ON documentos (proyecto_id);
CREATE INDEX IF NOT EXISTS ix_documentos_tipo ON documentos (tipo);

-- Plantilla documental: estructura elegida por proyecto y carpeta de cada documento.
-- Idempotente para bases creadas antes de esta función.
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS estructura TEXT;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS carpeta TEXT;

DROP TRIGGER IF EXISTS documentos_touch ON documentos;
CREATE TRIGGER documentos_touch
BEFORE UPDATE ON documentos
FOR EACH ROW EXECUTE FUNCTION app.touch_actualizado_en();

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
  creado_por     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
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
