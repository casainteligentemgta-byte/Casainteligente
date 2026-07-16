import { NextResponse } from 'next/server';
import { auditarEficienciaAdOficina } from '@/lib/nomina/auditoriaEficienciaAdOficina';
import { resolverTasaBcvVesPorUsd } from '@/lib/finanzas/bcvTasaPorFecha';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';

export const dynamic = 'force-dynamic';

/** GET — ratio nómina oficina / honorarios AD (candado descuentos Nexus). */
export async function GET() {
  try {
    const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());
    const tasaRes = await resolverTasaBcvVesPorUsd(new Date().toISOString().slice(0, 10));
    const auditoria = await auditarEficienciaAdOficina(supabase, tasaRes.tasa_bcv_ves_por_usd);

    return NextResponse.json({
      ratio_eficiencia: auditoria.ratio_eficiencia,
      bloquear_descuentos_nexus: auditoria.bloquear_descuentos_nexus,
      honorarios_ad_usd: auditoria.honorarios_ad_usd,
      nomina_oficina_usd: auditoria.nomina_oficina_usd,
      nomina_oficina_ves: auditoria.nomina_oficina_ves,
      umbral_pct: auditoria.umbral_pct,
      proyectos_con_ad: auditoria.proyectos_con_ad,
      eficiente: auditoria.eficiente,
      tasa_bcv: tasaRes.tasa_bcv_ves_por_usd,
    });
  } catch (err: unknown) {
    console.error('[GET eficiencia-ad]', err);
    return NextResponse.json({ error: formatErrorMessage(err) }, { status: 500 });
  }
}
