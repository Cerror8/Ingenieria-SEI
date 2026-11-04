-- =====================================================================
-- Módulo Gestión de Proyectos (PMO) · Esquema PostgreSQL 14+
-- No hay tabla de usuarios: el módulo vive dentro de la plataforma
-- universitaria. El usuario institucional llega como TEXTO (correo o id
-- SSO) y solo se usa para auditoría.
-- =====================================================================
CREATE SCHEMA IF NOT EXISTS pmo;
SET search_path = pmo, public;

-- ---------- Catálogos -------------------------------------------------
CREATE TABLE lineas_investigacion (
  id      SERIAL PRIMARY KEY,
  nombre  TEXT NOT NULL UNIQUE
);
CREATE TABLE dependencias (
  id      SERIAL PRIMARY KEY,
  nombre  TEXT NOT NULL UNIQUE
);
CREATE TABLE ods (
  id      SMALLINT PRIMARY KEY CHECK (id BETWEEN 1 AND 17),
  nombre  TEXT NOT NULL
);

-- ---------- Proyecto (Frame 01 · Información general) ----------------
CREATE TABLE proyectos (
  id                SERIAL PRIMARY KEY,
  codigo            TEXT NOT NULL UNIQUE,                       -- "Código obligatorio y único"
  nombre            TEXT NOT NULL,
  linea_id          INT  NOT NULL REFERENCES lineas_investigacion(id),
  estado            TEXT NOT NULL DEFAULT 'Estructuración'
                    CHECK (estado IN ('Estructuración','En formulación','En ejecución',
                                      'Suspendido','Finalizado','Cerrado')),
  dependencia_id    INT REFERENCES dependencias(id),
  gestion_pmo       TEXT,
  fecha_gestion     DATE,
  responsable       TEXT,
  objetivo_general  TEXT,
  valor_total       NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  valor_supervision NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (valor_supervision >= 0),
  fecha_inicio      DATE,
  fecha_fin         DATE,
  avance_tecnico    NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (avance_tecnico BETWEEN 0 AND 100),
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);
CREATE INDEX ix_proyectos_linea  ON proyectos(linea_id);
CREATE INDEX ix_proyectos_estado ON proyectos(estado);

-- ---------- Ficha técnica FR-019 (Frame 02) --------------------------
CREATE TABLE ficha_fr019 (
  proyecto_id     INT PRIMARY KEY REFERENCES proyectos(id) ON DELETE CASCADE,
  enfoque         TEXT,            -- Sección 06
  problema        TEXT,            -- Sección 07
  justificacion   TEXT,            -- Sección 08
  sostenibilidad  TEXT             -- Sección 09
);
CREATE TABLE ficha_objetivos (               -- Sección 05
  id SERIAL PRIMARY KEY, proyecto_id INT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL, orden INT NOT NULL DEFAULT 1
);
CREATE TABLE ficha_ods (                     -- Sección 09 (selector múltiple)
  proyecto_id INT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  ods_id SMALLINT NOT NULL REFERENCES ods(id),
  PRIMARY KEY (proyecto_id, ods_id)
);
CREATE TABLE ficha_riesgos (                 -- Sección 10
  id SERIAL PRIMARY KEY, proyecto_id INT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  riesgo TEXT NOT NULL,
  probabilidad TEXT NOT NULL CHECK (probabilidad IN ('Alta','Media','Baja')),
  consecuencia TEXT NOT NULL CHECK (consecuencia IN ('Alta','Media','Baja')),
  plan_mitigacion TEXT
);
CREATE TABLE ficha_cobertura (               -- Sección 11
  id SERIAL PRIMARY KEY, proyecto_id INT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  pais TEXT NOT NULL DEFAULT 'Colombia', departamento TEXT, municipio TEXT
);
CREATE TABLE ficha_poblacion (               -- Sección 11 (población)
  id SERIAL PRIMARY KEY, proyecto_id INT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL, cantidad INT NOT NULL DEFAULT 0 CHECK (cantidad >= 0)
);
CREATE TABLE ficha_enfoques_diferenciales (  -- Sección 12
  id SERIAL PRIMARY KEY, proyecto_id INT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('Etario','Género','Étnico','Inclusión','Ambiental')),
  descripcion TEXT
);
CREATE TABLE ficha_grupos_interes (          -- Sección 13
  id SERIAL PRIMARY KEY, proyecto_id INT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('Directo','Indirecto')), descripcion TEXT
);
CREATE TABLE ficha_componentes (             -- Secciones 14–15
  id SERIAL PRIMARY KEY, proyecto_id INT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL, descripcion TEXT, resultado_esperado TEXT, orden INT NOT NULL DEFAULT 1
);
CREATE TABLE ficha_componente_actividades (
  id SERIAL PRIMARY KEY, componente_id INT NOT NULL REFERENCES ficha_componentes(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL
);
CREATE TABLE indicadores (                   -- Sección 16 (también alimenta Seguimiento/Dashboard)
  id SERIAL PRIMARY KEY, proyecto_id INT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  actividad TEXT, indicador TEXT NOT NULL, meta NUMERIC(14,2), resultado NUMERIC(14,2) NOT NULL DEFAULT 0,
  unidad TEXT, tiempo_estimado TEXT, responsable TEXT,
  estado TEXT NOT NULL DEFAULT 'Pendiente'
         CHECK (estado IN ('Pendiente','En riesgo','Cumplido','No cumplido')),
  fecha_limite DATE
);
CREATE TABLE ficha_ingresos (                -- Sección 17.1
  id SERIAL PRIMARY KEY, proyecto_id INT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('Recursos propios','Aportes de terceros')),
  concepto TEXT NOT NULL, valor_total NUMERIC(16,2) NOT NULL CHECK (valor_total >= 0)
);
CREATE TABLE ficha_gastos (                  -- Sección 17.2
  id SERIAL PRIMARY KEY, proyecto_id INT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL, concepto TEXT NOT NULL, unidad TEXT,
  cantidad NUMERIC(12,2) NOT NULL DEFAULT 1, valor_unitario NUMERIC(16,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(18,2) GENERATED ALWAYS AS (cantidad * valor_unitario) STORED
);
CREATE TABLE ficha_aprobaciones (            -- Aprobaciones
  id SERIAL PRIMARY KEY, proyecto_id INT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  rol_aprobador TEXT NOT NULL, nombre TEXT, fecha DATE,
  estado_firma TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estado_firma IN ('Pendiente','Firmado','Rechazado'))
);

-- ---------- Seguimiento, actividades y Gantt (Frames 04-06) ----------
CREATE TABLE avance_historial (
  id SERIAL PRIMARY KEY, proyecto_id INT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  porcentaje NUMERIC(5,2) NOT NULL CHECK (porcentaje BETWEEN 0 AND 100),
  descripcion TEXT, usuario TEXT, fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE actividades (
  id SERIAL PRIMARY KEY, proyecto_id INT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL, descripcion TEXT, responsable TEXT,
  fecha_inicio DATE NOT NULL, fecha_fin DATE NOT NULL,
  avance NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (avance BETWEEN 0 AND 100),
  estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente','En curso','Completada','Retrasada')),
  es_hito BOOLEAN NOT NULL DEFAULT FALSE,
  dependencia_id INT REFERENCES actividades(id) ON DELETE SET NULL,   -- dependencias del Gantt
  CHECK (fecha_fin >= fecha_inicio),
  CHECK (dependencia_id IS NULL OR dependencia_id <> id)
);
CREATE INDEX ix_actividades_proyecto ON actividades(proyecto_id);

-- ---------- Presupuesto (Frame 07) -----------------------------------
CREATE TABLE contrapartidas (
  id SERIAL PRIMARY KEY, proyecto_id INT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  entidad TEXT NOT NULL, valor NUMERIC(16,2) NOT NULL CHECK (valor >= 0)
);
CREATE TABLE desembolsos (
  id SERIAL PRIMARY KEY, proyecto_id INT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  fecha DATE NOT NULL, concepto TEXT NOT NULL, valor NUMERIC(16,2) NOT NULL CHECK (valor > 0)
);

-- ---------- Antecedentes (Frame 03) ----------------------------------
-- Un antecedente es un registro del repositorio general. Asociarlo crea
-- una RELACIÓN; nunca se duplican archivos.
CREATE TABLE antecedentes (
  id SERIAL PRIMARY KEY, codigo TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL,
  linea_id INT REFERENCES lineas_investigacion(id), tipo_documento TEXT,
  anio SMALLINT, nivel_estructuracion TEXT CHECK (nivel_estructuracion IN ('Básico','Intermedio','Avanzado'))
);
CREATE TABLE proyecto_antecedentes (
  proyecto_id INT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  antecedente_id INT NOT NULL REFERENCES antecedentes(id) ON DELETE CASCADE,
  asociado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (proyecto_id, antecedente_id)
);

-- ---------- Documentos con versiones (Frame 12) ----------------------
CREATE TABLE documentos (
  id SERIAL PRIMARY KEY, proyecto_id INT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL CHECK (categoria IN ('Ficha técnica','Actas','Informes','Antecedentes','Evidencias','Otros')),
  nombre TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'Borrador' CHECK (estado IN ('Borrador','En revisión','Aprobado','Rechazado'))
);
CREATE TABLE documento_versiones (
  id SERIAL PRIMARY KEY, documento_id INT NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
  version INT NOT NULL, ruta_archivo TEXT NOT NULL, hash_sha256 TEXT,
  subido_por TEXT, subido_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (documento_id, version)
);

-- ---------- Informes (Frame 13) --------------------------------------
-- 'datos' guarda una foto (JSON) de los datos vigentes al generar el informe.
CREATE TABLE informes (
  id SERIAL PRIMARY KEY, proyecto_id INT REFERENCES proyectos(id) ON DELETE CASCADE,  -- NULL = todos
  tipo TEXT NOT NULL CHECK (tipo IN ('Diario','Semanal','Mensual','Proyecto','Ejecutivo')),
  periodo_desde DATE, periodo_hasta DATE, datos JSONB NOT NULL,
  generado_por TEXT, generado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Auditoría (Frame 11) -------------------------------------
CREATE TABLE auditoria (
  id BIGSERIAL PRIMARY KEY, fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario TEXT NOT NULL DEFAULT 'sistema',
  accion TEXT NOT NULL CHECK (accion IN ('Creación','Actualización','Eliminación')),
  entidad TEXT NOT NULL, registro TEXT,
  proyecto_id INT,                       -- sin FK: el historial sobrevive al proyecto
  valor_anterior JSONB, valor_nuevo JSONB
);
CREATE INDEX ix_auditoria_proyecto ON auditoria(proyecto_id, fecha DESC);
