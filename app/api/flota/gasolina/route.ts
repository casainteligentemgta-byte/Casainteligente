import { NextRequest, NextResponse } from 'next/server';
import {
  analizarConsumo,
  listarGasolina,
  obtenerGasolinaPorMaquinaria,
  registrarGasolina,
} from '@/lib/flota/gasolina';
import { listarConductores } from '@/lib/flota/conductores';
import { listarVehiculos, requireAccesoFlota, respuestaMigracionPendiente } from '@/lib/flota/acceso';
import { jsonErrorFlota } from '@/lib/flota/error';
import { entidadIdDesdeSearch, filtrarPorUnidadesEntidad, parseFechaIso } from '@/lib/flota/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const maquinaria_id = searchParams.get('maquinaria_id');
    const vehiculoId = searchParams.get('vehiculo_id')?.trim() || undefined;
    const conductorId = searchParams.get('conductor_id')?.trim() || undefined;
    const desde = parseFechaIso(searchParams.get('desde'));
    const hasta = parseFechaIso(searchParams.get('hasta'));

    const entidadId = entidadIdDesdeSearch(searchParams);

    if (maquinaria_id && !conductorId && !desde && !hasta && !vehiculoId) {
      const data = await obtenerGasolinaPorMaquinaria(maquinaria_id);
      return NextResponse.json(data);
    }

    const [gasolina, vehiculos, conductores] = await Promise.all([
      listarGasolina(auth.supabase, {
        vehiculoId: vehiculoId ?? maquinaria_id ?? undefined,
        conductorId,
        desde: desde ?? undefined,
        hasta: hasta ?? undefined,
      }),
      listarVehiculos(auth.supabase, { activo: true, entidadId }),
      listarConductores(auth.supabase, { activo: true, entidadId }),
    ]);
    if (gasolina.migracionPendiente) {
      return respuestaMigracionPendiente({ registros: [], analisis: null, vehiculos: [], conductores: [] });
    }
    const ids = new Set(vehiculos.items.map((v) => v.id));
    const registros = filtrarPorUnidadesEntidad(gasolina.items, ids, entidadId);
    return NextResponse.json({
      ok: true,
      registros,
      analisis: analizarConsumo(registros),
      vehiculos: vehiculos.items,
      conductores: conductores.items,
    });
  } catch (error) {
    return jsonErrorFlota(error, 'No se pudieron cargar las cargas de gasolina');
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const data = await registrarGasolina(body);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return jsonErrorFlota(error, 'No se pudo registrar la carga de gasolina');
  }
}
