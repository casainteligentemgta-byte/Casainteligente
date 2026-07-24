import type { SupabaseClient } from '@supabase/supabase-js';
import type { EstadoProcura } from '@/lib/procuras/procuraEstados';

/** Material ya ingresado a stock: no se borra la procura para preservar trazabilidad. */
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

export type EliminarProcurasOpciones = {
  /**
   * Quita procura_id de compras contables y recepciones, y limpia purchase_invoice_id
   * en la procura (no borra facturas ni movimientos de almacén).
   */
  desvincularVinculos?: boolean;
};

async function desvincularProcurasAntesDeBorrar(
  supabase: SupabaseClient,
  ids: string[],
): Promise<void> {
  const { error: ccErr } = await supabase
    .from('contabilidad_compras')
    .update({ procura_id: null })
    .in('procura_id', ids);
  if (ccErr?.code !== '42P01' && ccErr) throw new Error(ccErr.message);

  const { error: recErr } = await supabase
    .from('ci_recepciones_campo')
    .update({ procura_id: null })
    .in('procura_id', ids);
  if (recErr?.code !== '42P01' && recErr) throw new Error(recErr.message);

  const { error: piErr } = await supabase
    .from('ci_procuras')
    .update({ purchase_invoice_id: null })
    .in('id', ids);
  if (piErr) throw new Error(piErr.message);
}

export async function eliminarProcurasPorIds(
  supabase: SupabaseClient,
  ids: string[],
  opts?: EliminarProcurasOpciones,
): Promise<EliminarProcurasResult> {
  const desvincular = opts?.desvincularVinculos !== false;
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
      if (ESTADOS_NO_ELIMINABLES.includes(r.estado as EstadoProcura)) {
        return `${r.ticket}: material ya recibido en almacén (estado «${r.estado}»)`;
      }
      if (!desvincular) {
        if (r.purchase_invoice_id?.trim()) {
          return `${r.ticket}: vinculada a una compra (purchase invoice)`;
        }
      }
      return null;
    })
    .filter(Boolean) as string[];

  if (bloqueadas.length) {
    throw new Error(`No se pueden eliminar:\n${bloqueadas.join('\n')}`);
  }

  const idsFound = found.map((r) => r.id);

  if (!desvincular) {
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
  } else {
    await desvincularProcurasAntesDeBorrar(supabase, idsFound);
    const { error: vErr } = await supabase
      .from('ci_procura_factura_vinculos')
      .delete()
      .in('procura_id', idsFound);
    if (vErr?.code !== '42P01' && vErr) throw new Error(vErr.message);
  }

  const { error: delErr } = await supabase.from('ci_procuras').delete().in('id', idsFound);
  if (delErr) throw new Error(delErr.message);

  return {
    eliminadas: idsFound.length,
    tickets: found.map((r) => r.ticket),
  };
}
