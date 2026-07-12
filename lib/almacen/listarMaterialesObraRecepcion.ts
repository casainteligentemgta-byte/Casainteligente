import type { SupabaseClient } from '@supabase/supabase-js';
import type { MaterialCampoOpcion } from '@/components/almacen/BuscadorMaterialCampo';
import {
  materialPerteneceCatalogoEntidad,
  resolverEntidadIdCatalogo,
} from '@/lib/almacen/catalogoEntidad';

export type MaterialObraRecepcion = MaterialCampoOpcion;

function mapRow(row: {
  id: string;
  name?: string | null;
  sap_code?: string | null;
  unit?: string | null;
  entidad_id?: string | null;
}): MaterialObraRecepcion {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Material').trim() || 'Material',
    sap_code: row.sap_code?.trim() || null,
    unit: String(row.unit ?? 'UND').trim() || 'UND',
  };
}

/** Materiales del catálogo de la entidad de la obra + stock en ubicaciones de la obra. */
export async function listarMaterialesObraRecepcion(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<MaterialObraRecepcion[]> {
  const pid = proyectoId.trim();
  if (!pid) return [];

  const entidadId = await resolverEntidadIdCatalogo(supabase, { proyectoId: pid });
  const byId = new Map<string, MaterialObraRecepcion>();

  if (entidadId) {
    const { data: delEntidad, error: errEnt } = await supabase
      .from('global_inventory')
      .select('id,name,sap_code,unit,entidad_id')
      .eq('entidad_id', entidadId)
      .order('name')
      .limit(800);

    if (errEnt) throw new Error(errEnt.message);
    for (const row of delEntidad ?? []) {
      const m = mapRow(row as { id: string; name?: string; sap_code?: string; unit?: string });
      byId.set(m.id, m);
    }
  }

  const { data: delProyecto, error: errProy } = await supabase
    .from('global_inventory')
    .select('id,name,sap_code,unit,entidad_id')
    .eq('proyecto_id', pid)
    .order('name')
    .limit(500);

  if (errProy) throw new Error(errProy.message);
  for (const row of delProyecto ?? []) {
    const raw = row as {
      id: string;
      name?: string;
      sap_code?: string;
      unit?: string;
      entidad_id?: string | null;
    };
    if (!materialPerteneceCatalogoEntidad(raw, entidadId)) continue;
    const m = mapRow(raw);
    byId.set(m.id, m);
  }

  const { data: ubicaciones, error: errUb } = await supabase
    .from('inv_ubicaciones')
    .select('id')
    .eq('activo', true)
    .eq('ci_proyecto_id', pid);

  if (errUb && !/does not exist/i.test(errUb.message ?? '')) {
    throw new Error(errUb.message);
  }

  const ubIds = (ubicaciones ?? []).map((u) => String(u.id)).filter(Boolean);
  if (ubIds.length) {
    const BATCH = 40;
    for (let i = 0; i < ubIds.length; i += BATCH) {
      const batch = ubIds.slice(i, i + BATCH);
      const { data: stockRows, error: stockErr } = await supabase
        .from('inventario_stock')
        .select(
          'material_id, material:global_inventory ( id, name, sap_code, unit, entidad_id )',
        )
        .in('ubicacion_id', batch)
        .gt('cantidad_disponible', 0);

      if (stockErr?.code === '42P01') break;
      if (stockErr) throw new Error(stockErr.message);

      for (const row of stockRows ?? []) {
        const raw = row.material as
          | {
              id: string;
              name?: string;
              sap_code?: string;
              unit?: string;
              entidad_id?: string | null;
            }
          | Array<{
              id: string;
              name?: string;
              sap_code?: string;
              unit?: string;
              entidad_id?: string | null;
            }>
          | null;
        const mat = Array.isArray(raw) ? raw[0] : raw;
        if (!mat?.id) continue;
        if (!materialPerteneceCatalogoEntidad(mat, entidadId)) continue;
        const m = mapRow(mat);
        byId.set(m.id, m);
      }
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
