"use server";

import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";

const { busquedasLogs } = schema;

export type BuscarLeadsResult = {
  ok: boolean;
  error?: string;
  /** ID de la fila en busquedas_logs para que el cliente se suscriba al progreso */
  busquedaId?: string;
};

/**
 * Inicia una búsqueda:
 *  1. Inserta una fila en busquedas_logs con status='running' y los criterios
 *  2. Dispara el webhook a n8n (fire-and-forget — no espera la respuesta)
 *  3. Devuelve el busqueda_id al cliente, que se suscribe a SSE para ver progreso
 *
 * n8n al final del workflow actualiza la fila con los contadores y status='completed'.
 * Eso dispara NOTIFY → SSE → el dashboard muestra el cartel.
 */
export async function buscarLeads(formData: FormData): Promise<BuscarLeadsResult> {
  const url = process.env.N8N_WEBHOOK_BUSCAR_LEADS;
  if (!url) {
    return { ok: false, error: "N8N_WEBHOOK_BUSCAR_LEADS no está configurado en .env.local" };
  }

  const industria = (formData.get("Industria/Sector") as string | null)?.trim() ?? "";
  const ciudad = (formData.get("Ciudad") as string | null)?.trim() ?? "";
  const provincia = (formData.get("Provincia") as string | null)?.trim() ?? "";
  const pais = (formData.get("Pais") as string | null)?.trim() ?? "";
  const cantidad = parseInt((formData.get("Cantidad de resultados") as string) ?? "0", 10) || 0;
  const rating = (formData.get("Rating mínimo (estrellas)") as string | null)?.trim() ?? "";
  const radio = parseFloat((formData.get("Radio en km (solo aplica con KMZ)") as string) ?? "0");
  const kmz = formData.get("Archivo KMZ/KML (opcional)") as File | null;

  if (!kmz?.size && !ciudad && !provincia && !pais && !industria) {
    return {
      ok: false,
      error: "Tenés que subir un KMZ o indicar al menos industria/país/provincia/ciudad",
    };
  }

  // 1. Crear la fila de tracking
  const [row] = await db
    .insert(busquedasLogs)
    .values({
      status: "running",
      criterios: {
        industria,
        ciudad,
        provincia,
        pais,
        cantidad,
        rating,
        radio,
        con_kmz: !!kmz?.size,
        archivo_kmz: kmz?.name ?? null,
      },
    })
    .returning({ id: busquedasLogs.id });

  const busquedaId = row.id;

  // 2. Adjuntar busqueda_id y tiene_kmz al FormData
  const tieneKmz = !!kmz?.size;
  formData.set("tiene_kmz", tieneKmz ? "true" : "false");
  formData.set("busqueda_id", busquedaId);
  if (!tieneKmz) {
    formData.delete("Archivo KMZ/KML (opcional)");
  }

  // 3. Disparar webhook fire-and-forget. NO await del flujo entero.
  //    Solo esperamos al ACK del HTTP inicial (n8n responde 200 ~ inmediato con Immediately mode).
  try {
    const res = await fetch(url, { method: "POST", body: formData });
    if (!res.ok) {
      // Marcamos la búsqueda como fallida acá mismo
      const errText = await res.text().catch(() => "");
      await db
        .update(busquedasLogs)
        .set({
          status: "failed",
          errorMessage: `n8n respondió ${res.status}: ${errText.slice(0, 200) || "(sin cuerpo)"}`,
          finishedAt: new Date(),
        })
        .where(eq(busquedasLogs.id, busquedaId));
      return {
        ok: false,
        error: `n8n respondió ${res.status}. La búsqueda quedó marcada como fallida.`,
        busquedaId,
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    await db
      .update(busquedasLogs)
      .set({ status: "failed", errorMessage: msg, finishedAt: new Date() })
      .where(eq(busquedasLogs.id, busquedaId));
    return { ok: false, error: `No se pudo contactar n8n: ${msg}`, busquedaId };
  }

  return { ok: true, busquedaId };
}

/** Lee el estado actual de una búsqueda. Para polling inicial / fallback. */
export async function getBusquedaStatus(busquedaId: string) {
  const [row] = await db
    .select()
    .from(busquedasLogs)
    .where(eq(busquedasLogs.id, busquedaId))
    .limit(1);
  return row ?? null;
}
