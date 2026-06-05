import { NextResponse } from 'next/server';
import { deleteCompraRegistro } from '@/lib/contabilidad/deleteCompraRegistro';
import { normalizarMonedaExtracted } from '@/lib/contabilidad/extractedCanal';
import {
  monedaOriginalCompra,
  recalcularMontosCompraCambioMoneda,
} from '@/lib/contabilidad/monedaCompra';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import type { MonedaOrigen } from '@/lib/finanzas/currency-converter';

export const dynamic = 'force-dynamic';

/** PATCH — Cambia moneda original (VES/USD) y recalcula montos bimonetarios. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    if (params.id.startsWith('canal-')) {
      return NextResponse.json(
        { error: 'Factura pendiente de Telegram: actualice la moneda desde el listado o recepción.' },
        { status: 400 },
      );
    }

    const body = (await req.json()) as { moneda?: string };
    const monedaNueva = normalizarMonedaExtracted(body.moneda) as MonedaOrigen;

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { data: row, error: loadErr } = await admin.client
      .from('contabilidad_compras')
      .select(
        'id,fecha,total_amount,total_amount_usd,tasa_bcv_ves_por_usd,moneda,moneda_original,monto_ves,monto_usd',
      )
      .eq('id', params.id)
      .maybeSingle();

    if (loadErr) {
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
    }

    const fila = row as {
      id: string;
      fecha: string;
      total_amount: number;
      total_amount_usd?: number | null;
      tasa_bcv_ves_por_usd?: number | null;
      moneda?: string | null;
      moneda_original?: string | null;
      monto_ves?: number | null;
      monto_usd?: number | null;
    };

    if (monedaOriginalCompra(fila) === monedaNueva) {
      return NextResponse.json({ ok: true, compra: row });
    }

    const { nominalFactura: _nominal, ...payloadMoneda } = await recalcularMontosCompraCambioMoneda(
      fila,
      monedaNueva,
    );

    const { data: updated, error: upErr } = await admin.client
      .from('contabilidad_compras')
      .update(payloadMoneda as never)
      .eq('id', params.id)
      .select(
        'id,fecha,total_amount,total_amount_usd,tasa_bcv_ves_por_usd,moneda,moneda_original,monto_ves,monto_usd',
      )
      .single();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, compra: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo actualizar la moneda.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE compra en contabilidad (+ recepción). ?duplicados=1 incluye mismo nº factura. ?canalId= uuid telegram. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(req.url);
    const incluirDuplicados = searchParams.get('duplicados') === '1';
    const canalId = searchParams.get('canalId')?.trim() || null;

    const result = await deleteCompraRegistro(admin.client, params.id, {
      incluirDuplicadosMismaFactura: incluirDuplicados,
    });

    if (canalId) {
      const { error: canalErr } = await admin.client
        .from('ci_facturas_canal_pendientes')
        .delete()
        .eq('id', canalId);
      if (canalErr) {
        console.warn('[DELETE compra] canal:', canalErr.message);
      }
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo eliminar la compra.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
