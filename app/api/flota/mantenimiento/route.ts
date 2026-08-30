import { NextResponse } from 'next/server';
import {
  crearMantenimiento,
  listarMantenimientos,
  obtenerMantenimientoPorMaquinaria,
  registrarMantenimiento,
} from '@/lib/flota/mantenimiento';
import { listarVehiculos, requireAccesoFlota, respuestaMigracionPendiente } from '@/lib/flota/acceso';
import { esUuid, parseFechaIso, parseNumero } from '@/lib/flota/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const maquinariaId = url.searchParams.get('maquinaria_id')?.trim() || undefined;
  const vehiculoId = url.searchParams.get('vehiculo_id')?.trim() || undefined;
  const tipo = url.searchParams.get('tipo')?.trim() || undefined;

  try {
    if (maquinariaId && esUuid(maquinariaId) && !tipo) {
      const [registros, vehiculos] = await Promise.all([
        obtenerMantenimientoPorMaquinaria(maquinariaId),
        listarVehiculos(auth.supabase, { activo: true }),
      ]);
      return NextResponse.json({
        ok: true,
        registros,
        vehiculos: vehiculos.items,
      });
    }

    const [mant, vehiculos] = await Promise.all([
      listarMantenimientos(auth.supabase, { vehiculoId: vehiculoId ?? maquinariaId, tipo }),
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
    const maquinariaId = String(body.maquinaria_id ?? '').trim();
    if (maquinariaId) {
      const registro = await registrarMantenimiento({
        maquinaria_id: maquinariaId,
        tipo_mantenimiento: String(body.tipo_mantenimiento ?? body.tipo ?? ''),
        descripcion: body.descripcion != null ? String(body.descripcion) : undefined,
        km_actual: parseNumero(body.km_actual ?? body.odometro_km) ?? undefined,
        taller_nombre:
          body.taller_nombre != null || body.taller != null
            ? String(body.taller_nombre ?? body.taller)
            : undefined,
        costo: parseNumero(body.costo ?? body.costo_usd) ?? undefined,
        fecha_mantenimiento:
          parseFechaIso(body.fecha_mantenimiento ?? body.fecha) ?? String(body.fecha_mantenimiento ?? ''),
        proyecto_id: body.proyecto_id != null ? String(body.proyecto_id) : undefined,
      });
      return NextResponse.json({ ok: true, registro });
    }

    const registro = await crearMantenimiento(auth.supabase, body);
    return NextResponse.json({ ok: true, registro });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al registrar mantenimiento';
    return NextResponse.json({ error: msg }, { status: /requerido|inválid/i.test(msg) ? 400 : 500 });
  }
}
