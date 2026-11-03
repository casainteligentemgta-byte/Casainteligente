import type { SupabaseClient } from '@supabase/supabase-js';
import { vincularClienteEntidad } from '@/lib/clientes/clienteEntidades';
import { buscarClientesParecidos, mejorParecido, type ClienteParecido } from '@/lib/clientes/duplicadosCliente';
import { esUuid } from '@/lib/clientes/entidadActiva';
import { esErrorUnicoCustomers, guardarClienteEnDb } from '@/lib/clientes/guardarCliente';
import { nombreDisplayCustomer } from '@/lib/clientes/proyectosClienteDisplay';

export type ResultadoAltaCliente = {
  id: string | null;
  yaExistia: boolean;
  vinculado: boolean;
  nombre: string | null;
  motivo: ClienteParecido['motivo'] | null;
  error: string | null;
};

function criterioDePayload(payload: Record<string, unknown>, excludeId?: string | null) {
  return {
    rif: typeof payload.rif === 'string' ? payload.rif : null,
    cedula: typeof payload.cedula === 'string' ? payload.cedula : null,
    telefono:
      (typeof payload.movil === 'string' && payload.movil) ||
      (typeof payload.telefono === 'string' && payload.telefono) ||
      null,
    excludeId: excludeId ?? null,
  };
}

export function puedeForzarNuevoPorTelefono(motivo: ClienteParecido['motivo'] | null | undefined): boolean {
  return motivo === 'telefono';
}

async function vincularSiHayEntidad(
  session: SupabaseClient,
  customerId: string,
  entidadId: string | null,
): Promise<{ vinculado: boolean; error: string | null }> {
  const eid = String(entidadId ?? '').trim();
  if (!esUuid(eid)) return { vinculado: false, error: null };
  const r = await vincularClienteEntidad(session, customerId, eid);
  if (r.error) return { vinculado: false, error: r.error };
  return { vinculado: !r.yaEstaba, error: null };
}

/**
 * Alta de cliente: si ya existe por cédula/RIF (o teléfono), se vincula a la
 * entidad activa en vez de crear otro. `busqueda` debe ver todos los clientes
 * (service_role); si no hay, se usa la sesión (solo los de su entidad).
 */
export async function altaOVincularCliente(input: {
  session: SupabaseClient;
  busqueda: SupabaseClient;
  payload: Record<string, unknown>;
  entidadId: string | null;
  forzarNuevo?: boolean;
}): Promise<ResultadoAltaCliente> {
  const { session, busqueda, payload, entidadId } = input;
  const criterio = criterioDePayload(payload);
  const dup = await buscarClientesParecidos(busqueda, criterio);
  if (dup.error) {
    return {
      id: null,
      yaExistia: false,
      vinculado: false,
      nombre: null,
      motivo: null,
      error: dup.error,
    };
  }
  const mejor = mejorParecido(dup.parecidos);
  const forzar = Boolean(input.forzarNuevo) && puedeForzarNuevoPorTelefono(mejor?.motivo);

  if (mejor && !forzar) {
    const link = await vincularSiHayEntidad(session, mejor.id, entidadId);
    if (link.error) {
      return {
        id: mejor.id,
        yaExistia: true,
        vinculado: false,
        nombre: mejor.nombre,
        motivo: mejor.motivo,
        error: link.error,
      };
    }
    return {
      id: mejor.id,
      yaExistia: true,
      vinculado: link.vinculado,
      nombre: mejor.nombre,
      motivo: mejor.motivo,
      error: null,
    };
  }

  const insert = await guardarClienteEnDb(session, payload, null);
  if (!insert.error && insert.id) {
    const link = await vincularSiHayEntidad(session, insert.id, entidadId);
    return {
      id: insert.id,
      yaExistia: false,
      vinculado: link.vinculado,
      nombre: nombreDisplayCustomer(payload) || null,
      motivo: null,
      error: link.error,
    };
  }

  if (insert.error && esErrorUnicoCustomers(insert.error)) {
    const otra = await buscarClientesParecidos(busqueda, criterio);
    const encontrado = mejorParecido(otra.parecidos);
    if (encontrado) {
      const link = await vincularSiHayEntidad(session, encontrado.id, entidadId);
      return {
        id: encontrado.id,
        yaExistia: true,
        vinculado: link.vinculado,
        nombre: encontrado.nombre,
        motivo: encontrado.motivo,
        error: link.error,
      };
    }
  }

  return {
    id: null,
    yaExistia: false,
    vinculado: false,
    nombre: null,
    motivo: null,
    error: insert.error ?? 'No se pudo guardar el cliente.',
  };
}
