# Nitel — Dashboard de revisión de correos

Dashboard web para que Nitel **revise, edite y envíe manualmente** los correos de prospección que genera el workflow de n8n, en lugar de mandarlos automáticos.

> 📖 **Para desplegar en un servidor, leer [`DEPLOY-NITEL.md`](./DEPLOY-NITEL.md)** — tiene todo: base de datos, variables de entorno, integración con n8n, Gmail, Docker, reverse proxy y checklist de migración.

---

## Qué hace

- **Bandeja** de leads con sus 3 correos redactados, listos para revisar y enviar.
- **Buscar leads**: dispara el scraping de Google Maps (vía n8n) desde el propio dashboard.
- **Editor** de cada correo con preview tipo Gmail, validaciones y confirmación antes de enviar.
- **Acciones masivas**: enviar un correo a varios leads de una, archivar, etc.
- **Filtros + buscador** por estado, rubro, origen, nombre/email.
- **Auto-pausa**: si un lead responde, deja de mandarle los correos siguientes.
- **Respuestas**: detecta y muestra lo que responden los leads.
- **Estadísticas**: tasa de respuesta, funnel, por industria, actividad reciente.
- **Tiempo real**: la bandeja se actualiza sola (Postgres LISTEN/NOTIFY + Server-Sent Events).

## Stack

Next.js 16 · React 19 · TypeScript · TailwindCSS v4 · Drizzle ORM · PostgreSQL · TipTap · Gmail API.

## Correr en desarrollo

```bash
npm install
# crear .env.local (ver DEPLOY-NITEL.md sección 6)
# correr la migración SQL (ver DEPLOY-NITEL.md sección 5.4)
npm run dev
```

Queda en http://localhost:3000

## Estructura

```
src/
├── app/(app)/        # Páginas: bandeja, buscar, enviados, respondieron, estadísticas, secuencia
├── app/api/          # OAuth Gmail + stream SSE
├── components/       # UI
├── db/               # Schema (Drizzle) + pool de conexión
└── lib/              # Gmail, acciones, eventos de DB, fechas
scripts/              # SQL de migración
```

## Variables de entorno

Ver [`DEPLOY-NITEL.md`](./DEPLOY-NITEL.md) sección 6. En resumen:

- `DATABASE_URL` — Postgres (el mismo que usa n8n)
- `N8N_WEBHOOK_BUSCAR_LEADS` — webhook de n8n para buscar leads
- `GOOGLE_SA_JSON` + `IMPERSONATE_EMAIL` — Gmail con Service Account (producción)
- `FROM_EMAIL`, `FROM_NAME` — remitente
- `NEXT_PUBLIC_BASE_URL` — URL pública
- `TEST_EMAIL_OVERRIDE` — modo prueba (vacío en producción)

## ⚠️ Importante

- **Nunca** subir `.env.local` ni la carpeta `secrets/` (credenciales). Ya están en `.gitignore`.
- En producción, `TEST_EMAIL_OVERRIDE` debe quedar **vacío**.
- El dashboard depende del formato de la columna `correo_N` que llena n8n (primera línea = asunto).
