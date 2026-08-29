import { NextResponse } from 'next/server';
import { crearMantenimiento, listarMantenimientos } from '@/lib/flota/mantenimiento';
import { listarVehiculos, requireAccesoFlota, respuestaMigracionPendiente } from '@/lib/flota/acceso';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const vehiculoId = url.searchParams.get('vehiculo_id')?.trim() || undefined;
  const tipo = url.searchParams.get('tipo')?.trim() || undefined;

  try {
    const [mant, vehiculos] = await Promise.all([
      listarMantenimientos(auth.supabase, { vehiculoId, tipo }),
      listarVehiculos(auth.supabase, { activo: true }),
    ]);
    if (mant.migracionPendiente) {
      return respuestaMigracionPendiente({ registros: [], vehiculos: [] });
    }
    return NextResponse.json({
      ok: true,
      registros: mant.items,
      vehiculos: vehiculos.items,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al listar mantenimiento' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  try {
    const registro = await crearMantenimiento(auth.supabase, body);
    return NextResponse.json({ ok: true, registro });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al registrar mantenimiento';
    return NextResponse.json({ error: msg }, { status: /requerido|inválid/i.test(msg) ? 400 : 500 });
  }
}
