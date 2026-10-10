import { NextResponse } from 'next/server';
import { listarPedidosMaterial } from '@/lib/almacen/listarPedidosMaterial';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/almacen/pedidos
 * Pedidos de material al almacén (quién pide, para qué, quién despacha y con qué foto).
 * Solo lectura. Pide sesión: los datos se leen con service_role.
 *
 * Query: activos=1 (deja fuera despachados, rechazados y cancelados)
 */
export async function GET(req: Request) {
  try {
    const sesion = await createClient();
    const {
      data: { user },
    } = await sesion.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Inicia sesión para continuar.', code: 'SIN_SESION' },
        { status: 401 },
      );
    }

    const url = new URL(req.url);
    const supabase = createSupabaseAdminOnlyClient() ?? sesion;
    const lista = await listarPedidosMaterial(supabase, {
      soloActivos: url.searchParams.get('activos') === '1',
    });
    return NextResponse.json(lista);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al cargar los pedidos';
    console.error('[GET /api/almacen/pedidos]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
