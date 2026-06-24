import { NextResponse } from 'next/server';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { orFiltroBusquedaCompras, patronIlike } from '@/lib/contabilidad/comprasQueryFiltros';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

const SELECT_COMPRA = `
  id,
  invoice_number,
  supplier_name,
  supplier_rif,
  fecha,
  total_amount,
  moneda,
  purchase_invoice_id,
  procura_id,
  proyecto_id,
  ci_proyectos(nombre)
`;

/** GET — Facturas de contabilidad disponibles para vincular a una procura. */
export async function GET(req: Request) {
  const auth = await requirePermisoWeb('procura.ejecutar_compra');
  if (!auth.ok) {
    const read = await requirePermisoWeb('procura.aprobar');
    if (!read.ok) return auth.response;
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const proyectoId = searchParams.get('proyecto_id')?.trim() || null;
  const soloObra = searchParams.get('solo_obra') !== '0';
  const limit = Math.min(Number(searchParams.get('limit') ?? 25) || 25, 40);

  let query = admin.client
    .from('contabilidad_compras')
    .select(SELECT_COMPRA)
    .not('purchase_invoice_id', 'is', null)
    .is('procura_id', null)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (soloObra && proyectoId) {
    query = query.eq('proyecto_id', proyectoId);
  }

  if (q.length >= 2) {
    const or = orFiltroBusquedaCompras(q, []);
    if (or) query = query.or(or);
  } else if (q.length === 1) {
    const pattern = patronIlike(q);
    if (pattern) query = query.or(`invoice_number.ilike.${pattern},supplier_name.ilike.${pattern}`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    facturas: ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const proy = row.ci_proyectos as { nombre?: string } | { nombre?: string }[] | null;
      const obra = Array.isArray(proy) ? proy[0]?.nombre : proy?.nombre;
      return {
        id: String(row.id),
        invoice_number: (row.invoice_number as string | null) ?? null,
        supplier_name: (row.supplier_name as string | null) ?? null,
        supplier_rif: (row.supplier_rif as string | null) ?? null,
        fecha: (row.fecha as string | null) ?? null,
        total_amount: row.total_amount != null ? Number(row.total_amount) : null,
        moneda: (row.moneda as string | null) ?? null,
        purchase_invoice_id: (row.purchase_invoice_id as string | null) ?? null,
        proyecto_id: (row.proyecto_id as string | null) ?? null,
        obra: typeof obra === 'string' ? obra.trim() || null : null,
      };
    }),
  });
}
