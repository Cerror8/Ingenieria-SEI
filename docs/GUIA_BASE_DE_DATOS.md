# Guía · Base de datos

## 1. Levantarla
```bash
cd database
docker compose up -d                 # crea la BD sei_pmo y corre init/01..04
docker exec -it sei_pmo_db psql -U sei -d sei_pmo -c "SELECT codigo, estado FROM pmo.proyectos;"
```
Para repetir desde cero: `docker compose down -v && docker compose up -d`.
Sin Docker: crea una BD y ejecuta en orden `init/01_schema.sql … 04_seed.sql` con `psql`.

## 2. Modelo (esquema `pmo`)
```
lineas_investigacion ─┐
dependencias ─────────┼─< proyectos >─┬─ ficha_fr019 (enfoque, problema, justificación, sostenibilidad)
ods ─< ficha_ods >────┘               ├─ ficha_objetivos / riesgos / cobertura / poblacion
                                      ├─ ficha_enfoques_diferenciales / grupos_interes
                                      ├─ ficha_componentes ─< ficha_componente_actividades
                                      ├─ indicadores            (Sección 16 + seguimiento)
                                      ├─ ficha_ingresos / ficha_gastos / ficha_aprobaciones
                                      ├─ actividades            (Gantt: hitos y dependencia_id)
                                      ├─ avance_historial · contrapartidas · desembolsos
                                      ├─ documentos ─< documento_versiones
                                      ├─ informes (foto JSON de los datos al generar)
                                      └─ proyecto_antecedentes >─ antecedentes
auditoria (sin FK: sobrevive al proyecto)
```

## 3. Reglas que ya impone la BD
- `codigo` único; nombre, línea y estado obligatorios (Frame 01).
- Avance y porcentajes entre 0 y 100; `fecha_fin >= fecha_inicio`.
- `ficha_gastos.valor_total = cantidad × valor_unitario` (columna generada).
- Antecedentes: solo una **relación** (no se duplican archivos).
- Una actividad no puede depender de sí misma.

## 4. Auditoría automática (Frame 11)
El trigger `auditar()` registra INSERT/UPDATE/DELETE de las tablas clave. En UPDATE guarda
**solo los campos que cambiaron** (`{"avance_tecnico": 68}` → `{"avance_tecnico": 75}`).
El backend le pasa el usuario con `set_config('app.usuario', …, true)` dentro de cada transacción.
Si quieres auditar otra tabla, añádela a la lista del `DO $$` en `02_triggers.sql`.

## 5. Vistas de KPIs
- `v_presupuesto`: ingresos, gastos, contrapartidas, desembolsado, disponible, % ejecución.
- `v_kpis_proyecto`: avance técnico/presupuestal, actividades, hitos, entregables, indicadores, alertas.
Los dashboards leen estas vistas, por eso "recalcular automáticamente" no necesita código extra.

## 5.1 Ajustes probables
Cambia la fórmula de presupuesto en `v_presupuesto` si tu universidad usa otra; amplía el
`CHECK` de `estado` si hay más estados.

## 6. Migraciones (cuando salgas de desarrollo)
`init/*.sql` solo corre la primera vez. A partir del primer despliegue, usa una herramienta de
migraciones (p. ej. `node-pg-migrate` o `dbmate`) y crea un archivo por cambio; no edites los `init`.

## 7. Seguridad y operación
- Cambia la contraseña de `docker-compose.yml` y usa un rol de aplicación **sin** SUPERUSER (el de pruebas lo era).
- Respaldos diarios con `pg_dump`; guarda también los archivos del repositorio documental.
- Datos personales (responsables): confirma con la universidad la política de habeas data (Ley 1581).
