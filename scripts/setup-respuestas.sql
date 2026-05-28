-- Sumamos a nitel_leads el contenido del mensaje que envió el lead
-- (el flag respondio + cual_respondio ya existían).
ALTER TABLE nitel_leads
  ADD COLUMN IF NOT EXISTS respuesta_texto TEXT,
  ADD COLUMN IF NOT EXISTS respuesta_recibida_at TIMESTAMPTZ;

-- Índice para filtrar/contar respondieron rápido
CREATE INDEX IF NOT EXISTS idx_nitel_leads_respuesta_recibida_at
  ON nitel_leads (respuesta_recibida_at DESC)
  WHERE respondio = true;

-- Verificar
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name='nitel_leads' AND column_name IN ('respuesta_texto', 'respuesta_recibida_at');
