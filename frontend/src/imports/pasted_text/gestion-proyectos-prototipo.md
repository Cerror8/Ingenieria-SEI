ACTUALIZAR EL PROTOTIPO DEL MÓDULO DE GESTIÓN DE PROYECTOS
USUARIO INTERNO / ADMINISTRADOR

IMPORTANTE:

Mantener exactamente el mismo Design System, sidebar, header, tarjetas,
tipografía, colores, botones, tablas, gráficos y espaciado del dashboard
principal ya creado.

NO crear un diseño diferente.

Esta actualización debe agregar el FLUJO COMPLETO DE CREACIÓN Y EDICIÓN
DE UN PROYECTO.

El módulo está integrado a una plataforma universitaria existente.

NO crear login.
NO crear usuarios propios.
NO crear autenticación propia.

====================================================
FRAME 01 — NUEVO PROYECTO
====================================================

Título:

Nuevo proyecto

Subtítulo:

Crear un nuevo proyecto de Gestión de Proyectos

Crear stepper horizontal:

01 Información general
02 Ficha técnica FR-019
03 Antecedentes
04 Seguimiento
05 Revisión

PASO 01:

Información general

Campos:

Código del proyecto *
Nombre del proyecto *
Línea de investigación *
Estado *
Dependencia proponente
Gestión PMO
Fecha de gestión
Responsable
Objetivo general
Valor total del proyecto
Valor de supervisión

Botones:

Cancelar
Guardar borrador
Continuar

Validaciones:

Código obligatorio y único.
Nombre obligatorio.
Línea obligatoria.
Estado obligatorio.

Mostrar mensajes de validación debajo de los campos.

====================================================
FRAME 02 — FR-019
====================================================

Título:

Ficha Técnica FR-019

Mostrar:

PRY-2026-009
Sistema de fortalecimiento ...

Mostrar progreso:

Diligenciamiento 75%

Mostrar:

Guardado automáticamente hace 20 segundos

Crear acordeones desplegables.

SECCIÓN 05:
Objetivos específicos

Permitir múltiples objetivos.

Campos:

Descripción
Orden

Botón:

+ Agregar objetivo

SECCIÓN 06:
Enfoque

Textarea:

Enfoque del proyecto

SECCIÓN 07:
Problema

Textarea:

Planteamiento del problema

SECCIÓN 08:
Justificación

Textarea:

Justificación del proyecto

SECCIÓN 09:
Sostenibilidad

Textarea:

Sostenibilidad

Selector múltiple:

ODS 1
ODS 2
ODS 3
ODS 4
...
ODS 17

SECCIÓN 10:
Riesgos

Tabla editable:

Riesgo
Probabilidad
Consecuencia
Plan de mitigación

Botón:

+ Agregar riesgo

SECCIÓN 11:
Cobertura geográfica

País
Departamento
Subregión/Municipio

Botón:

+ Agregar cobertura

SECCIÓN 11:
Población participante

Tabla:

Categoría
Cantidad

Botón:

+ Agregar categoría

SECCIÓN 12:
Enfoques diferenciales

Tipo:

Etario
Género
Étnico
Inclusión
Ambiental

Descripción

Botón:

+ Agregar enfoque

SECCIÓN 13:
Grupos de interés

Tipo:

Directo
Indirecto

Descripción

Botón:

+ Agregar grupo

SECCIONES 14–15:
Componentes de metodología

Cada componente debe tener:

Nombre
Descripción
Resultado esperado

Dentro de cada componente:

Actividades

Botón:

+ Agregar componente

SECCIÓN 16:
Indicadores

Cada indicador:

Actividad
Indicador
Meta
Resultado/avance
Tiempo estimado
Responsable
Estado

Botón:

+ Agregar indicador

SECCIÓN 17.1:
Ingresos

Tipo:

Recursos propios
Aportes de terceros

Concepto
Valor total

SECCIÓN 17.2:
Gastos

Categoría
Concepto
Unidad
Cantidad
Valor unitario
Valor total

SECCIÓN:
Aprobaciones

Rol aprobador
Nombre
Fecha
Estado de firma

Estados:

Pendiente
Firmado
Rechazado

Botones generales:

Guardar sección
Guardar borrador
Anterior
Continuar

====================================================
FRAME 03 — ANTECEDENTES
====================================================

Título:

Antecedentes del proyecto

Subtítulo:

Buscar y asociar antecedentes existentes.

Filtros idénticos al repositorio general:

Código de proyecto
Línea de investigación
Año
Tipo de documento
Nivel de estructuración

Buscador:

Buscar por código, línea o palabra clave

Resultados en tabla:

Código
Nombre
Línea
Tipo
Año
Nivel
Acciones

Acciones:

Ver
Asociar

Agregar:

+ Cargar nuevo antecedente

Al asociar:

mostrar modal:

Asociar antecedente

Proyecto:

PRY-2026-009

Antecedente:

PRY-2024-008

Botones:

Cancelar
Asociar

Mostrar Toast:

Antecedente asociado correctamente.

NO duplicar archivos.

====================================================
FRAME 04 — SEGUIMIENTO
====================================================

Título:

Seguimiento del proyecto

Mostrar KPI cards:

Avance técnico
0%

Avance presupuestal
0%

Indicadores
0%

Actividades
0

Entregables
0

Alertas
0

Crear sección:

Avance técnico

Campo:

Porcentaje de avance

Slider/input:

0 – 100%

Textarea:

Descripción del avance técnico

Botón:

Actualizar avance

Mostrar:

Última actualización

====================================================
FRAME 05 — ACTIVIDADES
====================================================

Tabla:

Actividad
Responsable
Fecha inicio
Fecha fin
Avance
Estado
Dependencia

Estados:

Pendiente
En curso
Completada
Retrasada

Botón:

+ Nueva actividad

Modal:

Nombre
Descripción
Responsable
Fecha inicio
Fecha fin
Dependencia
Avance
Estado

====================================================
FRAME 06 — GANTT
====================================================

Título:

Cronograma Gantt

PRY-2026-009

Mostrar timeline.

Columnas:

Actividad
Responsable
Inicio
Fin
Duración
Avance
Estado

Mostrar barras horizontales.

Permitir:

+ Nueva actividad
Editar
Eliminar

Mostrar hitos visualmente.

Mostrar dependencias entre actividades.

====================================================
FRAME 07 — PRESUPUESTO
====================================================

Título:

Presupuesto del proyecto

KPI:

Valor total
Ingresos
Gastos
Contrapartidas
Desembolsado
Disponible
% ejecución

Tabs:

Ingresos
Gastos
Contrapartidas
Desembolsos

Contrapartidas:

Entidad
Valor

Botón:

+ Agregar contrapartida

Desembolsos:

Fecha
Concepto
Valor

Botón:

+ Agregar desembolso

Recalcular automáticamente:

Total
Ejecutado
Disponible
Porcentaje

====================================================
FRAME 08 — REVISIÓN
====================================================

Título:

Revisión del proyecto

Mostrar checklist:

Información general
Ficha FR-019
Antecedentes
Presupuesto
Actividades
Gantt
Indicadores

Estados:

✓ Completo
⚠ Pendiente
✕ Error

Mostrar resumen:

Código
Nombre
Línea
Responsable
Estado
Avance
Presupuesto

Botones:

Volver
Guardar proyecto

====================================================
FRAME 09 — PROYECTO CREADO
====================================================

Mostrar modal:

✓ Proyecto creado correctamente

Código:

PRY-2026-009

Nombre:

Sistema de fortalecimiento ...

Estado:

Estructuración

Botones:

Ir al proyecto
Ver dashboard

====================================================
FRAME 10 — EDITAR PROYECTO
====================================================

Al seleccionar:

Editar

NO comenzar nuevamente el formulario.

Abrir:

Editar proyecto

PRY-2026-009

Tabs:

Resumen
Ficha técnica FR-019
Dashboard
Seguimiento
Gantt
Presupuesto
Indicadores
Documentos
Antecedentes
Informes
Historial
Auditoría

Cada sección debe conservar la información previamente registrada.

Permitir:

Editar
Guardar cambios
Cancelar

Mostrar:

Última actualización

====================================================
FRAME 11 — AUDITORÍA DEL PROYECTO
====================================================

La auditoría NO debe aparecer en la navegación principal.

Debe estar dentro del proyecto.

Mostrar:

Fecha
Usuario institucional
Acción
Entidad
Registro
Valor anterior
Valor nuevo

Ejemplo:

01/09/2026 10:21

Actualización

Avance técnico

55% → 68%

====================================================
FRAME 12 — DOCUMENTOS DEL PROYECTO
====================================================

La gestión documental debe estar dentro del proyecto.

Tabs:

Ficha técnica
Actas
Informes
Antecedentes
Evidencias
Otros

Acciones:

Ver
Descargar
Nueva versión

Botón:

+ Cargar documento

====================================================
FRAME 13 — INFORMES
====================================================

Dentro del proyecto:

Informes

Opciones:

Informe diario
Informe semanal
Informe del proyecto

Mostrar:

Última actualización

Los informes deben utilizar los datos más recientes disponibles al momento
de generar el informe.

Botones:

Generar informe
Descargar PDF
Descargar Word

====================================================
FRAME 14 — DASHBOARD INDIVIDUAL
====================================================

Cada proyecto debe tener su dashboard.

Mostrar:

Estado
Avance técnico
Avance presupuestal
Indicadores
Actividades
Entregables
Alertas

Gráficos:

Avance técnico vs planificado
Ejecución presupuestal
Indicadores
Gantt resumido

Mostrar:

Actualizado hace X segundos.

====================================================
FRAME 15 — CONFIRMACIÓN DE ACTUALIZACIÓN
====================================================

Cuando el administrador cambie información:

Mostrar Toast:

Proyecto actualizado correctamente.

Mostrar:

Actualizado hace 5 segundos

Actualizar visualmente:

KPI
Gráfico
Avance
Estado

====================================================
NAVEGACIÓN
====================================================

Crear prototipo interactivo.

Flujo:

Dashboard
→ Proyectos
→ Nuevo proyecto
→ Información general
→ FR-019
→ Antecedentes
→ Seguimiento
→ Actividades
→ Gantt
→ Presupuesto
→ Revisión
→ Crear proyecto
→ Dashboard individual

Segundo flujo:

Proyectos
→ Seleccionar proyecto
→ Editar
→ FR-019
→ Guardar cambios
→ Dashboard actualizado

Tercer flujo:

Proyecto
→ Seguimiento
→ Gantt
→ Actualizar actividad
→ Guardar
→ Dashboard actualizado

Cuarto flujo:

Proyecto
→ Presupuesto
→ Agregar contrapartida
→ Agregar desembolso
→ Guardar
→ Dashboard actualizado

Quinto flujo:

Proyecto
→ Informes
→ Informe diario/semanal/proyecto
→ Generar
→ PDF / Word

Sexto flujo:

Proyecto
→ Antecedentes
→ Buscar
→ Asociar
→ Confirmación

====================================================
REGLA VISUAL
====================================================

Todas las pantallas deben utilizar exactamente el mismo Design System
del dashboard principal.

No generar una nueva interfaz.

Mantener:

Sidebar
Header
Breadcrumbs
Tarjetas blancas
Fondo gris claro
Azul institucional
Badges
Tablas
Botones
Tipografía Inter
Sombras suaves
Bordes redondeados

Utilizar Auto Layout.

Crear componentes reutilizables.

Crear variantes:

Default
Hover
Active
Disabled
Loading
Success
Warning
Error

El prototipo debe ser navegable y representar un sistema administrativo
universitario real.ype Flow

Crear componentes con Auto Layout.

Utilizar variantes para estados.

Utilizar componentes reutilizables para mantener consistencia.

==================================================
RESULTADO ESPERADO
==================================================

El resultado debe parecer una aplicación institucional real lista para pasar a desarrollo.

NO generar únicamente mockups estáticos.

Crear un prototipo navegable.

El dashboard general debe parecerse visualmente al diseño proporcionado como referencia.

Cada proyecto debe tener su propio dashboard.

Los filtros deben estar representados.

Los KPIs deben estar representados.

Los gráficos deben estar representados.

La generación de informes y PDF debe estar representada.

La gestión de antecedentes debe estar representada.

La ficha técnica FR-019 debe estar representada.

El presupuesto debe estar representado.

Los indicadores deben estar representados.

Los documentos deben estar representados.

La auditoría debe estar representada.

La actualización dinámica debe estar representada.

El diseño debe ser coherente con un módulo integrado a una plataforma universitaria existente y no con una aplicación independiente.