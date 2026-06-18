import type { SupabaseClient } from '@supabase/supabase-js';
import type { CompraListaUnificada } from '@/lib/contabilidad/mapCanalPendienteCompra';

function compraYaIngresoAlmacen(c: CompraListaUnificada): boolean {
  return Boolean(c.ingresado_almacen_at?.trim() || c.compra_factura_id?.trim());
}

/** Completa nombres de entidad, proyecto y almacén para el listado de compras. */
export async function enriquecerComprasConDestino(
  supabase: SupabaseClient,
  compras: CompraListaUnificada[],
): Promise<CompraListaUnificada[]> {
  if (!compras.length) return compras;

  const proyectoIds = new Set<string>();
  const ubicacionIds = new Set<string>();
  const entidadIds = new Set<string>();

  for (const c of compras) {
    if (c.proyecto_id) proyectoIds.add(c.proyecto_id);
    if (c.ubicacion_destino_id?.trim()) ubicacionIds.add(c.ubicacion_destino_id.trim());
    if (c.entidad_id) entidadIds.add(c.entidad_id);
  }

  const proyectoUbicacionFallback = new Map<string, string>();
  const proyectosIngresadosSinUbi = Array.from(
    new Set(
      compras
        .filter(
          (c) =>
            c.proyecto_id &&
            !c.ubicacion_destino_id?.trim() &&
            compraYaIngresoAlmacen(c),
        )
        .map((c) => c.proyecto_id!),
    ),
  ).slice(0, 400);

  if (proyectosIngresadosSinUbi.length) {
    const { data: ubiObra } = await supabase
      .from('inv_ubicaciones')
      .select('id, ci_proyecto_id, nombre, tipo')
      .in('ci_proyecto_id', proyectosIngresadosSinUbi)
      .eq('tipo', 'obra')
      .is('ubicacion_padre_id', null);

    for (const u of ubiObra ?? []) {
      const pid = String(u.ci_proyecto_id ?? '').trim();
      const uid = String(u.id ?? '').trim();
      if (pid && uid && !proyectoUbicacionFallback.has(pid)) {
        proyectoUbicacionFallback.set(pid, uid);
        ubicacionIds.add(uid);
      }
    }
  }

  const proyectosMap = new Map<string, { nombre: string; entidad_id: string | null }>();
  if (proyectoIds.size) {
    const { data } = await supabase
      .from('ci_proyectos')
      .select('id, nombre, entidad_id')
      .in('id', Array.from(proyectoIds).slice(0, 400));
    for (const p of data ?? []) {
      proyectosMap.set(String(p.id), {
        nombre: String(p.nombre ?? '').trim() || 'Obra',
        entidad_id: p.entidad_id ? String(p.entidad_id) : null,
      });
      if (p.entidad_id) entidadIds.add(String(p.entidad_id));
    }
  }

  const ubicacionesMap = new Map<string, string>();
  if (ubicacionIds.size) {
    const { data } = await supabase
      .from('inv_ubicaciones')
      .select('id, nombre, tipo')
      .in('id', Array.from(ubicacionIds).slice(0, 400));
    for (const u of data ?? []) {
      const tipo =
        u.tipo === 'obra'
          ? 'Obra'
          : u.tipo === 'almacen_movil'
            ? 'Móvil'
            : u.tipo === 'almacen_central'
              ? 'Almacén'
              : String(u.tipo ?? '');
      ubicacionesMap.set(String(u.id), `${String(u.nombre ?? '').trim()} (${tipo})`);
    }
  }

  const entidadesMap = new Map<string, string>();
  if (entidadIds.size) {
    const { data } = await supabase
      .from('ci_entidades')
      .select('id, nombre')
      .in('id', Array.from(entidadIds).slice(0, 200));
    for (const e of data ?? []) {
      entidadesMap.set(String(e.id), String(e.nombre ?? '').trim() || 'Entidad');
    }
  }

  return compras.map((c) => {
    const proy = c.proyecto_id ? proyectosMap.get(c.proyecto_id) : undefined;
    const entidadId = c.entidad_id ?? proy?.entidad_id ?? null;
    const proyNombre =
      c.proyecto_nombre ??
      (Array.isArray(c.ci_proyectos)
        ? c.ci_proyectos[0]?.nombre
        : c.ci_proyectos?.nombre) ??
      proy?.nombre ??
      null;

    const ubicacionDestinoId =
      c.ubicacion_destino_id?.trim() ||
      (c.proyecto_id ? proyectoUbicacionFallback.get(c.proyecto_id) : null) ||
      null;

    return {
      ...c,
      entidad_id: entidadId,
      entidad_nombre: entidadId ? (entidadesMap.get(entidadId) ?? null) : null,
      proyecto_nombre: proyNombre?.trim() || null,
      ubicacion_destino_id: ubicacionDestinoId,
      ubicacion_nombre: ubicacionDestinoId
        ? (ubicacionesMap.get(ubicacionDestinoId) ?? c.ubicacion_nombre ?? null)
        : (c.ubicacion_nombre ?? null),
    };
  });
}
