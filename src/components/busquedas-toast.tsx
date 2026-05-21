"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { useLeadsStream, type BusquedaSnapshot } from "./leads-stream-provider";

export function BusquedasToast() {
  const { busquedas, dismissBusqueda } = useLeadsStream();
  const list = Array.from(busquedas.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );

  if (list.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {list.map((b) => (
        <div key={b.id} className="pointer-events-auto">
          <BusquedaCard busqueda={b} onDismiss={() => dismissBusqueda(b.id)} />
        </div>
      ))}
    </div>
  );
}

function BusquedaCard({
  busqueda,
  onDismiss,
}: {
  busqueda: BusquedaSnapshot;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (busqueda.status !== "running") return;
    const update = () => {
      const ms = Date.now() - new Date(busqueda.startedAt).getTime();
      setElapsedSec(Math.floor(ms / 1000));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [busqueda.startedAt, busqueda.status]);

  const isRunning = busqueda.status === "running";
  const isCompleted = busqueda.status === "completed";
  const isFailed = busqueda.status === "failed";

  const criterio = busqueda.criterios as Record<string, string | number> | null;
  const labelCriterio =
    criterio?.industria || criterio?.ciudad || criterio?.provincia || "Búsqueda";

  return (
    <div
      className={`w-80 rounded-2xl border backdrop-blur shadow-2xl shadow-black/40 overflow-hidden transition-all ${
        isCompleted
          ? "border-[#01dcfd]/40 bg-[#14141f]/95"
          : isFailed
          ? "border-red-500/40 bg-[#14141f]/95"
          : "border-[#770eff]/30 bg-[#14141f]/95"
      }`}
    >
      {/* Glow para completado */}
      {isCompleted && (
        <div
          aria-hidden
          className="absolute inset-0 opacity-30 blur-2xl pointer-events-none -z-10"
          style={{
            background: "radial-gradient(circle at 30% 0%, #01dcfd, transparent 70%)",
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isCompleted
              ? "nitel-gradient shadow-lg shadow-[#01dcfd]/30"
              : isFailed
              ? "bg-red-500/15 border border-red-500/30"
              : "bg-[#770eff]/15 border border-[#770eff]/30"
          }`}
        >
          {isRunning && <Loader2 className="w-4 h-4 text-[#770eff] animate-spin" />}
          {isCompleted && <CheckCircle2 className="w-4 h-4 text-white" />}
          {isFailed && <AlertCircle className="w-4 h-4 text-red-400" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[10.5px] uppercase tracking-[0.16em] font-medium ${
                isCompleted
                  ? "text-[#01dcfd]"
                  : isFailed
                  ? "text-red-400"
                  : "text-[#770eff]"
              }`}
            >
              {isCompleted ? "Completada" : isFailed ? "Fallida" : "Buscando…"}
            </span>
            {isRunning && (
              <span className="text-[10.5px] text-zinc-600 tabular-nums">
                · {formatElapsed(elapsedSec)}
              </span>
            )}
          </div>
          <div className="text-sm font-medium text-zinc-50 truncate mt-0.5">
            {String(labelCriterio)}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
            aria-label={expanded ? "Minimizar" : "Expandir"}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            onClick={onDismiss}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
            aria-label="Cerrar"
            title={
              isRunning
                ? "La búsqueda sigue corriendo en background. Los leads van a aparecer en la bandeja igual."
                : "Cerrar"
            }
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body expandido */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-[var(--nitel-border)] pt-3">
          {/* Criterios */}
          {criterio && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {Object.entries(criterio)
                .filter(([k, v]) => v && k !== "con_kmz" && k !== "archivo_kmz" && k !== "radio")
                .map(([k, v]) => (
                  <span
                    key={k}
                    className="px-1.5 py-0.5 rounded-md text-[10.5px] text-zinc-400 bg-white/[0.04] border border-[var(--nitel-border)]"
                  >
                    {String(v)}
                  </span>
                ))}
            </div>
          )}

          {/* Contadores cuando completed */}
          {isCompleted && (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <MiniStat
                  label="Scrapeados"
                  value={busqueda.totalScrapeados ?? 0}
                  color="#a1a1aa"
                />
                <MiniStat
                  label="Nuevos"
                  value={busqueda.totalInsertados ?? 0}
                  color="#01dcfd"
                  highlight
                />
                <MiniStat
                  label="Descartados"
                  value={busqueda.descartados ?? 0}
                  color="#770eff"
                />
              </div>
              {busqueda.mensaje && (
                <p className="text-[11.5px] text-zinc-400 leading-relaxed mb-3">
                  {busqueda.mensaje}
                </p>
              )}
              {(busqueda.totalInsertados ?? 0) > 0 && (
                <Link
                  href="/"
                  className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg nitel-gradient text-white text-xs font-medium tracking-tight transition-all hover:shadow-[0_6px_20px_-6px_rgba(1,220,253,0.6)]"
                >
                  Ir a la bandeja
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </>
          )}

          {/* Error si failed */}
          {isFailed && busqueda.errorMessage && (
            <p className="text-[11.5px] text-red-400/90 leading-relaxed">
              {busqueda.errorMessage}
            </p>
          )}

          {/* Mensaje cuando todavía corre */}
          {isRunning && (
            <div className="flex items-center gap-2 text-[11.5px] text-zinc-500">
              <span className="w-1 h-1 rounded-full bg-[#770eff] animate-pulse" />
              <span>n8n está scrapeando Google Maps y redactando correos. Podés seguir usando el dashboard.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
  highlight,
}: {
  label: string;
  value: number;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-lg border bg-black/20 px-2 py-1.5"
      style={{
        borderColor: highlight ? `${color}55` : "var(--nitel-border)",
      }}
    >
      <div
        className="text-[9.5px] uppercase tracking-[0.12em] font-medium"
        style={{ color: `${color}cc` }}
      >
        {label}
      </div>
      <div
        className="text-lg font-semibold tabular-nums leading-tight"
        style={{ color: highlight ? "#f4f4f5" : "#d4d4d8" }}
      >
        {value}
      </div>
    </div>
  );
}

function formatElapsed(sec: number) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}
