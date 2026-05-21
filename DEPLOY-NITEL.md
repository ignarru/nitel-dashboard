# Dashboard de correos Nitel — Documentación de despliegue

> Documento para el técnico que va a poner el dashboard en producción en un servidor propio de Nitel (Linux/Ubuntu).
> Lo escribió IABYIA. Cualquier duda puntual, consultar con Ignacio.

---

## 1. Qué es esto

Es una aplicación web (un **dashboard**) que le permite a Nitel **revisar, editar y enviar manualmente** los correos de prospección que hoy genera el workflow de n8n, en lugar de mandarlos automáticos. El flujo completo es:

```
1. El usuario busca leads desde el dashboard (o desde el form de n8n).
2. n8n scrapea Google Maps (Apify) + saca emails (Firecrawl) + inserta los leads en Postgres.
3. Otro workflow de n8n redacta los 3 correos de cada lead y los guarda en la base.
4. El dashboard muestra esos leads con sus correos listos.
5. El usuario revisa/edita y envía cada correo (o varios de una) con Gmail.
6. Si un lead responde, otro workflow lo detecta y lo marca en la base.
7. El dashboard muestra respuestas, estadísticas, etc. — todo en tiempo real.
```

El dashboard **no scrapea ni redacta nada**: eso lo siguen haciendo los workflows de n8n. El dashboard solo **lee y actualiza** la base de datos, manda correos por Gmail, y dispara los workflows vía webhook.

---

## 2. Arquitectura

```
                 ┌─────────────────────────────────────────────┐
                 │              Servidor de Nitel               │
                 │                                             │
   Navegador ───▶│   Dashboard (Next.js)  :3000                │
   (Chrome)      │        │         ▲                          │
                 │        │         │ LISTEN/NOTIFY (tiempo real)│
                 │        ▼         │                          │
                 │   PostgreSQL  (tabla leads_nitel +          │
                 │               busquedas_logs)               │
                 │        ▲                                    │
                 │        │ lee/escribe                        │
                 │   n8n (workflows de scraping y respuestas)  │
                 └────────┼────────────────────────────────────┘
                          │
                  Gmail API (manda los correos)
                  Apify / Firecrawl (scraping, desde n8n)
```

**Componentes que tienen que coexistir:**
- **El dashboard** (esta app) — lo que hay que desplegar.
- **PostgreSQL** — ya lo tiene Nitel (es donde n8n guarda los leads).
- **n8n** — ya lo tiene Nitel (los workflows ya existen).
- **Gmail API** — credenciales de Google (ver sección 8).

---

## 3. Stack tecnológico

| Componente | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.6 |
| Runtime | Node.js | 20+ (recomendado 20 LTS o 22 LTS) |
| Lenguaje | TypeScript | 5 |
| UI | React + TailwindCSS v4 + shadcn/ui | React 19 |
| ORM | Drizzle ORM | 0.45 |
| Driver DB | pg (node-postgres) | 8.21 |
| Editor de texto | TipTap | 3.23 |
| Gmail | googleapis | 172 |
| Gestor de paquetes | npm | (viene con Node) |

> **Importante:** el proyecto usa **Next.js 16**, que requiere **Node.js 20 o superior**. Verificar con `node -v` antes de empezar.

---

## 4. Estructura del proyecto

```
nitel-dashboard/
├── src/
│   ├── app/
│   │   ├── (app)/                  # Páginas del dashboard
│   │   │   ├── page.tsx            # Bandeja (home) — filtros, buscador, bulk, paginación
│   │   │   ├── buscar/             # Formulario para buscar leads (dispara n8n)
│   │   │   ├── enviados/           # Historial de correos enviados
│   │   │   ├── respondieron/       # Leads que respondieron
│   │   │   ├── estadisticas/       # Métricas y tasas de respuesta
│   │   │   ├── secuencia/[id]/     # Detalle de un lead (editor de correos)
│   │   │   └── layout.tsx          # Sidebar + contador diario de envíos
│   │   ├── api/
│   │   │   ├── auth/google/        # OAuth con Gmail (init + callback)
│   │   │   └── stream/leads/       # Server-Sent Events (tiempo real)
│   │   └── layout.tsx              # Root layout (fuente, dark mode)
│   ├── components/                 # Componentes de UI
│   ├── db/
│   │   ├── client.ts               # Pool de conexión a Postgres
│   │   └── schema.ts               # Schema de las tablas (Drizzle)
│   └── lib/
│       ├── gmail.ts                # Envío de correos (OAuth o Service Account)
│       ├── correo-actions.ts       # Acciones: enviar, archivar, bulk
│       ├── buscar-leads-action.ts  # Dispara el webhook de n8n
│       ├── lead-actions.ts         # Notas y edición de datos del lead
│       ├── db-events.ts            # Listener de LISTEN/NOTIFY de Postgres
│       └── fecha.ts                # Formateo de fechas en hora Argentina
├── scripts/                        # Scripts SQL de migración (ver sección 5)
├── secrets/                        # Credenciales (NO se versiona — ver sección 8)
├── .env.local                      # Variables de entorno (NO se versiona)
├── package.json
├── next.config.ts
└── drizzle.config.ts
```

---

## 5. Base de datos

El dashboard se conecta a **la misma base PostgreSQL donde n8n guarda los leads**. No usa una base separada.

### 5.1 Tabla `leads_nitel`

Esta tabla **ya existe** (la crea/usa el workflow de n8n). El dashboard le **agregó algunas columnas nuevas** que n8n no tenía. **Hay que correr la migración (5.4) en la base de Nitel** para que esas columnas existan.

Columnas que usa el dashboard:

| Columna | Tipo | Quién la llena | Para qué |
|---|---|---|---|
| `place_id` | varchar(255) PK | n8n (Google Maps) | Identificador único del lead |
| `name` | varchar(500) | n8n | Nombre del negocio |
| `category` | varchar(255) | n8n | Rubro |
| `address`, `phone`, `website` | text/varchar | n8n | Datos de contacto |
| `email` | varchar(255) | n8n | A dónde se manda el correo |
| `correo_1`, `correo_2`, `correo_3` | varchar | n8n (redacta) | Contenido de cada correo. **Formato: 1ª línea = asunto, línea en blanco, resto = cuerpo** |
| `rating`, `reviews`, `lat`, `lng` | numeric/int | n8n | Datos de Google Maps |
| `source_node` | varchar(100) | n8n | Origen del lead |
| `contactado_1/2/3` | boolean | **dashboard** (al enviar) | Si ya se mandó cada correo |
| `hora_enviado_1/2/3` | timestamptz | **dashboard** (al enviar) | Cuándo se mandó |
| `respondio` | boolean | n8n (workflow de respuestas) | Si el lead contestó |
| `cual_respondio` | varchar(50) | n8n | A qué correo respondió (acepta "Contacto 1" o "1") |
| **`respuesta_texto`** ⭐ | text | n8n (workflow de respuestas) | El cuerpo del mail que respondió el lead |
| **`respuesta_recibida_at`** ⭐ | timestamptz | n8n | Cuándo respondió |
| **`created_at`** ⭐ | timestamptz | DEFAULT NOW() | Cuándo se insertó (para contar leads por búsqueda) |
| **`archivado`** ⭐ | boolean | **dashboard** | Si se archivó (lo saca de la bandeja) |
| **`notas`** ⭐ | text | **dashboard** | Notas internas privadas |

⭐ = columnas **nuevas** agregadas por el dashboard. **Hay que crearlas con la migración (5.4).**

### 5.2 Tabla `busquedas_logs` (NUEVA — la crea el dashboard)

Registra cada búsqueda de leads para mostrar el progreso en tiempo real. **Hay que crearla** (está en la migración 5.4).

| Columna | Tipo | Para qué |
|---|---|---|
| `id` | uuid PK | ID de la búsqueda (el dashboard lo genera y se lo pasa a n8n) |
| `status` | text | `running` / `completed` / `failed` |
| `criterios` | jsonb | Los criterios de búsqueda (industria, ciudad, etc.) |
| `total_scrapeados` | int | Cuántos leads trajo Apify |
| `total_insertados` | int | Cuántos se guardaron (nuevos) |
| `descartados` | int | Cuántos no se guardaron (ya existían, sin web, sin email) |
| `mensaje` | text | Mensaje de resultado |
| `error_message` | text | Si falló, el error |
| `started_at`, `finished_at` | timestamptz | Tiempos |

### 5.3 Triggers de tiempo real (LISTEN/NOTIFY) — IMPRESCINDIBLES

El dashboard se actualiza **en tiempo real** (sin recargar) usando el mecanismo `LISTEN/NOTIFY` de PostgreSQL. Para que funcione, **hay que crear unos triggers** que emiten una notificación cada vez que cambia un lead o una búsqueda. **Están en la migración (5.4). Sin estos triggers el dashboard funciona igual pero NO se actualiza solo** (habría que recargar la página a mano).

### 5.4 Migración completa (correr UNA vez en la base de Nitel)

Guardá esto como `migracion.sql` y corré: `psql -U <usuario> -d <base> -f migracion.sql`

```sql
-- ============================================================
-- MIGRACIÓN DASHBOARD NITEL — correr una sola vez
-- ============================================================

-- 1) Columnas nuevas en leads_nitel (la tabla ya existe)
ALTER TABLE leads_nitel ADD COLUMN IF NOT EXISTS respuesta_texto TEXT;
ALTER TABLE leads_nitel ADD COLUMN IF NOT EXISTS respuesta_recibida_at TIMESTAMPTZ;
ALTER TABLE leads_nitel ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE leads_nitel ADD COLUMN IF NOT EXISTS archivado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE leads_nitel ADD COLUMN IF NOT EXISTS notas TEXT;

-- Índices útiles
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
```

> **Nota:** los scripts originales también están en la carpeta `scripts/` del proyecto (`setup-notify.sql`, `setup-respuestas.sql`, `setup-busquedas-logs.sql`). El SQL de arriba los unifica.

---

## 6. Variables de entorno

El dashboard se configura con un archivo `.env.local` (o variables de entorno del contenedor). **Esto es lo que cambia entre el entorno de IABYIA y el de Nitel.**

```bash
# ── BASE DE DATOS ──────────────────────────────────────────
# Conexión al Postgres de Nitel (el mismo que usa n8n).
# Formato: postgresql://USUARIO:PASSWORD@HOST:PUERTO/BASE
# OJO: si el password tiene caracteres especiales (@ ! % etc.), hay que
# escaparlos en URL-encoding (@ = %40, ! = %21, etc.)
DATABASE_URL=postgresql://usuario:password@localhost:5432/nombre_base

# ── GMAIL ──────────────────────────────────────────────────
# Opción A (RECOMENDADA para producción): Service Account.
# Requiere un JSON de Service Account + domain-wide delegation autorizado
# en el Google Workspace de Nitel (ver sección 8).
GOOGLE_SA_JSON=./secrets/sa-key.json
IMPERSONATE_EMAIL=clientes@nitel.com.ar

# Opción B (alternativa, OAuth): si NO se usa Service Account, dejar
# vacías las dos de arriba y completar estas. Requiere un login interactivo
# una vez (ver sección 8).
# GOOGLE_OAUTH_CLIENT_ID=...
# GOOGLE_OAUTH_CLIENT_SECRET=...
# GOOGLE_OAUTH_REDIRECT_URI=https://dashboard.nitel.com.ar/api/auth/google/callback

# Email desde el que salen los correos
FROM_EMAIL=clientes@nitel.com.ar
FROM_NAME=Nitel

# ── n8n ────────────────────────────────────────────────────
# URL del webhook de n8n que dispara la búsqueda de leads (workflow 30).
# En el server de Nitel será su propia URL de n8n.
N8N_WEBHOOK_BUSCAR_LEADS=https://n8n.NITEL.com/webhook/nitel-dashboard

# ── GENERAL ────────────────────────────────────────────────
# URL pública del dashboard (la que va a usar la gente)
NEXT_PUBLIC_BASE_URL=https://dashboard.nitel.com.ar

# ── MODO PRUEBA (DEJAR VACÍO EN PRODUCCIÓN) ────────────────
# Si tiene un email, TODOS los correos se mandan ahí en vez de al lead real.
# Sirve para probar sin spamear. EN PRODUCCIÓN DEBE QUEDAR VACÍO O BORRADO.
TEST_EMAIL_OVERRIDE=
```

### Resumen de qué cambia entre IABYIA (dev) y Nitel (prod)

| Variable | En IABYIA (dev) | En Nitel (prod) |
|---|---|---|
| `DATABASE_URL` | Postgres de IABYIA vía túnel | **Postgres de Nitel (localhost del server)** |
| `N8N_WEBHOOK_BUSCAR_LEADS` | n8n.servidorn8n.space | **URL de n8n de Nitel** |
| `GOOGLE_SA_JSON` + `IMPERSONATE_EMAIL` | (vacío, usa OAuth) | **Service Account de Nitel** |
| `NEXT_PUBLIC_BASE_URL` | localhost:3000 | **dominio público de Nitel** |
| `TEST_EMAIL_OVERRIDE` | un email de prueba | **VACÍO** |

---

## 7. Integración con n8n

El dashboard se conecta con **4 workflows** de n8n que ya existen. No hay que crearlos de cero, solo asegurarse de que estén activos y apuntando a la base correcta.

### Workflow A — "Buscar Leads" (el que dispara el dashboard)
- **Trigger:** un nodo **Webhook** (POST) con un path (ej. `nitel-dashboard`).
- El dashboard le manda `multipart/form-data` con los criterios + un campo `busqueda_id` (UUID).
- Hace el scraping (Apify) + emails (Firecrawl) + INSERT en `leads_nitel`.
- **Al final** (salida "done" del Loop) tiene un nodo **Postgres → Execute Query** que marca la búsqueda como completada:
  ```sql
  UPDATE busquedas_logs AS b
  SET status = 'completed',
      total_scrapeados = <cantidad de Preparar Datos>,
      total_insertados = (SELECT COUNT(*)::int FROM leads_nitel WHERE created_at >= b.started_at),
      descartados = <scrapeados> - <insertados>,
      finished_at = NOW()
  WHERE b.id = '<busqueda_id del webhook>';
  ```
- La URL de este webhook va en `N8N_WEBHOOK_BUSCAR_LEADS`.
- El webhook responde **inmediatamente** (modo "Immediately"), no espera a que termine.

### Workflow B — "Redactar correos"
- Se dispara **automáticamente** cuando se inserta un lead nuevo en `leads_nitel` (trigger de Postgres en n8n).
- Redacta los 3 correos con IA y los guarda en `correo_1/2/3`.
- Formato de cada columna: **primera línea = asunto, línea en blanco, resto = cuerpo**.

### Workflow C — "Detector de respuestas"
- **Trigger:** Email IMAP (lee la casilla de Nitel).
- Cuando llega una respuesta, busca el lead por email y actualiza:
  - `respondio = true`
  - `cual_respondio` = "Contacto 1/2/3"
  - `respuesta_texto` = cuerpo del mail (limpio)
  - `respuesta_recibida_at` = ahora

### Workflow D — "Error Handler"
- **Trigger:** Error Trigger.
- Configurado como "Error Workflow" del Workflow A.
- Si la búsqueda falla, marca `busquedas_logs.status = 'failed'`.

> **Para Nitel:** estos workflows ya están en el n8n de prueba. Hay que **exportarlos e importarlos** en el n8n de Nitel, cambiar las credenciales de Postgres (a la base local de Nitel), y actualizar la URL del webhook en `N8N_WEBHOOK_BUSCAR_LEADS`.

---

## 8. Autenticación con Gmail

El dashboard manda correos vía la **Gmail API**. Hay dos formas:

### Opción A — Service Account (RECOMENDADA para producción)

Una "cuenta robot" que puede mandar en nombre de `clientes@nitel.com.ar` sin login interactivo. Es lo ideal para un servidor.

**Setup (lo hace un admin del Google Workspace de Nitel):**
1. En Google Cloud Console, crear un proyecto y una **Service Account**.
2. Generar una **clave JSON** y guardarla en `secrets/sa-key.json` del servidor.
3. Habilitar la **Gmail API** en el proyecto.
4. **Domain-wide delegation:** en `admin.google.com` → Seguridad → Controles de API → Delegación en todo el dominio → Agregar:
   - **Client ID:** (el del JSON de la Service Account)
   - **Scope:** `https://www.googleapis.com/auth/gmail.send`
5. En `.env.local`:
   ```
   GOOGLE_SA_JSON=./secrets/sa-key.json
   IMPERSONATE_EMAIL=clientes@nitel.com.ar
   ```

> El código ya soporta esto. Si esas dos variables están seteadas, el dashboard usa la Service Account automáticamente.

### Opción B — OAuth (alternativa, requiere login una vez)

1. Crear un OAuth Client (tipo Web) en Google Cloud Console.
2. Redirect URI: `https://dashboard.nitel.com.ar/api/auth/google/callback`
3. Variables: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`.
4. Una vez deployado, entrar a `https://dashboard.nitel.com.ar/api/auth/google/init`, hacer login con `clientes@nitel.com.ar` y dar permiso. Se guarda un token en `secrets/oauth-token.json`.
5. **Contra:** el token puede expirar si cambian la contraseña de la cuenta. Por eso para producción se recomienda la Opción A.

> **La carpeta `secrets/` NUNCA se sube a git ni a la imagen pública.** Se monta como volumen o se copia manualmente al servidor.

---

## 9. Correr en desarrollo (para probar antes de producción)

```bash
# 1. Instalar dependencias
npm install

# 2. Crear .env.local con las variables (ver sección 6)

# 3. Correr la migración SQL en la base (sección 5.4)

# 4. Levantar en modo desarrollo
npm run dev
# → queda en http://localhost:3000
```

---

## 10. Despliegue en producción (Linux/Ubuntu)

Hay dos formas. **La opción Docker es la recomendada** (más limpia y reproducible).

### Pre-requisito en `next.config.ts`

Para Docker, agregar `output: "standalone"`:

```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
};
export default nextConfig;
```

### Opción A — Docker (recomendada)

**`Dockerfile`** (crear en la raíz del proyecto):

```dockerfile
# ---- Build ----
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Next standalone: copia solo lo necesario
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

**`docker-compose.yml`** (ejemplo):

```yaml
services:
  dashboard:
    build: .
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"   # solo local; el reverse proxy expone al público
    env_file:
      - .env.local
    volumes:
      - ./secrets:/app/secrets:ro   # credenciales Gmail (solo lectura)
    # Si Postgres corre en el mismo host (no en otro contenedor),
    # usar host.docker.internal o la red del host:
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

> Si Postgres corre **en el mismo servidor** (no en contenedor), en `DATABASE_URL` usar `host.docker.internal` en vez de `localhost`. Si Postgres está en otro contenedor de la misma red Docker, usar el nombre del contenedor.

**Deploy:**
```bash
docker compose up -d --build
docker compose logs -f dashboard   # ver logs
```

### Opción B — Node directo con PM2 (sin Docker)

```bash
# 1. Instalar Node 22 (con nvm o nodesource)
# 2. En el proyecto:
npm ci
npm run build

# 3. Instalar PM2 (gestor de procesos)
npm install -g pm2

# 4. Levantar
pm2 start npm --name nitel-dashboard -- start
pm2 save
pm2 startup   # para que arranque al reiniciar el server
```

### Reverse proxy + dominio + SSL (cualquiera de las dos opciones)

El dashboard escucha en el puerto 3000. Hay que ponerle un reverse proxy adelante para el dominio y el HTTPS.

**Con Nginx:**
```nginx
server {
    server_name dashboard.nitel.com.ar;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;

        # IMPORTANTE para el tiempo real (Server-Sent Events):
        proxy_buffering off;
        proxy_read_timeout 86400s;
    }
}
```
Después: `sudo certbot --nginx -d dashboard.nitel.com.ar` para el SSL.

> **Crítico:** la línea `proxy_buffering off;` es necesaria para que funcione la actualización en tiempo real (el endpoint `/api/stream/leads`). Si el proxy bufferea, el dashboard no se actualiza solo.

**Alternativa con Caddy** (más simple, SSL automático):
```
dashboard.nitel.com.ar {
    reverse_proxy 127.0.0.1:3000
}
```

---

## 11. Checklist de migración (paso a paso)

```
[ ] 1. Tener Node 20+ en el servidor (o Docker).
[ ] 2. Clonar/copiar el proyecto al servidor.
[ ] 3. Correr la migración SQL (sección 5.4) en la base de Nitel.
[ ] 4. Crear el .env.local con los valores de Nitel (sección 6):
       [ ] DATABASE_URL → Postgres de Nitel
       [ ] N8N_WEBHOOK_BUSCAR_LEADS → n8n de Nitel
       [ ] Gmail (Service Account recomendada) → sección 8
       [ ] FROM_EMAIL = clientes@nitel.com.ar
       [ ] NEXT_PUBLIC_BASE_URL = dominio público
       [ ] TEST_EMAIL_OVERRIDE = VACÍO  ⚠️
[ ] 5. Poner el JSON de credenciales en secrets/ (Gmail).
[ ] 6. Importar los 4 workflows en el n8n de Nitel y:
       [ ] cambiar credenciales de Postgres a la base local
       [ ] verificar que el webhook de "Buscar Leads" esté activo
       [ ] verificar el nodo final que actualiza busquedas_logs
       [ ] configurar el Error Handler como "Error Workflow"
[ ] 7. Agregar output: "standalone" en next.config.ts (si se usa Docker).
[ ] 8. Build + deploy (Docker o PM2).
[ ] 9. Configurar reverse proxy + dominio + SSL (con proxy_buffering off).
[ ] 10. Verificación (sección 12).
```

---

## 12. Verificación post-deploy

```
[ ] El dashboard abre en el dominio (https://dashboard.nitel.com.ar).
[ ] La bandeja muestra los leads (si hay leads con correos redactados).
[ ] El contador "Enviados hoy" abajo a la izquierda muestra un número.
[ ] Buscar leads: el form dispara n8n y aparece el cartel de progreso.
[ ] El cartel pasa de "Buscando..." a "Completada" cuando n8n termina.
[ ] Los leads nuevos aparecen solos en la bandeja (SIN recargar) → confirma tiempo real.
[ ] Enviar un correo de prueba (con TEST_EMAIL_OVERRIDE a una casilla propia primero).
[ ] Verificar que el correo llega y que en la base contactado_N=true.
[ ] Sacar TEST_EMAIL_OVERRIDE y probar un envío real.
```

---

## 13. Problemas comunes (troubleshooting)

| Síntoma | Causa probable | Solución |
|---|---|---|
| `DATABASE_URL no está definida` | Falta la variable | Revisar .env.local / env del contenedor |
| El dashboard no se actualiza solo | Falta el trigger NOTIFY o el proxy bufferea | Correr migración (5.4) + `proxy_buffering off` en Nginx |
| `password authentication failed` | Password mal escapado en DATABASE_URL | Escapar caracteres especiales (URL-encoding) |
| Al enviar: `unauthorized_client` | Domain-wide delegation no autorizado | Autorizar el Client ID en admin.google.com (sección 8) |
| Al enviar: `Gmail no está autorizado` | Faltan credenciales | Service Account o hacer el login OAuth |
| La búsqueda queda "Buscando..." para siempre | El nodo final de n8n no actualiza busquedas_logs | Revisar el Execute Query del Workflow A |
| Los correos salen al lead real en pruebas | TEST_EMAIL_OVERRIDE vacío | Setearlo mientras se prueba |
| Las respuestas no aparecen | Workflow C no guarda respuesta_texto | Verificar que el workflow llene esa columna |

---

## 14. Notas finales

- **La carpeta `secrets/` y el `.env.local` contienen credenciales. Nunca subirlos a un repositorio público.**
- **El `TEST_EMAIL_OVERRIDE` debe quedar vacío en producción**, sino todos los correos van a esa casilla en vez de a los leads.
- El dashboard está pensado para **un volumen moderado**. Gmail limita ~2000 correos/día para cuentas Workspace (el contador del sidebar lo monitorea).
- Toda la lógica de horarios usa **hora de Argentina** (`America/Argentina/Buenos_Aires`), sin importar la zona del servidor.
- Si algo del workflow de n8n cambia (nombres de nodos, formato de `correo_N`, etc.), avisar a IABYIA porque el dashboard depende de ese formato.

---

*Documento generado por IABYIA. Para soporte técnico del dashboard, contactar a Ignacio.*
