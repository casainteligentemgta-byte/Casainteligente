import { NextRequest, NextResponse } from 'next/server';
import {
  analizarConsumo,
  listarGasolina,
  obtenerGasolinaPorMaquinaria,
  registrarGasolina,
} from '@/lib/flota/gasolina';
import { listarConductores } from '@/lib/flota/conductores';
import { listarVehiculos, requireAccesoFlota, respuestaMigracionPendiente } from '@/lib/flota/acceso';
import { parseFechaIso } from '@/lib/flota/utils';

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
      listarVehiculos(auth.supabase, { activo: true }),
      listarConductores(auth.supabase, { activo: true }),
    ]);
    if (gasolina.migracionPendiente) {
      return respuestaMigracionPendiente({ registros: [], analisis: null, vehiculos: [], conductores: [] });
    }
    return NextResponse.json({
      ok: true,
      registros: gasolina.items,
      analisis: analizarConsumo(gasolina.items),
      vehiculos: vehiculos.items,
      conductores: conductores.items,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
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
    const msg = error instanceof Error ? error.message : String(error);
    const status = /requerido|inválid|mayor|JSON/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
