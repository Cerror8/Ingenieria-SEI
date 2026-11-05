# Ingeniería SEI · Universidad CESMAG

Plataforma institucional del programa de Ingeniería de Sistemas. El acceso se realiza con el login RAP-16 (administrador local o cuenta institucional de Google) y, una vez dentro, se trabaja sobre los módulos de dashboard, tableros, proyectos, seguimiento, antecedentes, informes y documentos.

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
├── src/                    Frontend (React + Vite)
│   ├── app/
│   │   ├── api/            Cliente HTTP y manejo de errores
│   │   ├── auth/           AuthProvider (contexto de sesión)
│   │   ├── components/     Componentes compartidos, PDF y notificaciones
│   │   ├── data/           Datos de ejemplo de la estructura inicial
│   │   ├── features/
│   │   │   ├── auth/       Login RAP-16
│   │   │   ├── dashboard/  Panel general
│   │   │   ├── tableros/   Tablero de trabajo estilo Monday
│   │   │   ├── projects/   Listado, creación y detalle de proyectos
│   │   │   ├── seguimiento/
│   │   │   ├── antecedentes/
│   │   │   ├── informes/
│   │   │   └── documentos/
│   │   ├── layout/         Sidebar y shell de la aplicación
│   │   └── App.tsx         Rutas pública y privada
│   └── styles/             Tema, Tailwind y fuentes
├── backend/                API REST (Express + TypeScript)
│   └── src/
│       ├── auth/           Sesiones, Google OAuth y admin local
│       └── routes/         Endpoints de autenticación
├── database/               Docker Compose y esquema inicial
├── docs/                   Documentación técnica
└── public/                 Recursos estáticos (escudo institucional)
```

## Requisitos

- Node.js 20 o superior
- Docker Desktop en ejecución
- Credenciales OAuth de Google (opcionales; el login local funciona sin ellas)

## Arranque rápido

```bash
# 1. Base de datos
npm run db:up

# 2. Backend (primera vez)
cd backend
cp .env.example .env
npm install
npm run dev          # http://localhost:4000/api

# 3. Frontend (en otra terminal, desde la raíz)
npm install
npm run dev          # http://localhost:5173
```

El backend crea automáticamente el administrador local al arrancar si no existe.

Credenciales de desarrollo:

```
Correo:     admin@unicesmag.edu.co
Contraseña: Admin12345!
```

> Cambia `ADMIN_EMAIL` y `ADMIN_PASSWORD` en `backend/.env` antes de desplegar.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Frontend en desarrollo |
| `npm run typecheck` | Verificación de tipos del frontend |
| `npm run build` | Build de producción |
| `npm run db:up` / `npm run db:down` | Levanta / detiene PostgreSQL |
| `npm run backend` | Backend en modo watch |

## Módulos actuales

- **Dashboard:** indicadores generales, estados, avance y alertas.
- **Tableros:** asignación de trabajo estilo Monday/Brix24 con columnas, arrastrar y soltar, responsables, prioridades y fechas. Por ahora guarda en `localStorage`; la persistencia en PostgreSQL queda para la siguiente fase.
- **Proyectos:** listado, creación guiada y detalle con ficha, Gantt, presupuesto, indicadores, documentos e historial.
- **Seguimiento, antecedentes, informes y documentos:** estructura base heredada del prototipo, lista para conectar datos reales.

## Autenticación

- **Administrador local:** correo y contraseña con hash bcrypt (12 rondas), definidos por variables de entorno.
- **Usuarios institucionales:** inicio de sesión con Google; la cuenta se crea automáticamente en el primer acceso con rol `usuario` y se restringe a `ALLOWED_DOMAIN`.
- La sesión viaja en una cookie `httpOnly` `rap_sid`; solo se guarda el hash SHA-256 del token en la tabla `sesiones`.

Detalle completo en [docs/AUTENTICACION.md](docs/AUTENTICACION.md) y [docs/BASE_DE_DATOS.md](docs/BASE_DE_DATOS.md).

## Estado

- Estructura de módulos restaurada y renombrada a Ingeniería SEI.
- Login RAP-16 probado de extremo a extremo: acceso local, sesión, rutas protegidas y cierre de sesión.
- Tablero de trabajo funcional con alta, movimiento y eliminación de tareas.
- Pendiente: conectar tableros y módulos a la API/PostgreSQL, construir el modelo RAP y elaborar el manual de usuario en Word.
