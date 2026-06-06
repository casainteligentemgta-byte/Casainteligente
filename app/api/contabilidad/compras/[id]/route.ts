import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteCompraRegistro } from '@/lib/contabilidad/deleteCompraRegistro';
import { normalizarMonedaExtracted, type ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';
import { repartirMontosFacturaEnLineas } from '@/lib/contabilidad/filtrosFacturaCanal';
import {
  monedaOriginalCompra,
  montosBimonetariosLista,
  precioUnitarioDesdeRepartoLinea,
  recalcularMontosCompraCambioMoneda,
  subtotalLineaEnMonedaOriginal,
} from '@/lib/contabilidad/monedaCompra';
import { tasaBcvCompra } from '@/lib/contabilidad/comprasMontos';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import type { MonedaOrigen } from '@/lib/finanzas/currency-converter';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { id: string } | Promise<{ id: string }> };

async function resolveParams(
  params: { id: string } | Promise<{ id: string }>,
): Promise<{ id: string }> {
  return params instanceof Promise ? params : Promise.resolve(params);
}

type CompraMonedaRow = {
  id: string;
  fecha: string;
  purchase_invoice_id: string | null;
  total_amount: number;
  total_amount_usd?: number | null;
  tasa_bcv_ves_por_usd?: number | null;
  moneda?: string | null;
  moneda_original?: string | null;
  monto_ves?: number | null;
  monto_usd?: number | null;
};

type LineaDbRow = {
  id: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
};

async function recalcularYGuardarLineasCompra(
  admin: SupabaseClient,
  compraId: string,
  filaActualizada: CompraMonedaRow,
  monedaNueva: MonedaOrigen,
): Promise<LineaDbRow[]> {
  const { data: lineasDb, error: lineasErr } = await admin
    .from('contabilidad_compra_lineas')
    .select('id, cantidad, precio_unitario, subtotal')
    .eq('compra_id', compraId);

  if (lineasErr) throw new Error(lineasErr.message);
  if (!lineasDb?.length) return [];

  const lineas = lineasDb as LineaDbRow[];
  const tasa = filaActualizada.tasa_bcv_ves_por_usd ?? tasaBcvCompra(filaActualizada) ?? null;
  const montos = montosBimonetariosLista(filaActualizada, tasa);
  const parsed = lineas.map((l) => {
    const cantidad = Number(l.cantidad) > 0 ? Number(l.cantidad) : 0;
    const precio =
      Number(l.precio_unitario) >= 0
        ? Number(l.precio_unitario)
        : cantidad > 0
          ? Number(l.subtotal) / cantidad
          : 0;
    return { cantidad, precioUnitario: precio };
  });
  const reparto = repartirMontosFacturaEnLineas({ bs: montos.bs, usd: montos.usd }, parsed);

  const actualizadas: LineaDbRow[] = [];

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]!;
    const cantidad = parsed[i]?.cantidad ?? 0;
    const repartoLinea = reparto[i] ?? { bs: 0, usd: null };
    const precio_unitario = precioUnitarioDesdeRepartoLinea(monedaNueva, cantidad, repartoLinea);
    const subtotal = subtotalLineaEnMonedaOriginal(monedaNueva, cantidad, repartoLinea);
    const { error: lineUpErr } = await admin
      .from('contabilidad_compra_lineas')
      .update({ precio_unitario, subtotal } as never)
      .eq('id', linea.id);
    if (lineUpErr) throw new Error(lineUpErr.message);
    actualizadas.push({ ...linea, precio_unitario, subtotal });
  }

  return actualizadas;
}

async function sincronizarMonedaEnRecepcionYCanal(
  admin: SupabaseClient,
  fila: CompraMonedaRow,
  monedaNueva: MonedaOrigen,
  nominalFactura: number,
  lineas: LineaDbRow[],
): Promise<void> {
  const piId = fila.purchase_invoice_id?.trim();
  if (!piId) return;

  const { error: piErr } = await admin
    .from('purchase_invoices')
    .update({
      moneda: monedaNueva,
      moneda_original: monedaNueva,
      total_amount: fila.total_amount,
      monto_ves: fila.monto_ves,
      monto_usd: fila.monto_usd,
      tasa_bcv_ves_por_usd: fila.tasa_bcv_ves_por_usd,
      total_amount_usd: fila.monto_usd,
    } as never)
    .eq('id', piId);
  if (piErr) {
    console.warn('[PATCH compra moneda] purchase_invoices:', piErr.message);
  }

  const { data: pendientes, error: canalErr } = await admin
    .from('ci_facturas_canal_pendientes')
    .select('id, extracted')
    .eq('purchase_invoice_id', piId);

  if (canalErr || !pendientes?.length) return;

  for (const p of pendientes) {
    const ex = (p.extracted ?? {}) as ExtractedCanalHeader;
    const items = Array.isArray(ex.items) ? ex.items : [];
    const itemsActualizados =
      items.length && lineas.length
        ? items.map((it, i) => ({
            ...it,
            unit_price: lineas[i]?.precio_unitario ?? it.unit_price,
          }))
        : items;

    const { error: upCanalErr } = await admin
      .from('ci_facturas_canal_pendientes')
      .update({
        extracted: {
          ...ex,
          moneda: monedaNueva,
          total_amount: nominalFactura,
          items: itemsActualizados,
        },
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', p.id);
    if (upCanalErr) {
      console.warn('[PATCH compra moneda] canal:', upCanalErr.message);
    }
  }
}

/** PATCH — Cambia moneda original (VES/USD) y recalcula montos bimonetarios. */
export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const { id } = await resolveParams(ctx.params);

    if (id.startsWith('canal-')) {
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
        'id,fecha,purchase_invoice_id,total_amount,total_amount_usd,tasa_bcv_ves_por_usd,moneda,moneda_original,monto_ves,monto_usd',
      )
      .eq('id', id)
      .maybeSingle();

    if (loadErr) {
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 });
    }

    const fila = row as CompraMonedaRow;

    if (monedaOriginalCompra(fila) === monedaNueva) {
      return NextResponse.json({ ok: true, compra: row });
    }

    const { nominalFactura, ...payloadMoneda } = await recalcularMontosCompraCambioMoneda(
      fila,
      monedaNueva,
    );

    const { data: updated, error: upErr } = await admin.client
      .from('contabilidad_compras')
      .update(payloadMoneda as never)
      .eq('id', id)
      .select(
        'id,fecha,purchase_invoice_id,total_amount,total_amount_usd,tasa_bcv_ves_por_usd,moneda,moneda_original,monto_ves,monto_usd',
      )
      .single();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const filaActualizada = {
      ...fila,
      ...(updated as CompraMonedaRow),
    };

    let lineasActualizadas: LineaDbRow[] = [];
    try {
      lineasActualizadas = await recalcularYGuardarLineasCompra(
        admin.client,
        id,
        filaActualizada,
        monedaNueva,
      );
    } catch (lineErr) {
      const message = lineErr instanceof Error ? lineErr.message : 'No se pudieron actualizar las líneas.';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    try {
      await sincronizarMonedaEnRecepcionYCanal(
        admin.client,
        filaActualizada,
        monedaNueva,
        nominalFactura,
        lineasActualizadas,
      );
    } catch (syncErr) {
      console.warn('[PATCH compra moneda] sync:', syncErr);
    }

    return NextResponse.json({ ok: true, compra: updated, nominalFactura });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo actualizar la moneda.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE compra en contabilidad (+ recepción). ?duplicados=1 incluye mismo nº factura. ?canalId= uuid telegram. */
export async function DELETE(req: Request, ctx: RouteCtx) {
  try {
    const { id } = await resolveParams(ctx.params);

    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(req.url);
    const incluirDuplicados = searchParams.get('duplicados') === '1';
    const canalId = searchParams.get('canalId')?.trim() || null;

    const result = await deleteCompraRegistro(admin.client, id, {
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
