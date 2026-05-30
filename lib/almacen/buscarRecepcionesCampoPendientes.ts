import type { SupabaseClient } from '@supabase/supabase-js';

export type RecepcionCampoPendienteConciliacion = {
  id: string;
  num_doc: string;
  tipo: string;
  proveedor_nombre: string;
  created_at: string;
};

export async function buscarRecepcionesCampoPendientes(
  supabase: SupabaseClient,
  params: {
    proyectoId: string;
    proveedorId?: string | null;
    proveedorNombre?: string | null;
  },
): Promise<RecepcionCampoPendienteConciliacion[]> {
  const proyectoId = params.proyectoId.trim();
  if (!proyectoId) return [];

  let query = supabase
    .from('ci_recepciones_campo')
    .select('id,num_doc,tipo,proveedor_nombre,created_at,proveedor_id')
    .eq('proyecto_id', proyectoId)
    .eq('estado', 'registrado')
    .is('factura_canal_pendiente_id', null)
    .in('tipo', ['nota_entrega', 'emergencia'])
    .order('created_at', { ascending: false })
    .limit(20);

  const proveedorId = params.proveedorId?.trim();
  if (proveedorId) {
    query = query.eq('proveedor_id', proveedorId);
  } else {
    const nombre = params.proveedorNombre?.trim();
    if (nombre && nombre.length >= 3) {
      query = query.ilike('proveedor_nombre', `%${nombre}%`);
    } else {
      return [];
    }
  }

  const { data, error } = await query;
  if (error) {
    if (/ci_recepciones_campo|42P01|does not exist/i.test(error.message ?? '')) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []).map((r) => ({
    id: String(r.id),
    num_doc: String(r.num_doc ?? ''),
    tipo: String(r.tipo ?? ''),
    proveedor_nombre: String(r.proveedor_nombre ?? ''),
    created_at: String(r.created_at ?? ''),
  }));
}
