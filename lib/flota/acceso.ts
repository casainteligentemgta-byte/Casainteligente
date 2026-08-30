import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { permisosEnforcementActivo, resolverActorWeb } from '@/lib/auth/permisos';
import {
  FLOTA_MIGRACION,
  TIPOS_VEHICULO,
  VEHICULO_SELECT,
  esMigracionPendiente,
  esUuid,
  normalizarPlaca,
  parseNumero,
  type FlotaVehiculo,
  type TipoVehiculo,
} from '@/lib/flota/utils';

export type RequireFlotaOk = {
  ok: true;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
};

export type RequireFlotaFail = { ok: false; response: NextResponse };

export async function requireAccesoFlota(): Promise<RequireFlotaOk | RequireFlotaFail> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Debe iniciar sesión' }, { status: 401 }),
    };
  }

  if (!permisosEnforcementActivo()) {
    return { ok: true, supabase, userId: user.id };
  }

  const actor = await resolverActorWeb(supabase, user.id, user.email);
  const { actorTienePermiso } = await import('@/lib/auth/permisos');
  if (!actorTienePermiso(actor, 'flota.gestionar') && !actorTienePermiso(actor, 'admin.config')) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'No tiene permiso para gestionar la flota', permiso_requerido: 'flota.gestionar' },
        { status: 403 },
      ),
    };
  }

  return { ok: true, supabase, userId: user.id };
}

export function respuestaMigracionPendiente(extra?: Record<string, unknown>) {
  return NextResponse.json({
    ok: true,
    migracionPendiente: true,
    hint: `Aplique la migración ${FLOTA_MIGRACION} en Supabase SQL Editor y ejecute notify pgrst, 'reload schema';`,
    ...extra,
  });
}

export async function listarVehiculos(
  supabase: SupabaseClient,
  opts?: { activo?: boolean },
): Promise<{ items: FlotaVehiculo[]; migracionPendiente: boolean }> {
  let q = supabase.from('ci_flota_vehiculos').select(VEHICULO_SELECT).order('placa');
  if (opts?.activo != null) q = q.eq('activo', opts.activo);

  const { data, error } = await q;
  if (esMigracionPendiente(error)) return { items: [], migracionPendiente: true };
  if (error) throw new Error(error.message);
  return { items: (data ?? []) as FlotaVehiculo[], migracionPendiente: false };
}

export async function crearVehiculo(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
): Promise<FlotaVehiculo> {
  const placa = normalizarPlaca(String(body.placa ?? ''));
  if (placa.length < 4) throw new Error('Placa inválida (mínimo 4 caracteres)');

  const tipoRaw = String(body.tipo ?? 'camioneta');
  const tipo = (TIPOS_VEHICULO as readonly string[]).includes(tipoRaw)
    ? (tipoRaw as TipoVehiculo)
    : 'camioneta';

  const row = {
    placa,
    marca: String(body.marca ?? '').trim() || null,
    modelo: String(body.modelo ?? '').trim() || null,
    anio: parseNumero(body.anio),
    tipo,
    color: String(body.color ?? '').trim() || null,
    odometro_km: parseNumero(body.odometro_km) ?? 0,
    capacidad_tanque_litros: parseNumero(body.capacidad_tanque_litros),
    entidad_id: esUuid(String(body.entidad_id ?? '')) ? String(body.entidad_id) : null,
    proyecto_id: esUuid(String(body.proyecto_id ?? '')) ? String(body.proyecto_id) : null,
    activo: body.activo !== false,
    notas: String(body.notas ?? '').trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('ci_flota_vehiculos')
    .insert(row)
    .select(VEHICULO_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as FlotaVehiculo;
}

export async function actualizarVehiculo(
  supabase: SupabaseClient,
  id: string,
  body: Record<string, unknown>,
): Promise<FlotaVehiculo> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.placa !== undefined) {
    const placa = normalizarPlaca(String(body.placa));
    if (placa.length < 4) throw new Error('Placa inválida');
    patch.placa = placa;
  }
  if (body.marca !== undefined) patch.marca = String(body.marca).trim() || null;
  if (body.modelo !== undefined) patch.modelo = String(body.modelo).trim() || null;
  if (body.anio !== undefined) patch.anio = parseNumero(body.anio);
  if (body.tipo !== undefined) {
    const tipoRaw = String(body.tipo);
    if ((TIPOS_VEHICULO as readonly string[]).includes(tipoRaw)) patch.tipo = tipoRaw;
  }
  if (body.color !== undefined) patch.color = String(body.color).trim() || null;
  if (body.odometro_km !== undefined) patch.odometro_km = parseNumero(body.odometro_km) ?? 0;
  if (body.capacidad_tanque_litros !== undefined) {
    patch.capacidad_tanque_litros = parseNumero(body.capacidad_tanque_litros);
  }
  if (body.entidad_id !== undefined) {
    patch.entidad_id = esUuid(String(body.entidad_id ?? '')) ? String(body.entidad_id) : null;
  }
  if (body.proyecto_id !== undefined) {
    patch.proyecto_id = esUuid(String(body.proyecto_id ?? '')) ? String(body.proyecto_id) : null;
  }
  if (body.activo !== undefined) patch.activo = Boolean(body.activo);
  if (body.notas !== undefined) patch.notas = String(body.notas).trim() || null;

  const { data, error } = await supabase
    .from('ci_flota_vehiculos')
    .update(patch)
    .eq('id', id)
    .select(VEHICULO_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data as FlotaVehiculo;
}

export async function eliminarVehiculo(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('ci_flota_vehiculos').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function subirArchivoFlota(
  supabase: SupabaseClient,
  params: { path: string; buffer: Buffer; contentType: string },
): Promise<string> {
  const { error } = await supabase.storage.from('flota').upload(params.path, params.buffer, {
    contentType: params.contentType,
    upsert: true,
  });
  if (error) throw new Error(`No se pudo guardar el archivo: ${error.message}`);
  const { data } = supabase.storage.from('flota').getPublicUrl(params.path);
  return data.publicUrl;
}
