# Ingeniería SEI · Universidad CESMAG

Página web para Ingeniería Civil. El acceso se realiza con el login RAP-16 (administrador local o cuenta de Google) y, una vez dentro, se trabaja sobre los módulos de dashboard, mi tablero, tableros, calendario, proyectos, seguimiento, antecedentes, informes, documentos y usuarios.

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 19 · Vite 8 · Tailwind CSS 4 · React Router 7 · Lucide · Recharts |
| Backend | Node + Express 4 · TypeScript · pg · zod · bcryptjs · multer · google-auth-library |
| Base de datos | PostgreSQL 16 en Docker local (puerto host **5433**); Neon/Supabase en Vercel |
| Autenticación | Sesión opaca en cookie `httpOnly` + OAuth 2.0 con Google |

## Estructura

```
.
├── frontend/               Aplicación React (Vite + Tailwind)
│   ├── public/             Favicon e íconos estáticos
│   └── src/
│       ├── app/
│       │   ├── api/        Cliente HTTP y manejo de errores
│       │   ├── auth/       AuthProvider (contexto de sesión)
│       │   ├── components/ Componentes compartidos, PDF y estados de carga
│       │   ├── constants.ts Navegación y configuración visual
│       │   ├── lib/        Utilidades de formato
│       │   ├── features/
│       │   │   ├── auth/         Login RAP-16 y solicitud de acceso
│       │   │   ├── dashboard/    Panel general
│       │   │   ├── mi-tablero/   Tablero personal por usuario
│       │   │   ├── tableros/     Tablero de trabajo estilo Monday
│       │   │   ├── projects/     Listado, creación y detalle de proyectos
│       │   │   ├── calendario/   Agenda personal y fechas límite
│       │   │   ├── perfil/       Personalización del perfil
│       │   │   ├── usuarios/     Administración de usuarios (solo admin)
│       │   │   ├── seguimiento/
│       │   │   ├── antecedentes/
│       │   │   ├── informes/
│       │   │   └── documentos/
│       │   ├── layout/     Sidebar, menús de perfil y notificaciones, shell
│       │   └── App.tsx     Rutas pública y privada
│       └── styles/         Tema, Tailwind y fuentes
├── backend/                API REST (Express + TypeScript)
│   ├── src/
│   │   ├── auth/           Sesiones, Google OAuth y admin local
│   │   ├── routes/         Endpoints de autenticación y dominio
│   │   ├── db.ts           Pool de PostgreSQL
│   │   └── app.ts          Composición de la API
│   ├── uploads/            Archivos cargados (ignorado por Git)
│   ├── scripts/            Inicialización de la base (`init-db.mjs`)
│   └── .env.example
├── api/                    Función serverless de Vercel (envuelve backend/dist)
├── database/               Docker Compose y scripts SQL de inicialización
│   ├── docker-compose.yml  PostgreSQL 16 y Adminer
│   └── init/
│       ├── 01_schema.sql   Usuarios y sesiones
│       ├── 02_dominio.sql  Proyectos, tableros, calendario, RAP y auditoría
│       └── 03_seed.sql     Sin datos de ejemplo (base vacía)
├── scripts/                Respaldo de la base de datos
├── vercel.json             Instalación, build y ruteo del despliegue
├── docs/                   Documentación técnica
└── README.md
```

## Requisitos

- Node.js 20 o superior
- Docker Desktop en ejecución
- Credenciales OAuth de Google (opcionales; el login local funciona sin ellas)

## Arranque rápido

La primera vez necesitas **tres terminales**: una para la base de datos, una para el backend y una para el frontend. Docker deja la base corriendo en segundo plano, así que en los siguientes arranques bastan **dos terminales** (backend y frontend) mientras el contenedor siga activo.

| Terminal | Qué ejecuta | Se queda ocupada |
|----------|-------------|------------------|
| 1 | `npm run db:up` (PostgreSQL + Adminer) | No: Docker libera la terminal |
| 2 | `npm run backend` | Sí, queda en modo watch |
| 3 | `npm run dev` | Sí, queda sirviendo Vite |

Todos los comandos se ejecutan **desde la raíz del proyecto** (`Ingenieria-SEI`). En PowerShell o en Git Bash son los mismos; solo cambia el comando para copiar archivos:

| Acción | Git Bash | PowerShell |
|--------|----------|------------|
| Copiar `.env` | `cp .env.example .env` | `Copy-Item .env.example .env` |

### Primera vez

```bash
# Terminal 1 — base de datos (requiere Docker Desktop abierto)
npm run db:up
# PostgreSQL en localhost:5433 · Adminer en http://localhost:8081

# Terminal 2 — backend
cd backend
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
npm install
npm run dev               # http://localhost:4000/api

# Terminal 3 — frontend
cd frontend
cp .env.example .env
npm install
npm run dev               # http://localhost:5174
```

Después de la primera instalación, los arranques siguientes son:

```bash
# Terminal 1 (solo si Docker no está corriendo)
npm run db:up

# Terminal 2
npm run backend

# Terminal 3
npm run dev
```

Comprobaciones rápidas:

- Base viva: `docker ps` debe mostrar `sei_rap_db`.
- Backend vivo: abre <http://localhost:4000/api/salud>.
- Frontend vivo: abre <http://localhost:5174>.

Para detener todo: `Ctrl+C` en las terminales 2 y 3, y `npm run db:down` para apagar los contenedores (los datos se conservan en el volumen `pgdata`).

El backend crea automáticamente el administrador local al arrancar si no existe. La base arranca **sin datos de ejemplo**: el primer tablero se crea desde el módulo **Tableros** y los proyectos desde **Proyectos**.

Credenciales de desarrollo:

```
Correo:     admin@unicesmag.edu.co
Contraseña: Admin12345!
```

> Cambia `ADMIN_EMAIL` y `ADMIN_PASSWORD` en `backend/.env` antes de desplegar.

Las cuentas nuevas no se crean activas: quien se registra con correo y contraseña desde **Solicita acceso**, o entra por primera vez con Google, queda como **solicitud pendiente**. Un administrador la revisa en **Usuarios → Solicitudes pendientes**, elige el rol y la aprueba o la rechaza. Mientras esté pendiente, el ingreso responde `403`.

## Scripts

| Comando (raíz) | Descripción |
|----------------|-------------|
| `npm run dev` | Frontend en desarrollo |
| `npm run build` | Build de producción del frontend |
| `npm run lint` | ESLint del frontend |
| `npm run typecheck` | Verificación de tipos del frontend |
| `npm run backend` | Backend en modo watch |
| `npm run backend:install` | Instala dependencias del backend |
| `npm run db:up` / `npm run db:down` | Levanta / detiene PostgreSQL y Adminer |
| `npm run db:init` | Aplica `database/init/*.sql` a la base indicada en `DATABASE_URL` (por ejemplo, la nube) |
| `npm run db:backup` | Genera un respaldo en `backups/` |

## Despliegue en Vercel

El repositorio ya está preparado para Vercel: el frontend se sirve como estático desde `frontend/dist` y la API (Express) se ejecuta como **una sola función serverless** en `api/index.mjs`, que envuelve `backend/dist/app.js`. `vercel.json` se encarga de instalar y compilar ambos paquetes y de enrutar `/api/*` a la función y el resto a `index.html`.

Pasos para publicarlo:

1. **Base de datos en la nube.** Crea una base PostgreSQL en [Neon](https://neon.tech) o [Supabase](https://supabase.com) y copia su cadena de conexión (incluye `?sslmode=require`). Vercel no puede alcanzar el PostgreSQL de tu Docker local (`localhost:5433`).
2. **Preparar el esquema.** En tu equipo, apunta `DATABASE_URL` a esa base (en `backend/.env` o como variable de entorno) y ejecuta una sola vez:

   ```bash
   npm run db:init
   ```

   El script aplica `database/init/01_schema.sql`, `02_dominio.sql` y `03_seed.sql` en orden y puede ejecutarse de nuevo sin romper nada.
3. **Variables de entorno en Vercel** (Project Settings → Environment Variables):

   | Variable | Valor |
   |----------|-------|
   | `DATABASE_URL` | Cadena de conexión de Neon/Supabase |
   | `CORS_ORIGIN` | `https://tu-dominio.vercel.app` (o tu dominio propio) |
   | `FRONTEND_URL` | Igual que `CORS_ORIGIN` |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Credenciales reales del administrador (cámbialas antes de publicar) |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Credenciales OAuth de Google |
   | `GOOGLE_REDIRECT_URI` | `https://tu-dominio.vercel.app/api/auth/google/callback` |
   | `ALLOWED_DOMAIN` | Opcional; vacío acepta cualquier cuenta de Google |

   No definas `UPLOAD_DIR` en Vercel: la aplicación usa `/tmp/uploads` automáticamente. `PGSSL` solo es necesario si tu cadena de conexión no incluye `sslmode`. Tampoco hace falta `VITE_API_URL`: el build de producción usa `/api` en el mismo dominio.
4. **Almacenamiento de archivos (recomendado).** Crea un **Blob store** en Vercel (Storage → Create → Blob) y conéctalo al proyecto. Vercel inyecta `BLOB_READ_WRITE_TOKEN` y a partir de ahí los documentos, evidencias y valores de referencia se guardan en Blob con acceso privado; en PostgreSQL solo queda la clave `blob:<ruta>`. Sin Blob, los archivos se guardan en `/tmp` y se pierden al reiniciar la función.

   | Variable | Valor |
   |----------|-------|
   | `BLOB_READ_WRITE_TOKEN` | Se añade solo al conectar el Blob store |

   En local no hace falta: si la variable no existe, se sigue usando `backend/uploads/`.
5. **Google Cloud Console.** Agrega como URI de redirección autorizada la misma URL de `GOOGLE_REDIRECT_URI`.
6. **Desplegar.** Vercel tomará los cambios de la rama conectada a GitHub en cada push. El administrador se crea solo en la primera petición que llega a la función.

Limitaciones de Vercel que conviene tener presentes:

- Los archivos solo persisten si hay un Blob store conectado (`BLOB_READ_WRITE_TOKEN`). Sin él, `/tmp` es efímero y se pierden entre instancias.
- Las funciones rechazan cuerpos mayores a ~4.5 MB, así que las subidas grandes que en local funcionan (hasta 20–30 MB) fallarán en producción. La solución es subir directo al storage desde el navegador (pendiente).
- El límite de duración de la función está en 60 s (`maxDuration`); la primera consulta de estilos de un Excel grande puede tardar unos segundos. El archivo se descarga una vez a `/tmp` y se reutiliza mientras viva la instancia.


## Módulos

- **Dashboard:** KPIs, estados, avances, ejecución presupuestal y alertas calculados desde la API.
- **Mi tablero:** espacio personal y privado de cada usuario. Reúne en un solo lugar todas las tareas de los tableros de proyecto donde la persona está asignada, sin duplicarlas ni modificarlas: al abrir una tarjeta se usa el mismo detalle y flujo condicional del tablero de origen. Debajo, cada usuario gestiona sus **tareas personales** independientes (título, descripción, prioridad, etiqueta y fecha límite) en tres columnas: **Por hacer**, **En curso** y **Completado**. Solo el dueño ve y edita sus tareas personales; si tienen fecha límite aparecen automáticamente en su **calendario personal**. Incluye resumen de tareas de proyecto, personales y vencidas.
- **Tableros:** tablero estilo Monday con columnas y tareas persistidas en PostgreSQL. El botón **Nueva tarea** existe solo en la cabecera del tablero; cada tarea debe pertenecer a un **proyecto** y se crea siempre en **Por hacer**. La persona que crea la tarea o lidera el proyecto es quien asigna o reasigna al responsable; el resto de usuarios no puede hacerlo. Cada tarea se asigna a una **persona real** registrada (avatar y nombre) o queda sin asignar, y el tablero se filtra por **Todas las personas / Mis tareas / Sin asignar / por persona**. La prioridad define el tono (alta = rojo, media = ámbar, baja = azul claro) y la intensidad aumenta al acercarse la fecha límite: vencida, crítica (≤2 días), próxima (≤7 días), lejana y sin fecha. Las tarjetas vencidas o por vencer muestran además el aviso de días restantes. Si la base está vacía, permite crear el primer tablero.
- **Flujo condicional de tareas:** el avance no es libre. La persona asignada pulsa **Entendido, iniciar tarea** (solo visible para ella) para pasar de **Por hacer** a **En curso**. Para pasar de **En curso** a **En revisión** debe publicar un comentario de lo realizado y subir al menos una evidencia o documento, ambos de su autoría. Quien creó la tarea, lidera el proyecto o administra el sistema puede **Aprobar y completar** (pasa a **Completado** y registra la fecha) o **Devolver con correcciones** (vuelve a **En curso** con el motivo como comentario y exige nueva evidencia). Las tarjetas muestran solo las acciones que corresponden a cada rol.
- **Seguimiento del tablero:** arriba de las columnas se muestra el avance general (porcentaje y conteo por columna), el avance por persona (tareas asignadas y completadas) y el ritmo semanal (tareas completadas en los últimos 7 días, usando la fecha real de finalización). Al aprobar una tarea se registra su fecha de finalización.
- **Detalle de tarea:** al abrir una tarjeta se muestra su ficha con proyecto, creador, líder del proyecto, líder del tablero, prioridad, fecha límite, responsable, descripción, **comentarios** y **archivos adjuntos** (PDF, Word, Excel, PowerPoint, imágenes o texto hasta 20 MB). Incluye el panel de flujo con las acciones disponibles y el estado de los requisitos de entrega. Los comentarios y adjuntos se guardan en PostgreSQL y los archivos en `backend/uploads/tareas/` (o Vercel Blob si está conectado); abrir o descargar exige sesión activa.
- **Usuarios:** módulo exclusivo del rol `admin`. Incluye una bandeja de **solicitudes pendientes** para cuentas creadas con el formulario de registro o con Google que aún no fueron aprobadas: el administrador elige el rol y aprueba o rechaza cada solicitud. La tabla principal lista las cuentas con proveedor (local o Google), rol, estado activo/inactivo, último acceso y avance de tareas. Permite crear cuentas locales con contraseña, cambiar el rol (`admin` o `usuario`) y activar o desactivar cuentas. El sistema impide que un administrador se quite a sí mismo el rol o se desactive, y que se elimine el último administrador activo.
- **Proyectos:** listado y detalle alimentados por la API; creación guiada de cinco pasos que registra el proyecto, permite elegir un **líder del proyecto** y vuelve a abrir su detalle. El líder puede asignar tareas del proyecto y aprobar o devolver sus entregas.
- **Seguimiento:** tarjetas de avance técnico y presupuestal por proyecto activo.
- **Antecedentes:** proyectos finalizados agrupados por línea y documentos del repositorio con búsqueda y filtros.
- **Informes:** generación mediante el modal de informe (queda registrada en la base) e historial de informes desde la API.
- **Documentos:** repositorio documental con filtros por categoría y carga real de archivos (PDF, Word, Excel, PowerPoint, imágenes y texto hasta 20 MB). Los archivos se guardan en `backend/uploads/` (o Vercel Blob si está conectado) y los metadatos en PostgreSQL; ver y descargar exige sesión activa.
- **Calendario:** mes navegable que muestra las fechas límite de las tareas de proyecto asignadas, las **tareas personales** con fecha y la agenda personal de cada usuario (reuniones y eventos propios, de día completo o con horario). Permite crear, editar y eliminar eventos (doble clic en un día abre el formulario); las tareas se consultan pero no se modifican desde aquí.
- **Perfil y notificaciones:** menú de usuario con acceso al perfil (nombre y foto personalizables, conservados aunque se vuelva a entrar con Google) y cierre de sesión. La campana lista las tareas vencidas o que vencen en los próximos 7 días, ordenadas por fecha y prioridad: cada persona ve **sus tareas asignadas** y el administrador ve las de **todo el equipo**.

La interfaz es responsiva: debajo de `lg` la barra lateral se abre como panel deslizante con botón hamburguesa y, en escritorio, se puede retraer a solo iconos con el botón de la cabecera (el estado se recuerda en el navegador). Las tablas se desplazan horizontalmente y los formularios pasan a una columna.

## API

Todas las rutas de dominio exigen sesión activa (`requireAuth`). Los endpoints devuelven JSON en camelCase. Las rutas marcadas **admin** además exigen rol de administrador (`requireAdmin`) y responden `403` al resto de usuarios.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Acceso local |
| `POST` | `/api/auth/registro` | Solicitud de acceso con correo y contraseña (queda pendiente de aprobación) |
| `GET` | `/api/auth/google` | Inicia OAuth con Google |
| `GET` | `/api/auth/google/callback` | Retorno de Google; las cuentas desconocidas quedan pendientes |
| `GET` | `/api/auth/me` | Usuario de la sesión |
| `PATCH` | `/api/auth/me` | Actualiza nombre y foto del perfil |
| `POST` | `/api/auth/logout` | Cierra la sesión |
| `GET` | `/api/salud` | Verificación de conexión a la base |
| `GET` | `/api/dashboard` | KPIs y series del panel |
| `GET` | `/api/proyectos` · `GET /api/proyectos/:id` | Listado y detalle |
| `POST` | `/api/proyectos` | Crea un proyecto |
| `GET` | `/api/indicadores` | Indicadores (filtro `?proyectoId=`) |
| `GET` | `/api/documentos` | Documentos (filtros `?proyectoId=` y `?tipo=`) |
| `POST` | `/api/documentos` | Carga un documento (`multipart/form-data`) |
| `GET` | `/api/documentos/:id/archivo` | Abre el archivo; `?descargar=1` fuerza la descarga |
| `GET` | `/api/informes` · `POST /api/informes` | Historial y generación |
| `GET` | `/api/auditoria` | Bitácora (filtro `?registro=`) |
| `GET` | `/api/tableros` · `GET /api/tableros/:id` | Tableros y tareas |
| `POST` | `/api/tableros` | Crea un tablero |
| `GET` | `/api/mi-tablero` | Tareas de proyecto asignadas al usuario y sus tareas personales |
| `POST` | `/api/mi-tablero/personales` | Crea una tarea personal del usuario |
| `PATCH` | `/api/mi-tablero/personales/:id` | Edita o cambia de columna una tarea personal propia |
| `DELETE` | `/api/mi-tablero/personales/:id` | Elimina una tarea personal propia |
| `POST` | `/api/tableros/:id/tareas` | Crea una tarea ligada a un proyecto |
| `PATCH` | `/api/tableros/:id/tareas/:tareaId` | Edita campos o asigna responsable (creador, líder o **admin**) |
| `POST` | `/api/tableros/:id/tareas/:tareaId/entendido` | El asignado pasa la tarea a **En curso** |
| `POST` | `/api/tableros/:id/tareas/:tareaId/enviar-revision` | El asignado envía a revisión con comentario y evidencia |
| `POST` | `/api/tableros/:id/tareas/:tareaId/aprobar` | El gestor aprueba y completa la tarea |
| `POST` | `/api/tableros/:id/tareas/:tareaId/devolver` | El gestor devuelve con correcciones a **En curso** |
| `DELETE` | `/api/tableros/:id/tareas/:tareaId` | Elimina una tarea (**solo admin**) |
| `GET` · `POST` | `/api/tableros/:id/tareas/:tareaId/comentarios` | Lista y publica comentarios |
| `DELETE` | `/api/tableros/:id/tareas/:tareaId/comentarios/:comentarioId` | Elimina un comentario (autor o **admin**) |
| `GET` · `POST` | `/api/tableros/:id/tareas/:tareaId/adjuntos` | Lista y sube adjuntos (`multipart/form-data`) |
| `GET` | `/api/tableros/:id/tareas/:tareaId/adjuntos/:adjuntoId/archivo` | Abre el adjunto; `?descargar=1` fuerza la descarga |
| `DELETE` | `/api/tableros/:id/tareas/:tareaId/adjuntos/:adjuntoId` | Elimina un adjunto (autor o **admin**) |
| `GET` | `/api/notificaciones` | Tareas vencidas o que vencen en los próximos 7 días |
| `GET` | `/api/calendario?desde=&hasta=` | Tareas con fecha límite y eventos propios del rango |
| `POST` | `/api/calendario/eventos` | Crea un evento personal |
| `PATCH` | `/api/calendario/eventos/:id` | Edita un evento propio |
| `DELETE` | `/api/calendario/eventos/:id` | Elimina un evento propio |
| `GET` | `/api/usuarios/asignables` | Usuarios activos para asignar tareas (cualquier sesión) |
| `GET` | `/api/usuarios` | **admin** · Listado con rol, estado y conteo de tareas |
| `POST` | `/api/usuarios` | **admin** · Crea una cuenta local |
| `PATCH` | `/api/usuarios/:id` | **admin** · Actualiza nombre, rol o estado activo |
| `POST` | `/api/usuarios/:id/aprobar` | **admin** · Aprueba una solicitud y asigna el rol |
| `DELETE` | `/api/usuarios/:id/solicitud` | **admin** · Rechaza y elimina una solicitud pendiente |

Los errores se devuelven como `{ "error": "mensaje" }`; los fallos de validación con zod añaden `detalles` por campo. Cuerpos principales:

- `POST /api/auth/login`: `{ "email", "password" }`.
- `POST /api/auth/registro`: `{ "email", "nombre", "password" }` (contraseña de 8 a 72 caracteres). Crea la solicitud inactiva y pendiente.
- `PATCH /api/auth/me`: `{ "nombre": "…", "fotoUrl": "https://…" | null }`.
- `POST /api/documentos` (`multipart/form-data`): campos `proyectoId`, `tipo`, `nombre`, `version`, `estado` y archivo `archivo`.
- `POST /api/tableros`: `{ "nombre", "descripcion" }`.
- `POST /api/tableros/:id/tareas`: `{ "titulo", "descripcion", "proyectoId", "responsableId": "uuid" | null, "prioridad", "fechaLimite", "etiqueta" }`. `proyectoId` es obligatorio; la tarea siempre nace en **Por hacer**. `responsableId` debe ser un usuario activo; al asignarlo, el nombre mostrado se toma de la cuenta.
- `POST /api/mi-tablero/personales`: `{ "titulo", "descripcion", "prioridad", "fechaLimite", "etiqueta", "columna"? }`. La tarea queda asociada al usuario de la sesión; `columna` solo admite `por-hacer`, `en-curso` o `completado`.
- `PATCH /api/mi-tablero/personales/:id`: acepta los mismos campos que la creación; al pasar a `completado` se registra la fecha de finalización y al reabrirla se limpia. Solo el dueño puede modificarla o eliminarla.
- `PATCH /api/tableros/:id/tareas/:tareaId`: acepta `titulo`, `descripcion`, `prioridad`, `fechaLimite`, `etiqueta` y `responsableId` (`null` para dejar sin asignar). Solo el creador de la tarea, el líder del proyecto o un **admin** pueden cambiar el responsable; la API responde `403` al resto. No permite cambiar `columna`: el avance pasa por los endpoints de flujo.
- `POST …/aprobar` y `POST …/devolver`: sin cuerpo el primero; el segundo recibe `{ "motivo": "…" }`. Solo el creador, el líder del proyecto, el líder del tablero o un **admin** pueden aprobar o devolver.
- `POST /api/tableros/:id/tareas/:tareaId/comentarios`: `{ "contenido": "…" }` (máximo 2000 caracteres).
- `POST /api/tableros/:id/tareas/:tareaId/adjuntos` (`multipart/form-data`): campo `archivo` con un único archivo de hasta 20 MB.
- `POST`/`PATCH /api/calendario/eventos`: `{ "titulo", "descripcion", "fechaInicio", "fechaFin", "todoElDia" }`, con fechas en ISO 8601.
- `POST /api/usuarios`: `{ "email", "nombre", "rol", "password" }` (contraseña de 8 a 72 caracteres, hash bcrypt de 12 rondas).
- `PATCH /api/usuarios/:id`: `{ "nombre"?, "rol"?, "activo"? }`.
- `POST /api/usuarios/:id/aprobar`: `{ "rol"?: "usuario" }`; activa la cuenta y limpia la marca de pendiente.

## Autenticación

- **Administrador local:** correo y contraseña con hash bcrypt (12 rondas), definidos por variables de entorno.
- **Registro con correo:** formulario público en `/registro`. La cuenta se crea inactiva y marcada como pendiente; no puede iniciar sesión hasta que un administrador la apruebe y le asigne un rol.
- **Cuentas de Google:** inicio de sesión con Google. Si el correo ya fue aprobado, entra con su rol; si es desconocido, se crea como solicitud pendiente y Google lo devuelve al login con el aviso correspondiente. Por ahora se acepta cualquier cuenta; para restringir, asigna un dominio en `ALLOWED_DOMAIN`.
- **Roles:** `admin` y `usuario`. Solo `admin` ve y usa el módulo **Usuarios** y las rutas de administración; el resto recibe `403`.
- **Colaboración:** cualquier sesión puede crear tareas y comentar o adjuntar en las tareas que tenga permitidas. Solo el creador de la tarea, el líder del proyecto, el líder del tablero o un `admin` pueden asignar responsable y aprobar o devolver; solo el asignado puede pulsar **Entendido** y enviar a revisión. Solo `admin` puede eliminar tareas; cada comentario o adjunto solo lo puede borrar quien lo subió o un `admin`.
- Las cuentas desactivadas o pendientes no pueden iniciar sesión.
- La pantalla de login y registro usa un monograma **SEI** provisional sobre la paleta naranja/gris/blanco del sistema, a la espera de la imagen institucional definitiva.
- La sesión viaja en una cookie `httpOnly` `rap_sid`; solo se guarda el hash SHA-256 del token en la tabla `sesiones`.

Detalle completo en [docs/AUTENTICACION.md](docs/AUTENTICACION.md) y [docs/BASE_DE_DATOS.md](docs/BASE_DE_DATOS.md).

## Estado

- Login RAP-16 probado de extremo a extremo: acceso local, sesión, rutas protegidas y cierre de sesión.
- Dominio modelado en PostgreSQL, **sin datos de ejemplo**: se llenará con los documentos institucionales nuevos.
- Dashboard, mi tablero, tableros, proyectos, seguimiento, antecedentes, informes, documentos, calendario, usuarios y perfil conectados a la API, con estados vacíos.
- Administración de usuarios probada de extremo a extremo: alta local, cambio de rol, activación/desactivación, protección del último administrador y respuesta `403` para no administradores.
- Asignación real de tareas probada: creación con responsable, avatares, filtros por persona y edición desde la API.
- Seguimiento progresivo probado: fecha de finalización al mover a **Completado**, porcentaje general, avance por persona y ritmo semanal.
- Mi tablero probado de extremo a extremo: agrega las tareas de proyecto del usuario, permite crear, editar, completar, reabrir y eliminar tareas personales, y aísla los datos entre cuentas (otra persona recibe `404` al intentar modificarlas).
- Registro y aprobación probados de extremo a extremo: alta pendiente, bloqueo de login `403`, aprobación con rol, rechazo y acceso posterior.
- Flujo condicional probado de extremo a extremo: solo el asignado confirma **Entendido**; el envío a revisión exige comentario y evidencia del asignado; solo el gestor aprueba o devuelve; tras una devolución se exige evidencia nueva.
- Comentarios y adjuntos probados de extremo a extremo: publicación y borrado, subida, descarga con sesión, límites de formato y tamaño, y permisos por autor/rol.
- Notificaciones de tareas próximas a vencer y calendario personal probados de extremo a extremo (alta, edición y eliminación de eventos).
- Interfaz responsiva con barra lateral desplegable en móvil y retráctil en escritorio.
- Carga y descarga de archivos documentales probada de extremo a extremo (límite 20 MB, formatos permitidos, control de sesión y limpieza de archivos ante errores).
- Despliegue en Vercel preparado: función serverless que envuelve Express, build conjunto de frontend y backend, SSL para PostgreSQL gestionado y `npm run db:init` verificado contra una base desechable. Los archivos admiten almacenamiento persistente en Vercel Blob (privado) con respaldo en disco local; probado en local y pendiente de probar contra un Blob store real. Las subidas directas al storage para superar el límite de ~4.5 MB siguen pendientes.
- Pendiente: cargar los documentos definitivos, edición de la ficha FR-019 y manual de usuario en Word.
