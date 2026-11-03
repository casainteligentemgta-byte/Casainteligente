export async function apiGuardarCliente(
  payload: Record<string, unknown>,
  id?: string | null,
): Promise<{ id: string | null; error: string | null }> {
  const url = id ? `/api/clientes/${id}` : '/api/clientes';
  try {
    const res = await fetch(url, {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!res.ok) {
      return { id: null, error: data.error || `No se pudo guardar (${res.status}).` };
    }
    return { id: String(data.id ?? id ?? '').trim() || null, error: null };
  } catch (e: unknown) {
    return { id: null, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
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
