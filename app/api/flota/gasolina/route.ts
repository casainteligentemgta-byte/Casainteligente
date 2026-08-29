import { NextResponse } from 'next/server';
import { analizarConsumo, crearGasolina, listarGasolina } from '@/lib/flota/gasolina';
import { listarConductores } from '@/lib/flota/conductores';
import { listarVehiculos, requireAccesoFlota, respuestaMigracionPendiente } from '@/lib/flota/acceso';
import { parseFechaIso } from '@/lib/flota/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const vehiculoId = url.searchParams.get('vehiculo_id')?.trim() || undefined;
  const conductorId = url.searchParams.get('conductor_id')?.trim() || undefined;
  const desde = parseFechaIso(url.searchParams.get('desde'));
  const hasta = parseFechaIso(url.searchParams.get('hasta'));

  try {
    const [gasolina, vehiculos, conductores] = await Promise.all([
      listarGasolina(auth.supabase, { vehiculoId, conductorId, desde: desde ?? undefined, hasta: hasta ?? undefined }),
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
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al listar gasolina' },
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
    const registro = await crearGasolina(auth.supabase, body);
    return NextResponse.json({ ok: true, registro });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al registrar gasolina';
    const status = /requerido|inválid|mayor/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
