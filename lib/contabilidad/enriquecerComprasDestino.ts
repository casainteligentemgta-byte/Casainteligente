import type { SupabaseClient } from '@supabase/supabase-js';
import type { CompraListaUnificada } from '@/lib/contabilidad/mapCanalPendienteCompra';
import { nombreDisplayCustomer } from '@/lib/clientes/proyectosClienteDisplay';

function compraYaIngresoAlmacen(c: CompraListaUnificada): boolean {
  return Boolean(c.ingresado_almacen_at?.trim() || c.compra_factura_id?.trim());
}

function etiquetaTipoUbicacion(tipo: string | null | undefined): string {
  if (tipo === 'obra') return 'Obra';
  if (tipo === 'almacen_movil') return 'Móvil';
  if (tipo === 'almacen_central') return 'Almacén';
  return String(tipo ?? '').trim() || 'Ubicación';
}

function preferirUbicacionProyecto(
  rows: Array<{
    id?: string | null;
    ci_proyecto_id?: string | null;
    nombre?: string | null;
    tipo?: string | null;
    ubicacion_padre_id?: string | null;
  }>,
  proyectoId: string,
): string | null {
  const delProyecto = rows.filter((u) => String(u.ci_proyecto_id ?? '').trim() === proyectoId);
  if (!delProyecto.length) return null;

  const preferida =
    delProyecto.find((u) => u.tipo === 'almacen_central') ??
    delProyecto.find((u) => u.tipo === 'almacen_movil') ??
    delProyecto.find((u) => u.tipo === 'obra' && !u.ubicacion_padre_id) ??
    delProyecto[0];

  return String(preferida?.id ?? '').trim() || null;
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
  const proyectosSinUbicacion = Array.from(
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

  if (proyectosSinUbicacion.length) {
    const { data: ubisProyecto } = await supabase
      .from('inv_ubicaciones')
      .select('id, ci_proyecto_id, nombre, tipo, ubicacion_padre_id')
      .in('ci_proyecto_id', proyectosSinUbicacion)
      .eq('activo', true);

    for (const pid of proyectosSinUbicacion) {
      const uid = preferirUbicacionProyecto(ubisProyecto ?? [], pid);
      if (uid && !proyectoUbicacionFallback.has(pid)) {
        proyectoUbicacionFallback.set(pid, uid);
        ubicacionIds.add(uid);
      }
    }
  }

  const proyectosMap = new Map<
    string,
    { nombre: string; entidad_id: string | null; customer_id: string | null }
  >();
  if (proyectoIds.size) {
    const { data } = await supabase
      .from('ci_proyectos')
      .select('id, nombre, entidad_id, customer_id')
      .in('id', Array.from(proyectoIds).slice(0, 400));
    for (const p of data ?? []) {
      proyectosMap.set(String(p.id), {
        nombre: String(p.nombre ?? '').trim() || 'Obra',
        entidad_id: p.entidad_id ? String(p.entidad_id) : null,
        customer_id: p.customer_id ? String(p.customer_id) : null,
      });
      if (p.entidad_id) entidadIds.add(String(p.entidad_id));
    }
  }

  const customerIds = new Set<string>();
  for (const proy of Array.from(proyectosMap.values())) {
    if (proy.customer_id) customerIds.add(proy.customer_id);
  }
  const customersMap = new Map<string, string>();
  if (customerIds.size) {
    const { data } = await supabase
      .from('customers')
      .select('id, nombre, apellido, razon_social')
      .in('id', Array.from(customerIds).slice(0, 200));
    for (const c of data ?? []) {
      const label = nombreDisplayCustomer(c);
      if (label) customersMap.set(String(c.id), label);
    }
  }

  const ubicacionesMap = new Map<string, string>();
  if (ubicacionIds.size) {
    const { data } = await supabase
      .from('inv_ubicaciones')
      .select('id, nombre, tipo')
      .in('id', Array.from(ubicacionIds).slice(0, 400));
    for (const u of data ?? []) {
      const nombre = String(u.nombre ?? '').trim();
      if (!nombre) continue;
      const tipo = etiquetaTipoUbicacion(u.tipo);
      ubicacionesMap.set(String(u.id), `${nombre} (${tipo})`);
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

    const ubicacionNombre = ubicacionDestinoId
      ? (ubicacionesMap.get(ubicacionDestinoId) ?? c.ubicacion_nombre ?? null)
      : (c.ubicacion_nombre ?? null);

    const customerId = proy?.customer_id ?? null;
    const clienteCrmNombre = customerId ? (customersMap.get(customerId) ?? null) : null;

    return {
      ...c,
      entidad_id: entidadId,
      entidad_nombre: entidadId ? (entidadesMap.get(entidadId) ?? null) : null,
      proyecto_nombre: proyNombre?.trim() || null,
      cliente_crm_nombre: clienteCrmNombre,
      ubicacion_destino_id: ubicacionDestinoId,
      ubicacion_nombre: ubicacionNombre?.trim() || null,
    };
  });
}
