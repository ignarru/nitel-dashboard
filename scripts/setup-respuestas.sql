-- Sumamos a leads_nitel el contenido del mensaje que envió el lead
-- (el flag respondio + cual_respondio ya existían).
ALTER TABLE leads_nitel
  ADD COLUMN IF NOT EXISTS respuesta_texto TEXT,
  ADD COLUMN IF NOT EXISTS respuesta_recibida_at TIMESTAMPTZ;

-- Índice para filtrar/contar respondieron rápido
CREATE INDEX IF NOT EXISTS idx_leads_nitel_respuesta_recibida_at
  ON leads_nitel (respuesta_recibida_at DESC)
  WHERE respondio = true;

-- Verificar
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name='leads_nitel' AND column_name IN ('respuesta_texto', 'respuesta_recibida_at');
