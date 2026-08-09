import type { SupabaseClient } from '@supabase/supabase-js';
import {
  generarCodigoCarnet,
  type DatosCarnetDigital,
} from '@/lib/rrhh/carnetDigital';

type EmpRow = {
  id: string;
  nombre_completo?: string | null;
  nombres?: string | null;
  primer_apellido?: string | null;
  segundo_apellido?: string | null;
  cedula?: string | null;
  documento?: string | null;
  cargo_nombre?: string | null;
  celular?: string | null;
  telefono?: string | null;
  foto_perfil_url?: string | null;
  carnet_codigo?: string | null;
  carnet_emitido_at?: string | null;
  carnet_vigente_hasta?: string | null;
  proyecto_modulo_id?: string | null;
  tipo_sangre?: string | null;
  hoja_vida_obrero?: { salud?: { tipoSangre?: string }; personales?: { tipoSangre?: string } } | null;
};

/**
 * Carga datos del carnet; si no hay código, lo genera (sin persistir).
 * Use `emitir=true` en API para guardar emisión.
 */
export async function cargarDatosCarnetEmpleado(
  supabase: SupabaseClient,
  empleadoId: string,
): Promise<{ ok: true; datos: DatosCarnetDigital } | { ok: false; error: string }> {
  const id = empleadoId.trim();
  if (!id) return { ok: false, error: 'id requerido' };

  const { data, error } = await supabase
    .from('ci_empleados')
    .select(
      'id,nombre_completo,nombres,primer_apellido,segundo_apellido,cedula,documento,cargo_nombre,celular,telefono,foto_perfil_url,carnet_codigo,carnet_emitido_at,carnet_vigente_hasta,proyecto_modulo_id,tipo_sangre,hoja_vida_obrero',
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    if (/carnet_codigo|carnet_emitido|does not exist|schema cache/i.test(error.message)) {
      const bare = await supabase
        .from('ci_empleados')
        .select(
          'id,nombre_completo,nombres,primer_apellido,segundo_apellido,cedula,documento,cargo_nombre,celular,telefono,foto_perfil_url,proyecto_modulo_id,hoja_vida_obrero',
        )
        .eq('id', id)
        .maybeSingle();
      if (bare.error || !bare.data) {
        return { ok: false, error: bare.error?.message ?? 'Empleado no encontrado' };
      }
      return { ok: true, datos: await armar(supabase, bare.data as EmpRow, null, null, null) };
    }
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: 'Empleado no encontrado' };

  const row = data as EmpRow;
  return {
    ok: true,
    datos: await armar(
      supabase,
      row,
      row.carnet_codigo ?? null,
      row.carnet_emitido_at ?? null,
      row.carnet_vigente_hasta ?? null,
    ),
  };
}

async function armar(
  supabase: SupabaseClient,
  row: EmpRow,
  codigoExistente: string | null,
  emitidoAt: string | null,
  vigenteHasta: string | null,
): Promise<DatosCarnetDigital> {
  const nombre =
    (row.nombre_completo ?? '').trim() ||
    [row.nombres, row.primer_apellido, row.segundo_apellido].filter(Boolean).join(' ').trim() ||
    'Trabajador';
  const cedula = (row.cedula ?? row.documento ?? '').trim();

  let obraNombre: string | null = null;
  let entidadNombre: string | null = null;
  const proyId = (row.proyecto_modulo_id ?? '').trim();
  if (proyId) {
    const { data: proy } = await supabase
      .from('ci_proyectos')
      .select('nombre,entidad_id')
      .eq('id', proyId)
      .maybeSingle();
    obraNombre = ((proy as { nombre?: string } | null)?.nombre ?? '').trim() || null;
    const eid = ((proy as { entidad_id?: string } | null)?.entidad_id ?? '').trim();
    if (eid) {
      const { data: ent } = await supabase
        .from('ci_entidades')
        .select('nombre')
        .eq('id', eid)
        .maybeSingle();
      entidadNombre = ((ent as { nombre?: string } | null)?.nombre ?? '').trim() || null;
    }
  }

  const hv = row.hoja_vida_obrero;
  const sangre =
    (row.tipo_sangre ?? '').trim() ||
    (hv?.salud?.tipoSangre ?? '').trim() ||
    (hv?.personales?.tipoSangre ?? '').trim() ||
    null;

  const codigo =
    (codigoExistente ?? '').trim() ||
    generarCodigoCarnet({ obraNombre, cedula, empleadoId: row.id });

  return {
    empleadoId: row.id,
    codigo,
    nombre,
    cedula,
    oficio: (row.cargo_nombre ?? '').trim() || 'Obrero',
    obraNombre,
    entidadNombre,
    fotoUrl: (row.foto_perfil_url ?? '').trim() || null,
    emitidoAt: emitidoAt || new Date().toISOString(),
    vigenteHasta: vigenteHasta,
    sangre,
    telefono: (row.celular ?? row.telefono ?? '').trim() || null,
  };
}

export async function emitirCarnetEmpleado(
  supabase: SupabaseClient,
  empleadoId: string,
  opts?: { vigenteHasta?: string | null },
): Promise<{ ok: true; datos: DatosCarnetDigital } | { ok: false; error: string }> {
  const loaded = await cargarDatosCarnetEmpleado(supabase, empleadoId);
  if (!loaded.ok) return loaded;

  const now = new Date().toISOString();
  const patch = {
    carnet_codigo: loaded.datos.codigo,
    carnet_emitido_at: now,
    carnet_vigente_hasta: (opts?.vigenteHasta ?? '').trim() || null,
  };

  const { error } = await supabase.from('ci_empleados').update(patch).eq('id', empleadoId.trim());
  if (error) {
    if (/carnet_codigo|does not exist|schema cache/i.test(error.message)) {
      return {
        ok: false,
        error: 'Falta migración 319 (columnas carnet en ci_empleados). Aplíquela en Supabase.',
      };
    }
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    datos: {
      ...loaded.datos,
      emitidoAt: now,
      vigenteHasta: patch.carnet_vigente_hasta,
    },
  };
}
