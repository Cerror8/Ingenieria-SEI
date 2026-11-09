-- =====================================================================
-- Ingeniería SEI · Datos iniciales
-- La base arranca vacía a propósito: los proyectos, indicadores,
-- documentos, informes, actividades, tableros y datos RAP se cargarán
-- con los documentos definitivos.
-- El único registro que se crea al arrancar es el administrador local,
-- y lo hace el backend desde las variables ADMIN_EMAIL / ADMIN_PASSWORD.
-- =====================================================================
SET search_path = app, public;
