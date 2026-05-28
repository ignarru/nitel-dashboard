-- ============================================================
-- MIGRACION DASHBOARD NITEL — correr UNA sola vez
-- ============================================================

-- 1) Columnas nuevas en nitel_leads (la tabla ya existe)
ALTER TABLE nitel_leads ADD COLUMN IF NOT EXISTS respuesta_texto TEXT;
ALTER TABLE nitel_leads ADD COLUMN IF NOT EXISTS respuesta_recibida_at TIMESTAMPTZ;
ALTER TABLE nitel_leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE nitel_leads ADD COLUMN IF NOT EXISTS archivado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nitel_leads ADD COLUMN IF NOT EXISTS notas TEXT;
ALTER TABLE nitel_leads ADD COLUMN IF NOT EXISTS correo_1_html TEXT;
ALTER TABLE nitel_leads ADD COLUMN IF NOT EXISTS correo_2_html TEXT;
ALTER TABLE nitel_leads ADD COLUMN IF NOT EXISTS correo_3_html TEXT;

-- Indices utiles
CREATE INDEX IF NOT EXISTS idx_nitel_leads_contactado_1 ON nitel_leads (contactado_1);
CREATE INDEX IF NOT EXISTS idx_nitel_leads_email ON nitel_leads (email);
CREATE INDEX IF NOT EXISTS idx_nitel_leads_respondio ON nitel_leads (respondio);
CREATE INDEX IF NOT EXISTS idx_nitel_leads_source_node ON nitel_leads (source_node);
CREATE INDEX IF NOT EXISTS idx_nitel_leads_respuesta_recibida_at
  ON nitel_leads (respuesta_recibida_at DESC) WHERE respondio = true;

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

-- 3) Trigger NOTIFY para nitel_leads (tiempo real)
CREATE OR REPLACE FUNCTION nitel_leads_notify() RETURNS trigger AS $func$
DECLARE payload json;
BEGIN
  payload := json_build_object('op', TG_OP, 'place_id', COALESCE(NEW.place_id, OLD.place_id));
  PERFORM pg_notify('nitel_leads_change', payload::text);
  RETURN COALESCE(NEW, OLD);
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nitel_leads_insert_notify ON nitel_leads;
DROP TRIGGER IF EXISTS nitel_leads_update_notify ON nitel_leads;
DROP TRIGGER IF EXISTS nitel_leads_delete_notify ON nitel_leads;
CREATE TRIGGER nitel_leads_insert_notify AFTER INSERT ON nitel_leads
  FOR EACH ROW EXECUTE FUNCTION nitel_leads_notify();
CREATE TRIGGER nitel_leads_update_notify AFTER UPDATE ON nitel_leads
  FOR EACH ROW EXECUTE FUNCTION nitel_leads_notify();
CREATE TRIGGER nitel_leads_delete_notify AFTER DELETE ON nitel_leads
  FOR EACH ROW EXECUTE FUNCTION nitel_leads_notify();

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
