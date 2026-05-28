-- Función única para notificar cambios en nitel_leads
CREATE OR REPLACE FUNCTION nitel_leads_notify() RETURNS trigger AS $func$
DECLARE
  payload json;
BEGIN
  payload := json_build_object(
    'op', TG_OP,
    'place_id', COALESCE(NEW.place_id, OLD.place_id)
  );
  PERFORM pg_notify('nitel_leads_change', payload::text);
  RETURN COALESCE(NEW, OLD);
END;
$func$ LANGUAGE plpgsql;

-- Borramos triggers viejos si existen (idempotente)
DROP TRIGGER IF EXISTS nitel_leads_insert_notify ON nitel_leads;
DROP TRIGGER IF EXISTS nitel_leads_update_notify ON nitel_leads;

-- Triggers para INSERT y UPDATE
CREATE TRIGGER nitel_leads_insert_notify
  AFTER INSERT ON nitel_leads
  FOR EACH ROW EXECUTE FUNCTION nitel_leads_notify();

CREATE TRIGGER nitel_leads_update_notify
  AFTER UPDATE ON nitel_leads
  FOR EACH ROW EXECUTE FUNCTION nitel_leads_notify();

-- Verificar
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'nitel_leads';
