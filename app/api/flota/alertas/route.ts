import { NextResponse } from 'next/server';
import {
  evaluarAlertas,
  listarAlertas,
  listarConfigAlertas,
  persistirAlertasGeneradas,
  upsertConfigAlerta,
} from '@/lib/flota/alertas';
import { listarConductores, listarDocumentosConductor } from '@/lib/flota/conductores';
import { analizarConsumo, listarGasolina } from '@/lib/flota/gasolina';
import { listarMantenimientos } from '@/lib/flota/mantenimiento';
import { listarVehiculos, requireAccesoFlota, respuestaMigracionPendiente } from '@/lib/flota/acceso';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const todas = url.searchParams.get('todas') === '1';

  try {
    const [alertas, config] = await Promise.all([
      listarAlertas(auth.supabase, { soloAbiertas: !todas }),
      listarConfigAlertas(auth.supabase),
    ]);
    if (alertas.migracionPendiente || config.migracionPendiente) {
      return respuestaMigracionPendiente({ alertas: [], config: [] });
    }
    return NextResponse.json({ ok: true, alertas: alertas.items, config: config.items });
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
    if (body.accion === 'generar') {
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
        creadas,
      });
    }

    const config = await upsertConfigAlerta(auth.supabase, body);
    return NextResponse.json({ ok: true, config });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al guardar alerta';
    return NextResponse.json({ error: msg }, { status: /inválid/i.test(msg) ? 400 : 500 });
  }
}
