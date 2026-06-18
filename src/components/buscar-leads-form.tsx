"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Upload, Loader2, MapPin, Tag, Globe, Star, Hash, Compass } from "lucide-react";
import { buscarLeads } from "@/lib/buscar-leads-action";
import { useLeadsStream } from "./leads-stream-provider";

const RATINGS = ["+3.0", "+3.5", "+4.0", "+4.5", "5"] as const;

export function BuscarLeadsForm() {
  const router = useRouter();
  const { trackBusqueda } = useLeadsStream();
  const [pending, start] = useTransition();
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setArchivoNombre(file ? file.name : null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    start(async () => {
      const res = await buscarLeads(formData);

      if (res.ok && res.busquedaId) {
        // Registramos la búsqueda en el provider para que el toast la trackee
        await trackBusqueda(res.busquedaId);
        toast.success(
          "Búsqueda iniciada. Mirá el cartel abajo a la derecha para ver el progreso.",
        );
        form.reset();
        setArchivoNombre(null);
        // Llevamos al usuario a la bandeja para que vea los leads cuando lleguen
        router.push("/");
      } else {
        toast.error(res.error ?? "No se pudo iniciar la búsqueda");
        // Si igual hubo un busqueda_id, lo trackeamos para que se vea el "Fallida"
        if (res.busquedaId) await trackBusqueda(res.busquedaId);
      }
    });
  }

  // Si hay un KMZ cargado, la ubicación sale del polígono → bloqueamos país/provincia/ciudad.
  // Si NO hay KMZ, el radio no aplica → lo bloqueamos.
  const tieneKmz = !!archivoNombre;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Archivo KMZ — destacado arriba */}
      <FieldGroup
        icon={Upload}
        label="Archivo KMZ/KML"
        hint="Opcional · Para búsqueda geográfica por polígono. Si lo dejás vacío, usamos los campos de ubicación de abajo"
      >
        <label className="relative flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-[var(--nitel-border-strong)] bg-[#14141f]/40 hover:border-[#01dcfd]/40 hover:bg-[#14141f]/70 cursor-pointer transition-all">
          <Upload className="w-4 h-4 text-zinc-500" />
          <span className="text-sm text-zinc-300 flex-1 truncate">
            {archivoNombre || "Click para subir un .kmz o .kml"}
          </span>
          {archivoNombre && (
            <span className="text-[10.5px] uppercase tracking-wider text-[#01dcfd]">
              cargado
            </span>
          )}
          <input
            type="file"
            name="Archivo KMZ/KML (opcional)"
            accept=".kmz,.kml"
            onChange={onFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
      </FieldGroup>

      {/* Nota sobre obligatorios */}
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
        <span className="text-[#01dcfd]">*</span>
        <span>Los campos con asterisco son obligatorios.</span>
      </div>

      {/* Grid de búsqueda */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FieldGroup
          icon={Tag}
          label="Industria o sector"
          hint="Ej: inmobiliaria, ferretería, veterinaria. Lo corregimos automático con IA si tipeás mal"
        >
          <Input name="Industria/Sector" />
        </FieldGroup>

        <FieldGroup
          icon={Globe}
          label="País"
          disabled={tieneKmz}
          hint={tieneKmz ? "Se usa la ubicación del archivo KMZ" : undefined}
        >
          <Input name="Pais" disabled={tieneKmz} />
        </FieldGroup>

        <FieldGroup
          icon={MapPin}
          label="Provincia"
          disabled={tieneKmz}
          hint={tieneKmz ? "Se usa la ubicación del archivo KMZ" : undefined}
        >
          <Input name="Provincia" disabled={tieneKmz} />
        </FieldGroup>

        <FieldGroup
          icon={MapPin}
          label="Ciudad"
          disabled={tieneKmz}
          hint={tieneKmz ? "Se usa la ubicación del archivo KMZ" : undefined}
        >
          <Input name="Ciudad" disabled={tieneKmz} />
        </FieldGroup>
      </div>

      {/* Parámetros de búsqueda */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FieldGroup icon={Hash} label="Cantidad" required hint="Cuántos leads buscar">
          <Input
            name="Cantidad de resultados"
            type="number"
            min={1}
            max={500}
            required
          />
        </FieldGroup>

        <FieldGroup
          icon={Compass}
          label="Radio (km)"
          disabled={!tieneKmz}
          hint={tieneKmz ? "Radio alrededor del polígono del KMZ. Default 3 km" : "Solo aplica si subís un KMZ"}
        >
          <Input
            name="Radio en km (solo aplica con KMZ)"
            type="number"
            min={1}
            defaultValue={3}
            disabled={!tieneKmz}
          />
        </FieldGroup>

        <FieldGroup icon={Star} label="Rating mínimo" required>
          <Select name="Rating mínimo (estrellas)" required defaultValue="">
            <option value="" disabled>
              Elegí un rating
            </option>
            {RATINGS.map((r) => (
              <option key={r} value={r}>
                {r === "5" ? "5 estrellas" : `${r} y más`}
              </option>
            ))}
          </Select>
        </FieldGroup>
      </div>

      {/* CTA */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--nitel-border)]">
        <span className="text-xs text-zinc-500 mr-auto">
          La búsqueda corre en background. Vas a ver un cartel flotante con el progreso.
        </span>
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2.5 rounded-lg nitel-gradient text-white text-sm font-medium tracking-tight transition-all flex items-center gap-2 disabled:opacity-50 hover:shadow-[0_8px_24px_-8px_rgba(1,220,253,0.6)] hover:-translate-y-px active:translate-y-0"
        >
          {pending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {pending ? "Iniciando..." : "Buscar leads"}
        </button>
      </div>
    </form>
  );
}

function FieldGroup({
  icon: Icon,
  label,
  hint,
  required,
  disabled,
  children,
}: {
  icon: React.ElementType;
  label: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={disabled ? "opacity-50 transition-opacity" : "transition-opacity"}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-[#01dcfd]/70" />
        <label className="text-[10.5px] uppercase tracking-[0.16em] text-zinc-500 font-medium">
          {label}
          {required && (
            <span className="text-[#01dcfd] ml-1" aria-hidden>
              *
            </span>
          )}
        </label>
      </div>
      {children}
      {hint && <p className="text-[11px] text-zinc-600 mt-1">{hint}</p>}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3 py-2 rounded-lg bg-[#14141f]/60 border border-[var(--nitel-border)] text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-[#01dcfd]/50 focus:bg-[#14141f]/90 transition-all disabled:cursor-not-allowed disabled:bg-[#14141f]/30"
    />
  );
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full px-3 py-2 rounded-lg bg-[#14141f]/60 border border-[var(--nitel-border)] text-sm text-zinc-100 focus:outline-none focus:border-[#01dcfd]/50 focus:bg-[#14141f]/90 transition-all appearance-none cursor-pointer"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2301dcfd' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        paddingRight: "32px",
      }}
    >
      {children}
    </select>
  );
}
