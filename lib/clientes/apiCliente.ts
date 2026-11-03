export type ResultadoGuardarCliente = {
  id: string | null;
  error: string | null;
  yaExistia?: boolean;
  vinculado?: boolean;
  nombre?: string | null;
  motivo?: 'rif' | 'cedula' | 'telefono' | null;
};

export async function apiGuardarCliente(
  payload: Record<string, unknown>,
  id?: string | null,
): Promise<ResultadoGuardarCliente> {
  const url = id ? `/api/clientes/${id}` : '/api/clientes';
  try {
    const res = await fetch(url, {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as ResultadoGuardarCliente & {
      ya_existia?: boolean;
      error?: string;
    };
    if (!res.ok) {
      return { id: null, error: data.error || `No se pudo guardar (${res.status}).` };
    }
    return {
      id: String(data.id ?? id ?? '').trim() || null,
      error: null,
      yaExistia: Boolean(data.yaExistia ?? data.ya_existia),
      vinculado: Boolean(data.vinculado),
      nombre: data.nombre ?? null,
      motivo: data.motivo ?? null,
    };
  } catch (e: unknown) {
    return { id: null, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}

export async function apiBuscarDuplicadosCliente(criterio: {
  rif?: string | null;
  cedula?: string | null;
  telefono?: string | null;
  excludeId?: string | null;
}): Promise<{ parecidos: Array<{ id: string; nombre: string; motivo: 'rif' | 'cedula' | 'telefono' }>; error: string | null }> {
  const q = new URLSearchParams();
  if (criterio.rif) q.set('rif', criterio.rif);
  if (criterio.cedula) q.set('cedula', criterio.cedula);
  if (criterio.telefono) q.set('telefono', criterio.telefono);
  if (criterio.excludeId) q.set('excludeId', criterio.excludeId);
  try {
    const res = await fetch(`/api/clientes/duplicados?${q.toString()}`);
    const data = (await res.json().catch(() => ({}))) as {
      parecidos?: Array<{ id: string; nombre: string; motivo: 'rif' | 'cedula' | 'telefono' }>;
      error?: string;
    };
    if (!res.ok) return { parecidos: [], error: data.error || `No se pudo buscar (${res.status}).` };
    return { parecidos: data.parecidos ?? [], error: null };
  } catch (e: unknown) {
    return { parecidos: [], error: e instanceof Error ? e.message : 'No se pudo buscar duplicados.' };
  }
}

export async function apiEntidadesCliente(customerId: string): Promise<{
  entidades: Array<{ entidadId: string; nombre: string; rif: string | null }>;
  error: string | null;
}> {
  try {
    const res = await fetch(`/api/clientes/${customerId}/entidades`);
    const data = (await res.json().catch(() => ({}))) as {
      entidades?: Array<{ entidadId: string; nombre: string; rif: string | null }>;
      error?: string;
    };
    if (!res.ok) return { entidades: [], error: data.error || `No se pudo cargar (${res.status}).` };
    return { entidades: data.entidades ?? [], error: null };
  } catch (e: unknown) {
    return { entidades: [], error: e instanceof Error ? e.message : 'No se pudieron cargar las empresas.' };
  }
}

export async function apiVincularEntidadCliente(
  customerId: string,
  entidadId: string,
): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`/api/clientes/${customerId}/entidades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entidad_id: entidadId }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { error: data.error || `No se pudo vincular (${res.status}).` };
    return { error: null };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'No se pudo vincular.' };
  }
}

export async function apiDesvincularEntidadCliente(
  customerId: string,
  entidadId: string,
): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`/api/clientes/${customerId}/entidades?entidad_id=${encodeURIComponent(entidadId)}`, {
      method: 'DELETE',
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { error: data.error || `No se pudo quitar (${res.status}).` };
    return { error: null };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'No se pudo quitar de la empresa.' };
  }
}

export async function apiClientesSinEntidad(): Promise<{
  clientes: Array<{ id: string; nombre: string }>;
  error: string | null;
}> {
  try {
    const res = await fetch('/api/clientes/sin-entidad');
    const data = (await res.json().catch(() => ({}))) as {
      clientes?: Array<{ id: string; nombre: string }>;
      error?: string;
    };
    if (res.status === 403) return { clientes: [], error: null };
    if (!res.ok) return { clientes: [], error: data.error || `No se pudo cargar (${res.status}).` };
    return { clientes: data.clientes ?? [], error: null };
  } catch (e: unknown) {
    return { clientes: [], error: e instanceof Error ? e.message : 'No se pudieron cargar.' };
  }
}

export async function apiAsignarEntidadMasiva(
  entidadId: string,
  customerIds?: string[],
): Promise<{ vinculados: number; error: string | null }> {
  try {
    const res = await fetch('/api/clientes/sin-entidad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entidad_id: entidadId,
        customer_ids: customerIds ?? [],
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { vinculados?: number; error?: string };
    if (!res.ok) return { vinculados: 0, error: data.error || `No se pudo asignar (${res.status}).` };
    return { vinculados: Number(data.vinculados) || 0, error: null };
  } catch (e: unknown) {
    return { vinculados: 0, error: e instanceof Error ? e.message : 'No se pudo asignar.' };
  }
}

export async function apiArchivarCliente(
  id: string,
  status: 'activo' | 'inactivo',
): Promise<{ error: string | null }> {
  const r = await apiGuardarCliente({ status }, id);
  return { error: r.error };
}

export async function apiRegistrarContactoCliente(input: {
  customerId: string;
  canal: string;
  nota?: string | null;
}): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`/api/clientes/${input.customerId}/contactos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canal: input.canal, nota: input.nota ?? null }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { error: data.error || `No se pudo registrar (${res.status}).` };
    return { error: null };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'No se pudo registrar el contacto.' };
  }
}
