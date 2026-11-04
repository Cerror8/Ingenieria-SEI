SET search_path = pmo, public;
SELECT set_config('app.usuario', 'seed@universidad.edu.co', false);

INSERT INTO lineas_investigacion(nombre) VALUES
 ('Educación y Pedagogía'),('Tecnología e Innovación'),('Medio Ambiente'),
 ('Salud y Bienestar'),('Desarrollo Social'),('Gestión Universitaria');
INSERT INTO dependencias(nombre) VALUES
 ('Facultad de Ciencias de la Educación'),('Facultad de Ingeniería'),('Facultad de Ciencias de la Salud'),
 ('Facultad de Ciencias Ambientales'),('Vicerrectoría Académica');
INSERT INTO ods(id,nombre) VALUES
 (1,'Fin de la pobreza'),(2,'Hambre cero'),(3,'Salud y bienestar'),(4,'Educación de calidad'),
 (5,'Igualdad de género'),(6,'Agua limpia y saneamiento'),(7,'Energía asequible y no contaminante'),
 (8,'Trabajo decente y crecimiento económico'),(9,'Industria, innovación e infraestructura'),
 (10,'Reducción de las desigualdades'),(11,'Ciudades y comunidades sostenibles'),
 (12,'Producción y consumo responsables'),(13,'Acción por el clima'),(14,'Vida submarina'),
 (15,'Vida de ecosistemas terrestres'),(16,'Paz, justicia e instituciones sólidas'),(17,'Alianzas para lograr los objetivos');

INSERT INTO proyectos(codigo,nombre,linea_id,estado,dependencia_id,responsable,objetivo_general,valor_total,fecha_inicio,fecha_fin,avance_tecnico) VALUES
 ('PRY-2026-001','Competencias Investigativas en Educación Superior',1,'En ejecución',1,'Dra. Carmen López','Fortalecer las competencias investigativas de docentes y estudiantes.',150000000,'2026-01-15','2026-12-15',68),
 ('PRY-2026-002','Salud Pública Comunitaria en Zonas Rurales',4,'En ejecución',3,'Dr. Andrés Morales','Implementar estrategias de atención primaria en comunidades rurales.',120000000,'2026-03-01','2026-10-20',31),
 ('PRY-2026-003','Sistema de Riego Inteligente con IoT',2,'En ejecución',2,'Ing. Luis Herrera','Sistema de riego basado en sensores IoT.',85000000,'2026-02-01','2026-11-30',45);

INSERT INTO ficha_fr019(proyecto_id,enfoque,problema,justificacion,sostenibilidad) VALUES
 (1,'Investigación-acción participativa','Baja producción investigadora docente.','Cierre de brechas de formación en investigación.','Institucionalización del programa de formación.');
INSERT INTO ficha_objetivos(proyecto_id,descripcion,orden) VALUES (1,'Desarrollar instrumentos de evaluación de competencias investigativas',1),(1,'Capacitar a 80 docentes en metodologías activas',2);
INSERT INTO ficha_ods VALUES (1,4),(1,10),(1,17);
INSERT INTO ficha_riesgos(proyecto_id,riesgo,probabilidad,consecuencia,plan_mitigacion) VALUES (1,'Baja participación docente','Media','Alta','Convocatoria con incentivos');
INSERT INTO ficha_ingresos(proyecto_id,tipo,concepto,valor_total) VALUES (1,'Recursos propios','Aporte institucional',100000000),(1,'Aportes de terceros','Convenio MEN',50000000);
INSERT INTO ficha_gastos(proyecto_id,categoria,concepto,unidad,cantidad,valor_unitario) VALUES
 (1,'Personal','Investigadores','Mes',12,5000000),(1,'Equipos','Materiales de laboratorio','Global',1,25000000),(1,'Difusión','Publicaciones','Publicación',4,6250000);
INSERT INTO ficha_aprobaciones(proyecto_id,rol_aprobador,nombre,estado_firma) VALUES (1,'Director de Investigación','Dr. Rafael Gómez','Pendiente');

INSERT INTO indicadores(proyecto_id,actividad,indicador,meta,resultado,unidad,responsable,estado,fecha_limite) VALUES
 (1,'Publicación','Artículos en revistas indexadas',4,2,'artículos','Dra. Carmen López','En riesgo','2026-12-15'),
 (1,'Validación','Instrumentos validados',6,3,'instrumentos','Dr. Juan Pérez','No cumplido','2026-09-30'),
 (1,'Capacitación','Docentes capacitados',80,65,'docentes','Dra. Carmen López','Cumplido','2026-11-30');

INSERT INTO actividades(proyecto_id,nombre,responsable,fecha_inicio,fecha_fin,avance,estado,es_hito,dependencia_id) VALUES
 (1,'Revisión bibliográfica','Dra. Carmen López','2026-01-15','2026-03-31',100,'Completada',false,NULL),
 (1,'Diseño metodológico e instrumentos','Dr. Juan Pérez','2026-02-01','2026-05-31',85,'En curso',false,1),
 (1,'Recolección de datos - fase 1','Dra. Carmen López','2026-04-01','2026-06-30',70,'En curso',false,2),
 (1,'Entrega informe parcial','Admin PMO','2026-06-30','2026-06-30',0,'Pendiente',true,3);

INSERT INTO contrapartidas(proyecto_id,entidad,valor) VALUES (1,'Gobernación del Meta',15000000),(1,'Alcaldía de Villavicencio',8000000);
INSERT INTO desembolsos(proyecto_id,fecha,concepto,valor) VALUES (1,'2026-01-15','Primer desembolso',40000000),(1,'2026-04-15','Segundo desembolso',35000000);

INSERT INTO antecedentes(codigo,nombre,linea_id,tipo_documento,anio,nivel_estructuracion) VALUES
 ('PRY-2024-008','Sistema de riego inteligente v1.0',2,'Proyecto',2024,'Avanzado'),
 ('PRY-2023-015','Competencias docentes digitales',1,'Proyecto',2023,'Intermedio'),
 ('PRY-2022-007','Biodiversidad y ecosistemas',3,'Estudio',2022,'Básico');

SELECT set_config('app.usuario', '', false);
-- El seed también generó filas de auditoría; las limpiamos para empezar en limpio.
TRUNCATE auditoria;
