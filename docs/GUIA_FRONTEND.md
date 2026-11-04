# Guía · Frontend (React + Vite)

## 1. Arranque
```bash
cd frontend && cp .env.example .env && npm install && npm run dev      # http://localhost:5173
npm run build        # compilar
npm run typecheck    # tipos
```

## 2. Qué cambió respecto a tu Figma Make
El `App.tsx` de ~2.800 líneas se dividió **sin cambiar el diseño**:
```
src/app/
  App.tsx                          shell: estado de navegación, toast, modales
  types.ts · constants.ts          tipos y configuración visual/estados
  data/mock.ts · data/charts.ts    datos de ejemplo (se irán reemplazando por la API)
  api/client.ts                    cliente HTTP al backend (ya listo)
  lib/format.ts · components/      utilidades y componentes compartidos (Toast, PDFModal, shared)
  layout/Sidebar.tsx
  features/
    dashboard/ · antecedentes/ · informes/ · seguimiento/ · documentos/
    projects/pages/                ProjectsList, CreateProject (wizard), ProjectDetail (12 pestañas)
    projects/components/           ProjectCreatedModal
```
También: se quitó la dependencia de `peerDependencies` (React 18 ahora es dependencia normal), se añadió `index.html`, `main.tsx`, `tsconfig.json` y la tipografía pasó a **Inter**, como pide tu especificación.

## 3. Orden recomendado para conectar la API (de menor a mayor riesgo)
1. **Catálogos** (`api.catalogos()`): líneas, dependencias, ODS y antecedentes para los selects del wizard.
2. **Lista de proyectos** → `api.listarProyectos()` y **Dashboard general** (crea `GET /proyectos/_global/resumen`, ya existe).
3. **Crear proyecto** (paso 1) → `api.crearProyecto()`; muestra los errores 400/409 bajo cada campo (el backend devuelve `detalles` por campo).
4. **Detalle + ficha FR-019** → `api.obtenerProyecto()` + `api.ficha()`; reemplaza los `defaultValue` por el estado cargado (así la edición **conserva la información**, Frame 10) y "Guardar sección" → `api.guardarFicha()` enviando solo la sección.
5. **Seguimiento, Gantt, presupuesto**: cada acción llama a la API y luego **vuelve a pedir** `api.dashboard()` para actualizar KPI/gráficos (Frame 15).
6. **Auditoría, documentos, informes**.

Sugerencia técnica: instala `@tanstack/react-query`. Tras cada `mutation`, `invalidateQueries(['proyecto', codigo])` refresca KPI, gráfico, avance y estado de una vez.

## 4. Brechas del prototipo frente a tu especificación (pendientes)
- El wizard no incluye los pasos **Actividades, Gantt ni Presupuesto** del flujo 1 (hoy solo están dentro del proyecto).
- Gantt: faltan **dependencias visibles** entre actividades y edición; los hitos ya se muestran.
- Frame 03: el modal "Asociar antecedente" no muestra el toast de confirmación; filtros de búsqueda sin funcionalidad.
- Frame 10: la pestaña Ficha usa `defaultValue` (no conserva datos) → se resuelve en el paso 4.
- Colores `#1B3C6B` y grises fijos en las clases: muévelos a variables de `theme.css` y usa los componentes de `components/ui` para mantener un solo Design System.
- Rutas: pasar de `useState(view)` a **react-router** (`/proyectos`, `/proyectos/nuevo`, `/proyectos/:codigo/:pestana`) para que cada pestaña tenga URL y el botón "atrás" funcione.
- Variantes de botones (Hover/Disabled/Loading/Success/Error) como componente único.

## 5. Nota sobre números
El backend ya devuelve números como `number` y fechas como `"YYYY-MM-DD"`; formatea moneda con `fmt()` de `lib/format.ts`.
