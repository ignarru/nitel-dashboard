import { sql, SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { BaseDatosTabla, type LeadDbRow } from "@/components/base-datos-tabla";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

type Filtros = {
  q?: string;
  rubro?: string;
  origen?: string;
  arch?: string; // '' todos | 'no' sin archivar | 'si' solo archivados
  contacto?: string; // '' todos | 'sin' | 'en-curso'
  sort: string; // 'creado' | 'nombre' | 'estado'
  dir: "asc" | "desc";
  page: number;
};

type Stats = {
  total: number;
  conEmail: number;
  contactados: number;
  respondieron: number;
  archivados: number;
};

function condiciones(f: Filtros): SQL {
  const parts: SQL[] = [];
  if (f.q && f.q.trim()) {
    const like = `%${f.q.trim().slice(0, 80)}%`;
    parts.push(
      sql`(name ILIKE ${like} OR email ILIKE ${like} OR category ILIKE ${like} OR phone ILIKE ${like})`,
    );
  }
  if (f.rubro) parts.push(sql`category = ${f.rubro}`);
  if (f.origen) parts.push(sql`source_node = ${f.origen}`);
  if (f.arch === "no") parts.push(sql`archivado = false`);
  else if (f.arch === "si") parts.push(sql`archivado = true`);
  if (f.contacto === "sin") {
    parts.push(
      sql`(COALESCE(contactado_1,false)=false AND COALESCE(contactado_2,false)=false AND COALESCE(contactado_3,false)=false)`,
    );
  } else if (f.contacto === "en-curso") {
    parts.push(
      sql`(COALESCE(contactado_1,false)=true OR COALESCE(contactado_2,false)=true OR COALESCE(contactado_3,false)=true)`,
    );
  }
  if (parts.length === 0) return sql`true`;
  return sql.join(parts, sql` AND `);
}

/** ORDER BY seguro: columna por whitelist, dirección validada. */
function buildOrderBy(sort: string, dir: "asc" | "desc"): SQL {
  const d = sql.raw(dir === "asc" ? "ASC" : "DESC");
  if (sort === "nombre") return sql`name ${d} NULLS LAST`;
  if (sort === "estado") {
    return sql`(COALESCE(contactado_1::int,0)+COALESCE(contactado_2::int,0)+COALESCE(contactado_3::int,0)) ${d}, name ASC`;
  }
  return sql`created_at ${d}`;
}

async function getLeads(f: Filtros): Promise<{ rows: LeadDbRow[]; total: number }> {
  const cond = condiciones(f);
  const orderBy = buildOrderBy(f.sort, f.dir);
  const offset = (f.page - 1) * PAGE_SIZE;

  const rows = await db.execute(sql`
    SELECT
      place_id, name, email, category, phone, source_node,
      contactado_1, contactado_2, contactado_3,
      respondio, archivado, created_at,
      (nullif(trim(correo_1), '') IS NOT NULL
       OR nullif(trim(correo_2), '') IS NOT NULL
       OR nullif(trim(correo_3), '') IS NOT NULL) AS tiene_correos
    FROM nitel_leads
    WHERE ${cond}
    ORDER BY ${orderBy}
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `);

  const totalR = await db.execute(sql`
    SELECT COUNT(*)::int AS total FROM nitel_leads WHERE ${cond}
  `);
  const total = (totalR.rows[0] as { total: number }).total;

  return { rows: rows.rows as LeadDbRow[], total };
}

async function getOpcionesFiltro(): Promise<{ rubros: string[]; origenes: string[] }> {
  const r = await db.execute(sql`SELECT DISTINCT category, source_node FROM nitel_leads`);
  const rows = r.rows as Array<{ category: string | null; source_node: string | null }>;
  const rubros = [...new Set(rows.map((x) => x.category).filter((x): x is string => !!x?.trim()))].sort();
  const origenes = [...new Set(rows.map((x) => x.source_node).filter((x): x is string => !!x?.trim()))].sort();
  return { rubros, origenes };
}

async function getStats(): Promise<Stats> {
  const r = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE nullif(trim(email), '') IS NOT NULL)::int AS con_email,
      COUNT(*) FILTER (WHERE COALESCE(contactado_1,false) OR COALESCE(contactado_2,false) OR COALESCE(contactado_3,false))::int AS contactados,
      COUNT(*) FILTER (WHERE respondio = true)::int AS respondieron,
      COUNT(*) FILTER (WHERE archivado = true)::int AS archivados
    FROM nitel_leads
  `);
  const row = r.rows[0] as Record<string, number>;
  return {
    total: row.total ?? 0,
    conEmail: row.con_email ?? 0,
    contactados: row.contactados ?? 0,
    respondieron: row.respondieron ?? 0,
    archivados: row.archivados ?? 0,
  };
}

export default async function BaseDatosPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    rubro?: string;
    origen?: string;
    arch?: string;
    contacto?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const filtros: Filtros = {
    q: sp.q,
    rubro: sp.rubro,
    origen: sp.origen,
    arch: sp.arch,
    contacto: sp.contacto,
    sort: ["creado", "nombre", "estado"].includes(sp.sort ?? "") ? sp.sort! : "creado",
    dir: sp.dir === "asc" ? "asc" : "desc",
    page: Math.max(1, parseInt(sp.page ?? "1", 10) || 1),
  };

  const [{ rows: leads, total }, stats, opciones] = await Promise.all([
    getLeads(filtros),
    getStats(),
    getOpcionesFiltro(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="px-5 sm:px-8 py-8 sm:py-9 max-w-6xl mx-auto">
      <header className="mb-7">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#01dcfd]/80 font-medium mb-2">
          Base de datos
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-50 mb-1.5 tracking-tight">
          Todos los leads
        </h1>
        <p className="text-sm text-zinc-500">
          Vista cruda de la tabla en Postgres — todos los leads guardados, incluidos archivados y
          sin correos. Entrá a la secuencia o borralos de forma permanente.
        </p>
      </header>

      <BaseDatosTabla
        leads={leads}
        stats={stats}
        opciones={opciones}
        filtros={{
          q: filtros.q,
          rubro: filtros.rubro,
          origen: filtros.origen,
          arch: filtros.arch,
          contacto: filtros.contacto,
          sort: filtros.sort,
          dir: filtros.dir,
        }}
        page={filtros.page}
        totalPages={totalPages}
        total={total}
      />
    </div>
  );
}
