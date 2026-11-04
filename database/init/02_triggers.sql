SET search_path = pmo, public;

-- Mantiene proyectos.actualizado_en ("Última actualización")
CREATE OR REPLACE FUNCTION touch_actualizado() RETURNS trigger SET search_path = pmo, public AS $$
BEGIN NEW.actualizado_en := now(); RETURN NEW; END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_proyectos_touch BEFORE UPDATE ON proyectos
  FOR EACH ROW EXECUTE FUNCTION touch_actualizado();

-- Auditoría genérica. El backend fija el usuario con:
--   SELECT set_config('app.usuario', 'correo@universidad.edu.co', true);
-- Solo registra los campos que cambiaron en UPDATE.
CREATE OR REPLACE FUNCTION auditar() RETURNS trigger SET search_path = pmo, public AS $$
DECLARE
  v_old JSONB; v_new JSONB; v_row JSONB; v_proy INT; v_accion TEXT; k TEXT;
  d_old JSONB := '{}'; d_new JSONB := '{}';
BEGIN
  IF TG_OP = 'INSERT' THEN v_new := to_jsonb(NEW); v_row := v_new; v_accion := 'Creación';
  ELSIF TG_OP = 'DELETE' THEN v_old := to_jsonb(OLD); v_row := v_old; v_accion := 'Eliminación';
  ELSE
    v_old := to_jsonb(OLD); v_new := to_jsonb(NEW); v_row := v_new; v_accion := 'Actualización';
    FOR k IN SELECT jsonb_object_keys(v_new) LOOP
      IF k <> 'actualizado_en' AND v_old->k IS DISTINCT FROM v_new->k THEN
        d_old := d_old || jsonb_build_object(k, v_old->k);
        d_new := d_new || jsonb_build_object(k, v_new->k);
      END IF;
    END LOOP;
    IF d_new = '{}'::jsonb THEN RETURN NEW; END IF;
    v_old := d_old; v_new := d_new;
  END IF;

  v_proy := CASE WHEN TG_TABLE_NAME = 'proyectos' THEN (v_row->>'id')::INT
                 ELSE (v_row->>'proyecto_id')::INT END;

  INSERT INTO auditoria(usuario, accion, entidad, registro, proyecto_id, valor_anterior, valor_nuevo)
  VALUES (COALESCE(NULLIF(current_setting('app.usuario', true), ''), 'sistema'),
          v_accion, TG_TABLE_NAME, COALESCE(v_row->>'codigo', v_row->>'id'), v_proy, v_old, v_new);
  RETURN COALESCE(NEW, OLD);
END $$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['proyectos','ficha_fr019','ficha_objetivos','ficha_riesgos','ficha_ingresos',
      'ficha_gastos','ficha_aprobaciones','indicadores','actividades','contrapartidas','desembolsos',
      'avance_historial','proyecto_antecedentes','documentos','documento_versiones']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_aud_%1$s AFTER INSERT OR UPDATE OR DELETE ON %1$s
                    FOR EACH ROW EXECUTE FUNCTION auditar()', t);
  END LOOP;
END $$;
