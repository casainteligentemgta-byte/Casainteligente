import type { SupabaseClient } from '@supabase/supabase-js';
import type { EstadoProcura } from '@/lib/procuras/procuraEstados';

const ESTADOS_NO_ELIMINABLES: readonly EstadoProcura[] = ['recibida', 'recibida_parcial'];

type ProcuraDeleteRow = {
  id: string;
  ticket: string;
  estado: string;
  purchase_invoice_id: string | null;
};

export type EliminarProcurasResult = {
  eliminadas: number;
  tickets: string[];
};

function motivoNoEliminable(row: ProcuraDeleteRow): string | null {
  if (ESTADOS_NO_ELIMINABLES.includes(row.estado as EstadoProcura)) {
    return `estado «${row.estado}» (material ya recibido)`;
  }
  if (row.purchase_invoice_id?.trim()) {
    return 'vinculada a una compra (purchase invoice)';
  }
  return null;
}

export async function eliminarProcurasPorIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<EliminarProcurasResult> {
  const uniq = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (!uniq.length) {
    throw new Error('Indique al menos un id de procura.');
  }

  const { data: rows, error: loadErr } = await supabase
    .from('ci_procuras')
    .select('id,ticket,estado,purchase_invoice_id')
    .in('id', uniq);

  if (loadErr) throw new Error(loadErr.message);

  const found = (rows ?? []) as ProcuraDeleteRow[];
  if (found.length !== uniq.length) {
    throw new Error('Una o más procuras no existen o ya fueron eliminadas.');
  }

  const bloqueadas = found
    .map((r) => {
      const motivo = motivoNoEliminable(r);
      return motivo ? `${r.ticket}: ${motivo}` : null;
    })
    .filter(Boolean) as string[];

  if (bloqueadas.length) {
    throw new Error(`No se pueden eliminar:\n${bloqueadas.join('\n')}`);
  }

  const idsFound = found.map((r) => r.id);

  const { data: compras, error: comprasErr } = await supabase
    .from('contabilidad_compras')
    .select('procura_id')
    .in('procura_id', idsFound);
  if (comprasErr?.code !== '42P01' && comprasErr) throw new Error(comprasErr.message);
  if ((compras ?? []).length) {
    throw new Error('Hay procuras vinculadas a compras contables. Cancele o desvincule antes de borrar.');
  }

  const { data: recepciones, error: recErr } = await supabase
    .from('ci_recepciones_campo')
    .select('procura_id')
    .in('procura_id', idsFound);
  if (recErr?.code !== '42P01' && recErr) throw new Error(recErr.message);
  if ((recepciones ?? []).length) {
    throw new Error(
      'Hay procuras con recepciones de campo registradas. No se pueden eliminar para preservar trazabilidad.',
    );
  }

  const { error: delErr } = await supabase.from('ci_procuras').delete().in('id', idsFound);
  if (delErr) throw new Error(delErr.message);

  return {
    eliminadas: idsFound.length,
    tickets: found.map((r) => r.ticket),
  };
}
