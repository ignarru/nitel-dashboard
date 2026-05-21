/**
 * Endpoint Server-Sent Events. Multiplexea dos tipos de cambios:
 *   - event "lead:change"    → cambio en leads_nitel
 *   - event "busqueda:change" → cambio en busquedas_logs
 */
import {
  dbEventsListener,
  type LeadsChangeEvent,
  type BusquedasChangeEvent,
} from "@/lib/db-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await dbEventsListener.start();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          /* stream cerrado */
        }
      };

      send("hello", { ok: true, ts: Date.now() });

      const onLeadChange = (payload: LeadsChangeEvent) => send("lead:change", payload);
      const onBusquedaChange = (payload: BusquedasChangeEvent) =>
        send("busqueda:change", payload);

      dbEventsListener.on("leads:change", onLeadChange);
      dbEventsListener.on("busquedas:change", onBusquedaChange);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          /* stream cerrado */
        }
      }, 25_000);

      const abort = () => {
        clearInterval(heartbeat);
        dbEventsListener.off("leads:change", onLeadChange);
        dbEventsListener.off("busquedas:change", onBusquedaChange);
        try {
          controller.close();
        } catch {}
      };

      controller.error = ((err: unknown) => {
        abort();
        throw err;
      }) as never;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
