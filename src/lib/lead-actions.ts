"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
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
