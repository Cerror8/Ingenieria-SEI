-- =====================================================================
-- RAP-16 · Esquema de autenticación
-- PostgreSQL 14+ · esquema "app"
-- =====================================================================
CREATE SCHEMA IF NOT EXISTS app;
SET search_path = app, public;

-- Usuarios institucionales (Google) y administradores locales.
CREATE TABLE usuarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  nombre        TEXT NOT NULL,
  foto_url      TEXT,
  proveedor     TEXT NOT NULL CHECK (proveedor IN ('google', 'local')),
  google_id     TEXT UNIQUE,
  password_hash TEXT,
  rol           TEXT NOT NULL DEFAULT 'usuario'
                CHECK (rol IN ('admin', 'docente', 'estudiante', 'usuario')),
  activo        BOOLEAN NOT NULL DEFAULT true,
  perfil_editado BOOLEAN NOT NULL DEFAULT false,
  ultimo_acceso TIMESTAMPTZ,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (proveedor <> 'local' OR password_hash IS NOT NULL)
);

CREATE UNIQUE INDEX ux_usuarios_email ON usuarios (lower(email));
CREATE INDEX ix_usuarios_rol ON usuarios (rol);

-- Sesiones opacas: la cookie guarda el token y aquí solo su hash.
CREATE TABLE sesiones (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expira_en  TIMESTAMPTZ NOT NULL,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_sesiones_usuario ON sesiones (usuario_id);
CREATE INDEX ix_sesiones_expira ON sesiones (expira_en);

CREATE OR REPLACE FUNCTION app.touch_actualizado_en() RETURNS trigger AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER usuarios_touch
BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION app.touch_actualizado_en();
