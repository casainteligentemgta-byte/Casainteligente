import { NextRequest, NextResponse } from 'next/server';
import { crearConductor, listarConductores, obtenerConductores } from '@/lib/flota/conductores';
import {
  crearVehiculo,
  listarVehiculos,
  requireAccesoFlota,
  respuestaMigracionPendiente,
} from '@/lib/flota/acceso';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const entidad_id = searchParams.get('entidad_id');
    const q = searchParams.get('q')?.trim() || undefined;
    const activoRaw = searchParams.get('activo');
    const activo = activoRaw == null ? undefined : activoRaw !== '0' && activoRaw !== 'false';

    if (entidad_id) {
      const data = await obtenerConductores(entidad_id);
      return NextResponse.json(data);
    }

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
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.recurso === 'vehiculo') {
      const vehiculo = await crearVehiculo(auth.supabase, body);
      return NextResponse.json({ ok: true, vehiculo }, { status: 201 });
    }
    const data = await crearConductor(body);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const status = /requerido|inválid|JSON/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
