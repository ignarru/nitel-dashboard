"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { getBusquedaStatus } from "@/lib/buscar-leads-action";

type ChangeOp = "INSERT" | "UPDATE" | "DELETE";
type BusquedaStatus = "running" | "completed" | "failed";

export type BusquedaSnapshot = {
  id: string;
  status: BusquedaStatus;
  totalScrapeados: number | null;
  totalInsertados: number | null;
  descartados: number | null;
  mensaje: string | null;
  errorMessage: string | null;
  startedAt: string;
  criterios: Record<string, unknown> | null;
};

type Ctx = {
  /** place_ids llegados por SSE en los últimos HIGHLIGHT_MS, con su op */
  recent: Map<string, { op: ChangeOp; until: number }>;
  connected: boolean;
  pulseTick: number;
  /** Búsquedas que el usuario está tracking en esta sesión */
  busquedas: Map<string, BusquedaSnapshot>;
  trackBusqueda: (id: string) => Promise<void>;
  dismissBusqueda: (id: string) => void;
};

const LeadsStreamCtx = createContext<Ctx>({
  recent: new Map(),
  connected: false,
  pulseTick: 0,
  busquedas: new Map(),
  trackBusqueda: async () => {},
  dismissBusqueda: () => {},
});

const HIGHLIGHT_MS = 2_500;
const COALESCE_MS = 800;

export function LeadsStreamProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [pulseTick, setPulseTick] = useState(0);
  const [recent, setRecent] = useState<Ctx["recent"]>(new Map());
  const [busquedas, setBusquedas] = useState<Ctx["busquedas"]>(new Map());
  const refreshTimer = useRef<NodeJS.Timeout | null>(null);
  const busquedasRef = useRef(busquedas);
  busquedasRef.current = busquedas;

  // ---- Tracking de búsquedas ----
  const trackBusqueda = useCallback(async (id: string) => {
    // Hacemos un fetch inicial del estado (por si el evento ya pasó antes de suscribirnos)
    try {
      const row = await getBusquedaStatus(id);
      if (!row) return;
      setBusquedas((prev) => {
        const next = new Map(prev);
        next.set(id, {
          id: row.id,
          status: row.status as BusquedaStatus,
          totalScrapeados: row.totalScrapeados,
          totalInsertados: row.totalInsertados,
          descartados: row.descartados,
          mensaje: row.mensaje,
          errorMessage: row.errorMessage,
          startedAt: row.startedAt.toISOString(),
          criterios: (row.criterios as Record<string, unknown>) ?? null,
        });
        return next;
      });
    } catch (e) {
      console.warn("[stream] no se pudo cargar busqueda inicial:", e);
    }
  }, []);

  const dismissBusqueda = useCallback((id: string) => {
    setBusquedas((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // ---- Stream SSE ----
  useEffect(() => {
    const es = new EventSource("/api/stream/leads");

    es.addEventListener("hello", () => setConnected(true));

    es.addEventListener("lead:change", (evt: MessageEvent) => {
      setPulseTick((t) => t + 1);
      let data: { op: ChangeOp; place_id: string } | null = null;
      try {
        data = JSON.parse(evt.data);
      } catch {
        return;
      }
      if (!data?.place_id) return;

      setRecent((prev) => {
        const next = new Map(prev);
        next.set(data!.place_id, { op: data!.op, until: Date.now() + HIGHLIGHT_MS });
        return next;
      });

      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), COALESCE_MS);
    });

    es.addEventListener("busqueda:change", (evt: MessageEvent) => {
      let data: { op: ChangeOp; id: string; status: BusquedaStatus } | null = null;
      try {
        data = JSON.parse(evt.data);
      } catch {
        return;
      }
      if (!data?.id) return;

      // Solo refrescamos las búsquedas que el usuario inició en esta sesión
      if (!busquedasRef.current.has(data.id)) return;

      // Recargamos el snapshot completo de la búsqueda
      getBusquedaStatus(data.id)
        .then((row) => {
          if (!row) return;
          setBusquedas((prev) => {
            const next = new Map(prev);
            next.set(row.id, {
              id: row.id,
              status: row.status as BusquedaStatus,
              totalScrapeados: row.totalScrapeados,
              totalInsertados: row.totalInsertados,
              descartados: row.descartados,
              mensaje: row.mensaje,
              errorMessage: row.errorMessage,
              startedAt: row.startedAt.toISOString(),
              criterios: (row.criterios as Record<string, unknown>) ?? null,
            });
            return next;
          });
        })
        .catch(() => {});
    });

    es.onerror = () => setConnected(false);

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      es.close();
    };
  }, [router]);

  // Tick que limpia entradas expiradas
  useEffect(() => {
    const t = setInterval(() => {
      setRecent((prev) => {
        const now = Date.now();
        let changed = false;
        const next = new Map(prev);
        for (const [k, v] of next) {
          if (v.until < now) {
            next.delete(k);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 5_000);
    return () => clearInterval(t);
  }, []);

  return (
    <LeadsStreamCtx.Provider
      value={{ recent, connected, pulseTick, busquedas, trackBusqueda, dismissBusqueda }}
    >
      {children}
    </LeadsStreamCtx.Provider>
  );
}

export function useLeadsStream() {
  return useContext(LeadsStreamCtx);
}

export function useIsRecentLead(placeId: string): { recent: boolean; op?: ChangeOp } {
  const { recent } = useLeadsStream();
  const entry = recent.get(placeId);
  if (!entry || entry.until < Date.now()) return { recent: false };
  return { recent: true, op: entry.op };
}
