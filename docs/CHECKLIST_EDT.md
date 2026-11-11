# Checklists EDT por tipo de contrato

Fuentes:

- `Fases_v_obra.docx` (v1.1 – 30 ene 2026).
- `Fases_ve_interventoria.docx` (v1.1 – 30 ene 2026).
- Formato `SAC-PI031 · EDT interventoría y consultoría` (referencia de campos y estados).

El checklist deja de ser una única plantilla fija y pasa a depender del **tipo de contrato** del proyecto:

| Tipo | Fases | Actividades sembradas |
|---|---|---|
| Obra | 3 principales | 17 + 22 + 8 = **47** |
| Interventoría | 3 principales | 20 + 20 + 8 = **48** |

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
