import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { Send } from "lucide-react";
import { FilaEnviado } from "@/components/fila-enviado";

export const dynamic = "force-dynamic";

type EnviadoRow = {
  place_id: string;
  name: string | null;
  email: string | null;
  orden: number;
  asunto: string;
  hora_enviado: string;
};

export default async function EnviadosPage() {
  // Aplanamos las 3 columnas (contactado_N + hora_enviado_N + correo_N) en filas
  const rows = (
    await db.execute(sql`
      SELECT place_id, name, email, 1 AS orden,
        split_part(correo_1, E'\n', 1) AS asunto,
        hora_enviado_1 AS hora_enviado
      FROM leads_nitel
      WHERE contactado_1 AND hora_enviado_1 IS NOT NULL
      UNION ALL
      SELECT place_id, name, email, 2,
        split_part(correo_2, E'\n', 1),
        hora_enviado_2
      FROM leads_nitel
      WHERE contactado_2 AND hora_enviado_2 IS NOT NULL
      UNION ALL
      SELECT place_id, name, email, 3,
        split_part(correo_3, E'\n', 1),
        hora_enviado_3
      FROM leads_nitel
      WHERE contactado_3 AND hora_enviado_3 IS NOT NULL
      ORDER BY hora_enviado DESC
      LIMIT 200
    `)
  ).rows as EnviadoRow[];

  return (
    <div className="px-8 py-9 max-w-6xl mx-auto">
      <header className="mb-7">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#01dcfd]/80 font-medium mb-2">
          Historial
        </div>
        <h1 className="text-3xl font-semibold text-zinc-50 mb-1.5 tracking-tight">
          Enviados
        </h1>
        <p className="text-sm text-zinc-500">
          Todos los correos que ya salieron de tu casilla.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--nitel-border)] bg-[#14141f]/40 p-14 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl nitel-gradient-soft border border-[var(--nitel-border)] flex items-center justify-center">
            <Send className="w-6 h-6 text-zinc-400" />
          </div>
          <p className="text-zinc-200 font-medium">Todavía no mandaste ningún correo</p>
          <p className="text-zinc-500 text-sm mt-1">
            Cuando mandes algo desde la bandeja, va a aparecer acá.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--nitel-border)] bg-[#14141f]/60 backdrop-blur overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-black/30 border-b border-[var(--nitel-border)]">
              <tr className="text-left text-[10.5px] uppercase tracking-[0.14em] text-zinc-500">
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium w-16">N°</th>
                <th className="px-4 py-3 font-medium">Asunto</th>
                <th className="px-4 py-3 font-medium w-40">Enviado (hora ARG)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--nitel-border)]">
              {rows.map((r) => (
                <FilaEnviado
                  key={`${r.place_id}-${r.orden}`}
                  placeId={r.place_id}
                  name={r.name}
                  email={r.email}
                  orden={r.orden}
                  asunto={r.asunto}
                  horaEnviado={r.hora_enviado}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
