import { NextResponse } from 'next/server';
import {
  crearConductor,
  listarConductores,
  obtenerConductores,
} from '@/lib/flota/conductores';
import {
  crearVehiculo,
  listarVehiculos,
  requireAccesoFlota,
  respuestaMigracionPendiente,
} from '@/lib/flota/acceso';
import { esUuid, unirNombreCompleto } from '@/lib/flota/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAccesoFlota();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() || undefined;
  const entidadId = url.searchParams.get('entidad_id')?.trim() || undefined;
  const activoRaw = url.searchParams.get('activo');
  const activo = activoRaw == null ? undefined : activoRaw !== '0' && activoRaw !== 'false';

  try {
    if (entidadId && esUuid(entidadId) && !q && activo == null) {
      const items = await obtenerConductores(entidadId);
      const vehiculos = await listarVehiculos(auth.supabase);
      return NextResponse.json({
        ok: true,
        conductores: items,
        vehiculos: vehiculos.items,
      });
    }

    const [conductores, vehiculos] = await Promise.all([
      listarConductores(auth.supabase, { q, activo, entidadId }),
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
    const nombreCompleto =
      String(body.nombre_completo ?? '').trim() ||
      unirNombreCompleto(String(body.nombres ?? ''), String(body.apellidos ?? ''));
    const conductor = await crearConductor({
      entidad_id: String(body.entidad_id ?? ''),
      nombre_completo: nombreCompleto,
      cedula: String(body.cedula ?? body.numero_cedula ?? ''),
      numero_cedula: body.numero_cedula != null ? String(body.numero_cedula) : undefined,
      fecha_vencimiento_licencia:
        (body.fecha_vencimiento_licencia as string | undefined) ??
        (body.licencia_vence as string | undefined),
      fecha_vencimiento_salud:
        (body.fecha_vencimiento_salud as string | undefined) ??
        (body.certificado_medico_vence as string | undefined),
      empleado_id: body.empleado_id != null ? String(body.empleado_id) : undefined,
      telefono: body.telefono != null ? String(body.telefono) : undefined,
      email: body.email != null ? String(body.email) : undefined,
      tipo_licencia: body.tipo_licencia != null ? String(body.tipo_licencia) : undefined,
      vehiculo_asignado_id:
        body.vehiculo_asignado_id != null ? String(body.vehiculo_asignado_id) : undefined,
      proyecto_id: body.proyecto_id != null ? String(body.proyecto_id) : undefined,
      notas: body.notas != null ? String(body.notas) : undefined,
      activo: body.activo !== false,
    });
    return NextResponse.json({ ok: true, conductor });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al guardar';
    const status = /requerido|inválid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
