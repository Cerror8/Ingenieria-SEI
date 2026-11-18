# Autenticación · Ingeniería SEI

## Resumen

El sistema usa dos vías de acceso sobre una misma tabla de usuarios:

1. **Acceso local** (`proveedor = 'local'`): correo y contraseña, sea la cuenta del administrador o una cuenta aprobada.
2. **Acceso con Google** (`proveedor = 'google'`): OAuth 2.0 con cualquier cuenta de Google mientras `ALLOWED_DOMAIN` esté vacío.

Las cuentas nuevas no entran directamente. Quien usa el formulario público de registro o inicia sesión con un Google desconocido queda en estado **pendiente de aprobación**; un administrador lo revisa en el módulo **Usuarios**, elige el rol y aprueba o rechaza. Una cuenta pendiente no puede iniciar sesión.

Ambas vías terminan en el mismo mecanismo de sesión: un token aleatorio en cookie `httpOnly` y su hash SHA-256 en la base de datos.

Cada cuenta puede activar además la **verificación en dos pasos (2FA TOTP)** desde **Mi perfil**. Cuando está activa, la contraseña o Google solo inician un *desafío*; la sesión se crea únicamente al validar el código de la aplicación autenticadora o un código de respaldo.

## Variables de entorno

Archivo `backend/.env` (parte de `backend/.env.example`):

| Variable | Uso | Valor de desarrollo |
|----------|-----|---------------------|
| `PORT` | Puerto del backend | `4000` |
| `DATABASE_URL` | Cadena de conexión PostgreSQL | `postgres://sei:sei_dev_password@localhost:5433/sei_rap` |
| `CORS_ORIGIN` | Origen permitido con credenciales | `http://localhost:5174` |
| `FRONTEND_URL` | Destino tras el callback de Google | `http://localhost:5174` |
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
| `POST` | `/api/auth/login` | Login local. Límite: 10 intentos cada 15 minutos por IP. Responde `403` si la cuenta está pendiente o inactiva. Si la cuenta tiene 2FA responde `{ "requiere2fa": true }` sin abrir sesión. |
| `POST` | `/api/auth/2fa` | Canjea el desafío 2FA: `{ codigo }` (código TOTP o de respaldo). Límite: 12 intentos cada 15 minutos. |
| `POST` | `/api/auth/registro` | Solicitud de acceso `{ email, nombre, password }`. Crea la cuenta inactiva y pendiente; límite de 5 solicitudes por hora e IP. |
| `GET` | `/api/auth/google` | Inicia el flujo OAuth y redirige a Google. |
| `GET` | `/api/auth/google/callback` | Valida `state` y el ID token. Si la cuenta ya fue aprobada abre sesión (o pide 2FA); si es desconocida la crea pendiente y vuelve al login sin sesión. |
| `GET` | `/api/auth/me` | Devuelve el usuario de la sesión actual o `401`. |
| `PATCH` | `/api/auth/me` | Actualiza `nombre`, `fotoUrl`, `telefono` y `whatsappOptIn` del perfil propio. |
| `PATCH` | `/api/auth/me/correo` | Cambia el correo de acceso local: `{ email, password }`. |
| `PATCH` | `/api/auth/me/password` | Cambia la contraseña local: `{ actual, nueva }`. |
| `GET` | `/api/auth/2fa` | Estado 2FA de la cuenta: `{ habilitado, codigosRestantes }`. |
| `POST` | `/api/auth/2fa/iniciar` | Genera secreto TOTP pendiente y QR: `{ password? }` (obligatorio en cuentas locales). |
| `POST` | `/api/auth/2fa/activar` | Confirma el secreto pendiente con `{ codigo }` y devuelve los 8 códigos de respaldo en claro (única vez). |
| `POST` | `/api/auth/2fa/desactivar` | Desactiva 2FA: `{ password?, codigo }`. |
| `POST` | `/api/auth/2fa/codigos` | Regenera los códigos de respaldo: `{ password?, codigo }`. |
| `POST` | `/api/auth/logout` | Elimina la sesión, el desafío 2FA y borra las cookies. |
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
    "totpHabilitado": false,
    "ultimoAcceso": "2026-11-04T19:14:00.000Z"
  }
}
```

## Roles y administración de usuarios

Roles disponibles: `admin` y `usuario`. El rol viaja en la sesión y en `GET /api/auth/me`. El backend aplica dos guardas:

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
| `POST` | `/api/usuarios/:id/2fa/reset` | **admin** | Restablece la verificación en dos pasos: borra secreto, códigos y desafíos. Uso previsto cuando la persona perdió el dispositivo y los códigos; debe configurarla de nuevo. |

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
- Solo `admin` puede eliminar tareas.
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
   - Orígenes autorizados de JavaScript: `http://localhost:5174`
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
- Límite de intentos en el login local, en el canje 2FA y de solicitudes en el registro.
- Las cuentas nuevas quedan inactivas y pendientes hasta la aprobación de un administrador; el login valida ambos estados antes de crear la sesión.
- 2FA TOTP implementado con HMAC-SHA1 y comparación en tiempo constante (`crypto.timingSafeEqual`); tolerancia de ±1 paso y desafíos de 5 minutos con máximo 5 intentos.
- Códigos de respaldo de un solo uso: solo se almacena su hash SHA-256 y se consumen al validarse.
- Ninguna sesión se crea antes de superar el segundo factor; el desafío vive en cookie `httpOnly` independiente.
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

Si la cuenta de Google no existe, se crea con `activo = false` y `pendiente_aprobacion = true`, no se emite cookie de sesión y el navegador vuelve a `/login?error=pendiente`. Cuando el administrador la aprueba, el siguiente acceso con Google ya abre sesión normal. Una cuenta existente pero inactiva vuelve con `error=inactivo`. Si la cuenta aprobada tiene 2FA activo, el callback crea el desafío y redirige a `/login?paso=2fa`.

## Verificación en dos pasos (2FA TOTP)

### Esquema

La migración es idempotente y se aplica con `npm run db:init` (archivo `database/init/01_schema.sql`):

```sql
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS totp_habilitado_en TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS totp_codigos TEXT[];

CREATE TABLE IF NOT EXISTS desafios_2fa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expira_en TIMESTAMPTZ NOT NULL,
  intentos INT NOT NULL DEFAULT 0,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- `totp_secret`: secreto base32 de 20 bytes emitido al configurar. Se guarda en claro porque el servidor debe calcular códigos; cualquier cambio de cifrado exige gestionar una clave externa.
- `totp_habilitado_en`: `NULL` mientras no se confirme el primer código; con fecha indica 2FA activo.
- `totp_codigos`: solo hashes SHA-256 de los códigos de respaldo (8 por defecto); cada uso consume uno.
- `desafios_2fa`: desafíos de login pendientes; se guarda el hash del token, la expiración (5 minutos) y el contador de intentos (máximo 5).

### Activación desde Mi perfil

1. El usuario escribe su contraseña actual (las cuentas de Google no la tienen y quedan exentas).
2. El backend genera un secreto pendiente, un QR (`qrcode`) y el URI `otpauth://`; el secreto se muestra también en texto para carga manual.
3. La persona escanea el QR y escribe el código de 6 dígitos actual.
4. Al validarlo se fija `totp_habilitado_en`, se generan y muestran una única vez 8 códigos de respaldo (`XXXX-XXXX`) y se registra el cambio en auditoría.

Desde la misma sección se pueden **regenerar** los códigos o **desactivar** 2FA; ambas acciones exigen la contraseña local y un código válido.

### Inicio de sesión con 2FA

```
POST /auth/login
  ├─ credenciales inválidas o cuenta pendiente/inactiva → error
  └─ credenciales válidas + 2FA activo
       ├─ crea fila en desafios_2fa y cookie httpOnly rap_2fa (5 min)
       └─ { "requiere2fa": true }        ← sin cookie de sesión

POST /auth/2fa { codigo }
  ├─ valida desafío, expiración, intentos y estado de la cuenta
  ├─ acepta TOTP (±1 paso de 30 s) o código de respaldo de un solo uso
  ├─ elimina el desafío y la cookie rap_2fa
  └─ crea la sesión (rap_sid) y devuelve el usuario
```

El código TOTP es de 6 dígitos, periodo de 30 segundos y ventana de tolerancia de un paso. El endpoint de canje tiene su propio límite (12 intentos cada 15 minutos). Con Google el flujo es idéntico, salvo que el desafío se crea en el callback y la persona llega a `/login?paso=2fa`.

### Recuperación

- **Códigos de respaldo**: 8 códigos de un solo uso entregados al activar o regenerar. Se aceptan en el mismo campo del código TOTP (con o sin guion).
- **Restablecimiento por administrador**: en **Usuarios**, la columna **2FA** muestra el estado y el botón **Restablecer** borra secreto, códigos y desafíos. La persona configura 2FA de nuevo en su siguiente acceso. La acción queda auditada.

## Perfil personalizado

Cada usuario puede cambiar su nombre, foto, teléfono de WhatsApp y la verificación en dos pasos desde **Mi perfil**. Al guardar se marca `perfil_editado = true`; en los siguientes accesos con Google, el callback conserva esos valores en lugar de sobrescribirlos con los de la cuenta de Google. El rol solo lo administra un `admin`; el correo y la contraseña se cambian en **Seguridad de la cuenta** (cuentas locales).

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

## Marca y paleta oficial

El login, el registro, la barra lateral y la pantalla de carga usan el logo oficial de **Sebastián Escandón · Ingeniero Civil**:

- `frontend/src/assets/brand/logo-sei.png`: logo completo (emblema + texto), usado en el panel del login, el registro y la barra lateral.
- `frontend/src/assets/brand/emblema-sei.png`: solo el emblema, usado en la pantalla de carga.

Colores oficiales, definidos en `frontend/src/styles/theme.css` (variables `--brand-*` y tokens de tema):

| Color | Hex | Uso |
|-------|-----|-----|
| Naranja | `#F39200` | Elementos activos, acentos y botón principal (texto `#1B1B1B`). |
| Gris medio | `#706F6F` | Texto secundario y detalles. |
| Gris claro | `#B3B2B2` | Bordes y superficies suaves. |
| Tinta | `#1B1B1B` | Texto principal y panel de marca. |

El botón principal usa naranja con texto oscuro porque el blanco sobre `#F39200` no alcanza contraste AA. Los tonos `#C2410C` y `#B45309` se conservan para texto pequeño y estados heredados.
