# Ingeniería SEI · Universidad CESMAG

Página web para Ingeniería Civil. El acceso se realiza con el login RAP-16 (administrador local o cuenta de Google) y, una vez dentro, se trabaja sobre los módulos de dashboard, tableros, calendario, proyectos, seguimiento, antecedentes, informes, documentos y usuarios.

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 19 · Vite 8 · Tailwind CSS 4 · React Router 7 · Lucide · Recharts |
| Backend | Node + Express 4 · TypeScript · pg · zod · bcryptjs · multer · google-auth-library |
| Base de datos | PostgreSQL 16 en Docker (puerto host **5433**) |
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
│       │   │   ├── auth/         Login RAP-16
│       │   │   ├── dashboard/    Panel general
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
│   └── .env.example
├── database/               Docker Compose y scripts SQL de inicialización
│   ├── docker-compose.yml  PostgreSQL 16 y Adminer
│   └── init/
│       ├── 01_schema.sql   Usuarios y sesiones
│       ├── 02_dominio.sql  Proyectos, tableros, calendario, RAP y auditoría
│       └── 03_seed.sql     Sin datos de ejemplo (base vacía)
├── scripts/                Respaldo de la base de datos
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
npm run dev               # http://localhost:5173
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
- Frontend vivo: abre <http://localhost:5173>.

Para detener todo: `Ctrl+C` en las terminales 2 y 3, y `npm run db:down` para apagar los contenedores (los datos se conservan en el volumen `pgdata`).

El backend crea automáticamente el administrador local al arrancar si no existe. La base arranca **sin datos de ejemplo**: el primer tablero se crea desde el módulo **Tableros** y los proyectos desde **Proyectos**.

Credenciales de desarrollo:

```
Correo:     admin@unicesmag.edu.co
Contraseña: Admin12345!
```

> Cambia `ADMIN_EMAIL` y `ADMIN_PASSWORD` en `backend/.env` antes de desplegar.

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
| `npm run db:backup` | Genera un respaldo en `backups/` |

## Módulos

- **Dashboard:** KPIs, estados, avances, ejecución presupuestal y alertas calculados desde la API.
- **Tableros:** tablero estilo Monday con columnas, arrastrar y soltar desde una manija visible, alta, movimiento y eliminación de tareas persistidas en PostgreSQL. Cada tarea se asigna a una **persona real** registrada (avatar y nombre) o queda sin asignar, y el tablero muestra el trabajo de todo el equipo con filtros **Todas las personas / Mis tareas / Sin asignar / por persona**. La prioridad define el tono (alta = rojo, media = ámbar, baja = azul claro) y la intensidad aumenta al acercarse la fecha límite: vencida, crítica (≤2 días), próxima (≤7 días), lejana y sin fecha. Las tarjetas vencidas o por vencer muestran además el aviso de días restantes. Si la base está vacía, permite crear el primer tablero. En móvil el movimiento se hace desde un selector por tarjeta.
- **Seguimiento del tablero:** arriba de las columnas se muestra el avance general (porcentaje y conteo por columna), el avance por persona (tareas asignadas y completadas) y el ritmo semanal (tareas completadas en los últimos 7 días, usando la fecha real de finalización). Al mover una tarea a **Completado** se registra su fecha y, si se reabre, se limpia.
- **Detalle de tarea:** al abrir una tarjeta se muestra su ficha con prioridad, fecha límite, responsable, descripción, **comentarios** y **archivos adjuntos** (PDF, Word, Excel, PowerPoint, imágenes o texto hasta 20 MB). Los comentarios y adjuntos se guardan en PostgreSQL y los archivos en `backend/uploads/tareas/`; abrir o descargar exige sesión activa. Las tarjetas muestran el número de comentarios y adjuntos.
- **Usuarios:** módulo exclusivo del rol `admin`. Lista todas las cuentas con su proveedor (local o Google), rol, estado activo/inactivo, último acceso y avance de tareas asignadas/completadas. Permite crear cuentas locales con contraseña, cambiar el rol (`admin`, `docente`, `estudiante`, `usuario`) y activar o desactivar cuentas. El sistema impide que un administrador se quite a sí mismo el rol o se desactive, y que se elimine el último administrador activo.
- **Proyectos:** listado y detalle alimentados por la API; creación guiada de cinco pasos que registra el proyecto y vuelve a abrir su detalle.
- **Seguimiento:** tarjetas de avance técnico y presupuestal por proyecto activo.
- **Antecedentes:** proyectos finalizados agrupados por línea y documentos del repositorio con búsqueda y filtros.
- **Informes:** generación mediante el modal de informe (queda registrada en la base) e historial de informes desde la API.
- **Documentos:** repositorio documental con filtros por categoría y carga real de archivos (PDF, Word, Excel, PowerPoint, imágenes y texto hasta 20 MB). Los archivos se guardan en `backend/uploads/` y los metadatos en PostgreSQL; ver y descargar exige sesión activa.
- **Calendario:** mes navegable que muestra las fechas límite de las tareas y la agenda personal de cada usuario (reuniones y eventos propios, de día completo o con horario). Permite crear, editar y eliminar eventos (doble clic en un día abre el formulario); las tareas se consultan pero no se modifican desde aquí.
- **Perfil y notificaciones:** menú de usuario con acceso al perfil (nombre y foto personalizables, conservados aunque se vuelva a entrar con Google) y cierre de sesión. La campana lista las tareas vencidas o que vencen en los próximos 7 días, ordenadas por fecha y prioridad: cada persona ve **sus tareas asignadas** y el administrador ve las de **todo el equipo**.

La interfaz es responsiva: debajo de `lg` la barra lateral se abre como panel deslizante con botón hamburguesa y, en escritorio, se puede retraer a solo iconos con el botón de la cabecera (el estado se recuerda en el navegador). Las tablas se desplazan horizontalmente y los formularios pasan a una columna.

## API

Todas las rutas de dominio exigen sesión activa (`requireAuth`). Los endpoints devuelven JSON en camelCase. Las rutas marcadas **admin** además exigen rol de administrador (`requireAdmin`) y responden `403` al resto de usuarios.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Acceso local de administrador |
| `GET` | `/api/auth/google` | Inicia OAuth con Google |
| `GET` | `/api/auth/google/callback` | Retorno de Google |
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
| `POST` | `/api/tableros/:id/tareas` | Crea una tarea |
| `PATCH` | `/api/tableros/:id/tareas/:tareaId` | Mueve o edita una tarea |
| `DELETE` | `/api/tableros/:id/tareas/:tareaId` | Elimina una tarea (**admin** o **docente**) |
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

Los errores se devuelven como `{ "error": "mensaje" }`; los fallos de validación con zod añaden `detalles` por campo. Cuerpos principales:

- `POST /api/auth/login`: `{ "email", "password" }`.
- `PATCH /api/auth/me`: `{ "nombre": "…", "fotoUrl": "https://…" | null }`.
- `POST /api/documentos` (`multipart/form-data`): campos `proyectoId`, `tipo`, `nombre`, `version`, `estado` y archivo `archivo`.
- `POST /api/tableros`: `{ "nombre", "descripcion" }`.
- `POST /api/tableros/:id/tareas`: `{ "titulo", "descripcion", "columna", "responsableId": "uuid" | null, "prioridad", "fechaLimite", "etiqueta" }`. `responsableId` debe ser un usuario activo; al asignarlo, el nombre mostrado se toma de la cuenta.
- `PATCH /api/tableros/:id/tareas/:tareaId`: acepta los mismos campos, incluido `responsableId` (`null` para dejar la tarea sin asignar).
- `POST /api/tableros/:id/tareas/:tareaId/comentarios`: `{ "contenido": "…" }` (máximo 2000 caracteres).
- `POST /api/tableros/:id/tareas/:tareaId/adjuntos` (`multipart/form-data`): campo `archivo` con un único archivo de hasta 20 MB.
- `POST`/`PATCH /api/calendario/eventos`: `{ "titulo", "descripcion", "fechaInicio", "fechaFin", "todoElDia" }`, con fechas en ISO 8601.
- `POST /api/usuarios`: `{ "email", "nombre", "rol", "password" }` (contraseña de 8 a 72 caracteres, hash bcrypt de 12 rondas).
- `PATCH /api/usuarios/:id`: `{ "nombre"?, "rol"?, "activo"? }`.

## Autenticación

- **Administrador local:** correo y contraseña con hash bcrypt (12 rondas), definidos por variables de entorno.
- **Cuentas de Google:** inicio de sesión con Google; la cuenta se crea automáticamente en el primer acceso con rol `usuario`. Por ahora se acepta cualquier cuenta; para restringir, asigna un dominio en `ALLOWED_DOMAIN`.
- **Roles:** `admin`, `docente`, `estudiante` y `usuario`. Solo `admin` ve y usa el módulo **Usuarios** y las rutas `/api/usuarios` de administración; el resto recibe `403`. Cualquier usuario autenticado puede consultar `/api/usuarios/asignables` para asignar tareas.
- **Colaboración:** cualquier sesión puede crear tareas, comentar y adjuntar archivos. Solo `admin` y `docente` pueden eliminar tareas; cada comentario o adjunto solo lo puede borrar quien lo subió o un `admin`.
- Las cuentas desactivadas no pueden iniciar sesión.
- La sesión viaja en una cookie `httpOnly` `rap_sid`; solo se guarda el hash SHA-256 del token en la tabla `sesiones`.

Detalle completo en [docs/AUTENTICACION.md](docs/AUTENTICACION.md) y [docs/BASE_DE_DATOS.md](docs/BASE_DE_DATOS.md).

## Estado

- Login RAP-16 probado de extremo a extremo: acceso local, sesión, rutas protegidas y cierre de sesión.
- Dominio modelado en PostgreSQL, **sin datos de ejemplo**: se llenará con los documentos institucionales nuevos.
- Dashboard, tableros, proyectos, seguimiento, antecedentes, informes, documentos, calendario, usuarios y perfil conectados a la API, con estados vacíos.
- Administración de usuarios probada de extremo a extremo: alta local, cambio de rol, activación/desactivación, protección del último administrador y respuesta `403` para no administradores.
- Asignación real de tareas probada: creación con responsable, avatares, filtros por persona y edición desde la API.
- Seguimiento progresivo probado: fecha de finalización al mover a **Completado**, porcentaje general, avance por persona y ritmo semanal.
- Comentarios y adjuntos probados de extremo a extremo: publicación y borrado, subida, descarga con sesión, límites de formato y tamaño, y permisos por autor/rol.
- Notificaciones de tareas próximas a vencer y calendario personal probados de extremo a extremo (alta, edición y eliminación de eventos).
- Interfaz responsiva con barra lateral desplegable en móvil y retráctil en escritorio.
- Carga y descarga de archivos documentales probada de extremo a extremo (límite 20 MB, formatos permitidos, control de sesión y limpieza de archivos ante errores).
- Pendiente: cargar los documentos definitivos, edición de la ficha FR-019 y manual de usuario en Word.
