# Base de datos · Ingeniería SEI

## Contenedor

`database/docker-compose.yml` levanta PostgreSQL 16:

| Dato | Valor |
|------|-------|
| Contenedor | `sei_rap_db` |
| Imagen | `postgres:16` |
| Base | `sei_rap` |
| Usuario | `sei` |
| Contraseña (desarrollo) | `sei_dev_password` |
| Puerto host | **5433** → contenedor `5432` |
| Volumen | `database_pgdata` |

Se usa el puerto **5433** porque el puerto 5432 puede estar ocupado por otro PostgreSQL local. Si tu equipo lo tiene libre y prefieres 5432, cambia el mapeo en `docker-compose.yml` y `DATABASE_URL`.

El mismo `docker-compose.yml` levanta **Adminer** como cliente web:

| Dato | Valor |
|------|-------|
| Contenedor | `sei_rap_adminer` |
| URL | http://localhost:8081 |
| Servidor | `db` |
| Base / usuario / contraseña | `sei_rap` / `sei` / `sei_dev_password` |

El puerto 8081 se usa porque el 8080 está ocupado por otro contenedor local (kafka-ui).

## Comandos

```bash
# Desde la raíz del repositorio
npm run db:up
npm run db:down

# Reiniciar desde cero (elimina datos del volumen)
cd database
docker compose down -v
docker compose up -d

# Consola SQL
docker exec -it sei_rap_db psql -U sei -d sei_rap

# Respaldo (crea backups/sei_rap_YYYY-MM-DDTHH-MM-SS.sql)
npm run db:backup
```

Restaurar un respaldo:

```bash
docker exec -i sei_rap_db psql -U sei -d sei_rap < backups/sei_rap_2026-11-05T16-54-09.sql
```

Los archivos de `backups/` están ignorados por Git.

## Archivos de inicialización

| Archivo | Contenido |
|---------|-----------|
| `init/01_schema.sql` | Esquema `app`, función `touch_actualizado_en()`, usuarios y sesiones |
| `init/02_dominio.sql` | Proyectos, indicadores, documentos, informes, actividades, auditoría, tableros, calendario y entidades RAP |
| `init/03_seed.sql` | Sin datos de ejemplo: la base arranca vacía |

Los scripts de `database/init/` solo se ejecutan cuando el volumen está vacío. Para aplicar cambios sobre un volumen existente:

```bash
docker exec -i sei_rap_db psql -U sei -d sei_rap -v ON_ERROR_STOP=1 < database/init/02_dominio.sql
```

En `02_dominio.sql` las tablas e índices usan `IF NOT EXISTS`, pero los triggers no. Para reaplicar el script sobre un volumen existente, elimina antes todos los triggers que define (`proyectos_touch`, `indicadores_touch`, `documentos_touch`, `actividades_touch`, `tableros_touch`, `tareas_tablero_touch`, `tareas_personales_touch`, `eventos_calendario_touch`) o envuelve cada `CREATE TRIGGER` en un bloque condicional.

## Esquema `app`

### Autenticación

#### `app.usuarios`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `UUID` | PK, `gen_random_uuid()` |
| `email` | `TEXT` | Único sin distinguir mayúsculas |
| `nombre` | `TEXT` | Nombre visible (de Google, local o personalizado por el usuario) |
| `foto_url` | `TEXT` | Foto de perfil (de Google o personalizada por el usuario) |
| `proveedor` | `TEXT` | `google` o `local` |
| `google_id` | `TEXT` | Identificador `sub` de Google, único |
| `password_hash` | `TEXT` | Obligatorio si `proveedor = 'local'` |
| `rol` | `TEXT` | `admin` o `usuario` |
| `activo` | `BOOLEAN` | Desactiva el acceso sin borrar el registro |
| `pendiente_aprobacion` | `BOOLEAN` | `true` mientras la cuenta espera aprobación de un administrador |
| `ultimo_acceso` | `TIMESTAMPTZ` | Se actualiza en cada login |
| `perfil_editado` | `BOOLEAN` | Si es `true`, un nuevo login con Google no sobrescribe nombre ni foto |
| `creado_en` / `actualizado_en` | `TIMESTAMPTZ` | `actualizado_en` se mantiene con trigger |

Las solicitudes creadas con el formulario de registro o con un correo de Google desconocido se guardan con `activo = false` y `pendiente_aprobacion = true`. Al aprobarlas, la API las activa, limpia la marca y asigna el rol elegido; al rechazarlas, borra el registro.

Las columnas `perfil_editado` y `pendiente_aprobacion` se añadieron sobre el volumen existente con:

```sql
ALTER TABLE app.usuarios
  ADD COLUMN IF NOT EXISTS perfil_editado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pendiente_aprobacion BOOLEAN NOT NULL DEFAULT false;
```

Índices: `ux_usuarios_email` sobre `lower(email)` y `ix_usuarios_rol`.

#### `app.sesiones`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `UUID` | PK |
| `usuario_id` | `UUID` | FK a `usuarios`, `ON DELETE CASCADE` |
| `token_hash` | `TEXT` | SHA-256 del token, único |
| `expira_en` | `TIMESTAMPTZ` | Fecha de expiración |
| `creado_en` | `TIMESTAMPTZ` | Alta de la sesión |

Índices: `ix_sesiones_usuario` y `ix_sesiones_expira`.

### Dominio de proyectos y documentos

#### `app.proyectos`

Clave `TEXT` (código `PRY-XXXX-XXX`). Almacena `nombre`, `linea`, `responsable`, `dependencia`, `objetivo`, `estado` (`En formulación`, `En ejecución`, `Suspendido`, `Finalizado`, `Cerrado`), `avance` y `ejecucion_pct` (0–100), `presupuesto`, `fecha_inicio`/`fecha_fin`, `dias_restantes` y marcas de tiempo. Índices por `estado` y `linea`.

`tipo_contrato` (`Obra` o `Interventoría`, por defecto `Interventoría`) define qué checklist EDT se siembra y cómo se interpretan los entregables. Los proyectos existentes con estructura `construccion` se migraron a `Obra`:

```sql
ALTER TABLE app.proyectos
  ADD COLUMN IF NOT EXISTS tipo_contrato TEXT NOT NULL DEFAULT 'Interventoría'
  CHECK (tipo_contrato IN ('Obra', 'Interventoría'));
UPDATE app.proyectos SET tipo_contrato = 'Obra' WHERE estructura = 'construccion';
```

`lider_id` (FK a `usuarios`, `ON DELETE SET NULL`) identifica al líder del proyecto. Esa persona, además del creador de la tarea y los administradores, puede asignar responsables y aprobar o devolver entregas de las tareas del proyecto. Se añadió con:

```sql
ALTER TABLE app.proyectos
  ADD COLUMN IF NOT EXISTS lider_id UUID REFERENCES app.usuarios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_proyectos_lider ON app.proyectos (lider_id);
```

#### `app.indicadores`

Indicadores asociados a un proyecto (`proyecto_id` con `ON DELETE CASCADE`): `nombre`, `meta`, `avance` (texto libre), `cumplimiento` (0–100), `estado` (`Cumplido`, `En riesgo`, `No cumplido`, `Pendiente`), `responsable` y `fecha`.

#### `app.documentos`

Repositorio documental por proyecto: `nombre`, `tipo`, `version`, `fecha`, `usuario` y `estado` (`Aprobado`, `En revisión`, `Borrador`, `Rechazado`).

Metadatos del archivo cargado:

| Columna | Tipo | Notas |
|---------|------|-------|
| `archivo_nombre` | `TEXT` | Nombre original del archivo (máximo 255 caracteres) |
| `archivo_ruta` | `TEXT` | Nombre generado en `backend/uploads/` (UUID + extensión) |
| `archivo_mime` | `TEXT` | Tipo MIME reportado por el navegador |
| `archivo_tamano` | `BIGINT` | Tamaño en bytes (límite 20 MB) |

El archivo físico vive en `backend/uploads/` (ignorado por Git, configurable con `UPLOAD_DIR`); la base solo guarda sus metadatos. La descarga pasa por la API y exige sesión activa. Las columnas se añadieron sobre el volumen existente con:

```sql
ALTER TABLE app.documentos
  ADD COLUMN IF NOT EXISTS archivo_nombre TEXT,
  ADD COLUMN IF NOT EXISTS archivo_ruta   TEXT,
  ADD COLUMN IF NOT EXISTS archivo_mime   TEXT,
  ADD COLUMN IF NOT EXISTS archivo_tamano BIGINT;
```

`edt_actividad_id` vincula el documento con una actividad del checklist EDT. Un documento cargado desde el EDT o desde **Documentos** con ese vínculo aparece en ambos lugares, cuenta para el bloqueo de documento obligatorio y conserva la carpeta de la estructura del proyecto:

```sql
ALTER TABLE app.documentos
  ADD COLUMN IF NOT EXISTS edt_actividad_id UUID
  REFERENCES app.edt_actividades(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_documentos_edt ON app.documentos (edt_actividad_id);
```

Al respaldar, ten en cuenta que `db:backup` solo cubre PostgreSQL: copia también `backend/uploads/` si necesitas conservar los archivos.

#### `app.informes`

Informes generados: `fecha`, `tipo`, `periodo`, `proyecto` (código o `Todos`), `generado_por` y `formato` (`PDF` o `Word`).

#### `app.actividades`

Cronograma tipo Gantt por proyecto: `nombre`, `responsable`, `mes_inicio`/`mes_fin` (1–12), `avance`, `estado` (`Pendiente`, `En curso`, `Completada`, `Retrasada`) y `hito`.

#### `app.auditoria`

Bitácora: `fecha`, `usuario`, `accion`, `entidad`, `registro`, `valor_previo` y `valor_nuevo`. Se escribe desde la API al crear proyectos, documentos y tableros; al crear, editar o eliminar tareas; al confirmar **Entendido**, enviar a revisión, aprobar o devolver una tarea; al asignar responsables; al subir o eliminar adjuntos; al crear, editar o eliminar eventos de calendario; y al registrar, aprobar, rechazar o actualizar usuarios.

### Tableros estilo Monday

#### `app.tableros`

`id` UUID, `nombre`, `descripcion`, `creado_por` (FK a `usuarios`, `SET NULL`) y marcas de tiempo.

`proyecto_id` (FK a `proyectos`, `ON DELETE CASCADE`), `fase_id` (FK a `edt_fases`, `ON DELETE CASCADE`) y `tipo` (`Manual` o `Fase`) permiten que cada fase del EDT tenga su propio tablero automático. El tablero general no se almacena: se consulta agregando las tareas de todos los tableros con filtros por proyecto y fase.

```sql
ALTER TABLE app.tableros
  ADD COLUMN IF NOT EXISTS proyecto_id TEXT REFERENCES app.proyectos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS fase_id UUID REFERENCES app.edt_fases(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'Manual'
  CHECK (tipo IN ('Manual', 'Fase'));
CREATE INDEX IF NOT EXISTS ix_tableros_proyecto ON app.tableros (proyecto_id, fase_id);
```

#### `app.tareas_tablero`

`id` UUID, `tablero_id` (FK con `ON DELETE CASCADE`), `proyecto_id` (FK a `proyectos`, `ON DELETE SET NULL`), `creado_por` (FK a `usuarios`, `SET NULL`), `titulo`, `descripcion`, `columna` (`por-hacer`, `en-curso`, `en-revision`, `completado`), `responsable` (nombre visible), `responsable_id` (FK a `usuarios`, `ON DELETE SET NULL`), `edt_actividad_id` (FK a `edt_actividades`, `ON DELETE SET NULL`), `prioridad` (`Alta`, `Media`, `Baja`), `fecha_limite`, `etiqueta`, `orden`, `completado_en` y `ultima_devolucion_en`. Índice compuesto `(tablero_id, columna, orden)` e índices sobre `proyecto_id`, `responsable_id`, `completado_en`, `creado_por` y `edt_actividad_id`.

`edt_actividad_id` convierte la tarea en la tarjeta de una actividad EDT. La tarea se crea al sembrar o crear la actividad y se sincroniza en ambos sentidos: editar la actividad actualiza la tarea y mover o aprobar la tarea actualiza el estado de la actividad. Al eliminar la actividad se eliminan sus tareas vinculadas. La consulta del tablero general usa ese vínculo para exponer `faseNombre`, `faseOrden`, `edtEstado`, `edtTipo` y `edtRequiereDocumento`.

Reglas del flujo condicional:

- `proyecto_id` es obligatorio al crear una tarea y la tarea siempre nace en `por-hacer`.
- `creado_por` guarda quién la creó; junto con el líder del proyecto, el líder del tablero y los administradores forma el conjunto de **gestores** que pueden asignar, aprobar o devolver.
- `responsable_id` permite asignar la tarea a una cuenta real; `responsable` conserva el nombre para mostrar. Si la cuenta se elimina, la tarea queda sin asignar (`SET NULL`) pero conserva el texto.
- `completado_en` se llena al aprobar y se limpia si la tarea vuelve a abrirse; con esa fecha se calcula el ritmo semanal y el avance por persona.
- `ultima_devolucion_en` se actualiza cada vez que un gestor devuelve la tarea. El envío a revisión solo cuenta comentarios y adjuntos de la persona asignada creados **después** de esa marca, de modo que una devolución obliga a subir evidencia nueva.

Las columnas se añadieron sobre el volumen existente con:

```sql
ALTER TABLE app.tareas_tablero
  ADD COLUMN IF NOT EXISTS responsable_id UUID REFERENCES app.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proyecto_id UUID REFERENCES app.proyectos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS creado_por UUID REFERENCES app.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ultima_devolucion_en TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS ix_tareas_tablero_responsable ON tareas_tablero (responsable_id);
CREATE INDEX IF NOT EXISTS ix_tareas_tablero_completado ON tareas_tablero (completado_en);
CREATE INDEX IF NOT EXISTS ix_tareas_tablero_proyecto ON tareas_tablero (proyecto_id);
CREATE INDEX IF NOT EXISTS ix_tareas_tablero_creado_por ON tareas_tablero (creado_por);
UPDATE app.tareas_tablero
   SET completado_en = actualizado_en
 WHERE columna = 'completado' AND completado_en IS NULL;
```

Las tareas anteriores a esta migración pueden quedar con `proyecto_id` y `creado_por` en `NULL`; la API y la interfaz las muestran como **Sin proyecto** y solo los administradores pueden gestionarlas.

#### Fases y actividades EDT

El checklist EDT se organiza por fases y cada actividad puede convertirse en una tarjeta de tablero.

`app.edt_fases` guarda las fases de cada proyecto:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `UUID` | PK |
| `proyecto_id` | `TEXT` | FK a `proyectos`, `ON DELETE CASCADE` |
| `nombre` / `descripcion` | `TEXT` | Nombre visible y propósito de la fase |
| `clave` | `TEXT` | `fase-1`, `fase-2` o `fase-3` en las principales |
| `orden` | `INTEGER` | Orden del tablero |
| `es_principal` | `BOOLEAN` | Las tres fases base no se pueden eliminar |
| `depende_de_fase_id` | `UUID` | Fase anterior a la que se conecta una fase adicional |

Índice `ix_edt_fases_proyecto` sobre `(proyecto_id, orden)` y único parcial `ux_edt_fases_clave` sobre `(proyecto_id, clave)` cuando la clave no es nula.

`app.edt_actividades` guarda las tarjetas del checklist:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `UUID` | PK |
| `proyecto_id` / `fase_id` | `TEXT` / `UUID` | Proyecto y fase; `fase_id` con `ON DELETE CASCADE` |
| `etapa` | `SMALLINT` | 1–3, se mantiene por compatibilidad con el formato SAC-PI031 |
| `padre_id` | `UUID` | Subproducto de otra actividad |
| `actividad` / `descripcion` | `TEXT` | Nombre y detalle |
| `tipo` | `TEXT` | `Actividad`, `Documento` o `Acta` |
| `plantilla_clave` | `TEXT` | Clave idempotente de la plantilla (`obra-f1-contrato`, etc.) |
| `prioridad` | `TEXT` | `Alta`, `Media` o `Baja` |
| `requiere_documento` | `BOOLEAN` | Bloquea el completado sin archivo |
| `carpeta` | `TEXT` | Carpeta sugerida de la estructura del proyecto |
| `responsable` / `responsable_id` | `TEXT` / `UUID` | Nombre visible y cuenta real |
| `fecha_cumplimiento` | `DATE` | Fecha límite de la tarjeta |
| `estado` | `TEXT` | `Completado`, `En ejecución` o `No realizado` |
| `orden` | `INTEGER` | Orden dentro de la fase |

Índices `ix_edt_proyecto` sobre `(proyecto_id, etapa, orden)`, `ix_edt_fase` sobre `(fase_id, orden)` y único parcial `ux_edt_actividad_clave` sobre `(proyecto_id, plantilla_clave)` cuando la clave no es nula. Restricciones `CHECK` para `tipo` y `prioridad`.

`app.edt_requisitos` relaciona una actividad con sus requisitos previos:

```sql
CREATE TABLE IF NOT EXISTS app.edt_requisitos (
  actividad_id UUID NOT NULL REFERENCES app.edt_actividades(id) ON DELETE CASCADE,
  requisito_id UUID NOT NULL REFERENCES app.edt_actividades(id) ON DELETE CASCADE,
  PRIMARY KEY (actividad_id, requisito_id),
  CHECK (actividad_id <> requisito_id)
);
```

Reglas asociadas:

- Completar una actividad exige que sus subproductos estén completos.
- Completar una actividad exige que sus requisitos estén completos y, si exigen documento, con archivo cargado.
- Una actividad con `requiere_documento` no se completa sin al menos un documento vinculado.
- Aprobar una tarea vinculada aplica las mismas reglas (`bloqueoParaCompletar`).
- El avance del proyecto se recalcula desde el EDT; un padre con subproductos vale el promedio de sus hijos.

```sql
CREATE TABLE IF NOT EXISTS app.edt_fases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id TEXT NOT NULL REFERENCES app.proyectos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  clave TEXT,
  orden INTEGER NOT NULL DEFAULT 1,
  es_principal BOOLEAN NOT NULL DEFAULT false,
  depende_de_fase_id UUID REFERENCES app.edt_fases(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_edt_fases_proyecto ON app.edt_fases (proyecto_id, orden);
CREATE UNIQUE INDEX IF NOT EXISTS ux_edt_fases_clave
  ON app.edt_fases (proyecto_id, clave) WHERE clave IS NOT NULL;

ALTER TABLE app.edt_actividades
  ADD COLUMN IF NOT EXISTS fase_id UUID REFERENCES app.edt_fases(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS descripcion TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'Actividad',
  ADD COLUMN IF NOT EXISTS plantilla_clave TEXT,
  ADD COLUMN IF NOT EXISTS prioridad TEXT NOT NULL DEFAULT 'Alta',
  ADD COLUMN IF NOT EXISTS requiere_documento BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS carpeta TEXT;
CREATE INDEX IF NOT EXISTS ix_edt_fase ON app.edt_actividades (fase_id, orden);
CREATE UNIQUE INDEX IF NOT EXISTS ux_edt_actividad_clave
  ON app.edt_actividades (proyecto_id, plantilla_clave) WHERE plantilla_clave IS NOT NULL;

ALTER TABLE app.tareas_tablero
  ADD COLUMN IF NOT EXISTS edt_actividad_id UUID
  REFERENCES app.edt_actividades(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_tareas_tablero_edt ON app.tareas_tablero (edt_actividad_id);
```

#### `app.comentarios_tarea`

Comentarios de cada tarea: `tarea_id` (FK con `ON DELETE CASCADE`), `usuario_id` (FK a `usuarios`, `SET NULL`), `autor` (nombre al momento de comentar), `contenido` (máximo 2000 caracteres en la API) y `creado_en`. Índice `ix_comentarios_tarea` sobre `(tarea_id, creado_en)`.

#### `app.adjuntos_tarea`

Archivos adjuntos de cada tarea: `tarea_id` (FK con `ON DELETE CASCADE`), `usuario_id` (FK a `usuarios`, `SET NULL`), `nombre` (nombre original), `ruta` (nombre generado en `backend/uploads/tareas/`), `mime`, `tamano` y `creado_en`. Índice `ix_adjuntos_tarea` sobre `(tarea_id, creado_en)`.

Los archivos físicos viven en `backend/uploads/tareas/` (ignorado por Git); la base solo guarda sus metadatos y la descarga pasa por la API con sesión activa. Al respaldar, copia también esa carpeta.

#### Administración de usuarios

No requiere tablas nuevas: el módulo **Usuarios** opera sobre `app.usuarios` (`nombre`, `rol`, `activo`, `pendiente_aprobacion`, `password_hash`). Las solicitudes pendientes se listan y se resuelven con `POST /api/usuarios/:id/aprobar` (activa y asigna rol) o `DELETE /api/usuarios/:id/solicitud` (rechaza y elimina). La API impide que un administrador se quite a sí mismo el rol o se desactive y que desaparezca el último administrador activo; cada alta, aprobación, rechazo o cambio queda registrado en `app.auditoria` con entidad `Usuario`. Solo los usuarios activos alimentan el selector de responsables de los tableros.

### Mi tablero personal

El tablero personal no duplica las tareas de proyecto: las consulta desde `app.tareas_tablero` filtrando por `responsable_id = usuario de la sesión`. Las tareas propias y privadas viven en una tabla aparte.

La vista **Mi tablero** muestra primero todos los proyectos juntos y luego permite filtrar por proyecto. El selector solo lista proyectos donde el usuario tiene tareas de tablero o tareas personales con `proyecto_id`. `GET /api/mi-tablero` devuelve `tareasProyecto`, `tareasPersonales` y `proyectos`.

#### `app.tareas_personales`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `UUID` | PK, `gen_random_uuid()` |
| `usuario_id` | `UUID` | FK a `usuarios`, `ON DELETE CASCADE`; solo el dueño ve y edita la tarea |
| `proyecto_id` | `TEXT` | FK opcional a `proyectos`, `ON DELETE SET NULL`; alimenta el filtro por proyecto |
| `titulo` | `TEXT` | Obligatorio |
| `descripcion` | `TEXT` | Texto libre, por defecto vacío |
| `columna` | `TEXT` | `por-hacer`, `en-curso` o `completado` |
| `prioridad` | `TEXT` | `Alta`, `Media` o `Baja` |
| `fecha_limite` | `DATE` | Opcional; si existe, la tarea aparece en el calendario personal |
| `etiqueta` | `TEXT` | Por defecto `Personal` |
| `orden` | `INTEGER` | Orden dentro de la columna del usuario |
| `completado_en` | `TIMESTAMPTZ` | Se llena al pasar a `completado` y se limpia al reabrir |
| `creado_en` / `actualizado_en` | `TIMESTAMPTZ` | `actualizado_en` se mantiene con trigger |

Índice `ix_tareas_personales_usuario` sobre `(usuario_id, columna, fecha_limite)`. La API de `/api/mi-tablero` exige sesión activa y limita cada operación al usuario dueño (`WHERE usuario_id = $1`): modificar o eliminar una tarea ajena responde `404`. Cada alta, cambio de columna, edición o eliminación se registra en `app.auditoria` con entidad `Tarea personal`.

DDL para aplicar sobre un volumen existente:

```sql
CREATE TABLE IF NOT EXISTS app.tareas_personales (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID NOT NULL REFERENCES app.usuarios(id) ON DELETE CASCADE,
  proyecto_id    TEXT REFERENCES app.proyectos(id) ON DELETE SET NULL,
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
  ON app.tareas_personales (usuario_id, columna, fecha_limite);
CREATE INDEX IF NOT EXISTS ix_tareas_personales_proyecto
  ON app.tareas_personales (proyecto_id);
DROP TRIGGER IF EXISTS tareas_personales_touch ON app.tareas_personales;
CREATE TRIGGER tareas_personales_touch
BEFORE UPDATE ON app.tareas_personales
FOR EACH ROW EXECUTE FUNCTION app.touch_actualizado_en();
```

### Calendario personal

#### `app.eventos_calendario`

Eventos y reuniones propios de cada usuario. Las tareas no se duplican aquí: el calendario lee de `tareas_tablero` las tareas asignadas al usuario con `fecha_limite` en el rango y de `tareas_personales` sus tareas propias con fecha. Las primeras se etiquetan con su tablero de origen y las segundas con **Mi tablero personal**.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `UUID` | PK, `gen_random_uuid()` |
| `titulo` | `TEXT` | Obligatorio |
| `descripcion` | `TEXT` | Texto libre, por defecto vacío |
| `fecha_inicio` / `fecha_fin` | `TIMESTAMPTZ` | `fecha_fin >= fecha_inicio` |
| `todo_el_dia` | `BOOLEAN` | Si es `true`, la interfaz envía 00:00–23:59 hora local |
| `usuario_id` | `UUID` | FK a `usuarios`, `ON DELETE CASCADE`; solo el dueño ve y edita su evento |
| `creado_en` / `actualizado_en` | `TIMESTAMPTZ` | `actualizado_en` se mantiene con trigger |

Índice `ix_eventos_calendario_usuario` sobre `(usuario_id, fecha_inicio)`.

### Dominio RAP

| Tabla | Propósito |
|-------|-----------|
| `programas` | Programas académicos (`codigo`, `nombre`, `nivel`, `facultad`) |
| `asignaturas` | Asignaturas por programa (`codigo`, `nombre`, `semestre`, `creditos`) |
| `resultados_aprendizaje` | Resultados por asignatura (`codigo`, `descripcion`, `nivel`, `estado`) |
| `evaluaciones` | Evaluaciones por resultado (`nombre`, `tipo`, `peso`, `fecha`) |
| `evidencias` | Evidencias por evaluación (`nombre`, `tipo`, `url`, `cargada_por`, `fecha`) |

## Datos iniciales

La base arranca **sin datos de ejemplo**. `03_seed.sql` no inserta registros: los proyectos, indicadores, documentos, informes, actividades, tableros y el dominio RAP se cargarán con los documentos definitivos.

El único registro creado automáticamente es el administrador local, y lo hace el backend al arrancar con `ADMIN_EMAIL` y `ADMIN_PASSWORD`. El primer tablero de trabajo se crea desde la interfaz, en el módulo **Tableros**.

## Reset de datos

Para borrar todo y empezar limpio:

```bash
cd database
docker compose down -v
docker compose up -d
```

Después reinicia el backend para que vuelva a crear el administrador local.
