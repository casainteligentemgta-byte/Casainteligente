import { NextResponse } from 'next/server';
import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Diferencias pedido / facturado / recibido (migración 362). */
export async function GET(req: Request) {
  const acceso = await requireAlgunPermisoWeb(['compra.registrar', 'compra.confirmar', 'cco.ver', 'admin.config']);
  if (!acceso.ok) return acceso.response;

  const todas = new URL(req.url).searchParams.get('todas') === '1';
  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from('ci_control_compras')
    .select(
      'id,purchase_invoice_id,procura_id,proyecto_id,tipo,material_id,descripcion,unidad,cantidad_pedida,cantidad_facturada,cantidad_recibida,precio_unitario,precio_referencia,moneda,monto_diferencia,estado,revisada_por,revisada_at,nota,created_at,purchase_invoices(invoice_number,supplier_name)',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (!todas) q = q.eq('estado', 'abierta');
  const { data, error } = await q;
  if (error) {
    if (/ci_control_compras/.test(error.message)) return NextResponse.json({ diferencias: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const filas = (data ?? []) as Array<Record<string, unknown>>;
  const ids = Array.from(new Set(filas.map((f) => String(f.proyecto_id ?? '')).filter(Boolean)));
  const obras = new Map<string, string>();
  if (ids.length) {
    const { data: ps } = await supabase.from('ci_proyectos').select('id,nombre').in('id', ids);
    for (const p of (ps ?? []) as Array<{ id: string; nombre: string | null }>) obras.set(p.id, p.nombre ?? '');
  }
  return NextResponse.json({
    diferencias: filas.map((f) => ({ ...f, obra: obras.get(String(f.proyecto_id ?? '')) ?? null })),
  });
}

/** Marcar revisada: { id, nota? }. */
export async function PATCH(req: Request) {
  const acceso = await requireAlgunPermisoWeb(['compra.confirmar', 'cco.editar', 'admin.config']);
  if (!acceso.ok) return acceso.response;

  const body = (await req.json().catch(() => ({}))) as { id?: string; nota?: string };
  const id = String(body.id ?? '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Diferencia inválida.' }, { status: 400 });

  const ahora = new Date().toISOString();
  const { data, error } = await createSupabaseAdminClient()
    .from('ci_control_compras')
    .update({
      estado: 'revisada',
      revisada_por: acceso.actor.email ?? acceso.actor.nombre ?? acceso.userId,
      revisada_at: ahora,
      nota: String(body.nota ?? '').trim().slice(0, 500) || null,
      updated_at: ahora,
    })
    .eq('id', id)
    .eq('estado', 'abierta')
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: 'Ya estaba revisada o no existe.' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
