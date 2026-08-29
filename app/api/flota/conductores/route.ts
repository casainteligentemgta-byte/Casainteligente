import { NextResponse } from 'next/server';
import {
  crearConductor,
  listarConductores,
} from '@/lib/flota/conductores';
import {
  crearVehiculo,
  listarVehiculos,
  requireAccesoFlota,
  respuestaMigracionPendiente,
} from '@/lib/flota/acceso';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() || undefined;
  const activoRaw = url.searchParams.get('activo');
  const activo = activoRaw == null ? undefined : activoRaw !== '0' && activoRaw !== 'false';

  try {
    const [conductores, vehiculos] = await Promise.all([
      listarConductores(auth.supabase, { q, activo }),
      listarVehiculos(auth.supabase),
    ]);
    if (conductores.migracionPendiente || vehiculos.migracionPendiente) {
      return respuestaMigracionPendiente({ conductores: [], vehiculos: [] });
    }
    return NextResponse.json({
      ok: true,
      conductores: conductores.items,
      vehiculos: vehiculos.items,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al listar conductores' },
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
    if (body.recurso === 'vehiculo') {
      const vehiculo = await crearVehiculo(auth.supabase, body);
      return NextResponse.json({ ok: true, vehiculo });
    }
    const conductor = await crearConductor(auth.supabase, body);
    return NextResponse.json({ ok: true, conductor });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al guardar';
    const status = /requerido|inválid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
