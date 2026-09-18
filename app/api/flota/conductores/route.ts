import { NextRequest, NextResponse } from 'next/server';
import { crearConductor, listarConductores } from '@/lib/flota/conductores';
import { jsonErrorFlota } from '@/lib/flota/error';
import {
  crearVehiculo,
  listarVehiculos,
  requireAccesoFlota,
  respuestaMigracionPendiente,
} from '@/lib/flota/acceso';
import { entidadIdDesdeSearch } from '@/lib/flota/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAccesoFlota();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const entidadId = entidadIdDesdeSearch(searchParams);
    const q = searchParams.get('q')?.trim() || undefined;
    const activoRaw = searchParams.get('activo');
    const activo = activoRaw == null ? undefined : activoRaw !== '0' && activoRaw !== 'false';

    const [conductores, vehiculos] = await Promise.all([
      listarConductores(auth.supabase, { q, activo, entidadId }),
      listarVehiculos(auth.supabase, { entidadId }),
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
    return jsonErrorFlota(error, 'No se pudieron cargar los conductores');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAccesoFlota();
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as Record<string, unknown>;
    if (body.recurso === 'vehiculo') {
      const vehiculo = await crearVehiculo(auth.supabase, body);
      return NextResponse.json({ ok: true, vehiculo }, { status: 201 });
    }
    const data = await crearConductor(body, auth.supabase);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return jsonErrorFlota(error, 'No se pudo registrar el conductor');
  }
}
