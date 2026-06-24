import { NextResponse } from 'next/server';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { parseEstadoProcura } from '@/lib/procuras/procuraEstados';
import { vincularProcuraCompraContabilidad } from '@/lib/procuras/vincularProcuraCompra';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

const ESTADOS_VINCULO = new Set(['aprobada', 'aprobada_directa', 'recibida_parcial']);

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/** POST — Vincula procura aprobada con factura del cuadro de contabilidad. */
export async function POST(req: Request) {
  const auth = await requirePermisoWeb('procura.ejecutar_compra');
  if (!auth.ok) {
    const alt = await requirePermisoWeb('procura.aprobar');
    if (!alt.ok) return auth.response;
  }

  let body: { procura_id?: string; contabilidad_compra_id?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const procuraId = String(body.procura_id ?? '').trim();
  const compraId = String(body.contabilidad_compra_id ?? '').trim();

  if (!isUuid(procuraId) || !isUuid(compraId)) {
    return NextResponse.json({ error: 'procura_id y contabilidad_compra_id son obligatorios.' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;
  const supabase = admin.client;

  const { data: procura, error: procErr } = await supabase
    .from('ci_procuras')
    .select('id,ticket,estado,purchase_invoice_id')
    .eq('id', procuraId)
    .maybeSingle();

  if (procErr) return NextResponse.json({ error: procErr.message }, { status: 500 });
  if (!procura) return NextResponse.json({ error: 'Procura no encontrada.' }, { status: 404 });

  const proc = procura as {
    id: string;
    ticket: string;
    estado: string;
    purchase_invoice_id: string | null;
  };

  const estado = parseEstadoProcura(proc.estado);
  if (!estado || !ESTADOS_VINCULO.has(estado)) {
    return NextResponse.json(
      { error: `La procura ${proc.ticket} no está en estado que permita vincular factura.` },
      { status: 400 },
    );
  }

  if (proc.purchase_invoice_id?.trim()) {
    return NextResponse.json(
      { error: `La procura ${proc.ticket} ya tiene factura vinculada.` },
      { status: 409 },
    );
  }

  const { data: compra, error: compraErr } = await supabase
    .from('contabilidad_compras')
    .select('id,purchase_invoice_id,procura_id,invoice_number,supplier_name')
    .eq('id', compraId)
    .maybeSingle();

  if (compraErr) return NextResponse.json({ error: compraErr.message }, { status: 500 });
  if (!compra) return NextResponse.json({ error: 'Compra contable no encontrada.' }, { status: 404 });

  const compraRow = compra as {
    id: string;
    purchase_invoice_id: string | null;
    procura_id: string | null;
    invoice_number: string | null;
    supplier_name: string | null;
  };

  const purchaseInvoiceId = String(compraRow.purchase_invoice_id ?? '').trim();
  if (!purchaseInvoiceId) {
    return NextResponse.json(
      { error: 'Esta compra no tiene purchase_invoice_id. Regístrela primero en contabilidad.' },
      { status: 400 },
    );
  }

  const procuraOcupada = String(compraRow.procura_id ?? '').trim();
  if (procuraOcupada && procuraOcupada !== procuraId) {
    return NextResponse.json(
      { error: 'Esta factura ya está vinculada a otra procura.' },
      { status: 409 },
    );
  }

  const resultado = await vincularProcuraCompraContabilidad(supabase, {
    purchaseInvoiceId,
    procuraId,
    contabilidadCompraId: compraId,
    autoMatch: false,
  });

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error ?? 'No se pudo vincular.' }, { status: 500 });
  }
  if (!resultado.vinculado) {
    return NextResponse.json(
      { error: 'No se pudo vincular la procura con la factura seleccionada.' },
      { status: 400 },
    );
  }

  const { data: procActualizada } = await supabase
    .from('ci_procuras')
    .select('id,ticket,estado,purchase_invoice_id')
    .eq('id', procuraId)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    ticket: resultado.ticket ?? proc.ticket,
    procura_id: procuraId,
    contabilidad_compra_id: compraId,
    invoice_number: compraRow.invoice_number ?? null,
    supplier_name: compraRow.supplier_name ?? null,
    desviacion_usd: resultado.desviacionUsd ?? null,
    estado: (procActualizada as { estado?: string } | null)?.estado ?? null,
  });
}
