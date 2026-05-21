import { sql, SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { StatCards } from "@/components/stat-cards";
import { AutoRefreshLeads } from "@/components/auto-refresh-leads";
import { BandejaInteractiva, type LeadRow } from "@/components/bandeja-interactiva";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type Stats = {
  pendientes: number;
  activas: number;
  enviadosHoy: number;
  totalEnviados: number;
};

type Filtros = {
  estado?: string; // 'pendiente' | 'en-curso'
  rubro?: string;
  origen?: string;
  q?: string; // búsqueda de texto local
  page: number;
};

/** Condiciones base: lead accionable (correo redactado, sin enviar, sin responder, no archivado) */
function condicionesBase(): SQL {
  return sql`
    archivado = false
    AND (nullif(trim(correo_1), '') IS NOT NULL
         OR nullif(trim(correo_2), '') IS NOT NULL
         OR nullif(trim(correo_3), '') IS NOT NULL)
    AND NOT (respondio = true AND nullif(trim(respuesta_texto), '') IS NOT NULL)
    AND (
      (nullif(trim(correo_1), '') IS NOT NULL AND COALESCE(contactado_1, false) = false)
      OR (nullif(trim(correo_2), '') IS NOT NULL AND COALESCE(contactado_2, false) = false)
      OR (nullif(trim(correo_3), '') IS NOT NULL AND COALESCE(contactado_3, false) = false)
    )
  `;
}

/** Filtros del usuario (estado/rubro/origen) como SQL extra */
function condicionesFiltro(f: Filtros): SQL {
  const parts: SQL[] = [];
  if (f.estado === "pendiente") {
    // ningún correo enviado todavía
    parts.push(sql`(COALESCE(contactado_1,false)=false AND COALESCE(contactado_2,false)=false AND COALESCE(contactado_3,false)=false)`);
  } else if (f.estado === "en-curso") {
    // al menos un correo enviado
    parts.push(sql`(COALESCE(contactado_1,false)=true OR COALESCE(contactado_2,false)=true OR COALESCE(contactado_3,false)=true)`);
  }
  if (f.rubro) parts.push(sql`category = ${f.rubro}`);
  if (f.origen) parts.push(sql`source_node = ${f.origen}`);
  if (f.q && f.q.trim()) {
    const like = `%${f.q.trim()}%`;
    parts.push(
      sql`(name ILIKE ${like} OR email ILIKE ${like} OR category ILIKE ${like})`,
    );
  }
  if (parts.length === 0) return sql`true`;
  return sql.join(parts, sql` AND `);
}

async function getLeads(f: Filtros): Promise<{ rows: LeadRow[]; total: number }> {
  const base = condicionesBase();
  const filtro = condicionesFiltro(f);
  const offset = (f.page - 1) * PAGE_SIZE;

  const rows = await db.execute(sql`
    SELECT
      place_id, name, email, category, source_node,
      contactado_1, contactado_2, contactado_3,
      hora_enviado_1, hora_enviado_2, hora_enviado_3,
      split_part(correo_1, E'\n', 1) AS asunto_1,
      split_part(correo_2, E'\n', 1) AS asunto_2,
      split_part(correo_3, E'\n', 1) AS asunto_3
    FROM leads_nitel
    WHERE ${base} AND ${filtro}
    ORDER BY name ASC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `);

  const totalR = await db.execute(sql`
    SELECT COUNT(*)::int AS total FROM leads_nitel WHERE ${base} AND ${filtro}
  `);
  const total = (totalR.rows[0] as { total: number }).total;

  return { rows: rows.rows as LeadRow[], total };
}

/** Opciones distintas para poblar los dropdowns de filtro (solo de leads accionables) */
async function getOpcionesFiltro(): Promise<{ rubros: string[]; origenes: string[] }> {
  const base = condicionesBase();
  const r = await db.execute(sql`
    SELECT DISTINCT category, source_node FROM leads_nitel WHERE ${base}
  `);
  const rows = r.rows as Array<{ category: string | null; source_node: string | null }>;
  const rubros = [...new Set(rows.map((x) => x.category).filter((x): x is string => !!x?.trim()))].sort();
  const origenes = [...new Set(rows.map((x) => x.source_node).filter((x): x is string => !!x?.trim()))].sort();
  return { rubros, origenes };
}

async function getStats(): Promise<Stats> {
  const r = await db.execute(sql`
    WITH base AS (
      SELECT
        (CASE WHEN nullif(trim(correo_1), '') IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN nullif(trim(correo_2), '') IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN nullif(trim(correo_3), '') IS NOT NULL THEN 1 ELSE 0 END) AS total_correos,
        (CASE WHEN contactado_1 THEN 1 ELSE 0 END
         + CASE WHEN contactado_2 THEN 1 ELSE 0 END
         + CASE WHEN contactado_3 THEN 1 ELSE 0 END) AS enviados
      FROM leads_nitel WHERE archivado = false
    )
    SELECT
      (SELECT COUNT(*)::int FROM base WHERE total_correos > 0 AND enviados = 0) AS pendientes,
      (SELECT COUNT(*)::int FROM base WHERE total_correos > 0 AND enviados > 0 AND enviados < total_correos) AS activas,
      (SELECT COUNT(*)::int FROM (
        SELECT 1 FROM leads_nitel WHERE contactado_1 AND hora_enviado_1::date = CURRENT_DATE
        UNION ALL SELECT 1 FROM leads_nitel WHERE contactado_2 AND hora_enviado_2::date = CURRENT_DATE
        UNION ALL SELECT 1 FROM leads_nitel WHERE contactado_3 AND hora_enviado_3::date = CURRENT_DATE
      ) AS h) AS enviados_hoy,
      (SELECT
         SUM(CASE WHEN contactado_1 THEN 1 ELSE 0 END
           + CASE WHEN contactado_2 THEN 1 ELSE 0 END
           + CASE WHEN contactado_3 THEN 1 ELSE 0 END)::int
       FROM leads_nitel) AS total_enviados
  `);
  const row = r.rows[0] as Record<string, number>;
  return {
    pendientes: row.pendientes ?? 0,
    activas: row.activas ?? 0,
    enviadosHoy: row.enviados_hoy ?? 0,
    totalEnviados: row.total_enviados ?? 0,
  };
}

export default async function BandejaPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; rubro?: string; origen?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const filtros: Filtros = {
    estado: sp.estado,
    rubro: sp.rubro,
    origen: sp.origen,
    q: sp.q,
    page: Math.max(1, parseInt(sp.page ?? "1", 10) || 1),
  };

  const [{ rows: leads, total }, stats, opciones] = await Promise.all([
    getLeads(filtros),
    getStats(),
    getOpcionesFiltro(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="px-8 py-9 max-w-6xl mx-auto">
      <header className="mb-7 flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#01dcfd]/80 font-medium mb-2">
            Pipeline
          </div>
          <h1 className="text-3xl font-semibold text-zinc-50 mb-1.5 tracking-tight">
            Bandeja de revisión
          </h1>
          <p className="text-sm text-zinc-500">
            Leads con correos redactados por n8n, listos para que los revises y envíes.
          </p>
        </div>
        <AutoRefreshLeads />
      </header>

      <StatCards stats={stats} />

      <BandejaInteractiva
        leads={leads}
        opciones={opciones}
        filtros={{ estado: filtros.estado, rubro: filtros.rubro, origen: filtros.origen, q: filtros.q }}
        page={filtros.page}
        totalPages={totalPages}
        total={total}
      />
    </div>
  );
}
