# Proyecto de ejemplo: guía de uso, análisis y alcance

- **Fecha:** 2026-11-11
- **Versión del documento:** 1.0
- **Módulo:** Proyectos de Ingeniería SEI
- **Público:** administradores que crean el ejemplo y usuarios que lo consultan

Este documento explica cómo crear y recorrer el proyecto de ejemplo, qué muestra cada pestaña, qué se puede analizar hoy y qué falta implementar. La ficha del ejemplo queda con **todos los campos del proyecto diligenciados**; las pestañas que dependen de registros propios (EDT, Gantt, presupuesto, documentos e informes) arrancan vacías y se alimentan con el recorrido de la sección 4.

## 1. Qué es el proyecto de ejemplo

Es un registro guía de un contrato de interventoría, creado bajo demanda por un administrador. No es una semilla automática ni un dato demo: sólo existe si alguien pulsa el botón. Sirve para:

- Ver cómo se ve un proyecto con información completa en la lista, el resumen y el dashboard.
- Practicar el diligenciamiento del EDT por etapas, el cronograma, los movimientos financieros, los documentos y los informes.
- Comparar un proyecto real contra una estructura conocida.

El ejemplo se crea **sin registros vinculados**. Eso permite eliminarlo sin romper dependencias y evita llenar la base con información que nadie pidió.

## 2. Cómo crearlo

1. Inicia sesión con un usuario de rol **admin**.
2. Entra a **Proyectos → Ver proyectos**.
3. En el encabezado, pulsa **Proyecto de ejemplo** (icono de libro, a la izquierda de **Nuevo proyecto**).
4. El sistema responde con un aviso:
   - Si es la primera vez: `Proyecto de ejemplo INT-EJEMPLO-001 creado. Ábrelo, revisa sus pestañas y en EDT pulsa "Completar plantilla" para cargar las tres etapas.`
   - Si ya existía: `El proyecto de ejemplo INT-EJEMPLO-001 ya existe; puedes abrirlo para repasar el registro.`
5. Abre el proyecto con el icono del ojo (**Ver detalle**) o con el lápiz (**Editar**).

Notas de comportamiento:

- La creación es **idempotente**: pulsar varias veces no duplica el proyecto.
- Si el ejemplo ya existía pero no tenía líder asignado, el botón completa ese campo con el administrador que lo pulsa.
- El identificador es fijo: `INT-EJEMPLO-001`.
- El botón sólo lo ve un administrador; la API también exige rol admin.

## 3. Ficha completa del ejemplo

Todos los campos del proyecto quedan con valor. Las fechas se calculan respecto al día de creación; se muestra el resultado para una creación el **2026-11-11**.

| Campo | Valor del ejemplo | Dónde se ve |
|---|---|---|
| Identificador | `INT-EJEMPLO-001` | Lista de proyectos, encabezado del detalle |
| Nombre | Interventoría técnica, administrativa y financiera al contrato de obra 2026-045 | Lista y resumen |
| Nombre corto | `EJEMPLO-INT-045` | Lista, resumen, ficha de edición |
| N.º de contrato | `INT-2026-045` | Lista, resumen |
| Entidad contratante | Universidad CESMAG | Resumen |
| Entidad contratista | SEI Ingeniería S.A.S. | Resumen |
| Organizadores | Oficina de Software | Resumen |
| Línea / área | Interventoría de obra | Lista, resumen y filtros |
| Dependencia / área responsable | Dirección de Interventoría | Resumen |
| Responsable | Coordinación de Interventoría | Lista, resumen y filtros |
| Líder del proyecto | UUID del administrador que crea el ejemplo | Asignación y ficha de edición |
| Estado | En ejecución | Lista, badges y dashboard |
| Avance técnico | 38 % | Resumen, seguimiento y dashboard |
| Ejecución presupuestal | 32 % | Resumen, seguimiento, presupuesto y dashboard |
| Valor total del contrato | $480.000.000 COP | Lista, resumen y presupuesto |
| Presupuesto de negociación | $500.000.000 COP | Pestaña Presupuesto |
| Presupuesto de ejecución | $460.000.000 COP | Pestaña Presupuesto |
| Presupuesto de alerta | $440.000.000 COP | Pestaña Presupuesto |
| Fecha de asignación | 2026-07-04 (creación − 130 días) | Resumen |
| Fecha de inicio | 2026-07-14 (creación − 120 días) | Resumen y presupuesto |
| Fecha de fin | 2027-07-14 (creación + 245 días) | Resumen, lista y presupuesto |
| Días restantes | 245 (fijados al crear el ejemplo) | Dashboard global, tarjeta de próximos a finalizar |
| Estructura documental | Interventoría a consultoría (`interventoria-consultoria`) | Pestaña Documentos |
| Objetivo general | Ejemplo guía: registro completo de un contrato de interventoría con entidades, fechas, presupuestos y checklist EDT por etapas. | Resumen |
| Creado por | Nombre del administrador que crea el ejemplo | Resumen |
| Fecha de creación | Fecha y hora en que se crea el ejemplo | Resumen |

Lectura de los presupuestos: el valor negociado fue de $500.000.000, el contrato quedó en $480.000.000, la ejecución proyectada es de $460.000.000 y la alerta se dispara al superar $440.000.000. Con 32 % de ejecución, el valor ejecutado que muestra la pestaña Presupuesto es $153.600.000, todavía por debajo del umbral de alerta.

## 4. Recorrido guiado para usarlo

El orden recomendado es: Resumen → EDT → Gantt → Presupuesto → Documentos → Informes → Seguimiento → Auditoría.

### 4.1 Resumen

Muestra cuatro tarjetas (avance técnico, ejecución presupuestal, inicio y fin), la información contractual completa y el objetivo general. Con el ejemplo recién creado ya se ve todo diligenciado: no hay campos vacíos ni “Sin registro” salvo que se edite y se borre un valor.

### 4.2 EDT

1. Entra a la pestaña **EDT**.
2. Pulsa **Completar plantilla**. El sistema siembra las tres etapas del formato SAC-PI031.
3. La siembra es idempotente: si ya hay actividades, sólo agrega las que faltan y no duplica las existentes.
4. Cada etapa muestra su propio avance: total, completadas, vencidas y porcentaje. Una actividad vencida es la que tiene fecha de cumplimiento anterior a hoy y no está completada.

Contenido que carga la plantilla (20 actividades, 6 / 8 / 6):

| Etapa | Actividades principales y subproductos |
|---|---|
| 1. Preconstructiva (6) | Revisión de información básica, estudios y diseños (con “Consolidar observaciones y solicitudes de ajuste”); Acta de inicio y socialización del contrato; Planificación de la interventoría (con “Cronograma detallado y matriz de riesgos”); Informe preconstructivo inicial |
| 2. Constructiva (8) | Informe mensual preconstructivo (con “Llenar formato de planillas y resumen general”); Informe mensual constructivo 2; Informes semanales (con “Producto no. 5”); Actas de reunión (con Acta 15 y Acta 16) |
| 3. Cierre (6) | Informe final de interventoría; Acta de liquidación y recibo a satisfacción; Cierre documental y financiero (con “Entrega del expediente documental” y “Paz y salvo y garantías”); Lecciones aprendidas y retroalimentación |

Reglas que conviene probar con el ejemplo:

- Una actividad principal **no se puede completar** mientras tenga subproductos sin completar.
- Un subproducto **no puede tener subproductos propios**.
- El subproducto debe pertenecer a la misma etapa que su actividad principal.
- Si la actividad principal ya está completada, primero hay que reabrirla para cambiar el estado de un subproducto.

Para dejarlo “vivo”: asigna responsables y fechas a las actividades de la etapa 1, marca “Acta de inicio” como Completado y deja la etapa 2 en ejecución. La barra de avance por etapa se mueve de inmediato.

### 4.3 Gantt

El cronograma es CRUD real: **Nueva actividad**, editar y eliminar. Campos del formulario: actividad, responsable, mes de inicio, mes de fin, avance (%), estado (Completada, En curso, Pendiente, Retrasada) y marca de hito. El mes de fin no puede ser anterior al de inicio.

Actividades sugeridas para que el cronograma acompañe al ejemplo (los meses se interpretan en el año de inicio del proyecto; para una creación el 2026-11-11, ese año es 2026):

| Actividad | Responsable | Inicio | Fin | Avance | Estado | Hito |
|---|---|---|---|---|---|---|
| Acta de inicio y socialización | Coordinación de Interventoría | Julio | Julio | 100 % | Completada | Sí |
| Revisión y aprobación de diseños | Equipo técnico | Agosto | Septiembre | 100 % | Completada | No |
| Interventoría técnica de obra | Residente de interventoría | Septiembre | Diciembre | 65 % | En curso | No |
| Control financiero y actas parciales | Coordinación financiera | Julio | Diciembre | 50 % | En curso | No |
| Informe final y acta de liquidación | Coordinación de Interventoría | Diciembre | Diciembre | 0 % | Pendiente | Sí |

El Gantt usa un eje de doce meses etiquetado con el año de inicio. Si el contrato cruza de año, las actividades posteriores a diciembre se siguen dibujando en el mismo eje; el eje multianual está en la lista de pendientes de la sección 6.

### 4.4 Presupuesto

La pestaña muestra:

- Cuatro tarjetas: presupuesto de negociación, de ejecución, de alerta y valor total del contrato.
- Comparación **Presupuesto vs. tiempo y desarrollo**: porcentaje de tiempo transcurrido, avance técnico y ejecución presupuestal, con notas de advertencia cuando la ejecución supera el avance técnico en más de 10 puntos o cuando se supera el presupuesto de alerta.
- **Desembolsos y cobro de actas parciales**: total desembolsado, total de actas parciales y tabla de movimientos con fecha, clase, número de acta, concepto, valor y acciones.

Acciones disponibles:

- **Ajustar presupuestos**: edita negociación, ejecución y alerta. El valor total del contrato se cambia desde **Editar proyecto**.
- **Registrar movimiento**: crea un Desembolso o un Acta parcial; el número de acta sólo aplica a las actas parciales.
- Eliminar un movimiento con confirmación.

Movimientos sugeridos para que la tabla y los totales tengan datos (suman $153.600.000, equivalente al 32 % ejecutado):

| Fecha | Clase | N.º de acta | Concepto | Valor |
|---|---|---|---|---|
| 2026-07-20 | Desembolso | No aplica | Anticipo contractual (20 %) | $96.000.000 |
| 2026-09-15 | Acta parcial | 1 | Acta parcial de avance 1 | $33.600.000 |
| 2026-10-30 | Acta parcial | 2 | Acta parcial de avance 2 | $24.000.000 |

Cómo ver la alerta roja: el valor ejecutado se obtiene de multiplicar el valor total por el porcentaje de ejecución. Con 32 % son $153.600.000, por debajo de los $440.000.000 de alerta. Para probar el estado crítico:

- Baja el **presupuesto de alerta** por debajo de $153.600.000 con **Ajustar presupuestos** (por ejemplo, $150.000.000), o
- Sube **Ejecución presupuestal (%)** a 95 en **Editar proyecto**; el ejecutado sería $456.000.000 y superaría la alerta.

Importante: hoy el porcentaje de ejecución es un dato del proyecto y los movimientos son un registro aparte. La conciliación automática entre ambos está pendiente (sección 6).

### 4.5 Documentos

La estructura asignada es **Interventoría a consultoría**, con carpetas de administración, finanzas, documentación contractual, ejecución, comunicaciones, calidad e informes. Acciones:

- **Cargar documento**: sube un archivo y lo clasifica por tipo, carpeta, versión, fecha y número de documento.
- **Actualizar desde ZIP**: carga un paquete de carpetas y archivos; el sistema informa cuántos se reemplazaron, crearon, quedaron sin cambios u omitieron.
- **Descargar ZIP**: descarga el repositorio del proyecto.
- Dentro de la pestaña se pueden crear carpetas y mover documentos; cada documento conserva versiones e histórico.

Sugerencia: sube un acta de inicio, un informe mensual y un acta parcial en sus carpetas correspondientes para ver el checklist documental y el ZIP con contenido.

### 4.6 Informes

El flujo es jerárquico:

1. **Semanal**: es el único que se crea manualmente. Se elige proyecto, período (desde/hasta) y se describe la actividad de la semana.
2. **Mensual**: se consolida a partir de los informes semanales cuya fecha de inicio cae en el mes elegido.
3. **Trimestral**: se consolida a partir de los informes mensuales del trimestre elegido.

El consolidado se puede regenerar; si ya existe para el mismo período, se actualiza en lugar de duplicarse. Si no hay informes de origen, el consolidado se crea con la nota “Sin informes … registrados”, sin bloquear la operación.

Para probar con el ejemplo, crea tres informes semanales (por ejemplo, 2026-08-03 a 2026-08-07, 2026-08-10 a 2026-08-14 y 2026-09-07 a 2026-09-11), consolida **Mensual** de agosto de 2026 y luego **Trimestral** del trimestre 3 de 2026.

### 4.7 Seguimiento

Muestra avance técnico, avance presupuestal, indicadores, actividades del cronograma, entregables y alertas. El avance técnico se actualiza con un control deslizante y el botón **Actualizar avance**; el valor se guarda en el proyecto y alimenta el dashboard y la comparación presupuestal. La lista de actividades sale del Gantt y permite saltar a **Gestionar en Gantt**.

Hoy este avance es manual; el cálculo automático desde tareas o EDT está pendiente (sección 6).

### 4.8 Indicadores

El ejemplo no trae indicadores. La pestaña muestra el listado y los botones **Nuevo indicador** y editar, pero el módulo todavía es de sólo lectura: no hay formulario ni endpoints de creación, edición o borrado. Por eso el dashboard del proyecto mostrará “Sin indicadores registrados” y el panel global no tendrá alertas de indicadores.

### 4.9 Auditoría

Registra las acciones del proyecto. El ejemplo deja al menos el evento de creación con usuario, fecha y detalle. El botón **Exportar** aún no tiene acción asociada.

## 5. Qué se puede ver en análisis

| Vista | Qué analiza | Con el ejemplo recién creado | Después de diligenciarlo |
|---|---|---|---|
| Dashboard global | 7 KPIs (total, activos, finalizados, retrasados, avance promedio, ejecución promedio, líneas activas), filtros por año, línea, estado, responsable y período; dona por estado; avance de activos; ejecución presupuestal por proyecto; proyectos por línea; próximos a finalizar; alertas de indicadores | El ejemplo suma en total, activos, avance promedio, ejecución promedio y línea; aparece en “Próximos a finalizar” con 245 días | Los promedios y gráficos se mueven con cada avance y presupuesto; las alertas requieren indicadores |
| Dashboard del proyecto | Avance técnico, avance financiero, indicadores cumplidos, alertas activas; barras técnico vs. presupuestal; dona de estado de indicadores | 38 % técnico, 32 % financiero, 0 indicadores, 0 alertas | La dona se llena cuando existan indicadores; las alertas se activan con indicadores en riesgo o no cumplidos |
| Seguimiento | Seis tarjetas: avance técnico, presupuestal, indicadores, actividades, entregables y alertas; tabla del cronograma | Actividades y entregables en cero | Refleja el Gantt, los documentos y el avance guardado |
| EDT | Avance por etapa, actividades completadas, vencidas y porcentaje | Vacío hasta cargar la plantilla | Muestra 6/8/6 y el avance de cada etapa; las vencidas se resaltan |
| Gantt | Línea de tiempo por meses, hitos, estados y avance por actividad | Vacío | Visualiza el cronograma y los hitos |
| Presupuesto | Negociación vs. ejecución vs. alerta; tiempo vs. avance técnico vs. ejecución; advertencias; desembolsos y actas | Cuatro tarjetas y comparación con 32 %; movimientos en cero | Totales de desembolsos y actas, y alerta roja si se supera el umbral |
| Formatos | Valores de referencia y análisis de tablas de archivos Excel/CSV (materiales, instrumentos y otras tablas) | Independiente del proyecto; disponible si hay valores cargados | Permite analizar tablas y prellenar registros, pero aún no se integra al presupuesto del proyecto |
| Informes | Semanal, mensual y trimestral; consolidación jerárquica | Sin informes | Se ven los consolidados y su contenido |
| Auditoría | Eventos por proyecto | Evento de creación | Suma cada edición, carga y movimiento |

Análisis que **sí** se pueden hacer hoy con el ejemplo:

- Comparar tiempo consumido contra avance técnico y ejecución presupuestal.
- Detectar desviaciones: ejecución por encima del avance técnico o superación del presupuesto de alerta.
- Ver el peso del proyecto dentro del portafolio (estado, línea, avance y ejecución).
- Revisar el cumplimiento del checklist EDT por etapa y las actividades vencidas.
- Ver la evolución de los informes semanales a mensuales y trimestrales.

## 6. Qué falta implementar

| # | Funcionalidad | Estado actual | Qué falta | Prioridad |
|---|---|---|---|---|
| 1 | CRUD de indicadores | La API sólo expone consulta; “Nuevo indicador” y editar no tienen acción | Formulario, endpoints de creación/edición/borrado y permisos | Alta |
| 2 | Seguimiento automático | El avance técnico se captura con un control manual; el porcentaje de ejecución también es un dato manual | Calcular avance desde tareas, EDT y cronograma; recalcular ejecución desde movimientos | Alta |
| 3 | Valores de referencia en el proyecto | Formatos permite analizar tablas Excel/CSV, pero no llevarlas al proyecto | Convertir materiales e instrumentos en ítems “Otros” del proyecto y sumarlos al presupuesto | Alta |
| 4 | Análisis financiero ampliado | Hay tarjetas, comparación y movimientos, sin conciliación | Pagos por entidad contratante, ingresos vs. gastos, informe de déficit rojo/verde y contrapartidas | Alta |
| 5 | Antecedentes del proyecto | La pestaña muestra un aviso; la asociación se gestiona en el módulo Antecedentes | Asociar antecedentes desde el detalle sin duplicar documentos | Media |
| 6 | Exportar auditoría | El botón existe sin acción | Exportar el listado a Excel/CSV/PDF | Media |
| 7 | Validación documental | El checklist EDT controla actividades, no documentos | Marcar documentos obligatorios por carpeta y alertar faltantes | Media |
| 8 | Gantt multianual | Eje de doce meses con el año de inicio | Eje que cruce años y fechas completas en lugar de sólo mes | Media |
| 9 | Días restantes | Se fijan al crear el proyecto | Recalcular desde la fecha de fin en cada consulta o con tarea programada | Baja |
| 10 | Presupuesto por rubros | El presupuesto es global | Ítems/rubros con valores unitarios y totales | Baja |

Aclaraciones de alcance:

- La ficha **FR-019** fue retirada del flujo y no debe reincorporarse.
- El proyecto de ejemplo no crea datos en EDT, Gantt, presupuesto, documentos, indicadores ni informes; esas pestañas se alimentan con el recorrido de la sección 4.
- La conciliación automática entre porcentaje de ejecución y movimientos es parte del punto 2/4, no un comportamiento esperado hoy.

## 7. Borrado y reinicio

- El ejemplo recién creado **se puede eliminar**: menú de tres puntos → **Eliminar proyecto** (sólo admin), confirmando el código exacto `INT-EJEMPLO-001`.
- Si se cargaron registros vinculados, la eliminación se bloquea y el mensaje indica el conteo por tipo: documentos, indicadores, actividades del Gantt, actividades del EDT, tareas de tablero e informes.
- Los **desembolsos y actas parciales** no bloquean la eliminación: se eliminan en cascada con el proyecto. Si se necesitan como evidencia, expórtalos o regístralos en documentos antes de borrar.
- Para reiniciar la práctica: elimina el ejemplo, vuelve a pulsarlo y repite el recorrido. Si sólo se quiere limpiar el checklist EDT, se pueden borrar las actividades desde la pestaña EDT.

## 8. Publicación en Vercel

- El código del botón, el endpoint y este documento se publican con **commit + push**; Vercel reconstruye frontend y backend.
- El **proyecto de ejemplo no viaja con el despliegue**: es un registro de la base de datos. En producción hay que entrar como admin y pulsar **Proyecto de ejemplo** una vez.
- No se requieren variables de entorno nuevas ni cambios de credenciales para esta funcionalidad.
- El endpoint exige sesión de administrador; si el botón no aparece, revisa el rol del usuario. Si aparece y falla, revisa que el backend desplegado incluya la ruta `/proyectos/ejemplo`.

## 9. Checklist rápido

- [ ] Crear el ejemplo como admin.
- [ ] Revisar que la ficha del Resumen no tenga campos vacíos.
- [ ] Cargar la plantilla EDT y comprobar 6 / 8 / 6.
- [ ] Completar una actividad principal con subproductos pendientes y ver el bloqueo.
- [ ] Crear las cinco actividades sugeridas del Gantt.
- [ ] Registrar los tres movimientos sugeridos del presupuesto.
- [ ] Subir al menos un documento a una carpeta.
- [ ] Crear tres informes semanales y consolidar mensual y trimestral.
- [ ] Mover el avance técnico y ver el cambio en el dashboard.
- [ ] Probar la alerta roja bajando el presupuesto de alerta o subiendo la ejecución.
- [ ] Revisar la auditoría del proyecto.
- [ ] Opcional: eliminar el ejemplo y volver a crearlo.

## 10. Documentos relacionados

- `docs/CHECKLIST_EDT.md`: alcance y estado de los checklists EDT por tipo de contrato.
- `docs/TABLEROS_EDT.md`: fases como tableros, tablero general, Mi tablero, sincronización y urgencias.
- `docs/BASE_DE_DATOS.md`: esquema y tablas del sistema.
- `docs/AUTENTICACION.md`: sesión, roles y permisos.
- `docs/WHATSAPP.md`: canal opcional de notificaciones (no implementado).
