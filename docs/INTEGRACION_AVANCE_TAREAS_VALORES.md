# Avance automático, tareas–EDT y otros valores del proyecto

Fecha: 2026-11-11 · Alcance: puntos (a), (b) y (c) de la revisión de seguimiento, más la integración de tareas con el EDT, los responsables reales y la asignación desde tableros.

## 1. Avance automático del proyecto (a)

### 1.1 Precedencia de la fuente

El avance técnico de un proyecto se calcula con esta prioridad:

| Prioridad | Fuente | Condición | `proyectos.avance_origen` |
|---|---|---|---|
| 1 | EDT | El proyecto tiene al menos una actividad EDT | `EDT` |
| 2 | Gantt | No hay EDT y existen actividades de cronograma | `Gantt` |
| 3 | Manual | No hay EDT ni Gantt | `Manual` |

Cuando no hay actividades, se conserva el último porcentaje y el control vuelve a ser manual.

### 1.2 Fórmulas

- Estados EDT: `Completado = 100`, `En ejecución = 50`, `No realizado = 0` (cualquier otro valor cuenta como 0).
- Actividad raíz con subproductos: su valor es el promedio simple de sus hijos, calculado recursivamente.
- Avance EDT: promedio simple de las actividades raíz, redondeado y acotado a `0..100`.
- Avance Gantt: promedio simple del campo `avance` de todas las actividades, redondeado y acotado a `0..100`.
- El cálculo vive en `backend/src/lib/avance.ts` (`recalcularAvanceProyecto`).

### 1.3 Cuándo se recalcula

- Crear, editar o eliminar una actividad EDT (`POST/PATCH/DELETE /api/edt/...`) y al completar la plantilla de tres etapas (`POST /api/edt/:proyectoId/plantilla`).
- Crear, editar o eliminar una actividad del Gantt (`/api/proyectos/:id/actividades`).
- Crear una tarea vinculada al EDT, cambiar su vínculo, confirmar inicio, enviar a revisión, aprobar, devolver o eliminar la tarea (vía `sincronizarEdtDesdeTareas`).

Un cambio manual del avance (`PATCH /api/proyectos/:id` con `avance`) marca el origen como `Manual`, pero si el proyecto tiene EDT o Gantt, el siguiente recálculo lo reemplaza por el valor automático. En la práctica, el control manual solo persiste en proyectos sin actividades.

### 1.4 Interfaz

En el detalle del proyecto, pestaña **Seguimiento**, se muestra una insignia junto a "Actualizar avance técnico":

- `Automático desde EDT`
- `Automático desde Gantt`
- `Manual` (con deslizador y botón para guardar)

Con origen automático el deslizador se oculta y aparece una explicación: el avance se calcula con el promedio de las actividades y las tareas aprobadas vinculadas; se cambia actualizando esos estados. Si se eliminan todas las actividades, vuelve el control manual.

## 2. Tareas vinculadas a actividades del EDT

### 2.1 Datos

- `tareas_tablero.edt_actividad_id UUID REFERENCES edt_actividades(id) ON DELETE SET NULL`.
- Una tarea puede vincularse solo a una actividad del **mismo proyecto** de la tarea; el backend lo valida (`resolverEdtActividad`).
- Si se elimina la actividad EDT, la tarea queda sin vínculo.

### 2.2 Reglas de sincronización de estado

`sincronizarEdtDesdeTareas` evalúa primero los hijos y luego las tareas:

- Actividad con subproductos: solo se recalcula si **al menos un hijo tiene tareas vinculadas**.
  - Todos los hijos `Completado` → `Completado`.
  - Algún hijo distinto de `No realizado` → `En ejecución`.
  - En otro caso no cambia.
- Actividad sin subproductos (o sin gestión por hijos):
  - Todas las tareas `completado` → `Completado`.
  - Alguna tarea distinta de `por-hacer` → `En ejecución`.
  - Todas en `por-hacer` → no cambia.
- Nunca se escribe automáticamente `No realizado`: una actividad completada permanece así hasta que se reabra a mano.
- Tras actualizar la actividad, se recalcula su padre inmediato y luego el avance del proyecto.

Se dispara al crear la tarea con vínculo, al cambiar `edtActividadId` (sincroniza la actividad anterior y la nueva), al pasar por `entendido`, `enviar-revision`, `aprobar`, `devolver` y al eliminar la tarea.

### 2.3 Interfaz de tableros

- El formulario **Nueva tarea** incluye el selector **Actividad EDT**, que carga las actividades del proyecto elegido.
- El detalle de la tarea muestra **ACTIVIDAD EDT** con la etiqueta "Sin vincular al EDT" y la ayuda "Al vincularla, el estado y el avance se sincronizan".
- Al desasignar un responsable con la tarea en curso o en revisión, la tarea regresa a **Por hacer**.

## 3. Responsables reales

| Ámbito | Campo | Origen de la lista | Observación |
|---|---|---|---|
| EDT | `edt_actividades.responsable_id` (FK a `usuarios`) | `GET /api/usuarios/asignables` | `ON DELETE SET NULL`; se conserva el texto legado `responsable` |
| Gantt | `actividades.responsable` (texto) | `GET /api/usuarios/asignables` | La interfaz guarda el nombre del usuario; si un nombre antiguo no existe, se ofrece como "(nombre anterior)" |
| Tableros | `tareas_tablero.responsable_id` (FK a `usuarios`) + `responsable` (texto espejo) | `GET /api/usuarios/asignables` | Solo el creador de la tarea o el líder del proyecto pueden cambiar la asignación (`exigirGestor`) |

Al asignar una tarea se envía una notificación al responsable (si no es quien asigna) y se registra auditoría "Asignación".

## 4. Otros valores del proyecto (b y c)

### 4.1 Modelo de datos

Tabla `proyecto_valores` (`database/init/02_dominio.sql`):

| Columna | Tipo | Regla |
|---|---|---|
| `id` | UUID | PK |
| `proyecto_id` | TEXT | FK `proyectos(id)` `ON DELETE CASCADE` |
| `valor_id` | TEXT | FK `valores_referencia(id)` `ON DELETE SET NULL` |
| `tabla_id` | TEXT | FK `valores_tablas(id)` `ON DELETE SET NULL` |
| `fila_indice` | INTEGER | Fila de origen en la tabla analizada (0-based) |
| `nombre` | TEXT | Obligatorio, máximo 200 caracteres |
| `categoria` | TEXT | `Material`, `Instrumento` u `Otro` |
| `unidad` | TEXT | Máximo 40 caracteres |
| `cantidad` | NUMERIC(14,3) | `>= 0`, máximo 1.000.000 |
| `valor_unitario` | BIGINT | `>= 0`, máximo 9.000.000.000 |
| `valor_total` | BIGINT GENERATED | `(cantidad * valor_unitario)::bigint`, redondeado y almacenado |
| `tipo_proyecto` | TEXT | Vacío = aplica a todos; con valor debe coincidir con `proyectos.linea` |
| `origen` | TEXT | `Manual` o `Tabla` (se marca `Tabla` automáticamente si llega `tablaId`) |
| `creado_por`, fechas | | Auditoría básica de creación y actualización |

Índices: `(proyecto_id, categoria)` y `(tipo_proyecto)`.

### 4.2 Filtro por tipo de proyecto (c)

Regla del servidor, aplicada tanto al listado como al resumen:

```sql
tipo_proyecto = '' OR lower(btrim(tipo_proyecto)) = lower(btrim(proyectos.linea))
```

- Un valor **sin tipo** aplica a cualquier proyecto.
- Un valor **tipado** solo aparece y suma en proyectos cuya `linea` coincida (comparación sin distinción de mayúsculas ni espacios extremos).
- Al crear, si no se envía `tipoProyecto` se toma la línea del proyecto. Si se envía uno distinto, la API responde `400` con el nombre del valor y ambos tipos.
- El mismo control se repite al editar el tipo de un valor existente.

Filtro de la interfaz (solo visual, sobre las filas ya aplicables):

- **Todas las líneas aplicables**: muestra valores sin tipo y los de la línea del proyecto.
- **Solo `<línea>`**: únicamente los tipados con la línea del proyecto.
- **Sin tipo (aplican a todos)**: únicamente los valores sin tipo.

Las tarjetas de totales y el total general usan el resumen del servidor (todos los valores aplicables), por lo que no cambian al alternar el filtro visual.

### 4.3 Resumen y comparación con el presupuesto

`resumenProyecto` devuelve:

- `total`: suma de `valor_total` de los valores aplicables.
- `porCategoria`: `{ items, total }` para Material, Instrumento y Otro.
- `presupuesto`: `proyectos.presupuesto` (valor total del contrato).
- `diferencia`: `presupuesto - total`.

En la interfaz se muestra `$X disponibles del contrato`; si la diferencia es negativa, se muestra en rojo `Excede el contrato en $X`.

La **ejecución presupuestal** del proyecto sigue calculándose con desembolsos y actas parciales. Los "otros valores" componen el presupuesto, no registran gasto ejecutado.

### 4.4 API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/proyectos/:proyectoId/valores` | Proyecto, valores aplicables y resumen |
| POST | `/api/proyectos/:proyectoId/valores` | Carga por lote de 1 a 500 ítems; valida referencias y tipo; auditoría por lote |
| PATCH | `/api/proyectos/:proyectoId/valores/:valorId` | Edita nombre, categoría, unidad, cantidad, valor unitario o tipo; esquema estricto |
| DELETE | `/api/proyectos/:proyectoId/valores/:valorId` | Elimina y devuelve el resumen actualizado |

Validaciones adicionales:

- Las referencias `valorId` y `tablaId` deben existir; si alguna ya no existe, la carga completa se rechaza con `400`.
- El valor total no se recibe: lo calcula PostgreSQL.
- Cada alta, edición o eliminación registra auditoría ("Valor de proyecto").

### 4.5 Interfaz (Presupuesto → Otros valores del proyecto)

- Tarjetas por categoría con totales y número de ítems, más tarjeta **Total valores** con la diferencia frente al contrato.
- Selector de filtro por tipo con las tres opciones descritas.
- Tabla con Valor (y origen "Registro manual" o "Importado de tabla analizada"), Categoría, Unidad, Cantidad, Valor unitario, Valor total, Tipo y acciones de editar/eliminar. El pie muestra "Total visualizado (n)".
- **Agregar valor**: diálogo con nombre, categoría, unidad, cantidad (paso 0.001), valor unitario (paso 1) y tipo (aplica a todos o solo a la línea del proyecto), con vista previa del total.
- **Importar de análisis**:
  1. Elige un archivo de referencia (se listan los archivos con tablas analizadas).
  2. Elige la hoja/tabla; si solo hay una, se selecciona sola.
  3. El mapeo de columnas se completa automáticamente por etiquetas: nombre (`nombre`, `descripción`, `material`, `insumo`, `elemento`, `concepto`), unidad (`unidad`, `und`, `un`, `um`, `medida`), cantidad (`cantidad`, `cant`, `qty`) y valor unitario (`valor unitario`, `precio unitario`, `unitario`, `vr unit`, `precio`, `valor`). Todas las columnas se pueden corregir a mano.
  4. Categoría por defecto `Material`; tipo por defecto la línea del proyecto; filtro de texto para excluir filas.
  5. Vista previa de hasta 50 filas y máximo 500 por importación. Al importar se guardan `valorId`, `tablaId` y `filaIndice`, y el origen queda como `Tabla`.
- Los valores importados pueden editarse o eliminarse igual que los manuales.

## 5. Verificación realizada

- Suite aislada contra API 4100 y base temporal: **22/22 comprobaciones**, cubriendo precedencia EDT/Gantt/Manual, responsables resueltos, prioridad del EDT, vínculo tarea–EDT, sincronización de estados, recálculo de avance, CRUD de valores, filtro por tipo, rechazo de tipos incompatibles y referencias inexistentes, matemática del resumen.
- Navegador (Vite 5201): creación manual de un valor, importación completa desde una tabla analizada (mapeo automático, tres filas, origen `Tabla`, referencias persistidas), filtro por tipo y totales por categoría.
- Typecheck de backend y frontend y build de producción del frontend sin errores.

## 6. Limitaciones conocidas

- Los valores importados no se deduplican: importar dos veces la misma tabla crea filas repetidas; deben eliminarse a mano.
- El filtro de tipo de la interfaz es visual; el servidor ya entrega solo valores aplicables, por lo que no existe una vista de valores de otras líneas.
- La importación valida que la tabla exista, pero no que pertenezca al archivo de referencia seleccionado (la interfaz solo ofrece tablas del archivo elegido).
- La vista de Tableros abre el primer tablero del listado; no hay selector cuando existen varios.
- El avance manual no prevalece mientras existan actividades EDT o Gantt.
- La ejecución presupuestal no se deriva de `proyecto_valores`; sigue basada en desembolsos y actas.
