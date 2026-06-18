import {
  pgTable,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  index,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";

/**
 * Tabla de leads de Nitel — definida por el workflow de n8n del cliente.
 * El dashboard NO la crea: solo lee y actualiza.
 *
 * Flujo:
 *   1. n8n scrapea leads de Google Maps y los inserta acá.
 *   2. n8n redacta el cuerpo de los 3 correos y los pone en correo_1/2/3.
 *      Formato: primera línea = asunto, línea en blanco, resto = cuerpo (texto plano).
 *   3. El dashboard muestra los leads con al menos 1 correo redactado.
 *   4. Al "Enviar ahora", el dashboard:
 *      - manda el correo vía Gmail API
 *      - UPDATE contactado_N = true, hora_enviado_N = NOW()
 */
export const leadsNitel = pgTable(
  "nitel_leads",
  {
    placeId: varchar("place_id", { length: 255 }).primaryKey(),
    name: varchar("name", { length: 500 }),
    category: varchar("category", { length: 255 }),
    address: text("address"),
    phone: varchar("phone", { length: 50 }),
    website: text("website"),
    email: varchar("email", { length: 255 }),
    correo1: varchar("correo_1", { length: 255 }),
    correo2: varchar("correo_2", { length: 255 }),
    correo3: varchar("correo_3", { length: 255 }),
    // HTML editado por el humano en el dashboard. n8n solo escribe correo_N (texto
    // plano); cuando el operador edita en el editor, guardamos acá el HTML con formato
    // (negritas, links, listas) para enviarlo fiel. NULL = nunca se editó → se regenera
    // el HTML desde el texto plano de correo_N.
    correo1Html: text("correo_1_html"),
    correo2Html: text("correo_2_html"),
    correo3Html: text("correo_3_html"),
    rating: numeric("rating", { precision: 2, scale: 1 }),
    reviews: integer("reviews"),
    lat: numeric("lat", { precision: 10, scale: 7 }),
    lng: numeric("lng", { precision: 10, scale: 7 }),
    sourceNode: varchar("source_node", { length: 100 }),
    contactado1: boolean("contactado_1").default(false),
    contactado2: boolean("contactado_2").default(false),
    contactado3: boolean("contactado_3").default(false),
    respondio: boolean("respondio").default(false),
    cualRespondio: varchar("cual_respondio", { length: 50 }),
    respuestaTexto: text("respuesta_texto"),
    respuestaRecibidaAt: timestamp("respuesta_recibida_at", { withTimezone: true }),
    horaEnviado1: timestamp("hora_enviado_1", { withTimezone: true }),
    horaEnviado2: timestamp("hora_enviado_2", { withTimezone: true }),
    horaEnviado3: timestamp("hora_enviado_3", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    archivado: boolean("archivado").notNull().default(false),
    notas: text("notas"),
    // Dossier de la empresa que arma la IA (scraper de n8n) y sirve de contexto para
    // redactar los correos. n8n debe escribir esta columna; el dashboard solo lo muestra.
    dossier: text("dossier"),
  },
  (t) => [
    index("idx_nitel_leads_contactado_1").on(t.contactado1),
    index("idx_nitel_leads_email").on(t.email),
    index("idx_nitel_leads_respondio").on(t.respondio),
    index("idx_nitel_leads_source_node").on(t.sourceNode),
  ],
);

export type LeadNitel = typeof leadsNitel.$inferSelect;

/**
 * Trackeo de búsquedas. El dashboard inserta una fila al disparar el webhook,
 * n8n la actualiza al final del workflow con los contadores.
 */
export const busquedasLogs = pgTable("busquedas_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: text("status").notNull().default("running"),
  criterios: jsonb("criterios"),
  totalScrapeados: integer("total_scrapeados"),
  totalInsertados: integer("total_insertados"),
  descartados: integer("descartados"),
  mensaje: text("mensaje"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export type BusquedaLog = typeof busquedasLogs.$inferSelect;

/**
 * Parsea el contenido de una columna correo_N.
 * Formato esperado: primera línea = asunto, línea en blanco, resto = cuerpo.
 */
export function parseCorreoColumna(raw: string | null): { asunto: string; cuerpo: string } | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const idx = trimmed.indexOf("\n");
  if (idx === -1) return { asunto: trimmed, cuerpo: "" };
  const asunto = trimmed.slice(0, idx).trim();
  const cuerpo = trimmed.slice(idx + 1).replace(/^\n+/, "");
  return { asunto, cuerpo };
}

/**
 * Convierte cuerpo texto plano a HTML simple (cada doble salto = párrafo).
 */
export function cuerpoTextoAHtml(texto: string): string {
  return texto
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

/**
 * Convierte HTML del editor de vuelta a texto plano para guardar en correo_N.
 */
export function htmlACuerpoTexto(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<p>/gi, "")
    .replace(/<\/p>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/**
 * Combina asunto + cuerpo en el formato que va a la columna correo_N.
 */
export function combinarCorreo(asunto: string, cuerpoTexto: string): string {
  return `${asunto.trim()}\n\n${cuerpoTexto.trim()}`;
}
