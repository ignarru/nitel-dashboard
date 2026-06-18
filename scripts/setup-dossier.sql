-- Columna `dossier`: el resumen de la empresa que arma la IA (scraper de n8n).
-- Sirve de contexto para redactar los correos y ahora se muestra en el editor del dashboard
-- (panel "Resumen de la empresa" en /secuencia/[id]).
--
-- OJO con la estructura real de esta DB (verificado 2026-06-18):
--   * leads_nitel  = TABLA real (la que escribe n8n).
--   * nitel_leads  = VISTA sobre leads_nitel (la que LEE el dashboard / Drizzle).
-- Por eso este script hace dos cosas: agrega la columna a la tabla y recrea la vista para
-- que exponga la columna nueva. Es aditivo y no destructivo (idempotente).

-- 1) Columna en la TABLA real
ALTER TABLE leads_nitel ADD COLUMN IF NOT EXISTS dossier text;

-- 2) Recrear la VISTA para que incluya `dossier`. CREATE OR REPLACE solo agrega columnas
--    al final, no toca las existentes. Hay que repetir la lista completa de columnas.
CREATE OR REPLACE VIEW nitel_leads AS
SELECT place_id, name, category, address, phone, website, email,
       correo_1, correo_2, correo_3, rating, reviews, lat, lng, source_node,
       contactado_1, contactado_2, contactado_3, respondio, cual_respondio,
       hora_enviado_1, hora_enviado_2, hora_enviado_3,
       respuesta_texto, respuesta_recibida_at, created_at, archivado, notas,
       correo_1_html, correo_2_html, correo_3_html, dossier
FROM leads_nitel;

-- Para que se POBLE: el workflow de n8n debe escribir el dossier en leads_nitel.dossier
-- (mapear la columna `dossier` en el nodo "Update rows in a table" del correo 1, con el
--  valor del dossier que produce "Edit Fields1"). Los leads ya procesados quedan sin
-- dossier hasta que se re-procesen.
