"use client";

import { useState, useTransition, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  Inbox,
  Send,
  Archive,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Filter,
  Search,
} from "lucide-react";
import { LeadCardGlow } from "./lead-card-glow";
import { enviarBulk, archivarBulk } from "@/lib/correo-actions";
import { formatFechaCorta } from "@/lib/fecha";

export type LeadRow = {
  place_id: string;
  name: string | null;
  email: string | null;
  category: string | null;
  source_node: string | null;
  contactado_1: boolean | null;
  contactado_2: boolean | null;
  contactado_3: boolean | null;
  hora_enviado_1: string | null;
  hora_enviado_2: string | null;
  hora_enviado_3: string | null;
  asunto_1: string | null;
  asunto_2: string | null;
  asunto_3: string | null;
};

type Props = {
  leads: LeadRow[];
  opciones: { rubros: string[]; origenes: string[] };
  filtros: { estado?: string; rubro?: string; origen?: string; q?: string };
  page: number;
  totalPages: number;
  total: number;
};

export function BandejaInteractiva({ leads, opciones, filtros, page, totalPages, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [busqueda, setBusqueda] = useState(filtros.q ?? "");
  const busquedaTimer = useRef<NodeJS.Timeout | null>(null);

  /** Arma los params actuales, sobreescribiendo lo que se pase */
  function buildParams(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      estado: filtros.estado,
      rubro: filtros.rubro,
      origen: filtros.origen,
      q: filtros.q,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v.trim()) params.set(k, v);
    }
    return params;
  }

  function setParam(key: string, value: string) {
    const params = buildParams({ [key]: value });
    params.delete("page"); // resetear paginación al filtrar
    router.push(`${pathname}?${params.toString()}`);
  }

  function irAPagina(p: number) {
    const params = buildParams({ page: String(p) });
    router.push(`${pathname}?${params.toString()}`);
  }

  // Debounce del buscador: actualiza la URL 400ms después de dejar de tipear
  function onBuscar(value: string) {
    setBusqueda(value);
    if (busquedaTimer.current) clearTimeout(busquedaTimer.current);
    busquedaTimer.current = setTimeout(() => {
      const params = buildParams({ q: value });
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    }, 400);
  }

  useEffect(() => () => (busquedaTimer.current ? clearTimeout(busquedaTimer.current) : undefined), []);

  function toggle(placeId: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId);
      else next.add(placeId);
      return next;
    });
  }

  function toggleTodos() {
    if (seleccion.size === leads.length) setSeleccion(new Set());
    else setSeleccion(new Set(leads.map((l) => l.place_id)));
  }

  const hayFiltros = !!(filtros.estado || filtros.rubro || filtros.origen || filtros.q);
  const ids = useMemo(() => Array.from(seleccion), [seleccion]);
  const [confirmarOrden, setConfirmarOrden] = useState<1 | 2 | 3 | null>(null);

  function bulkEnviar(orden: 1 | 2 | 3) {
    if (ids.length === 0) return;
    setConfirmarOrden(null);
    start(async () => {
      const res = await enviarBulk(ids, orden);
      if (res.enviados > 0) {
        toast.success(`${res.enviados} correo${res.enviados === 1 ? "" : "s"} enviado${res.enviados === 1 ? "" : "s"}`);
      }
      if (res.fallidos > 0) {
        toast.error(`${res.fallidos} no se pudieron enviar (ya enviados, sin contenido o respondieron)`);
      }
      setSeleccion(new Set());
    });
  }

  function bulkArchivar() {
    if (ids.length === 0) return;
    if (!confirm(`¿Archivar ${ids.length} lead${ids.length === 1 ? "" : "s"}? Se sacan de la bandeja.`)) return;
    start(async () => {
      const res = await archivarBulk(ids);
      toast.success(`${res.count} lead${res.count === 1 ? "" : "s"} archivado${res.count === 1 ? "" : "s"}`);
      setSeleccion(new Set());
    });
  }

  return (
    <>
      {/* Buscador local */}
      <div className="relative mt-8 mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => onBuscar(e.target.value)}
          placeholder="Buscar por nombre, email o empresa..."
          className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[#14141f]/60 border border-[var(--nitel-border)] text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-[#01dcfd]/50 focus:bg-[#14141f]/90 transition-all"
        />
        {busqueda && (
          <button
            onClick={() => onBuscar("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-zinc-500 hover:text-zinc-200 transition-colors"
            aria-label="Limpiar búsqueda"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Barra de filtros */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-zinc-500 mr-1">
          <Filter className="w-3.5 h-3.5" />
          <span className="text-[10.5px] uppercase tracking-[0.16em] font-medium">Filtros</span>
        </div>

        <FiltroSelect
          value={filtros.estado ?? ""}
          onChange={(v) => setParam("estado", v)}
          placeholder="Estado"
          options={[
            { value: "pendiente", label: "Pendientes (sin contactar)" },
            { value: "en-curso", label: "En curso (algún correo enviado)" },
          ]}
        />
        <FiltroSelect
          value={filtros.rubro ?? ""}
          onChange={(v) => setParam("rubro", v)}
          placeholder="Rubro"
          options={opciones.rubros.map((r) => ({ value: r, label: r }))}
        />
        <FiltroSelect
          value={filtros.origen ?? ""}
          onChange={(v) => setParam("origen", v)}
          placeholder="Origen"
          options={opciones.origenes.map((o) => ({ value: o, label: o }))}
        />

        {hayFiltros && (
          <button
            onClick={() => {
              setBusqueda("");
              router.push(pathname);
            }}
            className="text-[11px] text-zinc-500 hover:text-[#01dcfd] transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Limpiar
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
          {leads.length > 0 && (
            <button
              onClick={toggleTodos}
              className="text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors"
            >
              {seleccion.size === leads.length ? "Deseleccionar todo" : "Seleccionar todo"}
            </button>
          )}
          <span className="text-xs text-zinc-500 tabular-nums">
            {total} lead{total === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Lista */}
      {leads.length === 0 ? (
        <div className="rounded-2xl border border-[var(--nitel-border)] bg-[#14141f]/40 p-14 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl nitel-gradient-soft border border-[var(--nitel-border)] flex items-center justify-center">
            <Inbox className="w-6 h-6 text-zinc-400" />
          </div>
          <p className="text-zinc-200 font-medium">
            {hayFiltros ? "No hay leads con esos filtros" : "No hay leads pendientes"}
          </p>
          <p className="text-zinc-500 text-sm mt-1">
            {hayFiltros
              ? "Probá limpiar los filtros."
              : "Cuando el workflow de n8n redacte correos, van a aparecer acá."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 pb-24">
          {leads.map((lead) => {
            const correos = [
              { orden: 1, asunto: lead.asunto_1, enviado: lead.contactado_1, hora: lead.hora_enviado_1 },
              { orden: 2, asunto: lead.asunto_2, enviado: lead.contactado_2, hora: lead.hora_enviado_2 },
              { orden: 3, asunto: lead.asunto_3, enviado: lead.contactado_3, hora: lead.hora_enviado_3 },
            ].filter((c) => c.asunto && c.asunto.trim().length > 0);
            const enviados = correos.filter((c) => c.enviado).length;
            const checked = seleccion.has(lead.place_id);
            return (
              <LeadCardGlow key={lead.place_id} placeId={lead.place_id}>
                <article
                  className={`group relative rounded-2xl border backdrop-blur transition-all duration-200 overflow-hidden ${
                    checked
                      ? "border-[#01dcfd]/60 bg-[#01dcfd]/[0.04]"
                      : "border-[var(--nitel-border)] bg-[#14141f]/60 hover:border-[#01dcfd]/30 hover:bg-[#14141f]/90"
                  }`}
                >
                  <span
                    aria-hidden
                    className="absolute left-0 top-4 bottom-4 w-[2px] rounded-full nitel-gradient opacity-0 group-hover:opacity-100 transition-opacity"
                  />

                  <div className="flex items-start gap-3 px-5 py-4">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggle(lead.place_id)}
                      className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                        checked
                          ? "bg-[#01dcfd] border-[#01dcfd]"
                          : "border-zinc-600 hover:border-[#01dcfd]"
                      }`}
                      aria-label="Seleccionar lead"
                    >
                      {checked && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M1 5L4 8L9 2" stroke="#0a0a0f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>

                    <Link href={`/secuencia/${encodeURIComponent(lead.place_id)}`} className="block flex-1 min-w-0">
                      <div className="flex items-baseline justify-between mb-3 gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-zinc-50 truncate tracking-tight">
                            {lead.name || lead.email}
                          </div>
                          <div className="text-[13px] text-zinc-500 truncate mt-0.5">
                            {lead.email}
                            {lead.category && <span className="text-zinc-600"> · {lead.category}</span>}
                          </div>
                        </div>
                        <div className="text-xs text-zinc-500 shrink-0 flex items-center gap-2">
                          <span>
                            {enviados}/{correos.length} enviado{enviados === 1 ? "" : "s"}
                          </span>
                          <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-[#01dcfd] group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>

                      <ul className="space-y-1">
                        {correos.map((c) => (
                          <li key={c.orden} className="flex items-center gap-2.5 text-sm text-zinc-400">
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full ${
                                c.enviado ? "bg-[#01dcfd] shadow-[0_0_6px_#01dcfd]" : "bg-zinc-600"
                              }`}
                            />
                            <span className="text-zinc-600 font-mono text-[11px] w-6">
                              {c.orden}/{correos.length}
                            </span>
                            <span className="truncate flex-1 max-w-[55ch] text-zinc-300">{c.asunto}</span>
                            {c.enviado && c.hora && (
                              <span className="text-[10.5px] uppercase tracking-wider text-[#01dcfd]/70 shrink-0 tabular-nums">
                                {formatFechaCorta(c.hora)} hs
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </Link>
                  </div>
                </article>
              </LeadCardGlow>
            );
          })}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-2">
          <button
            onClick={() => irAPagina(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-[var(--nitel-border)] text-sm text-zinc-300 hover:border-[#01dcfd]/40 hover:text-[#01dcfd] transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <span className="text-xs text-zinc-500 tabular-nums px-2">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => irAPagina(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg border border-[var(--nitel-border)] text-sm text-zinc-300 hover:border-[#01dcfd]/40 hover:text-[#01dcfd] transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
          >
            Siguiente <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Barra flotante de acciones bulk */}
      {seleccion.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--nitel-border-strong)] bg-[#14141f]/95 backdrop-blur-xl shadow-2xl shadow-black/50 px-3 py-2.5">
            <span className="text-sm text-zinc-200 px-2 tabular-nums">
              <span className="text-[#01dcfd] font-medium">{seleccion.size}</span> seleccionado
              {seleccion.size === 1 ? "" : "s"}
            </span>
            <div className="w-px h-6 bg-[var(--nitel-border)]" />

            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                onClick={() => setConfirmarOrden(n)}
                disabled={pending}
                className="px-3 py-1.5 rounded-lg text-[12.5px] text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                Correo {n}
              </button>
            ))}

            <div className="w-px h-6 bg-[var(--nitel-border)]" />
            <button
              onClick={bulkArchivar}
              disabled={pending}
              className="px-3 py-1.5 rounded-lg text-[12.5px] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Archive className="w-3.5 h-3.5" />
              Archivar
            </button>
            <button
              onClick={() => setSeleccion(new Set())}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
              aria-label="Cancelar selección"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Modal de confirmación del envío bulk */}
      {confirmarOrden !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={() => setConfirmarOrden(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md rounded-2xl border border-[var(--nitel-border-strong)] bg-[#14141f] shadow-2xl shadow-black/60 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              aria-hidden
              className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-24 rounded-full opacity-30 blur-3xl pointer-events-none nitel-gradient"
            />
            <div className="relative p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl nitel-gradient flex items-center justify-center shadow-lg shadow-[#01dcfd]/30">
                  <Send className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.16em] text-[#01dcfd]/80 font-medium">
                    Envío masivo
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-50 tracking-tight">
                    ¿Mandar el correo {confirmarOrden} a {seleccion.size} lead
                    {seleccion.size === 1 ? "" : "s"}?
                  </h3>
                </div>
              </div>

              <p className="text-[12.5px] text-zinc-500 mb-5 leading-relaxed">
                Se va a enviar el <strong className="text-zinc-300">correo {confirmarOrden}</strong>{" "}
                a los {seleccion.size} leads seleccionados, <strong className="text-zinc-300">ahora mismo</strong>.
                Los que ya recibieron ese correo, respondieron o no tienen contenido se saltean
                automáticamente. Esta acción no se puede deshacer.
              </p>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmarOrden(null)}
                  className="px-4 py-2 rounded-lg text-sm text-zinc-300 hover:text-zinc-50 hover:bg-white/[0.04] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => bulkEnviar(confirmarOrden)}
                  className="px-5 py-2 rounded-lg nitel-gradient text-white text-sm font-medium tracking-tight transition-all flex items-center gap-2 hover:shadow-[0_8px_24px_-8px_rgba(1,220,253,0.6)] hover:-translate-y-px active:translate-y-0"
                >
                  <Send className="w-4 h-4" />
                  Sí, enviar a {seleccion.size}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FiltroSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-3 py-1.5 rounded-lg bg-[#14141f]/60 border text-[12.5px] focus:outline-none focus:border-[#01dcfd]/50 transition-all appearance-none cursor-pointer ${
        value ? "border-[#01dcfd]/40 text-zinc-100" : "border-[var(--nitel-border)] text-zinc-400"
      }`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2371717a' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
        paddingRight: "28px",
      }}
    >
      <option value="">{placeholder}: todos</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
