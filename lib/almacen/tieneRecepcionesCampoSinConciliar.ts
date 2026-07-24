import type { SupabaseClient } from '@supabase/supabase-js';
import { resolverProveedorIdPorRifNombre } from '@/lib/almacen/resolverProveedorIdCompra';

/**
 * Detecta FRM en obra del mismo proveedor/proyecto sin factura canal enlazada (riesgo de doble stock).
 */
export async function tieneRecepcionesCampoSinConciliar(
  supabase: SupabaseClient,
  params: {
    proyectoId: string;
    supplierRif?: string | null;
    supplierName?: string | null;
    proveedorId?: string | null;
  },
): Promise<boolean> {
  const proyectoId = params.proyectoId.trim();
  if (!proyectoId) return false;

  let proveedorId = params.proveedorId?.trim() ?? '';
  if (!proveedorId) {
    proveedorId =
      (await resolverProveedorIdPorRifNombre(supabase, {
        rif: params.supplierRif,
        nombre: params.supplierName,
      })) ?? '';
  }

  let query = supabase
    .from('ci_recepciones_campo')
    .select('id', { count: 'exact', head: true })
    .eq('proyecto_id', proyectoId)
    .eq('estado', 'registrado')
    .is('factura_canal_pendiente_id', null)
    .in('tipo', ['nota_entrega', 'emergencia']);

  if (proveedorId) {
    query = query.eq('proveedor_id', proveedorId);
  } else {
    const nombre = params.supplierName?.trim();
    if (!nombre || nombre.length < 3) return false;
    query = query.ilike('proveedor_nombre', `%${nombre}%`);
  }

  const { count, error } = await query;
  if (error) {
    if (/ci_recepciones_campo|42P01|does not exist/i.test(error.message ?? '')) {
      return false;
    }
    throw new Error(error.message);
  }
  return (count ?? 0) > 0;
}
