import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  TrendingUp,
  MessageCircleReply,
  Send,
  Users,
  Clock,
  BarChart3,
  Trophy,
  MapPin,
} from "lucide-react";
import { formatFechaCorta } from "@/lib/fecha";

export const dynamic = "force-dynamic";

type Resumen = {
  total_leads: number;
  con_contenido: number;
  contactados: number;
  respondieron: number;
  tasa_respuesta: number;
  resp_correo_1: number;
  resp_correo_2: number;
  resp_correo_3: number;
  base_correo_1: number;
  base_correo_2: number;
  base_correo_3: number;
  tiempo_promedio_min: number | null;
  tiempo_min: number | null;
  tiempo_max: number | null;
};

type TopRow = { etiqueta: string; contactados: number; respondieron: number; tasa: number };

type ActividadDia = { dia: string; enviados: number; respuestas: number };

async function getResumen(): Promise<Resumen> {
  const r = await db.execute(sql`
    WITH base AS (
      SELECT
        place_id,
        (CASE WHEN nullif(trim(correo_1), '') IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN nullif(trim(correo_2), '') IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN nullif(trim(correo_3), '') IS NOT NULL THEN 1 ELSE 0 END) AS tiene_contenido,
        (CASE WHEN contactado_1 OR contactado_2 OR contactado_3 THEN 1 ELSE 0 END) AS fue_contactado,
        contactado_1, contactado_2, contactado_3,
        respondio, cual_respondio, respuesta_texto,
        respuesta_recibida_at, hora_enviado_1, hora_enviado_2, hora_enviado_3
      FROM nitel_leads
    ),
    tiempos AS (
      SELECT
        EXTRACT(EPOCH FROM (respuesta_recibida_at -
          CASE regexp_replace(cual_respondio, '[^0-9]', '', 'g')
            WHEN '1' THEN hora_enviado_1
            WHEN '2' THEN hora_enviado_2
            WHEN '3' THEN hora_enviado_3
            ELSE NULL
          END)) / 60 AS min_respuesta
      FROM base
      WHERE respondio = true AND nullif(trim(respuesta_texto), '') IS NOT NULL AND respuesta_recibida_at IS NOT NULL
    )
    SELECT
      (SELECT COUNT(*)::int FROM nitel_leads) AS total_leads,
      (SELECT COUNT(*)::int FROM base WHERE tiene_contenido > 0) AS con_contenido,
      (SELECT COUNT(*)::int FROM base WHERE fue_contactado > 0) AS contactados,
      (SELECT COUNT(*)::int FROM base WHERE respondio = true AND nullif(trim(respuesta_texto), '') IS NOT NULL) AS respondieron,
      (SELECT COUNT(*)::int FROM base WHERE respondio = true AND nullif(trim(respuesta_texto), '') IS NOT NULL AND regexp_replace(cual_respondio, '[^0-9]', '', 'g') = '1') AS resp_correo_1,
      (SELECT COUNT(*)::int FROM base WHERE respondio = true AND nullif(trim(respuesta_texto), '') IS NOT NULL AND regexp_replace(cual_respondio, '[^0-9]', '', 'g') = '2') AS resp_correo_2,
      (SELECT COUNT(*)::int FROM base WHERE respondio = true AND nullif(trim(respuesta_texto), '') IS NOT NULL AND regexp_replace(cual_respondio, '[^0-9]', '', 'g') = '3') AS resp_correo_3,
      (SELECT COUNT(*)::int FROM base WHERE contactado_1 = true) AS base_correo_1,
      (SELECT COUNT(*)::int FROM base WHERE contactado_2 = true) AS base_correo_2,
      (SELECT COUNT(*)::int FROM base WHERE contactado_3 = true) AS base_correo_3,
      (SELECT AVG(min_respuesta)::int FROM tiempos WHERE min_respuesta > 0) AS tiempo_promedio_min,
      (SELECT MIN(min_respuesta)::int FROM tiempos WHERE min_respuesta > 0) AS tiempo_min,
      (SELECT MAX(min_respuesta)::int FROM tiempos WHERE min_respuesta > 0) AS tiempo_max
  `);
  const row = r.rows[0] as Record<string, number | null>;
  const contactados = row.contactados ?? 0;
  const respondieron = row.respondieron ?? 0;
  return {
    total_leads: row.total_leads ?? 0,
    con_contenido: row.con_contenido ?? 0,
    contactados,
    respondieron,
    tasa_respuesta: contactados > 0 ? (respondieron / contactados) * 100 : 0,
    resp_correo_1: row.resp_correo_1 ?? 0,
    resp_correo_2: row.resp_correo_2 ?? 0,
    resp_correo_3: row.resp_correo_3 ?? 0,
    base_correo_1: row.base_correo_1 ?? 0,
    base_correo_2: row.base_correo_2 ?? 0,
    base_correo_3: row.base_correo_3 ?? 0,
    tiempo_promedio_min: row.tiempo_promedio_min,
    tiempo_min: row.tiempo_min,
    tiempo_max: row.tiempo_max,
  };
}

async function getTopPorCategoria(): Promise<TopRow[]> {
  const r = await db.execute(sql`
    SELECT
      COALESCE(NULLIF(trim(category), ''), '(sin categoría)') AS etiqueta,
      COUNT(*) FILTER (WHERE contactado_1 OR contactado_2 OR contactado_3)::int AS contactados,
      COUNT(*) FILTER (WHERE respondio = true AND nullif(trim(respuesta_texto), '') IS NOT NULL)::int AS respondieron
    FROM nitel_leads
    GROUP BY etiqueta
    HAVING COUNT(*) FILTER (WHERE contactado_1 OR contactado_2 OR contactado_3) > 0
    ORDER BY (CASE WHEN COUNT(*) FILTER (WHERE contactado_1 OR contactado_2 OR contactado_3) = 0 THEN 0
              ELSE 100.0 * COUNT(*) FILTER (WHERE respondio = true AND nullif(trim(respuesta_texto), '') IS NOT NULL) /
                   COUNT(*) FILTER (WHERE contactado_1 OR contactado_2 OR contactado_3) END) DESC,
             respondieron DESC
    LIMIT 5
  `);
  return (r.rows as Array<{ etiqueta: string; contactados: number; respondieron: number }>).map(
    (row) => ({
      etiqueta: row.etiqueta,
      contactados: row.contactados,
      respondieron: row.respondieron,
      tasa: row.contactados > 0 ? (row.respondieron / row.contactados) * 100 : 0,
    }),
  );
}

async function getTopPorSourceNode(): Promise<TopRow[]> {
  const r = await db.execute(sql`
    SELECT
      COALESCE(NULLIF(trim(source_node), ''), '(sin origen)') AS etiqueta,
      COUNT(*) FILTER (WHERE contactado_1 OR contactado_2 OR contactado_3)::int AS contactados,
      COUNT(*) FILTER (WHERE respondio = true AND nullif(trim(respuesta_texto), '') IS NOT NULL)::int AS respondieron
    FROM nitel_leads
    GROUP BY etiqueta
    HAVING COUNT(*) FILTER (WHERE contactado_1 OR contactado_2 OR contactado_3) > 0
    ORDER BY respondieron DESC, contactados DESC
    LIMIT 5
  `);
  return (r.rows as Array<{ etiqueta: string; contactados: number; respondieron: number }>).map(
    (row) => ({
      etiqueta: row.etiqueta,
      contactados: row.contactados,
      respondieron: row.respondieron,
      tasa: row.contactados > 0 ? (row.respondieron / row.contactados) * 100 : 0,
    }),
  );
}

async function getActividad(): Promise<ActividadDia[]> {
  // Últimos 30 días: por cada día, cuántos correos salieron y cuántas respuestas llegaron
  const r = await db.execute(sql`
    WITH dias AS (
      SELECT generate_series(
        (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - INTERVAL '29 days',
        (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
        INTERVAL '1 day'
      )::date AS dia
    ),
    enviados AS (
      SELECT dia, COUNT(*)::int AS n FROM (
        SELECT (hora_enviado_1 AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS dia FROM nitel_leads WHERE hora_enviado_1 IS NOT NULL
        UNION ALL
        SELECT (hora_enviado_2 AT TIME ZONE 'America/Argentina/Buenos_Aires')::date FROM nitel_leads WHERE hora_enviado_2 IS NOT NULL
        UNION ALL
        SELECT (hora_enviado_3 AT TIME ZONE 'America/Argentina/Buenos_Aires')::date FROM nitel_leads WHERE hora_enviado_3 IS NOT NULL
      ) e
      GROUP BY dia
    ),
    respuestas AS (
      SELECT (respuesta_recibida_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS dia,
             COUNT(*)::int AS n
      FROM nitel_leads
      WHERE respondio = true AND nullif(trim(respuesta_texto), '') IS NOT NULL AND respuesta_recibida_at IS NOT NULL
      GROUP BY dia
    )
    SELECT
      d.dia::text AS dia,
      COALESCE(e.n, 0) AS enviados,
      COALESCE(r.n, 0) AS respuestas
    FROM dias d
    LEFT JOIN enviados e ON e.dia = d.dia
    LEFT JOIN respuestas r ON r.dia = d.dia
    ORDER BY d.dia ASC
  `);
  return r.rows as ActividadDia[];
}

function formatTiempo(min: number | null): string {
  if (min === null || min === undefined) return "—";
  if (min < 60) return `${min} min`;
  const hs = Math.round(min / 60);
  if (hs < 24) return `${hs} h`;
  const d = Math.round(hs / 24);
  return `${d} día${d === 1 ? "" : "s"}`;
}

export default async function EstadisticasPage() {
  const [resumen, topCat, topSrc, actividad] = await Promise.all([
    getResumen(),
    getTopPorCategoria(),
    getTopPorSourceNode(),
    getActividad(),
  ]);

  const tasaRespCorreo = [
    {
      n: 1,
      enviados: resumen.base_correo_1,
      respondieron: resumen.resp_correo_1,
      tasa: resumen.base_correo_1 > 0 ? (resumen.resp_correo_1 / resumen.base_correo_1) * 100 : 0,
    },
    {
      n: 2,
      enviados: resumen.base_correo_2,
      respondieron: resumen.resp_correo_2,
      tasa: resumen.base_correo_2 > 0 ? (resumen.resp_correo_2 / resumen.base_correo_2) * 100 : 0,
    },
    {
      n: 3,
      enviados: resumen.base_correo_3,
      respondieron: resumen.resp_correo_3,
      tasa: resumen.base_correo_3 > 0 ? (resumen.resp_correo_3 / resumen.base_correo_3) * 100 : 0,
    },
  ];

  const maxActividad = Math.max(
    1,
    ...actividad.flatMap((d) => [d.enviados, d.respuestas]),
  );

  return (
    <div className="px-8 py-9 max-w-6xl mx-auto">
      <header className="mb-7">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#01dcfd]/80 font-medium mb-2">
          Métricas
        </div>
        <h1 className="text-3xl font-semibold text-zinc-50 mb-1.5 tracking-tight">
          Estadísticas
        </h1>
        <p className="text-sm text-zinc-500">
          Salud del pipeline de prospección y performance del outbound.
        </p>
      </header>

      {/* KPI hero — tasa de respuesta */}
      <section className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <KPIHero
          label="Tasa de respuesta"
          value={`${resumen.tasa_respuesta.toFixed(1)}%`}
          sub={`${resumen.respondieron} de ${resumen.contactados} contactados`}
          icon={MessageCircleReply}
          accent="#01dcfd"
          highlight
        />
        <KPIHero
          label="Total contactados"
          value={resumen.contactados}
          sub={`${resumen.respondieron} respondieron`}
          icon={Send}
          accent="#770eff"
        />
        <KPIHero
          label="Tiempo promedio de respuesta"
          value={formatTiempo(resumen.tiempo_promedio_min)}
          sub={
            resumen.tiempo_min !== null
              ? `Min: ${formatTiempo(resumen.tiempo_min)} · Max: ${formatTiempo(resumen.tiempo_max)}`
              : "Sin respuestas todavía"
          }
          icon={Clock}
          accent="#a1a1aa"
        />
      </section>

      {/* Funnel */}
      <Section title="Funnel" icon={TrendingUp}>
        <Funnel resumen={resumen} />
      </Section>

      {/* Tasa por correo */}
      <Section title="Tasa de respuesta por correo" icon={BarChart3}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {tasaRespCorreo.map((c) => (
            <div
              key={c.n}
              className="rounded-xl border border-[var(--nitel-border)] bg-[#14141f]/60 backdrop-blur p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10.5px] uppercase tracking-[0.14em] text-zinc-500 font-medium">
                  Correo {c.n}
                </span>
                <span className="text-[10.5px] text-zinc-600 tabular-nums">
                  {c.respondieron}/{c.enviados}
                </span>
              </div>
              <div className="text-2xl font-semibold text-zinc-50 tracking-tight tabular-nums">
                {c.tasa.toFixed(1)}%
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className="h-full rounded-full nitel-gradient"
                  style={{ width: `${Math.min(100, c.tasa)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Top por categoría */}
      <Section title="Top categorías por tasa de respuesta" icon={Trophy}>
        <TopList rows={topCat} mostrar="tasa" emptyMsg="Cuando haya contactos, vas a ver acá qué rubros responden mejor." />
      </Section>

      {/* Top por source_node */}
      <Section title="Top orígenes por cantidad de respuestas" icon={MapPin}>
        <TopList rows={topSrc} mostrar="respondieron" emptyMsg="Cuando los leads tengan source_node y respuestas, este ranking se llena solo." />
      </Section>

      {/* Actividad últimos 30 días */}
      <Section title="Actividad últimos 30 días" icon={Users}>
        <ActividadChart datos={actividad} maxValor={maxActividad} />
      </Section>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-3.5 h-3.5 text-[#01dcfd]/70" />
        <h2 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.18em]">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function KPIHero({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  highlight,
}: {
  label: string;
  value: number | string;
  sub: string;
  icon: React.ElementType;
  accent: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="relative rounded-2xl border backdrop-blur p-5 overflow-hidden"
      style={{
        background: "rgba(20, 20, 31, 0.6)",
        borderColor: highlight ? `${accent}55` : "var(--nitel-border)",
        boxShadow: highlight ? `0 0 0 1px ${accent}22, 0 8px 40px -12px ${accent}55` : undefined,
      }}
    >
      {highlight && (
        <div
          aria-hidden
          className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-25 blur-3xl pointer-events-none"
          style={{ background: accent }}
        />
      )}
      <div className="relative flex items-start justify-between mb-3">
        <span
          className="text-[10.5px] uppercase tracking-[0.16em] font-medium"
          style={{ color: `${accent}cc` }}
        >
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center border"
          style={{
            background: `${accent}1a`,
            borderColor: `${accent}40`,
          }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
        </div>
      </div>
      <div className="relative text-3xl font-semibold text-zinc-50 tabular-nums tracking-tight leading-none">
        {value}
      </div>
      <div className="relative text-[12px] text-zinc-500 mt-2">{sub}</div>
    </div>
  );
}

function Funnel({ resumen }: { resumen: Resumen }) {
  const pasos = [
    { label: "Scrapeados (total)", value: resumen.total_leads, color: "#a1a1aa" },
    { label: "Con correos redactados", value: resumen.con_contenido, color: "#770eff" },
    { label: "Contactados", value: resumen.contactados, color: "#01dcfd" },
    { label: "Respondieron", value: resumen.respondieron, color: "#01dcfd" },
  ];
  const max = Math.max(1, ...pasos.map((p) => p.value));
  return (
    <div className="rounded-2xl border border-[var(--nitel-border)] bg-[#14141f]/60 backdrop-blur p-5 space-y-3">
      {pasos.map((p, i) => {
        const pct = (p.value / max) * 100;
        const conversion =
          i > 0 && pasos[i - 1].value > 0
            ? ((p.value / pasos[i - 1].value) * 100).toFixed(1)
            : null;
        return (
          <div key={p.label} className="flex items-center gap-4">
            <div className="w-40 text-[12px] text-zinc-400 shrink-0">{p.label}</div>
            <div className="flex-1 h-7 bg-white/[0.04] rounded-md overflow-hidden">
              <div
                className="h-full rounded-md flex items-center px-2 transition-all"
                style={{
                  width: `${Math.max(8, pct)}%`,
                  background: `linear-gradient(90deg, ${p.color}66, ${p.color}33)`,
                  borderLeft: `2px solid ${p.color}`,
                }}
              >
                <span className="text-[12px] font-medium text-zinc-100 tabular-nums">{p.value}</span>
              </div>
            </div>
            <div className="w-20 text-right text-[11px] tabular-nums text-zinc-500 shrink-0">
              {conversion && <span>{conversion}%</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TopList({
  rows,
  mostrar,
  emptyMsg,
}: {
  rows: TopRow[];
  mostrar: "tasa" | "respondieron";
  emptyMsg: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--nitel-border)] bg-[#14141f]/40 p-6 text-[13px] text-zinc-500">
        {emptyMsg}
      </div>
    );
  }
  const max = Math.max(1, ...rows.map((r) => (mostrar === "tasa" ? r.tasa : r.respondieron)));
  return (
    <div className="rounded-2xl border border-[var(--nitel-border)] bg-[#14141f]/60 backdrop-blur divide-y divide-[var(--nitel-border)]">
      {rows.map((r) => {
        const valor = mostrar === "tasa" ? r.tasa : r.respondieron;
        const pct = (valor / max) * 100;
        return (
          <div key={r.etiqueta} className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] text-zinc-200 font-medium truncate">{r.etiqueta}</div>
              <div className="text-[11px] text-zinc-500 mt-0.5 tabular-nums">
                {r.respondieron}/{r.contactados} respondieron
              </div>
            </div>
            <div className="w-32 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full nitel-gradient"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <span className="text-[12px] text-zinc-300 tabular-nums font-medium w-14 text-right">
                {mostrar === "tasa" ? `${r.tasa.toFixed(1)}%` : valor}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActividadChart({
  datos,
  maxValor,
}: {
  datos: ActividadDia[];
  maxValor: number;
}) {
  return (
    <div className="rounded-2xl border border-[var(--nitel-border)] bg-[#14141f]/60 backdrop-blur p-5">
      <div className="flex items-center gap-4 mb-3 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-[#770eff]" />
          Enviados
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-[#01dcfd]" />
          Respuestas
        </span>
      </div>
      <div className="flex items-end gap-0.5 h-32">
        {datos.map((d) => (
          <div
            key={d.dia}
            className="flex-1 flex flex-col items-center justify-end group relative h-full"
            title={`${formatFechaCorta(d.dia + "T12:00:00Z")} — ${d.enviados} enviados, ${d.respuestas} respuestas`}
          >
            <div className="w-full flex gap-0.5 items-end justify-center h-full">
              <div
                className="w-1/2 rounded-t-sm bg-[#770eff] opacity-70 group-hover:opacity-100 transition-opacity"
                style={{ height: `${(d.enviados / maxValor) * 100}%`, minHeight: d.enviados > 0 ? "2px" : "0" }}
              />
              <div
                className="w-1/2 rounded-t-sm bg-[#01dcfd] opacity-80 group-hover:opacity-100 transition-opacity"
                style={{ height: `${(d.respuestas / maxValor) * 100}%`, minHeight: d.respuestas > 0 ? "2px" : "0" }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-zinc-600 tabular-nums">
        <span>{datos[0]?.dia.slice(5)}</span>
        <span>{datos[datos.length - 1]?.dia.slice(5)}</span>
      </div>
    </div>
  );
}
