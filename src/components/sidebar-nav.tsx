"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Send, Inbox, Search, MessageCircleReply, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Bandeja", icon: Inbox },
  { href: "/buscar", label: "Buscar leads", icon: Search },
  { href: "/respondieron", label: "Respondieron", icon: MessageCircleReply },
  { href: "/enviados", label: "Enviados", icon: Send },
  { href: "/estadisticas", label: "Estadísticas", icon: BarChart3 },
];

export function SidebarNav({
  enviadosHoy = 0,
  limiteDiario = 2000,
}: {
  enviadosHoy?: number;
  limiteDiario?: number;
}) {
  const pathname = usePathname();
  const pct = Math.min(100, (enviadosHoy / limiteDiario) * 100);
  const cerca = pct >= 80;
  return (
    <aside className="w-60 shrink-0 border-r border-[var(--nitel-border)] bg-[#0a0a0f]/80 backdrop-blur-xl h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-[var(--nitel-border)] flex items-center gap-3">
        {/* Isotipo con el gradiente firma de Nitel */}
        <div className="relative w-9 h-9 rounded-xl nitel-gradient shrink-0 flex items-center justify-center shadow-lg shadow-[#770eff]/20">
          <span className="text-white font-bold text-sm tracking-tighter">N</span>
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-[15px] text-zinc-50 leading-tight tracking-tight">
            Nitel
          </div>
          <div className="text-[11px] text-zinc-500 leading-tight mt-0.5">
            Revisión de correos
          </div>
        </div>
      </div>

      <nav className="p-3 space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group",
                active
                  ? "bg-gradient-to-r from-[#770eff]/15 to-[#01dcfd]/5 text-zinc-50 font-medium"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100",
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full nitel-gradient"
                />
              )}
              <Icon
                className={cn(
                  "w-4 h-4 transition-colors",
                  active ? "text-[#01dcfd]" : "text-zinc-500 group-hover:text-zinc-300",
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Pie del sidebar — contador de envíos del día + entorno */}
      <div className="absolute bottom-4 left-3 right-3 space-y-2">
        {/* Contador de correos enviados hoy (límite Gmail) */}
        <div className="px-3 py-2.5 rounded-lg border border-[var(--nitel-border)] bg-[#14141f]/60">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
              Enviados hoy
            </span>
            <span className={cn("text-[11px] tabular-nums font-medium", cerca ? "text-amber-400" : "text-zinc-300")}>
              {enviadosHoy}
              <span className="text-zinc-600"> / {limiteDiario}</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", cerca ? "bg-amber-400" : "nitel-gradient")}
              style={{ width: `${Math.max(2, pct)}%` }}
            />
          </div>
          {cerca && (
            <p className="text-[10px] text-amber-400/80 mt-1.5 leading-tight">
              Cerca del límite diario de Gmail
            </p>
          )}
        </div>

        <div className="px-3 py-2 rounded-lg border border-[var(--nitel-border)] bg-[#14141f]/60 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#01dcfd] shadow-[0_0_8px_#01dcfd]" />
          <span className="text-[11px] uppercase tracking-wider text-zinc-500">
            Entorno local
          </span>
        </div>
      </div>
    </aside>
  );
}
