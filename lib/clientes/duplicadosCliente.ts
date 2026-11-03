import type { SupabaseClient } from '@supabase/supabase-js';
import { nombreDisplayCustomer } from '@/lib/clientes/proyectosClienteDisplay';
import { normalizarDocumentoVe, normalizarTelefonoVe } from '@/lib/clientes/normalizarIdentidad';

export type ClienteCandidatoDup = {
  id: string;
  nombre: string | null;
  apellido?: string | null;
  razon_social?: string | null;
  rif?: string | null;
  cedula?: string | null;
  telefono?: string | null;
  movil?: string | null;
};

export type CriterioDuplicado = {
  rif?: string | null;
  cedula?: string | null;
  telefono?: string | null;
  excludeId?: string | null;
};

export type ClienteParecido = {
  id: string;
  nombre: string;
  motivo: 'rif' | 'cedula' | 'telefono';
};

function telefonoDeFila(row: ClienteCandidatoDup): string {
  return normalizarTelefonoVe(row.movil || row.telefono);
}

export function clientesParecidos(
  candidatos: ClienteCandidatoDup[],
  criterio: CriterioDuplicado,
): ClienteParecido[] {
  const rif = normalizarDocumentoVe(criterio.rif);
  const cedula = normalizarDocumentoVe(criterio.cedula);
  const telefono = normalizarTelefonoVe(criterio.telefono);
  const exclude = String(criterio.excludeId ?? '').trim();
  const out: ClienteParecido[] = [];
  const visto = new Set<string>();

  for (const c of candidatos) {
    const id = String(c.id ?? '').trim();
    if (!id || id === exclude || visto.has(id)) continue;
    let motivo: ClienteParecido['motivo'] | null = null;
    if (cedula && normalizarDocumentoVe(c.cedula) === cedula) motivo = 'cedula';
    else if (rif && normalizarDocumentoVe(c.rif) === rif) motivo = 'rif';
    else if (telefono && telefonoDeFila(c) === telefono) motivo = 'telefono';
    if (!motivo) continue;
    visto.add(id);
    out.push({
      id,
      nombre: nombreDisplayCustomer(c) || 'Cliente',
      motivo,
    });
  }
  return out;
}

const SELECT_DUP =
  'id,nombre,apellido,razon_social,rif,cedula,telefono,movil' as const;

/** Lee columnas cortas y compara en memoria (RIF/cédula/teléfono no están normalizados en BD). */
export async function buscarClientesParecidos(
  supabase: SupabaseClient,
  criterio: CriterioDuplicado,
): Promise<{ parecidos: ClienteParecido[]; error: string | null }> {
  const rif = normalizarDocumentoVe(criterio.rif);
  const cedula = normalizarDocumentoVe(criterio.cedula);
  const telefono = normalizarTelefonoVe(criterio.telefono);
  if (!rif && !cedula && !telefono) return { parecidos: [], error: null };

  const { data, error } = await supabase.from('customers').select(SELECT_DUP);
  if (error) return { parecidos: [], error: error.message };
  return {
    parecidos: clientesParecidos((data ?? []) as ClienteCandidatoDup[], criterio),
    error: null,
  };
}

const ORDEN_MOTIVO: Record<ClienteParecido['motivo'], number> = {
  cedula: 0,
  rif: 1,
  telefono: 2,
};

/** El de cédula/RIF primero; teléfono solo como respaldo. */
export function mejorParecido(parecidos: ClienteParecido[]): ClienteParecido | null {
  if (!parecidos.length) return null;
  return [...parecidos].sort((a, b) => ORDEN_MOTIVO[a.motivo] - ORDEN_MOTIVO[b.motivo])[0] ?? null;
}
