# Autenticación · Ingeniería SEI

## Resumen

El sistema usa dos vías de acceso sobre una misma tabla de usuarios:

1. **Acceso administrativo local** (`proveedor = 'local'`): correo y contraseña.
2. **Acceso con Google** (`proveedor = 'google'`): OAuth 2.0 con cuentas institucionales.

Ambas terminan en el mismo mecanismo de sesión: un token aleatorio en cookie `httpOnly` y su hash SHA-256 en la base de datos.

## Variables de entorno

Archivo `backend/.env` (parte de `backend/.env.example`):

| Variable | Uso | Valor de desarrollo |
|----------|-----|---------------------|
| `PORT` | Puerto del backend | `4000` |
| `DATABASE_URL` | Cadena de conexión PostgreSQL | `postgres://sei:sei_dev_password@localhost:5433/sei_rap` |
| `CORS_ORIGIN` | Origen permitido con credenciales | `http://localhost:5173` |
| `FRONTEND_URL` | Destino tras el callback de Google | `http://localhost:5173` |
| `SESSION_TTL_DIAS` | Duración de la sesión en días | `7` |
| `ADMIN_EMAIL` | Correo del administrador local | `admin@unicesmag.edu.co` |
| `ADMIN_PASSWORD` | Contraseña inicial del administrador | `Admin12345!` |
| `ALLOWED_DOMAIN` | Dominio permitido en Google (vacío = cualquiera) | `unicesmag.edu.co` |
| `GOOGLE_CLIENT_ID` | Client ID de OAuth 2.0 | — |
| `GOOGLE_CLIENT_SECRET` | Client Secret de OAuth 2.0 | — |
| `GOOGLE_REDIRECT_URI` | URI de retorno registrada en Google | `http://localhost:4000/api/auth/google/callback` |
| `NODE_ENV` | Entorno (`production` activa cookies `secure`) | `development` |

El frontend solo requiere `VITE_API_URL` (ver `.env.example` en la raíz), por defecto `http://localhost:4000/api`.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Login local. Límite: 10 intentos cada 15 minutos por IP. |
| `GET` | `/api/auth/google` | Inicia el flujo OAuth y redirige a Google. |
| `GET` | `/api/auth/google/callback` | Valida `state` y el ID token, crea o actualiza el usuario y abre sesión. |
| `GET` | `/api/auth/me` | Devuelve el usuario de la sesión actual o `401`. |
| `POST` | `/api/auth/logout` | Elimina la sesión y borra la cookie. |
| `GET` | `/api/salud` | Estado del servicio. |

Respuesta de usuario:

```json
{
  "usuario": {
    "id": "uuid",
    "email": "persona@unicesmag.edu.co",
    "nombre": "Nombre real",
    "fotoUrl": "https://...",
    "proveedor": "google",
    "rol": "usuario",
    "ultimoAcceso": "2026-11-04T19:14:00.000Z"
  }
}
```

## Configurar Google Cloud Console

1. Entra a <https://console.cloud.google.com> y crea (o selecciona) un proyecto.
2. Ve a **APIs y servicios → Pantalla de consentimiento OAuth**:
   - Tipo de usuario: **Externo** (o **Interno** si la universidad usa Google Workspace).
   - Completa nombre de la aplicación, correo de soporte y dominios autorizados.
   - Agrega el alcance `openid`, `email` y `profile`.
3. Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente OAuth**:
   - Tipo: **Aplicación web**.
   - Orígenes autorizados de JavaScript: `http://localhost:5173`
   - URI de redireccionamiento autorizado: `http://localhost:4000/api/auth/google/callback`
4. Copia el **Client ID** y **Client Secret** en `backend/.env`.
5. Reinicia el backend.

En producción reemplaza las URLs por el dominio real y registra exactamente las mismas rutas en Google Cloud.

### Restricción de dominio

`ALLOWED_DOMAIN=unicesmag.edu.co` rechaza cualquier cuenta que no termine en `@unicesmag.edu.co`. Si se deja vacío, se acepta cualquier cuenta de Google; no se recomienda en producción.

## Seguridad implementada

- Contraseñas con bcrypt (12 rondas); nunca se guardan en texto plano.
- Sesión con token de 32 bytes aleatorios; en base de datos solo vive su hash SHA-256.
- Cookie `httpOnly`, `sameSite=lax`, `path=/` y `secure` cuando `NODE_ENV=production`.
- Expiración de sesión configurable y limpieza al cerrar sesión.
- Validación del parámetro `state` de OAuth contra una cookie de corta duración.
- Verificación del ID token de Google con `google-auth-library` y auditoría del `client_id`.
- Límite de intentos en el login local.
- Validación de cuerpo con zod y consultas parametrizadas con `pg`.

## Flujo de Google

```
Frontend                 Backend                         Google
   │  GET /auth/google       │                              │
   ├────────────────────────>│  cookie oauth_state          │
   │                         ├─────────────────────────────>│
   │                         │<──── code + state ───────────┤
   │  redirect /login?...    │  verifica state e id_token   │
   │<────────────────────────┤  crea/actualiza usuario      │
   │  GET /auth/me           │  cookie rap_sid              │
   ├────────────────────────>│                              │
```

## Administrador local

Al arrancar, `backend/src/auth/admin.ts` busca el correo `ADMIN_EMAIL`. Si no existe, lo crea con `proveedor = 'local'`, `rol = 'admin'` y la contraseña hasheada. Si el usuario ya existe, no modifica su contraseña.

Para cambiar la contraseña de desarrollo, actualiza `ADMIN_PASSWORD` y elimina el registro correspondiente, o genera un hash nuevo con bcrypt y actualízalo en la base de datos.

## Códigos de error del login

| Código en la URL | Significado |
|------------------|-------------|
| `google_no_configurado` | Faltan `GOOGLE_CLIENT_ID` o `GOOGLE_CLIENT_SECRET`. |
| `oauth_state` | La cookie de estado expiró o no coincide. |
| `dominio` | La cuenta no pertenece a `ALLOWED_DOMAIN`. |
| `google` | Error al canjear el código o verificar el token. |

## Recursos pendientes

- Colocar el escudo oficial en `public/escudo-cesmag.png`. Mientras no exista, el login muestra un ícono de graduación como respaldo.
