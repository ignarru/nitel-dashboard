/**
 * Listener singleton: una sola conexión Postgres para LISTEN/NOTIFY a múltiples canales,
 * y emite eventos internos para que los endpoints SSE los multiplexeen a clientes.
 *
 * Canales escuchados:
 *   - leads_nitel_change   → INSERT/UPDATE en leads_nitel
 *   - busquedas_logs_change → INSERT/UPDATE en busquedas_logs
 */
import { EventEmitter } from "events";
import { Client } from "pg";

const CHANNELS = ["leads_nitel_change", "busquedas_logs_change"] as const;

export type LeadsChangeEvent = {
  op: "INSERT" | "UPDATE" | "DELETE";
  place_id: string;
};

export type BusquedasChangeEvent = {
  op: "INSERT" | "UPDATE" | "DELETE";
  id: string;
  status: "running" | "completed" | "failed";
};

class DbEventsListener extends EventEmitter {
  private client: Client | null = null;
  private starting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  async start() {
    if (this.client || this.starting) return;
    this.starting = true;

    try {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error("DATABASE_URL no está definido");

      const client = new Client({ connectionString: url });
      await client.connect();

      client.on("notification", (msg) => {
        if (!msg.payload) return;
        try {
          const data = JSON.parse(msg.payload);
          if (msg.channel === "leads_nitel_change") {
            this.emit("leads:change", data as LeadsChangeEvent);
          } else if (msg.channel === "busquedas_logs_change") {
            this.emit("busquedas:change", data as BusquedasChangeEvent);
          }
        } catch (e) {
          console.error(`[db-events] payload inválido en ${msg.channel}:`, e);
        }
      });

      client.on("error", (err) => {
        console.error("[db-events] error en conexión:", err.message);
        this.handleDisconnect();
      });

      client.on("end", () => {
        console.warn("[db-events] conexión cerrada");
        this.handleDisconnect();
      });

      for (const ch of CHANNELS) {
        await client.query(`LISTEN ${ch}`);
      }
      this.client = client;
      this.starting = false;
      console.log(`[db-events] escuchando canales: ${CHANNELS.join(", ")}`);
    } catch (e) {
      this.starting = false;
      console.error("[db-events] no pudo arrancar:", e);
      this.scheduleReconnect();
    }
  }

  private handleDisconnect() {
    if (this.client) {
      try {
        this.client.end().catch(() => {});
      } catch {}
      this.client = null;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.start();
    }, 5_000);
  }
}

// Singleton global, sobrevive HMR en dev
declare global {
  var __dbEventsListener: DbEventsListener | undefined;
}

export const dbEventsListener: DbEventsListener =
  globalThis.__dbEventsListener ?? (globalThis.__dbEventsListener = new DbEventsListener());

// Alias retro-compatible para no romper imports existentes
export const leadsListener = dbEventsListener;

if (typeof window === "undefined") {
  dbEventsListener.start();
}
