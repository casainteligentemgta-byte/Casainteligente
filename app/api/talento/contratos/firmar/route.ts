import { NextResponse } from 'next/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';

type RpcResult = { ok?: boolean; error?: string; contrato_id?: string };

/**
 * POST { token, costo_hora_acordado? } — Firma digital móvil (onboarding): valida token, ejecuta RPC
 * `firmar_contrato_y_asignar` (aceptación + asignación obra + costo hora).
 */
export async function POST(req: Request) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let body: { token?: string; costo_hora_acordado?: number | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const token = (body.token ?? '').trim();
  if (!token) {
    return NextResponse.json({ error: 'token requerido' }, { status: 400 });
  }

  const { data: emp, error: eEmp } = await admin.client
    .from('ci_empleados')
    .select('id,proyecto_modulo_id,recruitment_need_id')
    .eq('token_registro', token)
    .maybeSingle();

  if (eEmp || !emp) {
    return NextResponse.json({ error: 'Expediente no encontrado o token inválido' }, { status: 404 });
  }

  const empleadoId = String((emp as { id: string }).id);
  let proyectoId = String((emp as { proyecto_modulo_id?: string | null }).proyecto_modulo_id ?? '').trim() || null;
  const requisicionId = String((emp as { recruitment_need_id?: string | null }).recruitment_need_id ?? '').trim() || null;

  const { data: ctr, error: eCtr } = await admin.client
    .from('ci_contratos_empleado_obra')
    .select('id,obra_id,proyecto_id,salario_basico_diario_ves')
    .eq('empleado_id', empleadoId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (eCtr || !ctr) {
    return NextResponse.json({ error: 'No hay contrato generado para este expediente' }, { status: 404 });
  }

  const c = ctr as {
    obra_id?: string | null;
    proyecto_id?: string | null;
    salario_basico_diario_ves?: number | null;
  };

  const sitioContrato = (c.obra_id ?? c.proyecto_id ?? '').trim() || null;
  if (!proyectoId && sitioContrato) {
    proyectoId = sitioContrato;
  }
  if (!proyectoId) {
    return NextResponse.json(
      { error: 'Falta proyecto/obra en el expediente o en el contrato; complete los datos antes de firmar.' },
      { status: 400 },
    );
  }

  let costoHora = body.costo_hora_acordado;
  if (costoHora == null || Number.isNaN(Number(costoHora))) {
    const sal = Number(c.salario_basico_diario_ves);
    costoHora = Number.isFinite(sal) && sal > 0 ? Math.round((sal / 8) * 10000) / 10000 : 0;
  }

  const { data: rpcData, error: rpcErr } = await admin.client.rpc(
    'firmar_contrato_y_asignar',
    {
      p_empleado_id: empleadoId,
      p_proyecto_id: proyectoId,
      p_requisicion_id: requisicionId || null,
      p_costo_hora_acordado: costoHora,
    } as never,
  );

  if (rpcErr) {
    console.error('[contratos/firmar] rpc', rpcErr);
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  const out = rpcData as RpcResult | null;
  if (!out?.ok) {
    return NextResponse.json(
      { error: out?.error === 'sin_contrato' ? 'Sin contrato activo' : 'No se pudo completar la firma' },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, contrato_id: out.contrato_id ?? null });
}
