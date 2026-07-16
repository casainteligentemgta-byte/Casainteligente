import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import {
  CcoRubrosPdfDocument,
  type CcoRubroPdfProveedor,
} from '@/lib/contabilidad/cco/CcoRubrosPdf';
import { cargarJerarquiaContratos } from '@/lib/contabilidad/cco/contratosJerarquia';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET ?proyecto= — PDF rubros acordado vs pagado por subcontratista. */
export async function GET(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const proyectoId = new URL(req.url).searchParams.get('proyecto')?.trim();
    if (!proyectoId) {
      return NextResponse.json({ ok: false, error: 'Falta ?proyecto=' }, { status: 400 });
    }

    const { data: proy } = await admin.client
      .from('ci_proyectos')
      .select('nombre')
      .eq('id', proyectoId)
      .maybeSingle();
    const obra = String((proy as { nombre?: string } | null)?.nombre ?? 'Obra').trim() || 'Obra';

    const jer = await cargarJerarquiaContratos(admin.client, proyectoId);
    const proveedores: CcoRubroPdfProveedor[] = jer.porProveedor.map((p) => ({
      proveedor: p.proveedor,
      totalCosto: p.total_contratado,
      totalPagado: p.total_pagado,
      totalSaldo: p.total_saldo,
      lineas: p.contratos.map((c) => ({
        descripcion: c.descripcion,
        costoTotal: c.costo_total_usd,
        pagado: c.monto_pagado_usd,
        saldo: c.saldo_usd,
        pct: c.pct_avance,
      })),
    }));

    const node = createElement(CcoRubrosPdfDocument, {
      obra,
      generadoAt: new Date().toLocaleString('es-VE'),
      proveedores,
    });

    const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
    const buf = Buffer.from(await blob.arrayBuffer());
    const safeName = obra.replace(/[^\w\-]+/g, '_').slice(0, 40);

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="CCO_rubros_${safeName}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al exportar PDF rubros.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
