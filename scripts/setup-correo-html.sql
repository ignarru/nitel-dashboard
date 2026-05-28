-- Columnas para el HTML con formato que edita el operador en el dashboard.
-- n8n sigue escribiendo correo_N (texto plano: asunto + cuerpo). Cuando el humano
-- edita en el editor TipTap, guardamos acá el HTML (negritas, links, listas) para
-- enviar el correo fiel a lo editado. NULL = nunca se editó → se regenera el HTML
-- desde el texto plano de correo_N. Aditivo y no destructivo (no toca a n8n).
ALTER TABLE nitel_leads ADD COLUMN IF NOT EXISTS correo_1_html TEXT;
ALTER TABLE nitel_leads ADD COLUMN IF NOT EXISTS correo_2_html TEXT;
ALTER TABLE nitel_leads ADD COLUMN IF NOT EXISTS correo_3_html TEXT;
