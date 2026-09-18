import type { SupabaseClient } from '@supabase/supabase-js';
import {
  VEHICULO_SELECT,
  VEHICULO_SELECT_LEGACY,
  columnasEquipoFlotaFaltan,
  esUuid,
  inferirTipoVehiculo,
  normalizarPlaca,
  placaDesdeEquipo,
  type FlotaVehiculo,
} from '@/lib/flota/utils';

type EquipoCatalogo = {
  id: string;
  entidad_id: string | null;
  nombre_equipo: string;
  marca: string | null;
  modelo: string | null;
  serial: string | null;
};

function asVehiculos(data: unknown): FlotaVehiculo[] {
  return Array.isArray(data) ? (data as FlotaVehiculo[]) : [];
}

async function listarVehiculosInterno(supabase: SupabaseClient): Promise<FlotaVehiculo[]> {
  const first = await supabase.from('ci_flota_vehiculos').select(VEHICULO_SELECT);
  if (!first.error) return asVehiculos(first.data);
  if (columnasEquipoFlotaFaltan(first.error)) {
    const legacy = await supabase.from('ci_flota_vehiculos').select(VEHICULO_SELECT_LEGACY);
    if (!legacy.error) return asVehiculos(legacy.data);
  }
  return [];
}

/**
 * Crea o vincula unidades de `ci_flota_vehiculos` a partir del catálogo
 * de maquinaria propia (`ci_proyecto_equipos`).
 */
export async function sincronizarMaquinariaEnFlota(
  supabase: SupabaseClient,
  entidadId?: string,
): Promise<{ creados: number; vinculados: number }> {
  let q = supabase
    .from('ci_proyecto_equipos')
    .select('id,entidad_id,nombre_equipo,marca,modelo,serial,categoria')
    .eq('categoria', 'maquinaria_propia');
  if (entidadId && esUuid(entidadId)) q = q.eq('entidad_id', entidadId);

  const equiposRes = await q;
  if (equiposRes.error || !equiposRes.data?.length) return { creados: 0, vinculados: 0 };

  const vehiculos = await listarVehiculosInterno(supabase);
  const byEquipo = new Map(
    vehiculos.filter((v) => v.equipo_id).map((v) => [String(v.equipo_id), v]),
  );
  const byPlaca = new Map(vehiculos.map((v) => [normalizarPlaca(v.placa), v]));

  let creados = 0;
  let vinculados = 0;
  const now = new Date().toISOString();

  for (const raw of equiposRes.data as EquipoCatalogo[]) {
    if (byEquipo.has(raw.id)) continue;
    const placa = placaDesdeEquipo(raw);
    const existing = byPlaca.get(placa);
    const nombre = raw.nombre_equipo?.trim() || null;
    const tipo = inferirTipoVehiculo(raw.nombre_equipo, raw.marca, raw.modelo);

    if (existing) {
      const patch: Record<string, unknown> = {
        entidad_id: existing.entidad_id ?? raw.entidad_id,
        updated_at: now,
        equipo_id: raw.id,
        nombre,
      };
      if (!existing.marca && raw.marca) patch.marca = raw.marca;
      if (!existing.modelo && raw.modelo) patch.modelo = raw.modelo;
      const up = await supabase.from('ci_flota_vehiculos').update(patch).eq('id', existing.id);
      if (up.error && columnasEquipoFlotaFaltan(up.error)) {
        const { equipo_id: _e, nombre: _n, ...rest } = patch;
        await supabase.from('ci_flota_vehiculos').update(rest).eq('id', existing.id);
      }
      vinculados += 1;
      continue;
    }

    const row: Record<string, unknown> = {
      placa,
      marca: raw.marca?.trim() || null,
      modelo: raw.modelo?.trim() || null,
      tipo,
      odometro_km: 0,
      entidad_id: raw.entidad_id,
      activo: true,
      nombre,
      equipo_id: raw.id,
      updated_at: now,
    };
    let ins = await supabase.from('ci_flota_vehiculos').insert(row);
    if (ins.error && columnasEquipoFlotaFaltan(ins.error)) {
      const { equipo_id: _e, nombre: _n, ...rest } = row;
      ins = await supabase.from('ci_flota_vehiculos').insert(rest);
    }
    if (ins.error) continue;
    creados += 1;
  }

  return { creados, vinculados };
}

/** Si la unidad nació en Flota, la copia al catálogo de maquinaria de la entidad. */
export async function asegurarCatalogoDesdeVehiculo(
  supabase: SupabaseClient,
  vehiculo: FlotaVehiculo,
  opts?: { forzar?: boolean },
): Promise<FlotaVehiculo> {
  if (!vehiculo.entidad_id || !esUuid(vehiculo.entidad_id)) return vehiculo;
  if (vehiculo.equipo_id && !opts?.forzar) return vehiculo;

  const nombre =
    vehiculo.nombre?.trim() ||
    [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ').trim() ||
    vehiculo.placa;

  const payload = {
    entidad_id: vehiculo.entidad_id,
    proyecto_id: vehiculo.proyecto_id,
    categoria: 'maquinaria_propia',
    nombre_equipo: nombre,
    marca: vehiculo.marca,
    modelo: vehiculo.modelo,
    serial: vehiculo.placa,
    cantidad: 1,
    notas: vehiculo.notas,
  };

  const { data, error } = await supabase.from('ci_proyecto_equipos').insert(payload).select('id').single();
  if (error || !data?.id) return vehiculo;

  const patch = {
    equipo_id: String(data.id),
    nombre,
    updated_at: new Date().toISOString(),
  };
  const up = await supabase
    .from('ci_flota_vehiculos')
    .update(patch)
    .eq('id', vehiculo.id)
    .select(VEHICULO_SELECT)
    .maybeSingle();
  if (up.error && columnasEquipoFlotaFaltan(up.error)) {
    return { ...vehiculo, nombre };
  }
  return (up.data as FlotaVehiculo | null) ?? { ...vehiculo, equipo_id: String(data.id), nombre };
}
