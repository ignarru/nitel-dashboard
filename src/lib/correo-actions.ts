"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { combinarCorreo, htmlACuerpoTexto } from "@/db/schema";
import { sendEmail, isAuthorized } from "@/lib/gmail";

const { leadsNitel } = schema;

type Orden = 1 | 2 | 3;
type SetLead = Partial<typeof leadsNitel.$inferInsert>;

function setCorreo(orden: Orden, value: string): SetLead {
  switch (orden) {
    case 1: return { correo1: value };
    case 2: return { correo2: value };
    case 3: return { correo3: value };
  }
}

function setEnviado(orden: Orden, hora: Date): SetLead {
  switch (orden) {
    case 1: return { contactado1: true, horaEnviado1: hora };
    case 2: return { contactado2: true, horaEnviado2: hora };
    case 3: return { contactado3: true, horaEnviado3: hora };
  }
}

function getCorreoRaw(lead: typeof leadsNitel.$inferSelect, orden: Orden): string | null {
  switch (orden) {
    case 1: return lead.correo1;
    case 2: return lead.correo2;
    case 3: return lead.correo3;
  }
}

function getContactado(lead: typeof leadsNitel.$inferSelect, orden: Orden): boolean | null {
  switch (orden) {
    case 1: return lead.contactado1;
    case 2: return lead.contactado2;
    case 3: return lead.contactado3;
  }
}

/**
 * Guarda el borrador (asunto + cuerpoHtml) en la columna correo_N del lead.
 * Convierte el HTML del editor a texto plano antes de guardar.
 */
export async function guardarBorrador(
  placeId: string,
  orden: Orden,
  asunto: string,
  cuerpoHtml: string,
) {
  const cuerpoTexto = htmlACuerpoTexto(cuerpoHtml);
  const combinado = combinarCorreo(asunto, cuerpoTexto);
  await db
    .update(leadsNitel)
    .set(setCorreo(orden, combinado))
    .where(eq(leadsNitel.placeId, placeId));
  revalidatePath(`/secuencia/${placeId}`);
}

/**
 * Envía un correo al toque vía Gmail. Marca contactado_N = true y hora_enviado_N = NOW().
 */
export async function enviarAhora(
  placeId: string,
  orden: Orden,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAuthorized())) {
    return {
      ok: false,
      error: "Gmail no está conectado todavía. Andá a /api/auth/google/init para autorizar.",
    };
  }

  const [lead] = await db
    .select()
    .from(leadsNitel)
    .where(eq(leadsNitel.placeId, placeId))
    .limit(1);
  if (!lead) return { ok: false, error: "Lead no encontrado" };
  if (!lead.email) return { ok: false, error: "El lead no tiene email" };

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(lead.email.trim())) {
    return { ok: false, error: `El email del lead no es válido: ${lead.email}` };
  }

  // AUTO-PAUSE: si el lead ya respondió, no se mandan más correos de la secuencia
  if (lead.respondio && lead.respuestaTexto && lead.respuestaTexto.trim() !== "") {
    return {
      ok: false,
      error: "El lead ya respondió. No se envían más correos automáticos de la secuencia.",
    };
  }

  if (getContactado(lead, orden)) {
    return { ok: false, error: `Este correo ya fue enviado` };
  }

  const raw = getCorreoRaw(lead, orden);
  if (!raw) return { ok: false, error: `El correo ${orden} no tiene contenido` };

  // El formato es: primera línea = asunto, resto = cuerpo texto plano
  const trimmed = raw.trim();
  const idx = trimmed.indexOf("\n");
  const asunto = (idx === -1 ? trimmed : trimmed.slice(0, idx)).trim();
  const cuerpoTexto = idx === -1 ? "" : trimmed.slice(idx + 1).replace(/^\n+/, "");

  // Validar que no esté vacío
  if (!asunto) return { ok: false, error: "El asunto está vacío. Completalo antes de enviar." };
  if (!cuerpoTexto.trim()) {
    return { ok: false, error: "El cuerpo del correo está vacío. Completalo antes de enviar." };
  }

  const cuerpoHtml = cuerpoTexto
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");

  // Modo prueba: TEST_EMAIL_OVERRIDE redirige a una casilla controlada.
  // La DB se actualiza igual con el lead original.
  const destinatarioReal = process.env.TEST_EMAIL_OVERRIDE?.trim() || lead.email;

  try {
    await sendEmail({ to: destinatarioReal, subject: asunto, html: cuerpoHtml });
    await db
      .update(leadsNitel)
      .set(setEnviado(orden, new Date()))
      .where(eq(leadsNitel.placeId, placeId));

    revalidatePath(`/secuencia/${placeId}`);
    revalidatePath("/");
    revalidatePath("/enviados");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

/**
 * Envía el correo `orden` a varios leads de una. Cada uno pasa por las mismas
 * validaciones de enviarAhora (auto-pause, email válido, contenido no vacío, etc).
 */
export async function enviarBulk(
  placeIds: string[],
  orden: Orden,
): Promise<{ enviados: number; fallidos: number; errores: string[] }> {
  let enviados = 0;
  const errores: string[] = [];
  for (const placeId of placeIds) {
    const res = await enviarAhora(placeId, orden);
    if (res.ok) enviados++;
    else errores.push(res.error ?? "error desconocido");
  }
  return { enviados, fallidos: errores.length, errores };
}

/** Archiva varios leads de una (los saca de la bandeja). */
export async function archivarBulk(placeIds: string[]): Promise<{ ok: boolean; count: number }> {
  if (placeIds.length === 0) return { ok: true, count: 0 };
  await db
    .update(leadsNitel)
    .set({ archivado: true })
    .where(inArray(leadsNitel.placeId, placeIds));
  revalidatePath("/");
  return { ok: true, count: placeIds.length };
}
