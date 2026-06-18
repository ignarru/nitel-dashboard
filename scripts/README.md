# Migraciones SQL — `scripts/`

La tabla `nitel_leads` la **define el workflow de n8n de Nitel**, no este dashboard. El
dashboard solo lee/actualiza esa tabla y agrega columnas/objetos auxiliares de forma
**aditiva y no destructiva** (todos los scripts usan `IF NOT EXISTS`, así que son
idempotentes: correrlos dos veces no hace daño).

## Scripts (orden de aplicación)

| Script | Qué hace |
|---|---|
| `setup-busquedas-logs.sql` | Crea la tabla `busquedas_logs` (trackeo de búsquedas) + triggers `NOTIFY`. |
| `setup-notify.sql` | Función + triggers `NOTIFY` sobre `nitel_leads` para el stream SSE en tiempo real. |
| `setup-respuestas.sql` | Agrega a `nitel_leads` las columnas `respuesta_texto` y `respuesta_recibida_at` + índice. |
| `setup-correo-html.sql` | Agrega a `nitel_leads` las columnas `correo_1_html`, `correo_2_html`, `correo_3_html`: guardan el HTML con formato (negritas, links, listas) que edita el operador en el dashboard. n8n nunca las toca. |
| `setup-dossier.sql` | Agrega la columna `dossier` (resumen de la empresa que arma la IA) y recrea la vista para exponerla. Se muestra en el editor del dashboard. n8n debe poblarla. |

> **Estructura real (verificada 2026-06-18):** `leads_nitel` es la **TABLA** real (la que escribe n8n) y `nitel_leads` es una **VISTA** sobre ella (la que lee el dashboard / Drizzle). Por eso `setup-dossier.sql` agrega la columna a la tabla **y** recrea la vista. Si agregás columnas nuevas para el dashboard, acordate de exponerlas también en la vista.

> Las columnas `correo_N_html` son **invisibles para n8n**: su workflow escribe en
> `correo_N` (texto plano) y jamás lee ni escribe las `_html`. Por eso agregarlas no
> rompe nada de su operación.

## Cómo aplicarlas

### En dev (Postgres del VPS vía túnel SSH, `127.0.0.1:15432`)

Con el túnel SSH levantado y `DATABASE_URL` en `.env.local`:

```bash
# Con psql:
psql "$DATABASE_URL" -f scripts/setup-correo-html.sql

# Sin psql (usando el pg ya instalado en el proyecto):
DOTENV_CONFIG_PATH=.env.local npx tsx -e "import 'dotenv/config'; import {Pool} from 'pg'; import {readFileSync} from 'fs'; const p=new Pool({connectionString:process.env.DATABASE_URL}); p.query(readFileSync('scripts/setup-correo-html.sql','utf8')).then(()=>p.end());"
```

### En producción (Postgres de Nitel, `172.17.10.72`)

El Postgres de Nitel corre **solo dentro de su red** — no es accesible desde afuera.
La migración hay que correrla **desde dentro de su red** (en el server donde se deploye
el dashboard, o pidiéndosela a su técnico). Es un único comando, sin downtime:

```bash
psql "postgresql://USUARIO:PASS@172.17.10.72:5432/SU_DB" -f scripts/setup-correo-html.sql
```

Como son `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` sobre columnas de texto vacías que
n8n no usa, el cambio es seguro de coordinar con el técnico de Nitel.
