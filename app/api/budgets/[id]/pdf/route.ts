import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildPresupuestoPrintHtml } from '@/lib/presupuesto/html-impresion';

/**
 * GET /api/budgets/[id]/pdf
 * HTML imprimible A4 (fondo claro). Diseño alineado con docs/PRESUPUESTO-DISENO.md y lib/presupuesto/brand.ts
 */
export async function GET(
  _request: NextRequest,
  context: { params: { id: string } },
) {
  const { id } = context.params;
  if (!id) {
    return NextResponse.json({ error: 'Falta id' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: budget, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !budget) {
    return NextResponse.json(
      { error: error?.message ?? 'Presupuesto no encontrado' },
      { status: 404 },
    );
  }
  // Si la columna `numero_correlativo` no existe aún, calculamos un correlativo temporal.
  // Importante: NO listamos todos los presupuestos (puede causar timeout en Vercel).
  let numero_correlativo_override: number | null = null;
  try {
    const raw = (budget as any).numero_correlativo as unknown;
    const correlativoNum =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
          ? Number(raw)
          : null;
    const correlativoMissing = correlativoNum == null || Number.isNaN(correlativoNum);

    if (correlativoMissing) {
      const createdAt = (budget as any).created_at as string | null | undefined;
      if (createdAt) {
        const { count: beforeCount } = await supabase
          .from('budgets')
          .select('id', { count: 'exact', head: true })
          .lt('created_at', createdAt);

        const { count: sameEarlierCount } = await supabase
          .from('budgets')
          .select('id', { count: 'exact', head: true })
          .eq('created_at', createdAt)
          .lt('id', id);

        const a = typeof beforeCount === 'number' ? beforeCount : 0;
        const b = typeof sameEarlierCount === 'number' ? sameEarlierCount : 0;
        numero_correlativo_override = 500 + a + b;
      }
    }
  } catch {
    /* ignorar */
  }

  const html = buildPresupuestoPrintHtml({
    ...budget,
    id,
    ...(numero_correlativo_override != null ? { numero_correlativo: numero_correlativo_override } : {}),
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="presupuesto-${id.slice(0, 8)}.html"`,
    },
  });
}
