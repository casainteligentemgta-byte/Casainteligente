import { NextResponse } from 'next/server';
import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import {
  actorWebPuedePagarCredito,
  alcanceEntidadesCreditoWeb,
  registrarPagoCredito,
  subirComprobanteCredito,
} from '@/lib/contabilidad/creditoPagosDb';
import { avisarPagoCreditoAdmin } from '@/lib/telegram/creditoTelegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type RouteCtx = { params: Promise<{ id: string }> };

async function leerBody(req: Request): Promise<{
  montoUsd: number | null;
  fechaPago: string | null;
  referencia: string | null;
  file: File | null;
}> {
  const ctype = req.headers.get('content-type') ?? '';
  if (ctype.includes('multipart/form-data')) {
    const form = await req.formData();
    const montoRaw = form.get('monto_usd');
    const montoUsd = montoRaw != null && String(montoRaw).trim() !== '' ? Number(montoRaw) : null;
    const file = form.get('comprobante');
    return {
      montoUsd: Number.isFinite(montoUsd as number) ? (montoUsd as number) : null,
      fechaPago: String(form.get('fecha_pago') ?? '').trim() || null,
      referencia: String(form.get('referencia') ?? '').trim() || null,
      file: file instanceof File && file.size > 0 ? file : null,
    };
  }
  const json = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const montoUsd = json.monto_usd != null ? Number(json.monto_usd) : null;
  return {
    montoUsd: Number.isFinite(montoUsd as number) ? (montoUsd as number) : null,
    fechaPago: json.fecha_pago != null ? String(json.fecha_pago).trim() || null : null,
    referencia: json.referencia != null ? String(json.referencia).trim() || null : null,
    file: null,
  };
}

export async function POST(req: Request, ctx: RouteCtx) {
  const acceso = await requireAlgunPermisoWeb(['compra.credito_pagar']);
  if (!acceso.ok) return acceso.response;
  if (!actorWebPuedePagarCredito(acceso.actor)) {
    return NextResponse.json({ error: 'Solo comprador, administrador o contador.' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const purchaseInvoiceId = id?.trim();
  if (!purchaseInvoiceId) {
    return NextResponse.json({ error: 'Factura requerida.' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const alcance = await alcanceEntidadesCreditoWeb(acceso.actor, admin.client);
  const body = await leerBody(req);

  let comprobante: { path: string; fileName: string; mimeType: string } | null = null;
  if (body.file) {
    const buffer = Buffer.from(await body.file.arrayBuffer());
    comprobante = await subirComprobanteCredito(admin.client, purchaseInvoiceId, {
      buffer,
      mimeType: body.file.type || 'application/octet-stream',
      fileName: body.file.name || 'comprobante',
    });
  }

  try {
    const r = await registrarPagoCredito(admin.client, alcance, {
      purchaseInvoiceId,
      montoUsd: body.montoUsd,
      fechaPago: body.fechaPago,
      referencia: body.referencia,
      nombre: acceso.actor.nombre || acceso.actor.email || 'Web',
      userId: acceso.userId,
      comprobante,
    });
    try {
      await avisarPagoCreditoAdmin(admin.client, {
        proveedor: r.credito.proveedor,
        numero: r.credito.numeroFactura,
        montoUsd: r.montoUsd,
        nombre: acceso.actor.nombre || acceso.actor.email || 'Web',
        chatOrigen: '',
      });
    } catch (e) {
      console.warn('[credito web] aviso admin', e);
    }
    return NextResponse.json({
      ok: true,
      monto_usd: r.montoUsd,
      queda_pagado: r.quedaPagado,
      saldo_usd: r.credito.saldoUsd,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'No se pudo registrar el pago.';
    const status = /no encontrado|otra entidad|supera/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
