import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
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

  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

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

  const html = buildPresupuestoPrintHtml({ ...budget, id });

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="presupuesto-${id.slice(0, 8)}.html"`,
    },
  });
}
