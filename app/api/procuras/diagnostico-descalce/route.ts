import { NextResponse } from 'next/server';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import {
  normalizarDiagnosticoDescalce,
  type DiagnosticoDescalceRow,
} from '@/lib/procuras/diagnosticoDescalceProcuras';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

export type { DiagnosticoDescalceRow };

/** GET — Auditoría cambiaria de procuras vinculadas a compras (solo aprobadores). */
export async function GET() {
  const auth = await requirePermisoWeb('procura.aprobar');
  if (!auth.ok) return auth.response;

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { data, error } = await admin.client.rpc(
    'ci_diagnostico_descalce_procuras' as 'ci_registrar_ingreso_manual_campo',
  );

  if (error) {
    const hint = /ci_diagnostico_descalce_procuras|42883|does not exist/i.test(error.message)
      ? 'Ejecute migración 257_ci_diagnostico_descalce_seguro_metadatos_historial.sql en Supabase.'
      : undefined;
    return NextResponse.json({ error: error.message, hint }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    reporte: normalizarDiagnosticoDescalce(data),
  });
}
