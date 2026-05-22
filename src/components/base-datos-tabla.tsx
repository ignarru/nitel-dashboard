"use client";

import { useState, useTransition, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Loader2,
  Trash2,
  ArrowRight,
  Mail,
  MailX,
  Archive,
  MessageCircleReply,
  CheckCheck,
  AlertTriangle,
  Database,
} from "lucide-react";
import { eliminarLead, eliminarLeadsBulk } from "@/lib/lead-actions";
import { formatFechaCorta } from "@/lib/fecha";

export type LeadDbRow = {
  place_id: string;
  name: string | null;
  email: string | null;
  category: string | null;
  phone: string | null;
  source_node: string | null;
  contactado_1: boolean | null;
  contactado_2: boolean | null;
  contactado_3: boolean | null;
  respondio: boolean | null;
  archivado: boolean | null;
  created_at: string | null;
  tiene_correos: boolean | null;
};

type Stats = {
  total: number;
  conEmail: number;
  contactados: number;
  respondieron: number;
  archivados: number;
};

type FiltrosUI = {
  q?: string;
  rubro?: string;
  origen?: string;
  arch?: string;
  contacto?: string;
  sort: string;
  dir: "asc" | "desc";
};

type Props = {
  leads: LeadDbRow[];
  stats: Stats;
  opciones: { rubros: string[]; origenes: string[] };
  filtros: FiltrosUI;
  page: number;
  totalPages: number;
  total: number;
};

// Mismo template de columnas para el header y las filas (alineación perfecta).
const GRID = "md:grid-cols-[28px_minmax(0,1fr)_120px_152px_92px_84px]";

type Confirmar =
  | { tipo: "uno"; lead: LeadDbRow }
  | { tipo: "bulk"; ids: string[] }
  | null;

export function BaseDatosTabla({ leads, stats, opciones, filtros, page, totalPages, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [busqueda, setBusqueda] = useState(filtros.q ?? "");
  const [confirmar, setConfirmar] = useState<Confirmar>(null);
  const busquedaTimer = useRef<NodeJS.Timeout | null>(null);

  function buildParams(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      q: filtros.q,
      rubro: filtros.rubro,
      origen: filtros.origen,
      arch: filtros.arch,
      contacto: filtros.contacto,
      sort: filtros.sort,
      dir: filtros.dir,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v.trim()) params.set(k, v);
    }
    return params;
  }

  function setParam(key: string, value: string) {
    const params = buildParams({ [key]: value });
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function irAPagina(p: number) {
    router.push(`${pathname}?${buildParams({ page: String(p) }).toString()}`);
  }

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

  function onSort(col: string) {
    let dir: "asc" | "desc";
    if (filtros.sort === col) {
      dir = filtros.dir === "asc" ? "desc" : "asc";
    } else {
      dir = col === "nombre" ? "asc" : "desc";
    }
    const params = buildParams({ sort: col, dir });
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

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

  const ids = useMemo(() => Array.from(seleccion), [seleccion]);
  const hayFiltros = !!(filtros.q || filtros.rubro || filtros.origen || filtros.arch || filtros.contacto);

  function ejecutarBorrado() {
    if (!confirmar) return;
    const target = confirmar;
    setConfirmar(null);
    start(async () => {
      if (target.tipo === "uno") {
        const res = await eliminarLead(target.lead.place_id);
        if (res.ok) {
          toast.success("Lead borrado");
          setSeleccion((prev) => {
            const next = new Set(prev);
            next.delete(target.lead.place_id);
            return next;
          });
        } else {
          toast.error(res.error ?? "No se pudo borrar");
        }
      } else {
        const res = await eliminarLeadsBulk(target.ids);
        if (res.ok) {
          toast.success(`${res.count} lead${res.count === 1 ? "" : "s"} borrado${res.count === 1 ? "" : "s"}`);
          setSeleccion(new Set());
        } else {
          toast.error(res.error ?? "No se pudieron borrar");
        }
      }
      router.refresh();
    });
  }

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-7">
        <StatChip label="Total" value={stats.total} icon={Database} accent />
        <StatChip label="Con email" value={stats.conEmail} icon={Mail} />
        <StatChip label="Contactados" value={stats.contactados} icon={CheckCheck} />
        <StatChip label="Respondieron" value={stats.respondieron} icon={MessageCircleReply} />
        <StatChip label="Archivados" value={stats.archivados} icon={Archive} />
      </div>

      {/* Buscador */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => onBuscar(e.target.value)}
          placeholder="Buscar por nombre, email, rubro o teléfono..."
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

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-zinc-500 mr-1">
          <Filter className="w-3.5 h-3.5" />
          <span className="text-[10.5px] uppercase tracking-[0.16em] font-medium">Filtros</span>
        </div>
        <FiltroSelect
          value={filtros.contacto ?? ""}
          onChange={(v) => setParam("contacto", v)}
          placeholder="Contacto"
          options={[
            { value: "sin", label: "Sin contactar" },
            { value: "en-curso", label: "Con algún envío" },
          ]}
        />
        <FiltroSelect
          value={filtros.arch ?? ""}
          onChange={(v) => setParam("arch", v)}
          placeholder="Archivados"
          options={[
            { value: "no", label: "Ocultar archivados" },
            { value: "si", label: "Solo archivados" },
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
              {seleccion.size === leads.length ? "Deseleccionar" : "Seleccionar todo"}
            </button>
          )}
          <span className="text-xs text-zinc-500 tabular-nums">
            {total} lead{total === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Header de columnas (desktop) */}
      {leads.length > 0 && (
        <div
          className={`hidden md:grid ${GRID} items-center gap-3 px-4 py-2 text-[10.5px] uppercase tracking-[0.14em] text-zinc-500 font-medium border-b border-[var(--nitel-border)]`}
        >
          <span />
          <SortHeader label="Lead" col="nombre" filtros={filtros} onSort={onSort} />
          <span>Origen</span>
          <SortHeader label="Estado" col="estado" filtros={filtros} onSort={onSort} />
          <SortHeader label="Creado" col="creado" filtros={filtros} onSort={onSort} />
          <span className="text-right">Acciones</span>
        </div>
      )}

      {/* Lista */}
      {leads.length === 0 ? (
        <div className="rounded-2xl border border-[var(--nitel-border)] bg-[#14141f]/40 p-14 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl nitel-gradient-soft border border-[var(--nitel-border)] flex items-center justify-center">
            <Database className="w-6 h-6 text-zinc-400" />
          </div>
          <p className="text-zinc-200 font-medium">
            {hayFiltros ? "No hay leads con esos filtros" : "La base de datos está vacía"}
          </p>
          <p className="text-zinc-500 text-sm mt-1">
            {hayFiltros ? "Probá limpiar los filtros." : "Cuando n8n inserte leads, van a aparecer acá."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--nitel-border)] md:divide-y-0 md:space-y-px">
          {leads.map((lead) => (
            <FilaLead
              key={lead.place_id}
              lead={lead}
              checked={seleccion.has(lead.place_id)}
              onToggle={() => toggle(lead.place_id)}
              onBorrar={() => setConfirmar({ tipo: "uno", lead })}
              disabled={pending}
            />
          ))}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
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

      {/* Barra flotante bulk */}
      {seleccion.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-3">
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--nitel-border-strong)] bg-[#14141f]/95 backdrop-blur-xl shadow-2xl shadow-black/50 px-3 py-2.5">
            <span className="text-sm text-zinc-200 px-2 tabular-nums">
              <span className="text-[#01dcfd] font-medium">{seleccion.size}</span> seleccionado
              {seleccion.size === 1 ? "" : "s"}
            </span>
            <div className="w-px h-6 bg-[var(--nitel-border)]" />
            <button
              onClick={() => setConfirmar({ tipo: "bulk", ids })}
              disabled={pending}
              className="px-3 py-1.5 rounded-lg text-[12.5px] text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Borrar
            </button>
            <button
              onClick={() => setSeleccion(new Set())}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
              aria-label="Cancelar selección"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal confirmar borrado */}
      {confirmar && (
        <ConfirmarBorradoModal
          cantidad={confirmar.tipo === "uno" ? 1 : confirmar.ids.length}
          nombre={confirmar.tipo === "uno" ? confirmar.lead.name || confirmar.lead.email || "(sin nombre)" : null}
          onCancelar={() => setConfirmar(null)}
          onConfirmar={ejecutarBorrado}
        />
      )}
    </>
  );
}

function FilaLead({
  lead,
  checked,
  onToggle,
  onBorrar,
  disabled,
}: {
  lead: LeadDbRow;
  checked: boolean;
  onToggle: () => void;
  onBorrar: () => void;
  disabled: boolean;
}) {
  const secuenciaHref = `/secuencia/${encodeURIComponent(lead.place_id)}`;
  return (
    <div
      className={`grid grid-cols-1 ${GRID} md:items-center gap-3 px-4 py-3 md:rounded-lg transition-colors ${
        checked ? "bg-[#01dcfd]/[0.05]" : "hover:bg-white/[0.025]"
      }`}
    >
      {/* Checkbox + (mobile) acciones a la derecha */}
      <div className="flex items-center justify-between md:block">
        <Checkbox checked={checked} onChange={onToggle} />
        <div className="flex items-center gap-1 md:hidden">
          <AccionesLead href={secuenciaHref} onBorrar={onBorrar} disabled={disabled} />
        </div>
      </div>

      {/* Lead: nombre + email + rubro */}
      <div className="min-w-0">
        <Link href={secuenciaHref} className="group block min-w-0">
          <div className="font-medium text-zinc-50 truncate tracking-tight group-hover:text-[#01dcfd] transition-colors">
            {lead.name || lead.email || "(sin nombre)"}
          </div>
          <div className="text-[13px] text-zinc-500 truncate mt-0.5 flex items-center gap-1.5">
            {lead.email ? (
              <span className="truncate">{lead.email}</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-400/80">
                <MailX className="w-3 h-3" /> sin email
              </span>
            )}
            {lead.category && <span className="text-zinc-600 shrink-0">· {lead.category}</span>}
          </div>
        </Link>
      </div>

      {/* Origen */}
      <div className="text-[13px] text-zinc-400 truncate md:text-zinc-500">
        <span className="md:hidden text-zinc-600 text-[11px] uppercase tracking-wider mr-1.5">Origen</span>
        {lead.source_node || <span className="text-zinc-600">—</span>}
      </div>

      {/* Estado */}
      <div>
        <EstadoCelda lead={lead} />
      </div>

      {/* Creado */}
      <div className="text-[12.5px] text-zinc-500 tabular-nums">
        <span className="md:hidden text-zinc-600 text-[11px] uppercase tracking-wider mr-1.5">Creado</span>
        {lead.created_at ? formatFechaCorta(lead.created_at) : "—"}
      </div>

      {/* Acciones (desktop) */}
      <div className="hidden md:flex items-center justify-end gap-1">
        <AccionesLead href={secuenciaHref} onBorrar={onBorrar} disabled={disabled} />
      </div>
    </div>
  );
}

function EstadoCelda({ lead }: { lead: LeadDbRow }) {
  const enviados =
    (lead.contactado_1 ? 1 : 0) + (lead.contactado_2 ? 1 : 0) + (lead.contactado_3 ? 1 : 0);
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium tabular-nums ${
          enviados > 0
            ? "bg-[#01dcfd]/10 text-[#01dcfd] border border-[#01dcfd]/25"
            : "bg-white/[0.04] text-zinc-400 border border-[var(--nitel-border)]"
        }`}
      >
        <CheckCheck className="w-3 h-3" />
        {enviados}/3
      </span>
      {lead.respondio && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
          <MessageCircleReply className="w-3 h-3" />
        </span>
      )}
      {lead.archivado && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/25">
          <Archive className="w-3 h-3" />
        </span>
      )}
      {!lead.tiene_correos && (
        <span
          title="Sin correos redactados"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-400/90 border border-amber-500/25"
        >
          <AlertTriangle className="w-3 h-3" />
        </span>
      )}
    </div>
  );
}

function AccionesLead({
  href,
  onBorrar,
  disabled,
}: {
  href: string;
  onBorrar: () => void;
  disabled: boolean;
}) {
  return (
    <>
      <Link
        href={href}
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-[#01dcfd] hover:bg-[#01dcfd]/10 transition-colors"
        title="Ver secuencia"
        aria-label="Ver secuencia"
      >
        <ArrowRight className="w-4 h-4" />
      </Link>
      <button
        onClick={onBorrar}
        disabled={disabled}
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-zinc-500 hover:text-rose-300 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
        title="Borrar lead"
        aria-label="Borrar lead"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
        checked ? "bg-[#01dcfd] border-[#01dcfd]" : "border-zinc-600 hover:border-[#01dcfd]"
      }`}
      aria-label="Seleccionar lead"
      aria-pressed={checked}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1 5L4 8L9 2" stroke="#0a0a0f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function SortHeader({
  label,
  col,
  filtros,
  onSort,
}: {
  label: string;
  col: string;
  filtros: FiltrosUI;
  onSort: (col: string) => void;
}) {
  const active = filtros.sort === col;
  return (
    <button
      onClick={() => onSort(col)}
      className={`flex items-center gap-1 uppercase tracking-[0.14em] transition-colors ${
        active ? "text-[#01dcfd]" : "hover:text-zinc-300"
      }`}
    >
      {label}
      {active ? (
        filtros.dir === "asc" ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )
      ) : (
        <ChevronsUpDown className="w-3 h-3 opacity-40" />
      )}
    </button>
  );
}

function StatChip({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3.5 py-3 ${
        accent ? "border-[#01dcfd]/25 bg-[#01dcfd]/[0.04]" : "border-[var(--nitel-border)] bg-[#14141f]/50"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-zinc-500 font-medium mb-1.5">
        <Icon className={`w-3.5 h-3.5 ${accent ? "text-[#01dcfd]" : "text-zinc-500"}`} />
        {label}
      </div>
      <div className={`text-2xl font-semibold tabular-nums tracking-tight ${accent ? "text-[#01dcfd]" : "text-zinc-100"}`}>
        {value}
      </div>
    </div>
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

function ConfirmarBorradoModal({
  cantidad,
  nombre,
  onCancelar,
  onConfirmar,
}: {
  cantidad: number;
  nombre: string | null;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancelar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancelar]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onCancelar}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl border border-[var(--nitel-border-strong)] bg-[#14141f] shadow-2xl shadow-black/60 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          aria-hidden
          className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-24 rounded-full opacity-25 blur-3xl pointer-events-none bg-rose-500"
        />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-rose-300" />
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-rose-300/80 font-medium">
                Borrado permanente
              </div>
              <h3 className="text-lg font-semibold text-zinc-50 tracking-tight">
                {cantidad === 1 ? "¿Borrar este lead?" : `¿Borrar ${cantidad} leads?`}
              </h3>
            </div>
          </div>

          <p className="text-[12.5px] text-zinc-400 mb-5 leading-relaxed">
            {cantidad === 1 && nombre ? (
              <>
                Se va a borrar <strong className="text-zinc-200">{nombre}</strong> de la base de
                datos.{" "}
              </>
            ) : (
              <>Se van a borrar de la base de datos. </>
            )}
            Esto los elimina de Postgres de forma{" "}
            <strong className="text-rose-300">permanente</strong> — no se puede deshacer. Si solo
            querés sacarlos de la bandeja, mejor archivalos.
          </p>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onCancelar}
              className="px-4 py-2 rounded-lg text-sm text-zinc-300 hover:text-zinc-50 hover:bg-white/[0.04] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirmar}
              className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium tracking-tight transition-all flex items-center gap-2 hover:-translate-y-px active:translate-y-0"
            >
              <Trash2 className="w-4 h-4" />
              {cantidad === 1 ? "Sí, borrar" : `Sí, borrar ${cantidad}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
