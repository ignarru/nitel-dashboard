import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { MessageCircleReply, ExternalLink, ArrowRight } from "lucide-react";
import { formatFechaCorta, formatFechaCompleta } from "@/lib/fecha";

export const dynamic = "force-dynamic";

type RespuestaRow = {
  place_id: string;
  name: string | null;
  email: string | null;
  category: string | null;
  cual_respondio: string | null;
  respuesta_texto: string | null;
  respuesta_recibida_at: string | null;
  hora_enviado_1: string | null;
  hora_enviado_2: string | null;
  hora_enviado_3: string | null;
};

async function getRespuestas(): Promise<RespuestaRow[]> {
  const rows = await db.execute(sql`
    SELECT
      place_id, name, email, category,
      cual_respondio, respuesta_texto, respuesta_recibida_at,
      hora_enviado_1, hora_enviado_2, hora_enviado_3
    FROM nitel_leads
    WHERE respondio = true
      AND nullif(trim(respuesta_texto), '') IS NOT NULL
    ORDER BY respuesta_recibida_at DESC NULLS LAST, name ASC
  `);
  return rows.rows as RespuestaRow[];
}

/** Extrae el número de orden de "Contacto 1", "1", "correo 2", etc. */
function ordenDeRespuesta(cual: string | null): number | null {
  const m = (cual ?? "").match(/\d/);
  return m ? parseInt(m[0], 10) : null;
}

/** Calcula horas/días desde el envío del correo correspondiente */
function tiempoRespuesta(row: RespuestaRow): string | null {
  if (!row.respuesta_recibida_at) return null;
  const n = ordenDeRespuesta(row.cual_respondio);
  const horaEnvio =
    n === 1 ? row.hora_enviado_1 : n === 2 ? row.hora_enviado_2 : n === 3 ? row.hora_enviado_3 : null;
  if (!horaEnvio) return null;
  const ms = new Date(row.respuesta_recibida_at).getTime() - new Date(horaEnvio).getTime();
  if (ms < 0) return null;
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const hs = Math.round(min / 60);
  if (hs < 24) return `${hs} hs`;
  const d = Math.round(hs / 24);
  return `${d} día${d === 1 ? "" : "s"}`;
}

export default async function RespondieronPage() {
  const respuestas = await getRespuestas();

  return (
    <div className="px-8 py-9 max-w-5xl mx-auto">
      <header className="mb-7">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#01dcfd]/80 font-medium mb-2">
          Conversaciones
        </div>
        <h1 className="text-3xl font-semibold text-zinc-50 mb-1.5 tracking-tight">
          Leads que respondieron
        </h1>
        <p className="text-sm text-zinc-500">
          {respuestas.length} {respuestas.length === 1 ? "respuesta recibida" : "respuestas recibidas"}.
          Click en cada una para leer el mensaje completo.
        </p>
      </header>

      {respuestas.length === 0 ? (
        <div className="rounded-2xl border border-[var(--nitel-border)] bg-[#14141f]/40 p-14 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl nitel-gradient-soft border border-[var(--nitel-border)] flex items-center justify-center">
            <MessageCircleReply className="w-6 h-6 text-zinc-400" />
          </div>
          <p className="text-zinc-200 font-medium">Todavía no hay respuestas</p>
          <p className="text-zinc-500 text-sm mt-1">
            Cuando un lead conteste un correo, va a aparecer acá.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {respuestas.map((r) => (
            <RespuestaCard key={r.place_id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function RespuestaCard({ r }: { r: RespuestaRow }) {
  const tiempo = tiempoRespuesta(r);
  const orden = ordenDeRespuesta(r.cual_respondio);
  return (
    <details className="group rounded-2xl border border-[#01dcfd]/30 bg-gradient-to-br from-[#01dcfd]/[0.05] to-[#14141f]/80 backdrop-blur overflow-hidden hover:border-[#01dcfd]/50 transition-colors">
      <summary className="px-5 py-4 cursor-pointer list-none flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-[#01dcfd]/15 border border-[#01dcfd]/40 flex items-center justify-center shrink-0">
            <MessageCircleReply className="w-4 h-4 text-[#01dcfd]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-zinc-50 truncate tracking-tight">
              {r.name || r.email}
            </div>
            <div className="text-[13px] text-zinc-500 truncate mt-0.5">
              {r.email}
              {r.category && <span className="text-zinc-600"> · {r.category}</span>}
            </div>
            {r.respuesta_texto && (
              <p className="text-[13px] text-zinc-400 mt-2 line-clamp-1 group-open:hidden">
                &quot;{r.respuesta_texto.replace(/\s+/g, " ").trim()}&quot;
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0 text-right">
          {orden && (
            <span className="px-1.5 py-0.5 rounded-md text-[9.5px] uppercase tracking-[0.14em] font-medium bg-[#770eff]/15 border border-[#770eff]/40 text-[#770eff]">
              Correo {orden}/3
            </span>
          )}
          {r.respuesta_recibida_at && (
            <span className="text-[11px] text-zinc-500 tabular-nums">
              {formatFechaCorta(r.respuesta_recibida_at)} hs
            </span>
          )}
          {tiempo && (
            <span className="text-[10.5px] text-zinc-600">respondió en {tiempo}</span>
          )}
        </div>
      </summary>

      {/* Cuerpo expandido */}
      <div className="px-5 pb-5 pt-2 border-t border-[var(--nitel-border)] mt-2">
        {r.respuesta_texto ? (
          <div className="rounded-xl border border-[var(--nitel-border)] bg-black/30 p-4">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-zinc-500 mb-2 font-medium">
              Mensaje del lead
            </div>
            <div className="text-[14px] text-zinc-200 leading-relaxed whitespace-pre-wrap break-words">
              {r.respuesta_texto}
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500 italic">
            (El cuerpo del mensaje no quedó guardado todavía. Tenés que actualizar el workflow de n8n
            para que pase el body a la columna `respuesta_texto`.)
          </p>
        )}

        <div className="flex items-center justify-between mt-4 text-[12px] text-zinc-500">
          <span>
            {r.respuesta_recibida_at && (
              <>Recibido el {formatFechaCompleta(r.respuesta_recibida_at)} hs (hora Argentina)</>
            )}
          </span>
          <div className="flex items-center gap-2">
            <a
              href={`https://mail.google.com/mail/u/0/#search/from%3A${encodeURIComponent(r.email ?? "")}`}
              target="_blank"
              rel="noopener"
              className="px-3 py-1.5 rounded-lg text-[12px] text-zinc-300 hover:text-zinc-50 hover:bg-white/[0.04] transition-colors flex items-center gap-1.5 border border-[var(--nitel-border)]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir en Gmail
            </a>
            <Link
              href={`/secuencia/${encodeURIComponent(r.place_id)}`}
              className="px-3 py-1.5 rounded-lg nitel-gradient text-white text-[12px] font-medium tracking-tight transition-all flex items-center gap-1.5 hover:shadow-[0_6px_16px_-6px_rgba(1,220,253,0.6)]"
            >
              Ver lead
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </details>
  );
}
