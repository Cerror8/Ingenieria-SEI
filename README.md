# Ingeniería SEI · Universidad CESMAG

Página web para Ingeniería Civil. El acceso se realiza con el login RAP-16 (administrador local o cuenta de Google) y, una vez dentro, se trabaja sobre los módulos de dashboard, tableros, calendario, proyectos, seguimiento, antecedentes, informes y documentos.

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
│       │   ├── constants/  Navegación y configuración visual
│       │   ├── lib/        Utilidades de formato
│       │   ├── features/
│       │   │   ├── auth/         Login RAP-16
│       │   │   ├── dashboard/    Panel general
│       │   │   ├── tableros/     Tablero de trabajo estilo Monday
│       │   │   ├── projects/     Listado, creación y detalle de proyectos
│       │   │   ├── calendario/   Agenda personal y fechas límite
│       │   │   ├── perfil/       Personalización del perfil
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

```bash
# 1. Base de datos y Adminer (desde la raíz)
npm run db:up          # PostgreSQL en :5433 y Adminer en http://localhost:8081

# 2. Backend (primera vez)
cd backend
cp .env.example .env
npm install
npm run dev          # http://localhost:4000/api

# 3. Frontend (en otra terminal)
cd frontend
cp .env.example .env
npm install
npm run dev          # http://localhost:5173
```

También puedes usar los scripts de la raíz: `npm run backend` y `npm run dev`.

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
- **Tableros:** tablero estilo Monday con columnas, arrastrar y soltar, alta, movimiento y eliminación de tareas persistidas en PostgreSQL. La prioridad se distingue por color (alta = rojo, media = ámbar, baja = azul claro). Si la base está vacía, permite crear el primer tablero. En móvil el movimiento se hace desde un selector por tarjeta.
- **Proyectos:** listado y detalle alimentados por la API; creación guiada de cinco pasos que registra el proyecto y vuelve a abrir su detalle.
- **Seguimiento:** tarjetas de avance técnico y presupuestal por proyecto activo.
- **Antecedentes:** proyectos finalizados agrupados por línea y documentos del repositorio con búsqueda y filtros.
- **Informes:** generación mediante el modal de informe (queda registrada en la base) e historial de informes desde la API.
- **Documentos:** repositorio documental con filtros por categoría y carga real de archivos (PDF, Word, Excel, PowerPoint, imágenes y texto hasta 20 MB). Los archivos se guardan en `backend/uploads/` y los metadatos en PostgreSQL; ver y descargar exige sesión activa.
- **Calendario:** mes navegable que muestra las fechas límite de las tareas y la agenda personal de cada usuario (reuniones y eventos propios, de día completo o con horario). Permite crear, editar y eliminar eventos (doble clic en un día abre el formulario); las tareas se consultan pero no se modifican desde aquí.
- **Perfil y notificaciones:** menú de usuario con acceso al perfil (nombre y foto personalizables, conservados aunque se vuelva a entrar con Google) y cierre de sesión. La campana lista las tareas vencidas o que vencen en los próximos 7 días, ordenadas por fecha y prioridad.

La interfaz es responsiva: debajo de `lg` la barra lateral se abre como panel deslizante con botón hamburguesa y, en escritorio, se puede retraer a solo iconos con el botón de la cabecera (el estado se recuerda en el navegador). Las tablas se desplazan horizontalmente y los formularios pasan a una columna.

## API

Todas las rutas de dominio exigen sesión activa (`requireAuth`). Los endpoints devuelven JSON en camelCase.

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
| `DELETE` | `/api/tableros/:id/tareas/:tareaId` | Elimina una tarea |
| `GET` | `/api/notificaciones` | Tareas vencidas o que vencen en los próximos 7 días |
| `GET` | `/api/calendario?desde=&hasta=` | Tareas con fecha límite y eventos propios del rango |
| `POST` | `/api/calendario/eventos` | Crea un evento personal |
| `PATCH` | `/api/calendario/eventos/:id` | Edita un evento propio |
| `DELETE` | `/api/calendario/eventos/:id` | Elimina un evento propio |

Los errores se devuelven como `{ "error": "mensaje" }`; los fallos de validación con zod añaden `detalles` por campo. Cuerpos principales:

- `POST /api/auth/login`: `{ "email", "password" }`.
- `PATCH /api/auth/me`: `{ "nombre": "…", "fotoUrl": "https://…" | null }`.
- `POST /api/documentos` (`multipart/form-data`): campos `proyectoId`, `tipo`, `nombre`, `version`, `estado` y archivo `archivo`.
- `POST /api/tableros`: `{ "nombre", "descripcion" }`.
- `POST /api/tableros/:id/tareas`: `{ "titulo", "descripcion", "columna", "responsable", "prioridad", "fechaLimite", "etiqueta" }`.
- `POST`/`PATCH /api/calendario/eventos`: `{ "titulo", "descripcion", "fechaInicio", "fechaFin", "todoElDia" }`, con fechas en ISO 8601.

## Autenticación

- **Administrador local:** correo y contraseña con hash bcrypt (12 rondas), definidos por variables de entorno.
- **Cuentas de Google:** inicio de sesión con Google; la cuenta se crea automáticamente en el primer acceso con rol `usuario`. Por ahora se acepta cualquier cuenta; para restringir, asigna un dominio en `ALLOWED_DOMAIN`.
- La sesión viaja en una cookie `httpOnly` `rap_sid`; solo se guarda el hash SHA-256 del token en la tabla `sesiones`.

Detalle completo en [docs/AUTENTICACION.md](docs/AUTENTICACION.md) y [docs/BASE_DE_DATOS.md](docs/BASE_DE_DATOS.md).

## Estado

- Login RAP-16 probado de extremo a extremo: acceso local, sesión, rutas protegidas y cierre de sesión.
- Dominio modelado en PostgreSQL, **sin datos de ejemplo**: se llenará con los documentos institucionales nuevos.
- Dashboard, tableros, proyectos, seguimiento, antecedentes, informes, documentos, calendario y perfil conectados a la API, con estados vacíos.
- Notificaciones de tareas próximas a vencer y calendario personal probados de extremo a extremo (alta, edición y eliminación de eventos).
- Interfaz responsiva con barra lateral desplegable en móvil y retráctil en escritorio.
- Carga y descarga de archivos documentales probada de extremo a extremo (límite 20 MB, formatos permitidos, control de sesión y limpieza de archivos ante errores).
- Pendiente: cargar los documentos definitivos, edición de la ficha FR-019 y manual de usuario en Word.
