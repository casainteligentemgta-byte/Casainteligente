import type { SupabaseClient } from '@supabase/supabase-js';
import {
  compararReceptorConPropietario,
  normalizarRif,
} from '@/lib/contabilidad/propietarioFactura';

export type PropietarioObra = { nombre: string | null; rif: string | null };

/** Propietario (cliente) de la obra destino. Null si la obra no tiene cliente asignado. */
export async function buscarPropietarioObra(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<PropietarioObra | null> {
  const { data: proy } = await supabase
    .from('ci_proyectos')
    .select('customer_id')
    .eq('id', proyectoId)
    .maybeSingle();
  const customerId = String((proy as { customer_id?: string | null } | null)?.customer_id ?? '');
  if (!customerId) return null;
  const { data: cli } = await supabase
    .from('customers')
    .select('nombre, rif')
    .eq('id', customerId)
    .maybeSingle();
  if (!cli) return null;
  return {
    nombre: (cli as { nombre?: string | null }).nombre ?? null,
    rif: (cli as { rif?: string | null }).rif ?? null,
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Texto de aviso si la factura está a nombre de otra persona que el propietario de la obra.
 * Null cuando coincide o no hay datos suficientes para comparar.
 */
export function textoAvisoPropietario(
  extracted: Record<string, unknown>,
  propietario: PropietarioObra,
): string | null {
  const receptor = {
    nombre: typeof extracted.receptor_nombre === 'string' ? extracted.receptor_nombre : null,
    rif: typeof extracted.receptor_rif === 'string' ? extracted.receptor_rif : null,
  };
  const r = compararReceptorConPropietario(receptor, propietario);
  if (r.estado !== 'no_coincide') return null;
  const rifTxt = normalizarRif(receptor.rif) ? ` (RIF ${esc(String(receptor.rif))})` : '';
  return (
    `⚠️ <b>Revise la obra</b>\n` +
    `La factura está a nombre de <b>${esc(String(receptor.nombre ?? '—'))}</b>${rifTxt}.\n` +
    `La obra elegida es de <b>${esc(propietario.nombre ?? '—')}</b>` +
    (propietario.rif ? ` (RIF ${esc(propietario.rif)})` : '') +
    `.\n\n¿Confirma que es la obra correcta?`
  );
}
