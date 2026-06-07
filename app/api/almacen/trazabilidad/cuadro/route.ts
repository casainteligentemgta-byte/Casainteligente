import { NextResponse } from 'next/server';
import { listarTrazabilidadEstrategica } from '@/lib/almacen/listarTrazabilidadEstrategica';
import { supabaseAdminMovimientos } from '@/lib/almacen/supabaseAdminMovimientos';
import type { TipoMovimientoTrazabilidadFiltro } from '@/lib/almacen/trazabilidadCuadroShare';
import { trazabilidadFilasACsv } from '@/lib/almacen/trazabilidadExport';

export const dynamic = 'force-dynamic';

const TIPOS_VALIDOS = new Set<TipoMovimientoTrazabilidadFiltro>([
  '',
  'entrada_manual',
  'entrada_ocr',
  'nota_entrega',
  'transferencia',
  'despacho_obra',
  'prestamo',
  'perdida_deterioro',
  'ajuste',
  'anulacion',
]);

function parseTipo(raw: string | null): TipoMovimientoTrazabilidadFiltro {
  const v = (raw ?? '').trim() as TipoMovimientoTrazabilidadFiltro;
  return TIPOS_VALIDOS.has(v) ? v : '';
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const admin = supabaseAdminMovimientos();
    if (!admin.ok) return admin.response;

    const exportFormat = url.searchParams.get('export')?.trim().toLowerCase();
    const exportar = exportFormat === 'csv' || exportFormat === 'xls' || exportFormat === 'excel';

    const result = await listarTrazabilidadEstrategica(admin.client, {
      material: url.searchParams.get('material') ?? undefined,
      proyectoId: url.searchParams.get('proyecto') ?? undefined,
      tipoMovimiento: parseTipo(url.searchParams.get('tipo')),
      fechaDesde: url.searchParams.get('desde') ?? undefined,
      fechaHasta: url.searchParams.get('hasta') ?? undefined,
      pagina: Number(url.searchParams.get('page') ?? 1),
      pageSize: Number(url.searchParams.get('pageSize') ?? 50),
      exportar,
    });

    if (exportFormat === 'csv') {
      const csv = trazabilidadFilasACsv(result.filas);
      const stamp = new Date().toISOString().slice(0, 10);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="trazabilidad-${stamp}.csv"`,
        },
      });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al listar trazabilidad';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
