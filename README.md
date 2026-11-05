# Ingenieria-SEI · Sistema RAP CESMAG

Sistema de gestión de Resultados de Aprendizaje (RAP) para el programa de Ingeniería de Sistemas de la Universidad CESMAG. Autenticación con cuenta institucional de Google y acceso administrativo local.

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 19 · Vite 8 · Tailwind CSS 4 · React Router 7 · Lucide |
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
│   │   ├── features/       Login y panel de inicio
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

## Autenticación

- **Administrador local:** correo y contraseña con hash bcrypt (12 rondas), definidos por variables de entorno.
- **Usuarios institucionales:** inicio de sesión con Google; la cuenta se crea automáticamente en el primer acceso con rol `usuario` y se restringe a `ALLOWED_DOMAIN`.
- La sesión viaja en una cookie `httpOnly` `rap_sid`; solo se guarda el hash SHA-256 del token en la tabla `sesiones`.

Detalle completo de configuración, endpoints y despliegue en [docs/AUTENTICACION.md](docs/AUTENTICACION.md) y [docs/BASE_DE_DATOS.md](docs/BASE_DE_DATOS.md).

## Estado

- Repo unificado con frontend, backend y base de datos.
- Módulo PMO anterior eliminado por completo.
- Login RAP-16 (ADMIN) implementado y probado de extremo a extremo.
- Pendiente: módulos de resultados de aprendizaje, tableros de asignación de trabajo estilo Monday/Brix24, informes y documentación de usuario en Word.
