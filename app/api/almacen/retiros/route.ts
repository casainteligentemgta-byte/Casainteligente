import { NextResponse } from 'next/server';
import { listarRetirosCompra } from '@/lib/compras/listarRetirosCompra';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/almacen/retiros
 * Retiros de mercancía comprada (quién la busca, foto al retirar, entrega en almacén).
 * Solo lectura. Pide sesión: los datos se leen con service_role.
 *
 * Query: activos=1 (deja fuera entregados y cancelados)
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
    const lista = await listarRetirosCompra(supabase, {
      soloActivos: url.searchParams.get('activos') === '1',
    });
    return NextResponse.json(lista);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al cargar los retiros';
    console.error('[GET /api/almacen/retiros]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
