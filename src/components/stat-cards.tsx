import { Mail, Send, Inbox, Zap } from "lucide-react";

type Stats = {
  pendientes: number;
  activas: number;
  enviadosHoy: number;
  totalEnviados: number;
};

export function StatCards({ stats }: { stats: Stats }) {
  const items = [
    {
      label: "Pendientes",
      hint: "Sin contactar",
      value: stats.pendientes,
      icon: Inbox,
      iconColor: "#01dcfd",
      iconBg: "rgba(1,220,253,0.10)",
      iconBorder: "rgba(1,220,253,0.25)",
    },
    {
      label: "Activas",
      hint: "Con seguimiento abierto",
      value: stats.activas,
      icon: Zap,
      iconColor: "#770eff",
      iconBg: "rgba(119,14,255,0.10)",
      iconBorder: "rgba(119,14,255,0.25)",
    },
    {
      label: "Enviados hoy",
      hint: null,
      value: stats.enviadosHoy,
      icon: Send,
      iconColor: "#a1a1aa",
      iconBg: "rgba(255,255,255,0.04)",
      iconBorder: "rgba(255,255,255,0.10)",
    },
    {
      label: "Total enviados",
      hint: null,
      value: stats.totalEnviados,
      icon: Mail,
      iconColor: "#a1a1aa",
      iconBg: "rgba(255,255,255,0.04)",
      iconBorder: "rgba(255,255,255,0.10)",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(({ label, hint, value, icon: Icon, iconColor, iconBg, iconBorder }) => (
        <div
          key={label}
          className="group relative rounded-2xl border border-[var(--nitel-border)] bg-[#14141f]/70 backdrop-blur px-4 py-4 flex items-center gap-3.5 hover:border-[var(--nitel-border-strong)] transition-all duration-300 overflow-hidden"
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{
              background: `radial-gradient(circle at 0% 100%, ${iconBg}, transparent 70%)`,
            }}
          />

          <div
            className="relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
            style={{ background: iconBg, borderColor: iconBorder }}
          >
            <Icon className="w-4 h-4" style={{ color: iconColor }} />
          </div>
          <div className="min-w-0 relative">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-zinc-500 font-medium">
              {label}
            </div>
            <div className="text-2xl font-semibold text-zinc-50 tabular-nums leading-tight tracking-tight mt-0.5">
              {value}
            </div>
            {hint && (
              <div className="text-[10.5px] text-zinc-600 mt-0.5">{hint}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
