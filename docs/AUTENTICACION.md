# Autenticación · Ingeniería SEI

## Resumen

El sistema usa dos vías de acceso sobre una misma tabla de usuarios:

1. **Acceso local** (`proveedor = 'local'`): correo y contraseña, sea la cuenta del administrador o una cuenta aprobada.
2. **Acceso con Google** (`proveedor = 'google'`): OAuth 2.0 con cualquier cuenta de Google mientras `ALLOWED_DOMAIN` esté vacío.

Las cuentas nuevas no entran directamente. Quien usa el formulario público de registro o inicia sesión con un Google desconocido queda en estado **pendiente de aprobación**; un administrador lo revisa en el módulo **Usuarios**, elige el rol y aprueba o rechaza. Una cuenta pendiente no puede iniciar sesión.

Ambas vías terminan en el mismo mecanismo de sesión: un token aleatorio en cookie `httpOnly` y su hash SHA-256 en la base de datos.

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
| `UPLOAD_DIR` | Carpeta local de archivos subidos, relativa a `backend/` | `uploads` |
| `ALLOWED_DOMAIN` | Dominio permitido en Google (vacío = cualquiera) | *(vacío)* |
| `GOOGLE_CLIENT_ID` | Client ID de OAuth 2.0 | — |
| `GOOGLE_CLIENT_SECRET` | Client Secret de OAuth 2.0 | — |
| `GOOGLE_REDIRECT_URI` | URI de retorno registrada en Google | `http://localhost:4000/api/auth/google/callback` |
| `NODE_ENV` | Entorno (`production` activa cookies `secure`) | `development` |

El frontend solo requiere `VITE_API_URL` (ver `frontend/.env.example`), por defecto `http://localhost:4000/api`.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Login local. Límite: 10 intentos cada 15 minutos por IP. Responde `403` si la cuenta está pendiente o inactiva. |
| `POST` | `/api/auth/registro` | Solicitud de acceso `{ email, nombre, password }`. Crea la cuenta inactiva y pendiente; límite de 5 solicitudes por hora e IP. |
| `GET` | `/api/auth/google` | Inicia el flujo OAuth y redirige a Google. |
| `GET` | `/api/auth/google/callback` | Valida `state` y el ID token. Si la cuenta ya fue aprobada abre sesión; si es desconocida la crea pendiente y vuelve al login sin sesión. |
| `GET` | `/api/auth/me` | Devuelve el usuario de la sesión actual o `401`. |
| `PATCH` | `/api/auth/me` | Actualiza `nombre` y `fotoUrl` del perfil propio. |
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

## Roles y administración de usuarios

Roles disponibles: `admin`, `docente`, `estudiante` y `usuario`. El rol viaja en la sesión y en `GET /api/auth/me`. El backend aplica dos guardas:

- `requireAuth`: exige sesión activa y usuario activo.
- `requireAdmin`: exige además `rol = 'admin'`; responde `403` con `{ "error": "Esta acción requiere rol de administrador" }`.

Endpoints de administración (montados en `/api/usuarios`):

| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| `GET` | `/api/usuarios/asignables` | Cualquier sesión | Usuarios activos (`id`, `nombre`, `fotoUrl`, `rol`) para asignar tareas. |
| `GET` | `/api/usuarios` | **admin** | Listado completo con `proveedor`, `rol`, `activo`, `pendienteAprobacion`, `ultimoAcceso`, `creadoEn`, `tareasAsignadas` y `tareasCompletadas`. |
| `POST` | `/api/usuarios` | **admin** | Crea una cuenta local activa: `{ email, nombre, rol, password }`. Contraseña de 8 a 72 caracteres, hash bcrypt (12 rondas). Correo duplicado devuelve `409`. |
| `PATCH` | `/api/usuarios/:id` | **admin** | Actualiza `nombre`, `rol` y/o `activo`. Al activar una cuenta se limpia la marca de pendiente. |
| `POST` | `/api/usuarios/:id/aprobar` | **admin** | Aprueba una solicitud: `{ rol?: "usuario" }`; activa, limpia la marca y asigna el rol. |
| `DELETE` | `/api/usuarios/:id/solicitud` | **admin** | Rechaza y elimina una solicitud pendiente. |

Reglas de protección:

- Un administrador no puede cambiar su propio rol ni desactivar su propia cuenta.
- No se puede desactivar ni degradar al último administrador activo.
- Cada alta o cambio se registra en `app.auditoria` con entidad `Usuario`.

Permisos de colaboración en tableros:

- Cualquier sesión activa puede crear tareas, comentar y adjuntar archivos. Toda tarea debe pertenecer a un proyecto y nace en **Por hacer**.
- La asignación de responsable y la aprobación o devolución están reservadas al **gestor**: el creador de la tarea, el líder del proyecto (`proyectos.lider_id`), el líder del tablero (`tableros.creado_por`) o un `admin`.
- Solo la persona asignada puede pulsar **Entendido** (Por hacer → En curso) y **Enviar a revisión** (En curso → En revisión).
- El envío a revisión exige un comentario y al menos un adjunto creados por la persona asignada. Si la tarea fue devuelta, ambos deben ser posteriores a `ultima_devolucion_en`.
- Solo el gestor puede **Aprobar y completar** o **Devolver con correcciones**; la devolución vuelve la tarea a **En curso**, registra el motivo como comentario y exige evidencia nueva.
- Solo `admin` y `docente` pueden eliminar tareas.
- Un comentario o adjunto solo lo puede eliminar quien lo creó o un `admin`.
- Las notificaciones muestran las tareas asignadas a cada usuario; el `admin` ve las de todo el equipo.

El módulo **Usuarios** del frontend solo aparece en la barra lateral para `admin`; el resto de usuarios no lo ve y la API igualmente responde `403` si intentan llamarla. Dentro del módulo, la bandeja de **Solicitudes pendientes** muestra las cuentas de correo o Google que esperan aprobación, con selector de rol y acciones **Aprobar** y **Rechazar**.

Las cuentas desactivadas (`activo = false`) y las pendientes (`pendiente_aprobacion = true`) no pueden iniciar sesión ni aparecen en los filtros de responsables de los tableros; sus tareas asignadas se conservan.

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

`ALLOWED_DOMAIN=unicesmag.edu.co` rechaza cualquier cuenta que no termine en `@unicesmag.edu.co`. Si se deja vacío (configuración actual), se acepta cualquier cuenta de Google; se recomienda asignar un dominio antes de publicar en producción.

Si con `ALLOWED_DOMAIN` vacío una cuenta personal sigue sin poder entrar, revisa en Google Cloud el **tipo de usuario** de la pantalla de consentimiento: en **Interno** solo se admiten cuentas de la organización; debe ser **Externo**, y mientras la app esté en modo **Testing** hay que agregar el correo en **Test users**.

## Seguridad implementada

- Contraseñas con bcrypt (12 rondas); nunca se guardan en texto plano.
- Sesión con token de 32 bytes aleatorios; en base de datos solo vive su hash SHA-256.
- Cookie `httpOnly`, `sameSite=lax`, `path=/` y `secure` cuando `NODE_ENV=production`.
- Expiración de sesión configurable y limpieza al cerrar sesión.
- Validación del parámetro `state` de OAuth contra una cookie de corta duración.
- Verificación del ID token de Google con `google-auth-library` y auditoría del `client_id`.
- Límite de intentos en el login local y de solicitudes en el registro.
- Las cuentas nuevas quedan inactivas y pendientes hasta la aprobación de un administrador; el login valida ambos estados antes de crear la sesión.
- Validación de cuerpo con zod y consultas parametrizadas con `pg`.

## Flujo de Google

```
Frontend                 Backend                         Google
   │  GET /auth/google       │                              │
   ├────────────────────────>│  cookie oauth_state          │
   │                         ├─────────────────────────────>│
   │                         │<──── code + state ───────────┤
   │  redirect /login?...    │  verifica state e id_token   │
   │<────────────────────────┤  usuario aprobado → sesión   │
   │  GET /auth/me           │  desconocido → pendiente     │
   ├────────────────────────>│  cookie rap_sid (si aplica)  │
```

Si la cuenta de Google no existe, se crea con `activo = false` y `pendiente_aprobacion = true`, no se emite cookie de sesión y el navegador vuelve a `/login?error=pendiente`. Cuando el administrador la aprueba, el siguiente acceso con Google ya abre sesión normal. Una cuenta existente pero inactiva vuelve con `error=inactivo`.

## Perfil personalizado

Cada usuario puede cambiar su nombre y foto desde **Mi perfil**. Al guardar se marca `perfil_editado = true`; en los siguientes accesos con Google, el callback conserva esos valores en lugar de sobrescribirlos con los de la cuenta de Google. El correo y el rol se administran fuera del formulario y no son editables por el usuario.

## Administrador local

Al arrancar, `backend/src/auth/admin.ts` busca el correo `ADMIN_EMAIL`. Si no existe, lo crea con `proveedor = 'local'`, `rol = 'admin'` y la contraseña hasheada. Si el usuario ya existe, no modifica su contraseña.

Para cambiar la contraseña de desarrollo, actualiza `ADMIN_PASSWORD` y elimina el registro correspondiente, o genera un hash nuevo con bcrypt y actualízalo en la base de datos.

## Códigos de error del login

| Código en la URL | Significado |
|------------------|-------------|
| `google_no_configurado` | Faltan `GOOGLE_CLIENT_ID` o `GOOGLE_CLIENT_SECRET`. |
| `oauth_state` | La cookie de estado expiró o no coincide. |
| `dominio` | La cuenta no pertenece a `ALLOWED_DOMAIN`. |
| `pendiente` | La cuenta de Google quedó registrada como solicitud y espera aprobación. |
| `inactivo` | La cuenta existe pero está desactivada por un administrador. |
| `google` | Error al canjear el código o verificar el token. |

## Recursos pendientes

- Registro institucional de marca: el login y el registro usan `frontend/public/brand/logo-sebastian-escandon.jpg` (logo completo) y `logo-se-mark.jpg` (marca para la barra lateral y la carga), con la paleta naranja/gris/blanco del sistema.
