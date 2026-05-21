"use client";

import { useRouter } from "next/navigation";
import { formatFechaCorta } from "@/lib/fecha";

export function FilaEnviado({
  placeId,
  name,
  email,
  orden,
  asunto,
  horaEnviado,
}: {
  placeId: string;
  name: string | null;
  email: string | null;
  orden: number;
  asunto: string;
  horaEnviado: string;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={() => router.push(`/secuencia/${encodeURIComponent(placeId)}`)}
      className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
    >
      <td className="px-4 py-3">
        <div className="font-medium text-zinc-100 tracking-tight group-hover:text-[#01dcfd] transition-colors">
          {name || email}
        </div>
        <div className="text-xs text-zinc-500 mt-0.5">{email}</div>
      </td>
      <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{orden}/3</td>
      <td className="px-4 py-3 text-zinc-300 truncate max-w-md">{asunto}</td>
      <td className="px-4 py-3 text-zinc-400 text-xs tabular-nums">
        {formatFechaCorta(horaEnviado)} hs
      </td>
    </tr>
  );
}
