# Ingenieria-SEI · Módulo Gestión de Proyectos (PMO)

Plataforma de gestión de proyectos para el entorno institucional, organizada en tres capas sobre un solo repositorio.

## Estructura

```
.
├── src/          Frontend React 19 + Vite 8 + Tailwind 4 (prototipo PMO)
├── backend/      API REST · Node + Express + TypeScript + pg + zod
├── database/     PostgreSQL 16 · esquema, auditoría, vistas y seed
├── docs/         Guías de base de datos, backend y frontend
└── public/       Recursos estáticos del frontend
```

## Arranque rápido

```bash
# Frontend → http://localhost:5173
npm install
npm run dev

# Backend → http://localhost:4000/api
cd backend
cp .env.example .env
npm install
npm run dev

# Base de datos (Docker)
cd database
docker compose up -d
```

Verificación del frontend: `npm run typecheck` y `npm run build`.

## Estado

- Fase 0 completada: repo unificado, prototipo portado al Vite actual y build en verde.
- Fase 1 completada: paleta naranja/gris/blanco y sidebar gris oscuro con acento naranja.
- El frontend todavía usa datos de ejemplo (`src/app/data/mock.ts`); la conexión con la API se hará por módulos.
- Documentación detallada en `docs/`.
