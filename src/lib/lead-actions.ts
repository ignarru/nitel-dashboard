"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";

const { leadsNitel } = schema;

/** Guarda las notas internas de un lead (autosave). */
export async function guardarNota(placeId: string, notas: string) {
  await db
    .update(leadsNitel)
    .set({ notas })
    .where(eq(leadsNitel.placeId, placeId));
  revalidatePath(`/secuencia/${placeId}`);
}

/** Edita los datos básicos del lead (nombre, email, rubro). */
export async function editarLead(
  placeId: string,
  datos: { name: string; email: string; category: string },
): Promise<{ ok: boolean; error?: string }> {
  const email = datos.email.trim();
  // Validar email si viene cargado
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "El email no es válido" };
  }
  await db
    .update(leadsNitel)
    .set({
      name: datos.name.trim() || null,
      email: email || null,
      category: datos.category.trim() || null,
    })
    .where(eq(leadsNitel.placeId, placeId));
  revalidatePath(`/secuencia/${placeId}`);
  revalidatePath("/");
  return { ok: true };
}

function revalidarVistas() {
  revalidatePath("/base-de-datos");
  revalidatePath("/");
  revalidatePath("/enviados");
  revalidatePath("/respondieron");
}

/**
 * Borra un lead de la base de datos de forma PERMANENTE (DELETE físico).
 * Irreversible: lo saca de la tabla nitel_leads por completo.
 */
export async function eliminarLead(
  placeId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!placeId) return { ok: false, error: "Falta el identificador del lead" };
  try {
    await db.delete(leadsNitel).where(eq(leadsNitel.placeId, placeId));
    revalidarVistas();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo borrar el lead" };
  }
}

/** Borra varios leads de una (DELETE físico, irreversible). */
export async function eliminarLeadsBulk(
  placeIds: string[],
): Promise<{ ok: boolean; count: number; error?: string }> {
  if (placeIds.length === 0) return { ok: true, count: 0 };
  try {
    await db.delete(leadsNitel).where(inArray(leadsNitel.placeId, placeIds));
    revalidarVistas();
    return { ok: true, count: placeIds.length };
  } catch (e) {
    return {
      ok: false,
      count: 0,
      error: e instanceof Error ? e.message : "No se pudieron borrar los leads",
    };
  }
}
