# Checklists EDT por tipo de contrato

Fuentes:

- `Fases_v_obra.docx` (v1.1 – 30 ene 2026).
- `Fases_ve_interventoria.docx` (v1.1 – 30 ene 2026).
- Formato `SAC-PI031 · EDT interventoría y consultoría` (referencia de campos y estados).

El checklist deja de ser una única plantilla fija y pasa a depender del **tipo de contrato** del proyecto:

| Tipo | Fases | Actividades sembradas |
|---|---|---|
| Obra | 3 principales | 33 + 33 + 13 = **79** |
| Interventoría | 3 principales | 27 + 28 + 14 = **69** |

La plantilla de Obra se transcribió de la versión actualizada de `Fases_v_obra.docx`; la de Interventoría es su espejo de revisión (`Fases_ve_interventoria.docx` v1.1), con las solicitudes, revisiones y avales del interventor.

Las tres fases principales son siempre las mismas y se crean con el proyecto:

1. `fase-1` — Etapa precontractual (legalización, documentos y socialización).
2. `fase-2` — Etapa contractual (ejecución, actas, informes y control).
3. `fase-3` — Cierre de proyecto (recibo final, liquidación y cierre documental).

Se pueden **renombrar**, pero no eliminar. También se pueden agregar fases adicionales, que quedan enlazadas a la fase anterior mediante `depende_de_fase_id` y conservan su propio tablero.

## Tarjetas del checklist

Cada actividad es una tarjeta del tablero de su fase y una tarea asignable en `tareas_tablero`.

| Tipo de tarjeta | Significado | Exige archivo |
|---|---|---|
| `Actividad` | Trabajo de gestión o verificación. | Solo si `requiere_documento` está activo. |
| `Documento` | Entregable documental del contrato. | Sí, por defecto. |
| `Acta` | Acta o documento formal firmado. | Sí, por defecto. |

La prioridad por defecto de la plantilla es **Alta**. La fecha de cumplimiento y el responsable se asignan después del sembrado; hasta entonces la tarjeta aparece como **Sin fecha** y **Sin asignar**.

## Requisitos previos

`edt_requisitos` relaciona una actividad con las actividades que deben estar completas antes. Las reglas se validan en la API:

- Una actividad con subproductos no puede marcarse **Completado** mientras existan subproductos pendientes.
- Una actividad con requisitos no puede completarse si alguno no está **Completado**.
- Si el requisito exige documento, debe tener al menos un archivo cargado.
- Si la actividad exige documento propio, debe tener archivo antes de completarse.
- Un subproducto no puede tener subproductos propios ni predecesores de otra etapa.

La interfaz muestra estos bloqueos en la tarjeta: **REQUISITOS PREVIOS**, **Falta documento** y el mensaje **“Carga el documento obligatorio antes de completar.”**.

## Sembrado

- `POST /api/proyectos` crea el proyecto, asegura las tres fases y siembra el checklist del tipo de contrato dentro de la misma transacción. Si falla el sembrado, no queda un proyecto a medio configurar.
- `POST /api/edt/:proyectoId/plantilla` vuelve a ejecutar el sembrado para proyectos existentes.
- El sembrado es **idempotente**: identifica cada actividad por `plantilla_clave` (`obra-f1-contrato`, `int-f2-acta-inicio`, etc.) y no duplica las que ya existen.
- Al sembrar se crean también el tablero de cada fase y la tarea vinculada de cada actividad.
- La plantilla sugiere la carpeta documental según la estructura del proyecto. El usuario puede cambiarla a otra carpeta válida.

## Checklist documental desde Documentos

La pestaña **Documentos** del proyecto ya no muestra el checklist inline: tiene un botón **Checklist documental** que abre un modal.

- Lista las actividades documentales del EDT (`Documento`, `Acta` y actividades con `requiere_documento`) agrupadas por fase.
- Cada fila muestra los documentos ya recibidos con su nombre, versión, fecha, estado y un enlace **Abrir**; lo que falta queda como **Documento pendiente**.
- Filtros rápidos **Todos / Recibidos / Pendientes / No aplica** con sus conteos, para ver de inmediato qué se ha obtenido.
- El check se sincroniza con el EDT: una actividad **Completado** aparece marcada; si se completa o reabre en el EDT, el checklist lo refleja al abrirse o al pulsar actualizar.
- Al marcar una actividad sin archivo se abre el modal de carga con el proyecto, la carpeta sugerida, el nombre y el vínculo `edt_actividad_id` ya completos. Al subir el archivo se intenta completar la actividad.
- Si la actividad ya tiene documento, marcarla la completa directamente; desmarcarla la reabre sin borrar el archivo.
- Se respetan las mismas reglas de requisitos y documento obligatorio de la API; si falta un prerrequisito, el error se muestra dentro del modal.
- El progreso del modal cuenta actividades completadas y actividades con documento. Las carpetas con documentos se siguen resumiendo en la cabecera de **Documentos** y el filtro por carpeta queda en un selector junto a los tipos.

## Documentos y carpetas

- Un documento cargado desde el EDT guarda `documentos.edt_actividad_id` y queda visible tanto en la actividad como en **Documentos**.
- En **Documentos** se muestra con su carpeta de la estructura del proyecto; si la actividad tenía carpeta sugerida, se usa esa.
- Si el proyecto no tiene estructura documental, la actividad puede existir sin carpeta, pero no se puede asociar una carpeta arbitraria.
- Los documentos con `edt_actividad_id` alimentan el contador **documento(s)** de la tarjeta y desbloquean las reglas de documento obligatorio.

## Estados y avance

Estados válidos: `Completado`, `En ejecución`, `No realizado`.

- El estado del EDT se refleja en la columna de la tarea del tablero:
  - `No realizado` → `por-hacer`
  - `En ejecución` → `en-curso`
  - `Completado` → `completado`
- Cambiar la columna de la tarea a `completado` en el tablero también completa la actividad del EDT; devolverla a otra columna reabre la actividad. La sincronización es bidireccional.
- El avance del proyecto se recalcula con `recalcularAvanceProyecto` después de crear, editar, eliminar o sembrar actividades.
- Las tres fases principales se pueden renombrar; los tres estados del formato SAC-PI031 se mantienen.

## API

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/api/edt/:proyectoId` | Devuelve proyecto, fases y actividades con requisitos y conteos. |
| `POST` | `/api/edt/:proyectoId/fases` | Crea una fase adicional enlazada a la anterior. |
| `PATCH` | `/api/edt/fases/:id` | Renombra o cambia la dependencia de una fase. |
| `DELETE` | `/api/edt/fases/:id` | Elimina una fase adicional (las principales no se pueden eliminar). |
| `POST` | `/api/edt/:proyectoId` | Crea una actividad o tarjeta. |
| `PATCH` | `/api/edt/actividades/:id` | Edita actividad, responsable, fecha, estado, carpeta y requisitos. |
| `DELETE` | `/api/edt/actividades/:id` | Elimina la actividad y su tarea vinculada. |
| `POST` | `/api/edt/:proyectoId/plantilla` | Siembra o completa el checklist del tipo de contrato. |

## Interpretación de las fuentes Word

- Las actas y documentos obligatorios del Word se modelaron como tarjetas con tipo `Acta` o `Documento` y `requiere_documento = true`.
- Las solicitudes de la interventoría (contrato, presupuesto, diseños, plan de calidad, cronograma, licencias) se conservan como actividades con documento obligatorio, reflejando su rol de solicitar y avalar.
- Los pasos puramente administrativos se fusionaron cuando el Word los repetía en varias fases (por ejemplo, legalización, pólizas y hojas de vida en la etapa precontractual).
- Se añadieron documentos de control presupuestal (CDP, RP y plan de inversión del anticipo) porque el Word los menciona como soportes de las actas.
- El detalle completo de la arquitectura de tableros, documentos y urgencias está en `docs/TABLEROS_EDT.md`.

## Requisitos en rojo del Word

| Requisito | Cómo quedó |
|---|---|
| Línea de tiempo de documentos por fecha de llegada | La tabla de **Documentos** guarda fecha del documento, fecha de subida, versión y estado; se ordena por llegada y se puede descargar. |
| Casilla **aplica / no aplica** por capítulo | Implementado por actividad/requisito con la columna `edt_actividades.no_aplica`. La tarjeta del EDT y el checklist documental muestran “No aplica”, dejan de exigir documento y salen del cálculo de avance (incluidos los requisitos previos). Para excluir un capítulo completo se marcan sus actividades. |
| Matriz automática de entregables (fecha de radicación, versión y respuesta) | La tabla de **Documentos** muestra nombre, versión, fecha del documento, fecha de subida y estado. Falta la fecha de respuesta y, como actualizar un documento reemplaza archivo y versión en la misma fila, no se conserva el histórico de versiones anteriores. |
| Cada documento se guarda en la carpeta respectiva | Implementado: la actividad sugiere la carpeta de la plantilla y la carga la conserva; la tabla permite filtrar por carpeta. |
| Nombre `documento – versión – fecha` | Implementado: el modal de carga pide la versión (por defecto `v1.0`) y arma el nombre como `archivo v1.0 11nov26` si no se escribe uno. |

Queda pendiente la fecha de respuesta por documento (requiere columna nueva y campo en la tabla) y, para cumplir “cada versión hasta que se apruebe”, un histórico de versiones: hoy la actualización reemplaza el archivo en la misma fila. Ninguna de las dos bloquea compartir el enlace.
