import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { SidebarNav } from "@/components/sidebar-nav";
import { LeadsStreamProvider } from "@/components/leads-stream-provider";
import { BusquedasToast } from "@/components/busquedas-toast";

export const dynamic = "force-dynamic";

// Límite de Google Workspace: 2000 correos/día (cuentas gratuitas Gmail = 500)
const LIMITE_DIARIO = 2000;

async function getEnviadosHoy(): Promise<number> {
  const r = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM (
      SELECT 1 FROM leads_nitel WHERE contactado_1 AND hora_enviado_1::date = (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
      UNION ALL SELECT 1 FROM leads_nitel WHERE contactado_2 AND hora_enviado_2::date = (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
      UNION ALL SELECT 1 FROM leads_nitel WHERE contactado_3 AND hora_enviado_3::date = (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
    ) AS h
  `);
  return (r.rows[0] as { n: number }).n ?? 0;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const enviadosHoy = await getEnviadosHoy();

  return (
    <LeadsStreamProvider>
      <div className="flex min-h-screen">
        <SidebarNav enviadosHoy={enviadosHoy} limiteDiario={LIMITE_DIARIO} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <BusquedasToast />
    </LeadsStreamProvider>
  );
}
