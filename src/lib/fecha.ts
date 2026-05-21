/**
 * Formatea fechas en zona horaria de Argentina (America/Argentina/Buenos_Aires),
 * independiente de la zona del navegador o del server.
 */

const TZ = "America/Argentina/Buenos_Aires";

const fmtCorto = new Intl.DateTimeFormat("es-AR", {
  timeZone: TZ,
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const fmtCompleto = new Intl.DateTimeFormat("es-AR", {
  timeZone: TZ,
  day: "2-digit",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const fmtSoloHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** "21 may, 14:32" — para tablas, badges, listas */
export function formatFechaCorta(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return fmtCorto.format(d).replace(/\./g, "");
}

/** "21 de mayo, 14:32" — para detalle */
export function formatFechaCompleta(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return fmtCompleto.format(d);
}

/** "14:32:05" — solo hora, para timestamps de "guardado hace X" */
export function formatHora(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return fmtSoloHora.format(d);
}
