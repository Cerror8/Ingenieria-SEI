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

En `02_dominio.sql` las tablas e índices usan `IF NOT EXISTS`, pero los triggers no. Para reaplicar el script sobre un volumen existente, elimina antes todos los triggers que define (`proyectos_touch`, `indicadores_touch`, `documentos_touch`, `actividades_touch`, `tableros_touch`, `tareas_tablero_touch`, `eventos_calendario_touch`) o envuelve cada `CREATE TRIGGER` en un bloque condicional.

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
| `rol` | `TEXT` | `admin`, `docente`, `estudiante` o `usuario` |
| `activo` | `BOOLEAN` | Desactiva el acceso sin borrar el registro |
| `ultimo_acceso` | `TIMESTAMPTZ` | Se actualiza en cada login |
| `perfil_editado` | `BOOLEAN` | Si es `true`, un nuevo login con Google no sobrescribe nombre ni foto |
| `creado_en` / `actualizado_en` | `TIMESTAMPTZ` | `actualizado_en` se mantiene con trigger |

La columna `perfil_editado` se añadió sobre el volumen existente con:

```sql
ALTER TABLE app.usuarios
  ADD COLUMN IF NOT EXISTS perfil_editado BOOLEAN NOT NULL DEFAULT false;
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

Al respaldar, ten en cuenta que `db:backup` solo cubre PostgreSQL: copia también `backend/uploads/` si necesitas conservar los archivos.

#### `app.informes`

Informes generados: `fecha`, `tipo`, `periodo`, `proyecto` (código o `Todos`), `generado_por` y `formato` (`PDF` o `Word`).

#### `app.actividades`

Cronograma tipo Gantt por proyecto: `nombre`, `responsable`, `mes_inicio`/`mes_fin` (1–12), `avance`, `estado` (`Pendiente`, `En curso`, `Completada`, `Retrasada`) y `hito`.

#### `app.auditoria`

Bitácora: `fecha`, `usuario`, `accion`, `entidad`, `registro`, `valor_previo` y `valor_nuevo`. Se escribe desde la API al crear proyectos, documentos y tableros; al crear, mover, editar o eliminar tareas; al subir o eliminar adjuntos de tareas; al crear, editar o eliminar eventos de calendario; y al crear o actualizar usuarios.

### Tableros estilo Monday

#### `app.tableros`

`id` UUID, `nombre`, `descripcion`, `creado_por` (FK a `usuarios`, `SET NULL`) y marcas de tiempo.

#### `app.tareas_tablero`

`id` UUID, `tablero_id` (FK con `ON DELETE CASCADE`), `titulo`, `descripcion`, `columna` (`por-hacer`, `en-curso`, `en-revision`, `completado`), `responsable` (nombre visible), `responsable_id` (FK a `usuarios`, `ON DELETE SET NULL`), `prioridad` (`Alta`, `Media`, `Baja`), `fecha_limite`, `etiqueta`, `orden` y `completado_en`. Índice compuesto `(tablero_id, columna, orden)`, índice `ix_tareas_tablero_responsable` sobre `responsable_id` e índice `ix_tareas_tablero_completado` sobre `completado_en`.

`responsable_id` permite asignar la tarea a una cuenta real del sistema; `responsable` conserva el nombre para mostrar y se rellena desde la cuenta al asignarla. Si la cuenta se elimina, la tarea queda sin asignar (`SET NULL`) pero conserva el texto. `completado_en` se llena automáticamente cuando la tarea pasa a la columna `completado` y se limpia si se reabre; con esa fecha se calcula el ritmo semanal y el avance por persona. Las columnas se añadieron sobre el volumen existente con:

```sql
ALTER TABLE app.tareas_tablero
  ADD COLUMN IF NOT EXISTS responsable_id UUID REFERENCES app.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completado_en TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS ix_tareas_tablero_responsable ON tareas_tablero (responsable_id);
CREATE INDEX IF NOT EXISTS ix_tareas_tablero_completado ON tareas_tablero (completado_en);
UPDATE app.tareas_tablero
   SET completado_en = actualizado_en
 WHERE columna = 'completado' AND completado_en IS NULL;
```

#### `app.comentarios_tarea`

Comentarios de cada tarea: `tarea_id` (FK con `ON DELETE CASCADE`), `usuario_id` (FK a `usuarios`, `SET NULL`), `autor` (nombre al momento de comentar), `contenido` (máximo 2000 caracteres en la API) y `creado_en`. Índice `ix_comentarios_tarea` sobre `(tarea_id, creado_en)`.

#### `app.adjuntos_tarea`

Archivos adjuntos de cada tarea: `tarea_id` (FK con `ON DELETE CASCADE`), `usuario_id` (FK a `usuarios`, `SET NULL`), `nombre` (nombre original), `ruta` (nombre generado en `backend/uploads/tareas/`), `mime`, `tamano` y `creado_en`. Índice `ix_adjuntos_tarea` sobre `(tarea_id, creado_en)`.

Los archivos físicos viven en `backend/uploads/tareas/` (ignorado por Git); la base solo guarda sus metadatos y la descarga pasa por la API con sesión activa. Al respaldar, copia también esa carpeta.

#### Administración de usuarios

No requiere tablas nuevas: el módulo **Usuarios** opera sobre `app.usuarios` (`nombre`, `rol`, `activo`, `password_hash`). La API impide que un administrador se quite a sí mismo el rol o se desactive y que desaparezca el último administrador activo; cada alta o cambio queda registrado en `app.auditoria` con entidad `Usuario`. Los usuarios activos alimentan el selector de responsables de los tableros.

### Calendario personal

#### `app.eventos_calendario`

Eventos y reuniones propios de cada usuario. Las tareas no se duplican aquí: el calendario las lee de `tareas_tablero` por `fecha_limite`.

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

La base arranca **sin datos de ejemplo**. `03_seed.sql` no inserta registros: los proyectos, indicadores, documentos, informes, actividades, tableros y el dominio RAP se cargarán con los documentos institucionales definitivos.

El único registro creado automáticamente es el administrador local, y lo hace el backend al arrancar con `ADMIN_EMAIL` y `ADMIN_PASSWORD`. El primer tablero de trabajo se crea desde la interfaz, en el módulo **Tableros**.

## Reset de datos

Para borrar todo y empezar limpio:

```bash
cd database
docker compose down -v
docker compose up -d
```

Después reinicia el backend para que vuelva a crear el administrador local.
