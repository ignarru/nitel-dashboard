-- Tabla para trackear el progreso de cada búsqueda de leads
-- La inserta el dashboard cuando se dispara el webhook a n8n.
-- La actualiza n8n al final del workflow con los contadores.
CREATE TABLE IF NOT EXISTS busquedas_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status          TEXT NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'completed', 'failed')),
  criterios       JSONB,
  total_scrapeados INT,
  total_insertados INT,
  ya_existian     INT,
  mensaje         TEXT,
  error_message   TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_busquedas_logs_status ON busquedas_logs (status);
CREATE INDEX IF NOT EXISTS idx_busquedas_logs_started_at ON busquedas_logs (started_at DESC);

-- Trigger NOTIFY: emite eventos al canal "busquedas_logs_change" cada vez que
-- una fila se inserta o actualiza. El dashboard escucha por SSE.
CREATE OR REPLACE FUNCTION busquedas_logs_notify() RETURNS trigger AS $func$
DECLARE
  payload json;
BEGIN
  payload := json_build_object(
    'op', TG_OP,
    'id', COALESCE(NEW.id, OLD.id),
    'status', COALESCE(NEW.status, OLD.status)
  );
  PERFORM pg_notify('busquedas_logs_change', payload::text);
  RETURN COALESCE(NEW, OLD);
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS busquedas_logs_insert_notify ON busquedas_logs;
DROP TRIGGER IF EXISTS busquedas_logs_update_notify ON busquedas_logs;

CREATE TRIGGER busquedas_logs_insert_notify
  AFTER INSERT ON busquedas_logs
  FOR EACH ROW EXECUTE FUNCTION busquedas_logs_notify();

CREATE TRIGGER busquedas_logs_update_notify
  AFTER UPDATE ON busquedas_logs
  FOR EACH ROW EXECUTE FUNCTION busquedas_logs_notify();

-- Verificar
SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'busquedas_logs';
