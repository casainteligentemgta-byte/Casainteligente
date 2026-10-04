import { NextResponse } from 'next/server';
import {
  crearConfiguracionAlerta,
  evaluarAlertas,
  generarAlerta,
  listarAlertas,
  listarConfigAlertas,
  obtenerAlertasPendientes,
  persistirAlertasGeneradas,
  upsertConfigAlerta,
  verificarYGenerarAlertas,
} from '@/lib/flota/alertas';
import { listarConductores, listarDocumentosConductor } from '@/lib/flota/conductores';
import { analizarConsumo, listarGasolina } from '@/lib/flota/gasolina';
import { listarMantenimientos } from '@/lib/flota/mantenimiento';
import { listarVehiculos, requireAccesoFlota, respuestaMigracionPendiente } from '@/lib/flota/acceso';
import { entidadIdDesdeSearch, esUuid, filtrarPorUnidadesEntidad, parseFechaIso, parseNumero } from '@/lib/flota/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const entidadId = entidadIdDesdeSearch(url.searchParams);
  const todas = url.searchParams.get('todas') === '1';
  const pendientes =
    url.searchParams.get('pendientes') === '1' || url.searchParams.get('estado') === 'pendiente';

  try {
    if (pendientes) {
      const [alertas, config, vehiculos] = await Promise.all([
        obtenerAlertasPendientes(),
        listarConfigAlertas(auth.supabase),
        listarVehiculos(auth.supabase, { entidadId }),
      ]);
      const ids = new Set(vehiculos.items.map((v) => v.id));
      return NextResponse.json({
        ok: true,
        alertas: filtrarPorUnidadesEntidad(alertas, ids, entidadId),
        config: config.items,
      });
    }

    const [alertas, config, vehiculos] = await Promise.all([
      listarAlertas(auth.supabase, { soloAbiertas: !todas }),
      listarConfigAlertas(auth.supabase),
      listarVehiculos(auth.supabase, { entidadId }),
    ]);
    if (alertas.migracionPendiente || config.migracionPendiente) {
      return respuestaMigracionPendiente({ alertas: [], config: [] });
    }
    const ids = new Set(vehiculos.items.map((v) => v.id));
    return NextResponse.json({
      ok: true,
      alertas: filtrarPorUnidadesEntidad(alertas.items, ids, entidadId),
      config: config.items,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al listar alertas' },
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
    if (body.accion === 'verificar') {
      const porMaquinaria = await verificarYGenerarAlertas();
      return NextResponse.json({
        ok: true,
        verificadas: porMaquinaria.verificadas,
        creadas: porMaquinaria.creadas,
      });
    }

    if (body.accion === 'generar') {
      const porMaquinaria = await verificarYGenerarAlertas();
      const [conductores, vehiculos, mantenimientos, gasolina, configs] = await Promise.all([
        listarConductores(auth.supabase, { activo: true }),
        listarVehiculos(auth.supabase, { activo: true }),
        listarMantenimientos(auth.supabase),
        listarGasolina(auth.supabase),
        listarConfigAlertas(auth.supabase),
      ]);
      if (conductores.migracionPendiente) return respuestaMigracionPendiente({ creadas: [] });

      const documentos = (
        await Promise.all(
          conductores.items.map((c) => listarDocumentosConductor(auth.supabase, c.id)),
        )
      ).flatMap((d) => d.items);

      const borradores = evaluarAlertas({
        conductores: conductores.items,
        documentos,
        vehiculos: vehiculos.items,
        mantenimientos: mantenimientos.items,
        consumos: analizarConsumo(gasolina.items).por_vehiculo,
        configs: configs.items,
      });
      const creadas = await persistirAlertasGeneradas(auth.supabase, borradores);
      return NextResponse.json({
        ok: true,
        evaluadas: borradores.length,
        verificadas: porMaquinaria.verificadas,
        creadas: [...porMaquinaria.creadas, ...creadas],
      });
    }

    if (body.accion === 'alerta' || body.config_id) {
      const alerta = await generarAlerta({
        config_id: String(body.config_id ?? ''),
        maquinaria_id: String(body.maquinaria_id ?? body.vehiculo_id ?? ''),
        tipo_alerta: String(body.tipo_alerta ?? body.tipo ?? ''),
        descripcion: body.descripcion != null ? String(body.descripcion) : undefined,
        severidad: body.severidad as 'info' | 'warning' | 'critical' | undefined,
        fecha_vencimiento: parseFechaIso(body.fecha_vencimiento ?? body.vence_el) ?? undefined,
        km_vencimiento: parseNumero(body.km_vencimiento) ?? undefined,
      });
      return NextResponse.json({ ok: true, alerta });
    }

    if (body.frecuencia_tipo || (body.maquinaria_id && body.tipo_alerta)) {
      const maquinariaId = String(body.maquinaria_id ?? '');
      if (!esUuid(maquinariaId)) {
        return NextResponse.json({ error: 'maquinaria_id requerido' }, { status: 400 });
      }
      const config = await crearConfiguracionAlerta({
        maquinaria_id: maquinariaId,
        tipo_alerta: String(body.tipo_alerta ?? body.tipo ?? ''),
        frecuencia_tipo: body.frecuencia_tipo === 'km' ? 'km' : 'dias',
        frecuencia_valor: parseNumero(body.frecuencia_valor) ?? 0,
        proxima_alerta_km: parseNumero(body.proxima_alerta_km) ?? undefined,
        proxima_alerta_fecha: parseFechaIso(body.proxima_alerta_fecha) ?? undefined,
      });
      return NextResponse.json({ ok: true, config });
    }

    const config = await upsertConfigAlerta(auth.supabase, body);
    return NextResponse.json({ ok: true, config });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al guardar alerta';
    return NextResponse.json({ error: msg }, { status: /inválid|requerido/i.test(msg) ? 400 : 500 });
  }
}
