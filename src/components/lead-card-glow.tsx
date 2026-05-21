"use client";

import { useIsRecentLead } from "./leads-stream-provider";

/**
 * Destello breve detrás del card cuando un lead llega por SSE.
 * Dura ~2.2s, se ve sutilmente detrás del card y desaparece solo.
 */
export function LeadCardGlow({
  placeId,
  children,
}: {
  placeId: string;
  children: React.ReactNode;
}) {
  const { recent, op } = useIsRecentLead(placeId);

  if (!recent) return <>{children}</>;

  // Cyan para INSERT (lead nuevo), púrpura para UPDATE/DELETE
  const glowColor = op === "INSERT" ? "#01dcfd" : "#770eff";

  return (
    <div className="relative lead-glow-anchor">
      <div
        aria-hidden
        className="lead-glow-aura"
        style={{ "--glow-color": glowColor } as React.CSSProperties}
      />
      <div className="lead-glow-content">{children}</div>
    </div>
  );
}
