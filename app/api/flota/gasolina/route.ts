import { NextResponse } from 'next/server';
import {
  analizarConsumo,
  calcularConsumoPromedio,
  crearGasolina,
  listarGasolina,
  obtenerGasolinaPorMaquinaria,
  registrarGasolina,
} from '@/lib/flota/gasolina';
import { listarConductores } from '@/lib/flota/conductores';
import { listarVehiculos, requireAccesoFlota, respuestaMigracionPendiente } from '@/lib/flota/acceso';
import { esUuid, parseFechaIso, parseNumero } from '@/lib/flota/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const maquinariaId = url.searchParams.get('maquinaria_id')?.trim() || undefined;
  const vehiculoId = url.searchParams.get('vehiculo_id')?.trim() || undefined;
  const conductorId = url.searchParams.get('conductor_id')?.trim() || undefined;
  const desde = parseFechaIso(url.searchParams.get('desde'));
  const hasta = parseFechaIso(url.searchParams.get('hasta'));

  try {
    if (maquinariaId && esUuid(maquinariaId) && !conductorId && !desde && !hasta) {
      const [registros, consumo, vehiculos, conductores] = await Promise.all([
        obtenerGasolinaPorMaquinaria(maquinariaId),
        calcularConsumoPromedio(maquinariaId),
        listarVehiculos(auth.supabase, { activo: true }),
        listarConductores(auth.supabase, { activo: true }),
      ]);
      return NextResponse.json({
        ok: true,
        registros,
        consumo,
        analisis: analizarConsumo(registros),
        vehiculos: vehiculos.items,
        conductores: conductores.items,
      });
    }

    const [gasolina, vehiculos, conductores] = await Promise.all([
      listarGasolina(auth.supabase, {
        vehiculoId: vehiculoId ?? maquinariaId,
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
    const maquinariaId = String(body.maquinaria_id ?? '').trim();
    if (maquinariaId) {
      const litros = parseNumero(body.cantidad_litros ?? body.litros);
      const precio = parseNumero(body.precio_litro_usd);
      const costo =
        parseNumero(body.costo_total ?? body.monto_usd) ??
        (precio != null && litros != null ? Math.round(precio * litros * 100) / 100 : 0);
      const registro = await registrarGasolina({
        maquinaria_id: maquinariaId,
        cantidad_litros: litros ?? 0,
        costo_total: costo,
        km_actual: parseNumero(body.km_actual ?? body.odometro_km) ?? undefined,
        tipo_gasolina: body.tipo_gasolina != null ? String(body.tipo_gasolina) : undefined,
        estacion_gasolina:
          body.estacion_gasolina != null || body.estacion != null
            ? String(body.estacion_gasolina ?? body.estacion)
            : undefined,
        conductor_id: body.conductor_id != null ? String(body.conductor_id) : undefined,
        proyecto_id: body.proyecto_id != null ? String(body.proyecto_id) : undefined,
      });
      return NextResponse.json({ ok: true, registro });
    }

    const registro = await crearGasolina(auth.supabase, body);
    return NextResponse.json({ ok: true, registro });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al registrar gasolina';
    const status = /requerido|inválid|mayor/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
