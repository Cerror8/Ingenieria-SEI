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
```

Los scripts de `database/init/` solo se ejecutan cuando el volumen está vacío. Si cambias el esquema y necesitas recrearlo, elimina el volumen con `docker compose down -v`.

## Esquema `app`

### `app.usuarios`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `UUID` | PK, `gen_random_uuid()` |
| `email` | `TEXT` | Único sin distinguir mayúsculas |
| `nombre` | `TEXT` | Nombre real (Google) o etiqueta local |
| `foto_url` | `TEXT` | Foto de perfil de Google |
| `proveedor` | `TEXT` | `google` o `local` |
| `google_id` | `TEXT` | Identificador `sub` de Google, único |
| `password_hash` | `TEXT` | Obligatorio si `proveedor = 'local'` |
| `rol` | `TEXT` | `admin`, `docente`, `estudiante` o `usuario` |
| `activo` | `BOOLEAN` | Desactiva el acceso sin borrar el registro |
| `ultimo_acceso` | `TIMESTAMPTZ` | Se actualiza en cada login |
| `creado_en` / `actualizado_en` | `TIMESTAMPTZ` | `actualizado_en` se mantiene con trigger |

Índices:

- `ux_usuarios_email` sobre `lower(email)`.
- `ix_usuarios_rol` sobre `rol`.

Restricciones:

- `proveedor` solo admite `google` o `local`.
- Un usuario local debe tener `password_hash`.

### `app.sesiones`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `UUID` | PK |
| `usuario_id` | `UUID` | FK a `usuarios`, `ON DELETE CASCADE` |
| `token_hash` | `TEXT` | SHA-256 del token, único |
| `expira_en` | `TIMESTAMPTZ` | Fecha de expiración |
| `creado_en` | `TIMESTAMPTZ` | Alta de la sesión |

Índices: `ix_sesiones_usuario` y `ix_sesiones_expira`.

## Reset de datos

El esquema inicial no incluye datos de ejemplo. El único usuario inicial es el administrador local que crea el backend al arrancar (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

Para borrar todo y empezar limpio:

```bash
cd database
docker compose down -v
docker compose up -d
```

Después reinicia el backend para que vuelva a crear el administrador.
