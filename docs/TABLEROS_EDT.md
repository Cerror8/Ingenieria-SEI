# Tableros, fases y tareas EDT

Este documento describe cómo se conectan el checklist EDT, los tableros y las tareas después del ajuste de noviembre de 2026.

## Modelo general

```
Proyecto
├── tipo_contrato: Obra | Interventoría
├── 3 fases principales + fases adicionales (edt_fases)
│   └── 1 tablero automático por fase (tableros.tipo = 'Fase')
├── actividades / documentos / actas (edt_actividades)
│   ├── requisitos previos (edt_requisitos)
│   ├── documentos cargados (documentos.edt_actividad_id)
│   └── 1 tarea asignable por actividad (tareas_tablero.edt_actividad_id)
└── tableros manuales opcionales (tableros.tipo = 'Manual')
```

- **La fase es un tablero**: cada fase del EDT tiene un tablero propio, creado automáticamente con nombre `F1 · Etapa precontractual`, etc.
- **La actividad es una tarjeta**: al crear o sembrar una actividad se crea su tarea en el tablero de la fase, con título, descripción, prioridad, fecha límite, responsable y etiqueta `F1 · Documento`.
- **El tablero general no es una tabla**: es una vista de consulta que reúne todas las tareas de todas las fases y tableros del sistema o de un proyecto/fase concreta.
- **Mi tablero no duplica tareas**: consulta `tareas_tablero` filtrando por `responsable_id = usuario de la sesión`.

## Tipos de tablero y de tarjeta

| `tableros.tipo` | Origen | Uso |
|---|---|---|
| `Fase` | Automático al crear el proyecto o una fase nueva | Tablero de la fase EDT. |
| `Manual` | Alta manual del usuario | Tablero libre, sin fase asociada. |

| `edt_actividades.tipo` | Tarjeta | Documento obligatorio |
|---|---|---|
| `Actividad` | Trabajo de gestión o verificación | Solo si `requiere_documento = true`. |
| `Documento` | Entregable documental | Sí. |
| `Acta` | Acta o documento formal | Sí. |

La columna del tablero se deriva del estado del EDT: `No realizado → por-hacer`, `En ejecución → en-curso`, `Completado → completado`. La columna `en-revision` se usa para el flujo de aprobación de tareas.

## Tablero general (Tableros)

`GET /api/tableros/general?proyectoId=&faseId=` devuelve:

- `tareas`: todas las tareas con `proyectoId`, `proyectoNombre`, `faseId`, `faseNombre`, `tableroTipo`, `edtActividadId`, `edtEstado`, etc.
- `tableros`: la lista de tableros con su conteo de tareas.
- `proyectos`: los proyectos que tienen tareas.

La pantalla **Tableros** abre por defecto en la vista **Tablero general de proyectos**. Incluye:

- Chips **TABLERO GUÍA** agrupados por proyecto para saltar a un tablero de fase.
- Selector de tablero: `Tablero general (todos los proyectos)` o un tablero concreto.
- Búsqueda por tarea, proyecto, fase o responsable.
- Filtros por **proyecto**, **fase**, **prioridad** y **responsable**.
- Leyenda de urgencia y tarjetas con fecha límite, tiempo restante y color de borde.
- Botón **Entendido, iniciar tarea** para que la persona asignada confirme que la recibió antes de pasar a **En curso**.
- En modo tablero de fase, botón **Nueva tarea** y acciones de gestión según permisos.

## Tablero por fase (pestaña EDT del proyecto)

La pestaña **EDT** muestra las fases como tableros, no como acordeones ni desplegables:

- Encabezado de fase con avance, número de actividades y acciones para renombrar o eliminar (solo fases adicionales).
- Tarjetas de actividad con tipo, prioridad, responsable, fecha, documentos y requisitos.
- Botones de acción por tarjeta: editar, eliminar, cargar documento y cambiar estado.
- Botón **Nueva actividad** dentro de cada fase y **Nueva fase** para agregar fases enlazadas a la anterior.
- Bloqueos visibles: **REQUISITOS PREVIOS**, **Falta documento** y el aviso de carga obligatoria.

Las tres fases principales se pueden **renombrar** pero no eliminar. Las fases adicionales guardan `depende_de_fase_id` y se muestran como tableros conectados a la fase anterior.

## Mi tablero

`GET /api/mi-tablero` devuelve `tareasProyecto` (tareas de tablero asignadas), `tareasPersonales` (tareas propias) y `proyectos` (proyectos con tareas del usuario).

La vista **Mi tablero**:

- Muestra primero **todos los proyectos** juntos.
- Ofrece el filtro **Filtrar por proyecto**, que solo lista proyectos con tareas del usuario.
- Separa visualmente tareas de proyecto y tareas personales.
- Usa la misma urgencia y colores del tablero general.

## Sincronización EDT ↔ tablero

La sincronización es bidireccional y se apoya en `backend/src/lib/avance.ts`:

1. **EDT → tarea**: al crear o editar una actividad se crea o actualiza su tarea (`crearTareaActividad`, `sincronizarTareasDeActividad`). Se sincronizan título, descripción, prioridad, fecha límite, responsable, etiqueta y columna.
2. **Tarea → EDT**: al mover, aprobar, devolver o eliminar una tarea se llama `sincronizarEdtDesdeTareas`. La actividad sube de estado según sus tareas y sus subproductos.
3. **Asignación**: asignar un responsable en el tablero actualiza `responsable_id` de la tarea y de la actividad EDT; la tarea aparece en **Mi tablero** de esa persona.
4. **Aprobación bloqueada**: no se puede aprobar una tarea vinculada si la actividad EDT exige documento y no lo tiene, o si tiene requisitos previos pendientes (`bloqueoParaCompletar`). El error indica cargar el documento o completar los requisitos en la pestaña EDT.
5. **Avance del proyecto**: se recalcula desde el EDT (promedio de actividades raíz; un padre con subproductos vale el promedio de sus hijos). Si no hay EDT, usa el Gantt; sin ninguno, conserva el avance manual.

## Documentos vinculados

- La carga desde el EDT envía `edtActividadId` y opcionalmente `carpeta`.
- La carga desde **Documentos** también puede asociar `edtActividadId`.
- `GET /api/documentos?edtActividadId=...` filtra los documentos de una actividad.
- El documento queda visible en los dos lugares: en la tarjeta de la actividad y en **Documentos** con la ruta de su carpeta.
- La carpeta debe pertenecer a la estructura documental del proyecto; si la actividad tenía carpeta sugerida, se usa esa.
- Los documentos obligatorios alimentan las reglas de completado y de aprobación.

## Urgencia y colores

`frontend/src/app/lib/urgencia.ts` calcula el nivel según la fecha límite, evaluada al final del día:

| Nivel | Condición | Color | Etiqueta |
|---|---|---|---|
| Verde | Más de 30 días | `emerald` | A tiempo |
| Azul | 15–30 días | `sky` | Programada |
| Amarillo | 8–14 días | `amber` | Próxima |
| Naranja | 4–7 días | `orange` | Esta semana |
| Rojo | 1–3 días | `rose` | Urgente |
| Morado | Vencida | `purple` | Vencida |
| Gris | Sin fecha | `slate` | Sin fecha |

El texto restante usa:

- **Horas** si faltan menos de 48 horas.
- **Días** si faltan menos de 14 días.
- **Semanas** en los demás casos.
- Para vencidas: **“Vencida hace N días”** o **“Vencida hace menos de un día”**.

El color se aplica al borde izquierdo de la tarjeta, al punto de la columna y al badge de la fecha.

## API relacionada

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/api/tableros` | Lista de tableros. |
| `GET` | `/api/tableros/general` | Vista general con filtros `proyectoId` y `faseId`. |
| `GET` | `/api/tableros/:id` | Tablero con sus tareas. |
| `POST` | `/api/tableros/:id/tareas` | Crea una tarea (incluye `edtActividadId` opcional). |
| `PATCH` | `/api/tableros/tareas/:id` | Edita tarea, incluye `columna`, `responsableId` y `edtActividadId`. |
| `GET` | `/api/mi-tablero` | Tareas asignadas, tareas personales y proyectos del usuario. |
| `GET` | `/api/edt/:proyectoId` | Fases y actividades con requisitos y conteos. |
| `POST` | `/api/edt/:proyectoId` | Crea actividad y su tarea. |
| `POST` | `/api/edt/:proyectoId/plantilla` | Siembra el checklist del tipo de contrato. |
| `GET` | `/api/documentos?edtActividadId=...` | Documentos de una actividad. |

## Verificación local

La integración se verificó con un entorno aislado (API 4100, Vite 5200, PGlite 5434 y base de prueba), sin tocar los servidores de desarrollo del usuario ni la base de producción:

- Creación de proyectos de obra e interventoría con siembra de 47 y 48 actividades.
- Tres tableros de fase por proyecto y tablero general con filtros.
- Documento cargado desde el EDT visible en la actividad y en **Documentos**.
- Bloqueo por requisitos previos y por documento obligatorio.
- Asignación de tarea sincronizada con responsable del EDT y con **Mi tablero**.
- Aprobación bloqueada cuando la actividad EDT no puede completarse.
- Filtro por proyecto en **Mi tablero**, con todos los proyectos como vista inicial.
