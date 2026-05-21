"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { useLeadsStream } from "./leads-stream-provider";

/**
 * Indicador visual del stream de leads. La lógica del EventSource vive
 * en LeadsStreamProvider — este componente solo refleja su estado.
 */
export function AutoRefreshLeads() {
  const { connected, pulseTick } = useLeadsStream();
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (pulseTick === 0) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 600);
    return () => clearTimeout(t);
  }, [pulseTick]);

  return (
    <div className="flex items-center gap-1.5 text-[10.5px] text-zinc-500 shrink-0">
      <span
        className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
          pulse
            ? "bg-[#01dcfd] shadow-[0_0_10px_#01dcfd]"
            : connected
            ? "bg-emerald-500/70"
            : "bg-zinc-700"
        }`}
      />
      <Activity className="w-3 h-3 text-zinc-600" />
      <span>{connected ? "En vivo" : "Conectando…"}</span>
    </div>
  );
}
