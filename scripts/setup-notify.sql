-- Función única para notificar cambios en leads_nitel
CREATE OR REPLACE FUNCTION leads_nitel_notify() RETURNS trigger AS $func$
DECLARE
  payload json;
BEGIN
  payload := json_build_object(
    'op', TG_OP,
    'place_id', COALESCE(NEW.place_id, OLD.place_id)
  );
  PERFORM pg_notify('leads_nitel_change', payload::text);
  RETURN COALESCE(NEW, OLD);
END;
$func$ LANGUAGE plpgsql;

-- Borramos triggers viejos si existen (idempotente)
DROP TRIGGER IF EXISTS leads_nitel_insert_notify ON leads_nitel;
DROP TRIGGER IF EXISTS leads_nitel_update_notify ON leads_nitel;

-- Triggers para INSERT y UPDATE
CREATE TRIGGER leads_nitel_insert_notify
  AFTER INSERT ON leads_nitel
  FOR EACH ROW EXECUTE FUNCTION leads_nitel_notify();

CREATE TRIGGER leads_nitel_update_notify
  AFTER UPDATE ON leads_nitel
  FOR EACH ROW EXECUTE FUNCTION leads_nitel_notify();

-- Verificar
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'leads_nitel';
