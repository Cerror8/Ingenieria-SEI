# Ingeniería SEI · Universidad CESMAG

Página web para Ingeniería Civil. El acceso se realiza con el login RAP-16 (administrador local o cuenta institucional de Google) y, una vez dentro, se trabaja sobre los módulos de dashboard, tableros, proyectos, seguimiento, antecedentes, informes y documentos.

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 19 · Vite 8 · Tailwind CSS 4 · React Router 7 · Lucide · Recharts |
| Backend | Node + Express 4 · TypeScript · pg · zod · bcryptjs |
| Base de datos | PostgreSQL 16 en Docker (puerto host **5433**) |
| Autenticación | Sesión opaca en cookie `httpOnly` + OAuth 2.0 con Google |

## Estructura

```
.
├── frontend/               Aplicación React (Vite + Tailwind)
│   ├── public/             Recursos estáticos (escudo institucional)
│   └── src/
│       ├── app/
│       │   ├── api/        Cliente HTTP y manejo de errores
│       │   ├── auth/       AuthProvider (contexto de sesión)
│       │   ├── components/ Componentes compartidos, PDF y notificaciones
│       │   ├── constants/  Navegación y configuración visual
│       │   ├── data/       Datos estáticos de gráficas
│       │   ├── features/
│       │   │   ├── auth/         Login RAP-16
│       │   │   ├── dashboard/    Panel general
│       │   │   ├── tableros/     Tablero de trabajo estilo Monday
│       │   │   ├── projects/     Listado, creación y detalle de proyectos
│       │   │   ├── seguimiento/
│       │   │   ├── antecedentes/
│       │   │   ├── informes/
│       │   │   └── documentos/
│       │   ├── layout/     Sidebar desplegable y shell de la aplicación
│       │   └── App.tsx     Rutas pública y privada
│       └── styles/         Tema, Tailwind y fuentes
├── backend/                API REST (Express + TypeScript)
│   ├── src/
│   │   ├── auth/           Sesiones, Google OAuth y admin local
│   │   ├── routes/         Endpoints de autenticación y dominio
│   │   ├── db.ts           Pool de PostgreSQL
│   │   └── app.ts          Composición de la API
│   └── .env.example
├── database/               Docker Compose y scripts SQL de inicialización
│   └── init/
│       ├── 01_schema.sql   Usuarios y sesiones
│       ├── 02_dominio.sql  Proyectos, tableros, RAP y auditoría
│       └── 03_seed.sql     Sin datos de ejemplo (base vacía)
├── docs/                   Documentación técnica
└── README.md
```

## Requisitos

- Node.js 20 o superior
- Docker Desktop en ejecución
- Credenciales OAuth de Google (opcionales; el login local funciona sin ellas)

## Arranque rápido

```bash
# 1. Base de datos (desde la raíz)
npm run db:up

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
| `npm run db:up` / `npm run db:down` | Levanta / detiene PostgreSQL |

## Módulos

- **Dashboard:** KPIs, estados, avances, ejecución presupuestal y alertas calculados desde la API.
- **Tableros:** tablero estilo Monday con columnas, arrastrar y soltar, alta, movimiento y eliminación de tareas persistidas en PostgreSQL. Si la base está vacía, permite crear el primer tablero. En móvil el movimiento se hace desde un selector por tarjeta.
- **Proyectos:** listado y detalle alimentados por la API; creación guiada de cinco pasos que registra el proyecto y vuelve a abrir su detalle.
- **Seguimiento:** tarjetas de avance técnico y presupuestal por proyecto activo.
- **Antecedentes:** proyectos finalizados agrupados por línea y documentos del repositorio con búsqueda y filtros.
- **Informes:** generación de informes (se registran en la base) e historial paginado desde la API.
- **Documentos:** repositorio documental con filtros por categoría.

La interfaz es responsiva: debajo de `lg` la barra lateral se abre como panel deslizante con botón hamburguesa, las tablas se desplazan horizontalmente y los formularios pasan a una columna.

## API

Todas las rutas de dominio exigen sesión activa (`requireAuth`). Los endpoints devuelven JSON en camelCase.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Acceso local de administrador |
| `GET` | `/api/auth/google` | Inicia OAuth con Google |
| `GET` | `/api/auth/google/callback` | Retorno de Google |
| `GET` | `/api/auth/me` | Usuario de la sesión |
| `POST` | `/api/auth/logout` | Cierra la sesión |
| `GET` | `/api/salud` | Verificación de conexión a la base |
| `GET` | `/api/dashboard` | KPIs y series del panel |
| `GET` | `/api/proyectos` · `GET /api/proyectos/:id` | Listado y detalle |
| `POST` | `/api/proyectos` | Crea un proyecto |
| `GET` | `/api/indicadores` | Indicadores (filtro `?proyecto=`) |
| `GET` | `/api/documentos` | Documentos (filtros `?proyecto=` y `?tipo=`) |
| `GET` | `/api/informes` · `POST /api/informes` | Historial y generación |
| `GET` | `/api/auditoria` | Bitácora (filtro `?registro=`) |
| `GET` | `/api/tableros` · `GET /api/tableros/:id` | Tableros y tareas |
| `POST` | `/api/tableros` | Crea un tablero |
| `POST` | `/api/tableros/:id/tareas` | Crea una tarea |
| `PATCH` | `/api/tableros/:id/tareas/:tareaId` | Mueve o edita una tarea |
| `DELETE` | `/api/tableros/:id/tareas/:tareaId` | Elimina una tarea |

## Autenticación

- **Administrador local:** correo y contraseña con hash bcrypt (12 rondas), definidos por variables de entorno.
- **Usuarios institucionales:** inicio de sesión con Google; la cuenta se crea automáticamente en el primer acceso con rol `usuario` y se restringe a `ALLOWED_DOMAIN`.
- La sesión viaja en una cookie `httpOnly` `rap_sid`; solo se guarda el hash SHA-256 del token en la tabla `sesiones`.

Detalle completo en [docs/AUTENTICACION.md](docs/AUTENTICACION.md) y [docs/BASE_DE_DATOS.md](docs/BASE_DE_DATOS.md).

## Estado

- Login RAP-16 probado de extremo a extremo: acceso local, sesión, rutas protegidas y cierre de sesión.
- Dominio modelado en PostgreSQL, **sin datos de ejemplo**: se llenará con los documentos institucionales nuevos.
- Dashboard, tableros, proyectos, seguimiento, antecedentes, informes y documentos conectados a la API, con estados vacíos.
- Interfaz responsiva con barra lateral desplegable en móvil y tableta.
- Pendiente: cargar los documentos definitivos, edición de la ficha FR-019, carga real de archivos y manual de usuario en Word.
