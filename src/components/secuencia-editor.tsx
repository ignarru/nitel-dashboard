"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExt from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { toast } from "sonner";
import {
  CheckCheck,
  Circle,
  Send,
  Loader2,
  MessageCircleReply,
  AlertTriangle,
  X,
  Pencil,
  Check,
  StickyNote,
} from "lucide-react";
import { guardarBorrador, enviarAhora } from "@/lib/correo-actions";
import { guardarNota, editarLead } from "@/lib/lead-actions";
import { formatFechaCorta, formatFechaCompleta, formatHora } from "@/lib/fecha";

type Orden = 1 | 2 | 3;

type LeadUI = {
  placeId: string;
  name: string | null;
  email: string | null;
  category: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  notas: string | null;
  respondio: boolean;
};

type CorreoUI = {
  orden: Orden;
  asunto: string;
  cuerpoHtml: string;
  enviado: boolean;
  sentAt: string | null;
};

export function SecuenciaEditor({ lead, correos }: { lead: LeadUI; correos: CorreoUI[] }) {
  const [activeOrden, setActiveOrden] = useState<Orden>(correos[0]?.orden ?? 1);
  const active = correos.find((c) => c.orden === activeOrden) ?? correos[0];

  if (!active) {
    return (
      <div className="p-8 text-center text-zinc-500">
        Este lead no tiene correos redactados todavía.
      </div>
    );
  }

  return (
    <div className="h-full flex bg-[#0a0a0f]">
      <aside className="w-72 shrink-0 border-r border-[var(--nitel-border)] bg-[#0a0a0f]/80 backdrop-blur-xl flex flex-col">
        <LeadInfoEditable lead={lead} />
        <div className="p-3 flex-1 overflow-y-auto">
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-zinc-500 mb-3 px-2 font-medium">
            Secuencia
          </div>
          {correos.map((c) => {
            const isActive = c.orden === activeOrden;
            const Icon = c.enviado ? CheckCheck : Circle;
            return (
              <button
                key={c.orden}
                onClick={() => setActiveOrden(c.orden)}
                className={`relative w-full text-left px-3 py-2.5 rounded-lg flex items-start gap-2.5 transition-all mb-1 ${
                  isActive
                    ? "bg-gradient-to-r from-[#770eff]/15 to-[#01dcfd]/5 text-zinc-50"
                    : "hover:bg-white/[0.04] text-zinc-300"
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full nitel-gradient"
                  />
                )}
                <Icon
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    isActive ? "text-[#01dcfd]" : c.enviado ? "text-[#01dcfd]" : "text-zinc-500"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[10.5px] text-zinc-500 uppercase tracking-[0.14em]">
                    Correo {c.orden} de {correos.length}
                  </div>
                  <div className="text-sm font-medium truncate mt-0.5">
                    {c.asunto || "(sin asunto)"}
                  </div>
                  <div className="text-[11px] mt-0.5 text-zinc-500">
                    {c.enviado ? "Enviado" : "Sin enviar"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <CorreoPanel key={`${lead.placeId}-${active.orden}`} lead={lead} correo={active} />
    </div>
  );
}

function CorreoPanel({ lead, correo }: { lead: LeadUI; correo: CorreoUI }) {
  const editable = !correo.enviado;
  const [asunto, setAsunto] = useState(correo.asunto);
  const [html, setHtml] = useState(correo.cuerpoHtml);
  const [savingTimer, setSavingTimer] = useState<NodeJS.Timeout | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [pending, start] = useTransition();
  const [confirmando, setConfirmando] = useState(false);

  // Validaciones para habilitar el envío
  const cuerpoVacio = html.replace(/<[^>]*>/g, "").trim() === "";
  const asuntoVacio = asunto.trim() === "";
  const emailValido = !!lead.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email.trim());
  const puedeEnviar = !lead.respondio && !asuntoVacio && !cuerpoVacio && emailValido;

  function ejecutarEnvio() {
    setConfirmando(false);
    start(async () => {
      try {
        await guardarBorrador(lead.placeId, correo.orden, asunto, html);
        const res = await enviarAhora(lead.placeId, correo.orden);
        if (res.ok) {
          toast.success("Correo enviado");
        } else {
          toast.error(res.error ?? "No se pudo enviar");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al enviar");
      }
    });
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      LinkExt.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Escribí el cuerpo del correo..." }),
    ],
    content: correo.cuerpoHtml,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap-dark focus:outline-none min-h-[300px]",
      },
    },
    onUpdate: ({ editor }) => {
      const newHtml = editor.getHTML();
      setHtml(newHtml);
      scheduleSave(asunto, newHtml);
    },
  });

  function scheduleSave(a: string, h: string) {
    if (!editable) return;
    if (savingTimer) clearTimeout(savingTimer);
    const t = setTimeout(async () => {
      try {
        await guardarBorrador(lead.placeId, correo.orden, a, h);
        setLastSaved(new Date());
      } catch {
        /* silent */
      }
    }, 1500);
    setSavingTimer(t);
  }

  useEffect(() => () => (savingTimer ? clearTimeout(savingTimer) : undefined), [savingTimer]);

  const StatusIcon = correo.enviado ? CheckCheck : Circle;

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="px-6 py-4 border-b border-[var(--nitel-border)] bg-[#14141f]/40">
        <div className="flex items-center gap-2 mb-3 text-sm">
          <StatusIcon className={`w-4 h-4 ${correo.enviado ? "text-[#01dcfd]" : "text-zinc-500"}`} />
          <span className="text-zinc-100 font-medium">
            {correo.enviado ? "Enviado" : "Sin enviar"}
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-zinc-500">Correo {correo.orden}</span>
          {correo.sentAt && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="text-[#01dcfd]">{formatFechaCorta(correo.sentAt)} hs</span>
            </>
          )}
          {lastSaved && (
            <span className="ml-auto text-xs text-zinc-600 tabular-nums">
              Guardado {formatHora(lastSaved)}
            </span>
          )}
        </div>
        <div className="grid grid-cols-[60px_1fr] gap-x-3 gap-y-2 items-center">
          <span className="text-[10.5px] uppercase tracking-[0.16em] text-zinc-500 font-medium">
            Para
          </span>
          <span className="text-sm text-zinc-300">{lead.email}</span>
          <span className="text-[10.5px] uppercase tracking-[0.16em] text-zinc-500 font-medium">
            Asunto
          </span>
          <input
            type="text"
            value={asunto}
            onChange={(e) => {
              setAsunto(e.target.value);
              scheduleSave(e.target.value, html);
            }}
            disabled={!editable}
            placeholder="Asunto del correo"
            className="text-[15px] font-medium tracking-tight bg-transparent outline-none border-none text-zinc-50 disabled:text-zinc-400 placeholder:text-zinc-600 w-full"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-2 divide-x divide-[var(--nitel-border)]">
        <div className="flex flex-col bg-[#0a0a0f]">
          <div className="px-4 py-2.5 border-b border-[var(--nitel-border)] text-[10.5px] uppercase tracking-[0.16em] text-zinc-500 font-medium flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-[#770eff]" />
            Editor
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <EditorContent editor={editor} />
          </div>
        </div>

        <div className="flex flex-col bg-[#08080d]">
          <div className="px-4 py-2.5 border-b border-[var(--nitel-border)] text-[10.5px] uppercase tracking-[0.16em] text-zinc-500 font-medium flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-[#01dcfd]" />
            Cómo lo va a ver el lead
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-[600px] mx-auto">
              <div className="rounded-t-xl border border-[var(--nitel-border-strong)] border-b-0 bg-[#1a1a26] px-4 py-2.5 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3f3f46]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3f3f46]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3f3f46]" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-[11px] text-zinc-500 tracking-tight">
                    Gmail · Vista previa
                  </span>
                </div>
                <div className="w-12" />
              </div>
              <div className="rounded-b-xl border border-[var(--nitel-border-strong)] border-t-0 bg-white text-zinc-900 shadow-[0_24px_60px_-12px_rgba(1,220,253,0.12),0_8px_32px_-8px_rgba(0,0,0,0.6)] overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-200">
                  <div className="text-xs text-zinc-500 mb-1">
                    De: <span className="text-zinc-700">Nitel &lt;clientes@nitel.com.ar&gt;</span>
                  </div>
                  <div className="text-xs text-zinc-500 mb-3">
                    Para: <span className="text-zinc-700">{lead.email}</span>
                  </div>
                  <div className="text-base font-medium text-zinc-900 tracking-tight">
                    {asunto}
                  </div>
                </div>
                <div
                  className="px-6 py-5 text-[14px] leading-relaxed text-zinc-800 prose prose-sm max-w-none [&_p]:my-2"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-[var(--nitel-border)] bg-[#14141f]/60 backdrop-blur flex items-center justify-end gap-3">
        {correo.enviado ? (
          <div className="text-sm text-zinc-400 flex items-center gap-2">
            <CheckCheck className="w-4 h-4 text-[#01dcfd]" />
            Enviado el {correo.sentAt && formatFechaCompleta(correo.sentAt)} hs <span className="text-zinc-600">(hora Argentina)</span>
          </div>
        ) : lead.respondio ? (
          // AUTO-PAUSE: el lead respondió, no se mandan más correos
          <div className="flex items-center gap-2 text-sm text-[#01dcfd]">
            <MessageCircleReply className="w-4 h-4" />
            <span>El lead ya respondió — la secuencia se pausó automáticamente.</span>
          </div>
        ) : (
          <>
            {/* Avisos de validación */}
            {!emailValido && (
              <span className="text-xs text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Email del lead inválido
              </span>
            )}
            {emailValido && asuntoVacio && (
              <span className="text-xs text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Falta el asunto
              </span>
            )}
            {emailValido && !asuntoVacio && cuerpoVacio && (
              <span className="text-xs text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> El cuerpo está vacío
              </span>
            )}
            <button
              onClick={() => setConfirmando(true)}
              disabled={pending || !puedeEnviar}
              className="relative px-5 py-2 rounded-lg nitel-gradient text-white text-sm font-medium tracking-tight transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:shadow-[0_8px_24px_-8px_rgba(1,220,253,0.6)] enabled:hover:-translate-y-px active:translate-y-0"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar ahora
            </button>
          </>
        )}
      </div>

      {/* Modal de confirmación de envío */}
      {confirmando && (
        <ConfirmarEnvioModal
          email={lead.email ?? ""}
          asunto={asunto}
          orden={correo.orden}
          modoTest={typeof window !== "undefined"}
          onCancelar={() => setConfirmando(false)}
          onConfirmar={ejecutarEnvio}
        />
      )}
    </div>
  );
}

function ConfirmarEnvioModal({
  email,
  asunto,
  orden,
  onCancelar,
  onConfirmar,
}: {
  email: string;
  asunto: string;
  orden: Orden;
  modoTest: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onCancelar}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl border border-[var(--nitel-border-strong)] bg-[#14141f] shadow-2xl shadow-black/60 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* glow superior */}
        <div
          aria-hidden
          className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-24 rounded-full opacity-30 blur-3xl pointer-events-none nitel-gradient"
        />
        <div className="relative p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl nitel-gradient flex items-center justify-center shadow-lg shadow-[#01dcfd]/30">
                <Send className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.16em] text-[#01dcfd]/80 font-medium">
                  Confirmar envío
                </div>
                <h3 className="text-lg font-semibold text-zinc-50 tracking-tight">
                  ¿Mandar el correo {orden}?
                </h3>
              </div>
            </div>
            <button
              onClick={onCancelar}
              className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5 rounded-xl border border-[var(--nitel-border)] bg-black/30 p-4 mb-5">
            <div className="grid grid-cols-[60px_1fr] gap-x-3 text-sm">
              <span className="text-[10.5px] uppercase tracking-[0.16em] text-zinc-500 font-medium pt-0.5">
                Para
              </span>
              <span className="text-zinc-200 break-all">{email}</span>
            </div>
            <div className="grid grid-cols-[60px_1fr] gap-x-3 text-sm">
              <span className="text-[10.5px] uppercase tracking-[0.16em] text-zinc-500 font-medium pt-0.5">
                Asunto
              </span>
              <span className="text-zinc-200">{asunto}</span>
            </div>
          </div>

          <p className="text-[12.5px] text-zinc-500 mb-5">
            El correo va a salir <strong className="text-zinc-300">ahora mismo</strong> desde la
            casilla de Nitel. Esta acción no se puede deshacer.
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
              className="px-5 py-2 rounded-lg nitel-gradient text-white text-sm font-medium tracking-tight transition-all flex items-center gap-2 hover:shadow-[0_8px_24px_-8px_rgba(1,220,253,0.6)] hover:-translate-y-px active:translate-y-0"
            >
              <Send className="w-4 h-4" />
              Sí, enviar ahora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadInfoEditable({ lead }: { lead: LeadUI }) {
  const [editando, setEditando] = useState(false);
  const [name, setName] = useState(lead.name ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [category, setCategory] = useState(lead.category ?? "");
  const [pending, start] = useTransition();

  // Notas (autosave)
  const [notas, setNotas] = useState(lead.notas ?? "");
  const [notaGuardada, setNotaGuardada] = useState<Date | null>(null);
  const notaTimer = useRef<NodeJS.Timeout | null>(null);

  function onNotaChange(v: string) {
    setNotas(v);
    if (notaTimer.current) clearTimeout(notaTimer.current);
    notaTimer.current = setTimeout(async () => {
      try {
        await guardarNota(lead.placeId, v);
        setNotaGuardada(new Date());
      } catch {
        /* silent */
      }
    }, 1200);
  }

  useEffect(() => () => (notaTimer.current ? clearTimeout(notaTimer.current) : undefined), []);

  function guardarDatos() {
    start(async () => {
      const res = await editarLead(lead.placeId, { name, email, category });
      if (res.ok) {
        toast.success("Datos del lead actualizados");
        setEditando(false);
      } else {
        toast.error(res.error ?? "No se pudo guardar");
      }
    });
  }

  return (
    <div className="p-5 border-b border-[var(--nitel-border)]">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-[#01dcfd]/80 font-medium">
          Lead
        </div>
        {!editando ? (
          <button
            onClick={() => setEditando(true)}
            className="text-zinc-500 hover:text-[#01dcfd] transition-colors flex items-center gap-1 text-[11px]"
          >
            <Pencil className="w-3 h-3" /> Editar
          </button>
        ) : (
          <button
            onClick={guardarDatos}
            disabled={pending}
            className="text-[#01dcfd] hover:text-[#01dcfd]/80 transition-colors flex items-center gap-1 text-[11px] disabled:opacity-50"
          >
            {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Guardar
          </button>
        )}
      </div>

      {editando ? (
        <div className="space-y-2">
          <EditInput value={name} onChange={setName} placeholder="Nombre / empresa" />
          <EditInput value={email} onChange={setEmail} placeholder="email@dominio.com" />
          <EditInput value={category} onChange={setCategory} placeholder="Rubro" />
          <button
            onClick={() => {
              setEditando(false);
              setName(lead.name ?? "");
              setEmail(lead.email ?? "");
              setCategory(lead.category ?? "");
            }}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <>
          <div className="font-medium text-zinc-50 mb-0.5 tracking-tight">
            {lead.name || "(sin nombre)"}
          </div>
          <div className="text-sm text-zinc-400 truncate">{lead.email || "(sin email)"}</div>
          {lead.category && <div className="text-xs text-zinc-500 mt-1">{lead.category}</div>}
          {(lead.phone || lead.website) && (
            <div className="mt-3 pt-3 border-t border-[var(--nitel-border)] space-y-1 text-[11px] text-zinc-500">
              {lead.phone && <div>{lead.phone}</div>}
              {lead.website && (
                <div className="truncate">
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noopener"
                    className="hover:text-[#01dcfd] transition-colors"
                  >
                    {lead.website.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Notas internas */}
      <div className="mt-4 pt-4 border-t border-[var(--nitel-border)]">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em] text-zinc-500 font-medium">
            <StickyNote className="w-3 h-3" /> Notas internas
          </div>
          {notaGuardada && (
            <span className="text-[10px] text-zinc-600 tabular-nums">
              guardado {formatHora(notaGuardada)}
            </span>
          )}
        </div>
        <textarea
          value={notas}
          onChange={(e) => onNotaChange(e.target.value)}
          placeholder="Anotá lo que quieras sobre este lead (no se envía, es privado)..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-[#14141f]/60 border border-[var(--nitel-border)] text-[12.5px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#01dcfd]/40 transition-all resize-y leading-relaxed"
        />
      </div>
    </div>
  );
}

function EditInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-2.5 py-1.5 rounded-lg bg-[#14141f]/80 border border-[var(--nitel-border)] text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-[#01dcfd]/50 transition-all"
    />
  );
}
