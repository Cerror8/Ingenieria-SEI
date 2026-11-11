# Checklist EDT — Interventoría y consultoría (SAC-PI031 v1.0)

Fuente: `Comienzo ING/SAC-PI031_EDT interventoría y consultoría v1.0 23jun22.xlsx`
Compartido por el usuario el 2026-11-10. Hoja principal `EDT`; hojas auxiliares `Personal` y `Datos`.

| Campo | Valor |
|---|---|
| Proceso | Gestión de la calidad |
| Código | SAC-PI031 |
| Versión | 1 |
| Fecha del formato | 23/06/2022 |
| Proyecto | (sin diligenciar) |
| Fecha inicio | 02/11/2026 |

Estados válidos (hoja `Datos`): Completado · En ejecución · No realizado.

## Etapa 1 — Preconstructiva o información básica

La etapa existe en el formato, pero no tiene actividades diligenciadas (solo la fila no. 1 con estado "No realizado").

- [ ] Actividad 1 (sin nombre en el EDT)
- [ ] Asignar responsable, fecha de cumplimiento y estado
- [ ] Definir las demás actividades de la etapa

## Etapa 2 — Constructiva o ejecución

### 1. Informe mensual preconstructivo
Responsable: Carlos Montenegro · Fecha: 31/10/2026 · Estado: En ejecución

- [ ] Subproducto/predecesor: llenar formato de planillas y resumen general del informe preconstructivo — 03/11/2026 — En ejecución

### 2. Informe mensual constructivo 2
Responsable: Carlos Montenegro · Fecha: 04/11/2026 · Estado: En ejecución

### 3. Informes semanales
Responsable: sin asignar · Fecha: sin definir · Estado: No realizado

- [x] Subproducto "no. 5" — Carlos Montenegro — 01/11/2026 — Completado
- [ ] Completar nombre y fecha de los informes semanales faltantes

### 4. Actas de reunión
Responsable: Carlos Montenegro · Fecha: sin definir · Estado: No realizado

- [ ] Acta 15 — 27/10/2026 — No realizado
- [ ] Acta 16 — 03/11/2026 — No realizado

## Etapa 3 — De cierre de proyecto o retroalimentación

La etapa existe en el formato, pero no tiene actividades diligenciadas. La primera fila tiene fecha 08/11/2026 y estado "No realizado".

- [ ] Definir actividades de cierre (liquidación, informe final, lecciones aprendidas, retroalimentación)
- [ ] Asignar responsables, fechas de cumplimiento y estados

## Reglas del formato

- Cada etapa maneja las columnas: no., actividad, responsable, fecha de cumplimiento, estado de cumplimiento.
- Una actividad predecesora se registra como subproducto (renglón debajo); la actividad padre no puede cerrarse antes de que el subproducto termine.
- La hoja `Personal` relaciona No. / Responsable / Correo; está vacía y es la base para notificaciones.
- Algunas filas solo tienen fecha o número, sin nombre de actividad; el checklist las marca como pendientes de completar.

## Vacíos por definir

- Nombre del proyecto y fecha de inicio real.
- Actividades de las etapas 1 y 3.
- Nombres de los subproductos "no. 5", 15 y 16.
- Fechas de "Informes semanales" y "Actas de reunión".
- Correos del personal responsable en la hoja `Personal`.

## Implementación en SEI

- Cada proyecto tiene la pestaña **EDT** con las tres etapas fijas del formato.
- El botón **Cargar plantilla EDT** siembra las tres etapas: las actividades base de la etapa preconstructiva, las diligenciadas en SAC-PI031 para la etapa constructiva y las de cierre (acta de liquidación, expediente, paz y salvo y lecciones aprendidas), junto con sus subproductos.
- La siembra es idempotente: si el proyecto ya tiene parte del checklist, sólo agrega las actividades que falten y no duplica las existentes.
- Se pueden crear, editar y eliminar actividades y subproductos, cambiar el estado en línea y ver el avance del checklist.
- Una actividad principal no puede marcarse como completada mientras tenga subproductos pendientes.
- Las alertas de vencimiento salen por correo; WhatsApp es un canal opcional (ver `docs/WHATSAPP.md`) que usa el teléfono y el consentimiento registrados en el perfil, no la hoja `Personal` directamente.
- En **Formatos** se siembra automáticamente el formato de referencia **SAC-PI031 · EDT interventoría y consultoría** (9 campos: proyecto, etapa, no., actividad, responsable, fecha de cumplimiento, estado, subproducto de y observaciones). El archivo Excel queda como valor de referencia editable: se puede reemplazar por una nueva versión, corregir nombre/tipo/descripción y asociarlo a otros formatos; sus registros diligenciados se conservan al desactivarlo.
