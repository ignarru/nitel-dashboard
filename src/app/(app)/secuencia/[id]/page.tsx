import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, MessageCircleReply } from "lucide-react";
import { db, schema } from "@/db/client";
import { parseCorreoColumna, cuerpoTextoAHtml } from "@/db/schema";
import { SecuenciaEditor } from "@/components/secuencia-editor";
import { formatFechaCompleta } from "@/lib/fecha";

const { leadsNitel } = schema;

export const dynamic = "force-dynamic";

export default async function SecuenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const placeId = decodeURIComponent(id);

  const [lead] = await db
    .select()
    .from(leadsNitel)
    .where(eq(leadsNitel.placeId, placeId))
    .limit(1);
  if (!lead) notFound();

  const correoData = [
    { orden: 1 as const, raw: lead.correo1, enviado: !!lead.contactado1, sentAt: lead.horaEnviado1 },
    { orden: 2 as const, raw: lead.correo2, enviado: !!lead.contactado2, sentAt: lead.horaEnviado2 },
    { orden: 3 as const, raw: lead.correo3, enviado: !!lead.contactado3, sentAt: lead.horaEnviado3 },
  ];
  const correos = correoData
    .map((c) => {
      const parsed = parseCorreoColumna(c.raw);
      if (!parsed) return null;
      return {
        orden: c.orden,
        asunto: parsed.asunto,
        cuerpoHtml: cuerpoTextoAHtml(parsed.cuerpo),
        enviado: c.enviado,
        sentAt: c.sentAt?.toISOString() ?? null,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const testOverride = process.env.TEST_EMAIL_OVERRIDE?.trim() || null;

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f]">
      <div className="border-b border-[var(--nitel-border)] bg-[#0a0a0f]/70 backdrop-blur-xl px-6 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="group flex items-center gap-1.5 text-sm text-zinc-500 hover:text-[#01dcfd] transition-colors"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Volver a la bandeja
        </Link>
        <div className="text-sm flex items-center gap-2">
          <span className="text-[10.5px] uppercase tracking-[0.16em] text-zinc-500 font-medium">
            Lead
          </span>
          <span className="text-zinc-700">·</span>
          <span className="font-medium text-zinc-50 tracking-tight">
            {lead.name || lead.email}
          </span>
          {lead.category && (
            <span className="text-zinc-600 text-xs">{lead.category}</span>
          )}
        </div>
      </div>
      {testOverride && (
        <div className="border-b border-amber-500/30 bg-amber-500/[0.06] px-6 py-2 text-[12px] text-amber-300 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#facc15]" />
          <span className="font-medium">Modo prueba</span>
          <span className="text-amber-300/60">·</span>
          <span className="text-amber-300/80">
            Todos los envíos van a <span className="font-mono">{testOverride}</span> en vez del email real del lead. La base de datos se actualiza normal.
          </span>
        </div>
      )}
      {lead.respondio && lead.respuestaTexto && lead.respuestaTexto.trim() !== "" && (
        <div className="border-b border-[#01dcfd]/30 bg-[#01dcfd]/[0.05] px-6 py-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#01dcfd]/15 border border-[#01dcfd]/40 flex items-center justify-center shrink-0">
              <MessageCircleReply className="w-4 h-4 text-[#01dcfd]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10.5px] uppercase tracking-[0.16em] text-[#01dcfd] font-medium">
                  El lead respondió
                </span>
                {lead.cualRespondio?.match(/\d/) && (
                  <span className="text-[10.5px] text-zinc-500 tabular-nums">
                    · al correo {lead.cualRespondio.match(/\d/)![0]}/3
                  </span>
                )}
                {lead.respuestaRecibidaAt && (
                  <span className="text-[10.5px] text-zinc-500 tabular-nums">
                    · {formatFechaCompleta(lead.respuestaRecibidaAt)} hs
                  </span>
                )}
              </div>
              {lead.respuestaTexto ? (
                <div className="text-[13.5px] text-zinc-200 leading-relaxed whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                  {lead.respuestaTexto}
                </div>
              ) : (
                <p className="text-[12.5px] text-zinc-500 italic">
                  (Aún no se está guardando el cuerpo del mensaje. Ver instrucciones para actualizar el workflow.)
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <SecuenciaEditor
          lead={{
            placeId: lead.placeId,
            name: lead.name,
            email: lead.email,
            category: lead.category,
            phone: lead.phone,
            website: lead.website,
            address: lead.address,
            notas: lead.notas,
            respondio: !!(lead.respondio && lead.respuestaTexto && lead.respuestaTexto.trim() !== ""),
          }}
          correos={correos}
        />
      </div>
    </div>
  );
}
