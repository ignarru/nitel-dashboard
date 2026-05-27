-- ============================================================
-- MIGRACION DASHBOARD NITEL — correr UNA sola vez
-- ============================================================

-- 1) Columnas nuevas en leads_nitel (la tabla ya existe)
ALTER TABLE leads_nitel ADD COLUMN IF NOT EXISTS respuesta_texto TEXT;
ALTER TABLE leads_nitel ADD COLUMN IF NOT EXISTS respuesta_recibida_at TIMESTAMPTZ;
ALTER TABLE leads_nitel ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE leads_nitel ADD COLUMN IF NOT EXISTS archivado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE leads_nitel ADD COLUMN IF NOT EXISTS notas TEXT;

-- Indices utiles
CREATE INDEX IF NOT EXISTS idx_leads_nitel_contactado_1 ON leads_nitel (contactado_1);
CREATE INDEX IF NOT EXISTS idx_leads_nitel_email ON leads_nitel (email);
CREATE INDEX IF NOT EXISTS idx_leads_nitel_respondio ON leads_nitel (respondio);
CREATE INDEX IF NOT EXISTS idx_leads_nitel_source_node ON leads_nitel (source_node);
CREATE INDEX IF NOT EXISTS idx_leads_nitel_respuesta_recibida_at
  ON leads_nitel (respuesta_recibida_at DESC) WHERE respondio = true;

-- 2) Tabla busquedas_logs (nueva)
CREATE TABLE IF NOT EXISTS busquedas_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status           TEXT NOT NULL DEFAULT 'running'
                     CHECK (status IN ('running', 'completed', 'failed')),
  criterios        JSONB,
  total_scrapeados INT,
  total_insertados INT,
  descartados      INT,
  mensaje          TEXT,
  error_message    TEXT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_busquedas_logs_status ON busquedas_logs (status);
CREATE INDEX IF NOT EXISTS idx_busquedas_logs_started_at ON busquedas_logs (started_at DESC);

-- 3) Trigger NOTIFY para leads_nitel (tiempo real)
CREATE OR REPLACE FUNCTION leads_nitel_notify() RETURNS trigger AS $func$
DECLARE payload json;
BEGIN
  payload := json_build_object('op', TG_OP, 'place_id', COALESCE(NEW.place_id, OLD.place_id));
  PERFORM pg_notify('leads_nitel_change', payload::text);
  RETURN COALESCE(NEW, OLD);
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_nitel_insert_notify ON leads_nitel;
DROP TRIGGER IF EXISTS leads_nitel_update_notify ON leads_nitel;
DROP TRIGGER IF EXISTS leads_nitel_delete_notify ON leads_nitel;
CREATE TRIGGER leads_nitel_insert_notify AFTER INSERT ON leads_nitel
  FOR EACH ROW EXECUTE FUNCTION leads_nitel_notify();
CREATE TRIGGER leads_nitel_update_notify AFTER UPDATE ON leads_nitel
  FOR EACH ROW EXECUTE FUNCTION leads_nitel_notify();
CREATE TRIGGER leads_nitel_delete_notify AFTER DELETE ON leads_nitel
  FOR EACH ROW EXECUTE FUNCTION leads_nitel_notify();

-- 4) Trigger NOTIFY para busquedas_logs (tiempo real)
CREATE OR REPLACE FUNCTION busquedas_logs_notify() RETURNS trigger AS $func$
DECLARE payload json;
BEGIN
  payload := json_build_object('op', TG_OP, 'id', COALESCE(NEW.id, OLD.id),
                               'status', COALESCE(NEW.status, OLD.status));
  PERFORM pg_notify('busquedas_logs_change', payload::text);
  RETURN COALESCE(NEW, OLD);
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS busquedas_logs_insert_notify ON busquedas_logs;
DROP TRIGGER IF EXISTS busquedas_logs_update_notify ON busquedas_logs;
CREATE TRIGGER busquedas_logs_insert_notify AFTER INSERT ON busquedas_logs
  FOR EACH ROW EXECUTE FUNCTION busquedas_logs_notify();
CREATE TRIGGER busquedas_logs_update_notify AFTER UPDATE ON busquedas_logs
  FOR EACH ROW EXECUTE FUNCTION busquedas_logs_notify();
