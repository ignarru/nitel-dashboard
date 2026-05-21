import { BuscarLeadsForm } from "@/components/buscar-leads-form";
import { Search } from "lucide-react";

export const dynamic = "force-dynamic";

export default function BuscarPage() {
  return (
    <div className="px-8 py-9 max-w-3xl mx-auto">
      <header className="mb-7">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#01dcfd]/80 font-medium mb-2">
          Generador
        </div>
        <h1 className="text-3xl font-semibold text-zinc-50 mb-1.5 tracking-tight">
          Buscar leads nuevos
        </h1>
        <p className="text-sm text-zinc-500">
          Scrapea Google Maps con tus criterios y redacta los 3 correos automáticamente.
        </p>
      </header>

      <div className="rounded-2xl border border-[var(--nitel-border)] bg-[#14141f]/60 backdrop-blur p-6">
        <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-[#01dcfd]/[0.05] border border-[#01dcfd]/15">
          <div className="w-7 h-7 rounded-lg nitel-gradient-soft border border-[var(--nitel-border)] flex items-center justify-center shrink-0">
            <Search className="w-3.5 h-3.5 text-[#01dcfd]" />
          </div>
          <div className="text-[12.5px] text-zinc-300 leading-relaxed">
            <p className="text-zinc-100 font-medium mb-0.5">Cómo funciona</p>
            <p className="text-zinc-500">
              Llenás el form, el sistema busca en Google Maps con Apify, le saca emails con
              Firecrawl, y los inserta en tu base. Apenas se insertan, otro workflow les redacta
              los 3 correos automáticamente. Vos los revisás y enviás desde la bandeja.
            </p>
          </div>
        </div>

        <BuscarLeadsForm />
      </div>
    </div>
  );
}
