import type { SupabaseClient } from '@supabase/supabase-js';
import { parseEstadoProcura } from '@/lib/procuras/procuraEstados';
import { vincularProcuraCompraContabilidad } from '@/lib/procuras/vincularProcuraCompra';

const ESTADOS_VINCULO = new Set(['aprobada', 'aprobada_directa', 'recibida_parcial']);

export type ResultadoVinculoProcurasFactura = {
  ok: boolean;
  contabilidadCompraId: string;
  invoiceNumber: string | null;
  supplierName: string | null;
  vinculadas: Array<{ procuraId: string; ticket: string; desviacionUsd?: number }>;
  errores: string[];
};

type ProcuraRow = {
  id: string;
  ticket: string;
  estado: string;
  purchase_invoice_id: string | null;
  proyecto_id: string | null;
};

/** Vincula varias procuras a la misma factura del cuadro de contabilidad. */
export async function vincularProcurasFacturaContabilidad(
  supabase: SupabaseClient,
  params: {
    contabilidadCompraId: string;
    procuraIds: string[];
  },
): Promise<ResultadoVinculoProcurasFactura> {
  const compraId = params.contabilidadCompraId.trim();
  const ids = Array.from(new Set(params.procuraIds.map((id) => id.trim()).filter(Boolean)));

  const vacio: ResultadoVinculoProcurasFactura = {
    ok: false,
    contabilidadCompraId: compraId,
    invoiceNumber: null,
    supplierName: null,
    vinculadas: [],
    errores: [],
  };

  if (!ids.length) {
    return { ...vacio, errores: ['Indique al menos una procura.'] };
  }

  const { data: compra, error: compraErr } = await supabase
    .from('contabilidad_compras')
    .select('id,purchase_invoice_id,procura_id,invoice_number,supplier_name,proyecto_id')
    .eq('id', compraId)
    .maybeSingle();

  if (compraErr) throw new Error(compraErr.message);
  if (!compra) {
    return { ...vacio, errores: ['Compra contable no encontrada.'] };
  }

  const compraRow = compra as {
    id: string;
    purchase_invoice_id: string | null;
    procura_id: string | null;
    invoice_number: string | null;
    supplier_name: string | null;
    proyecto_id: string | null;
  };

  const purchaseInvoiceId = String(compraRow.purchase_invoice_id ?? '').trim();
  if (!purchaseInvoiceId) {
    return {
      ...vacio,
      errores: ['Esta compra no tiene purchase_invoice_id. Regístrela primero en contabilidad.'],
    };
  }

  const { data: procuras, error: procErr } = await supabase
    .from('ci_procuras')
    .select('id,ticket,estado,purchase_invoice_id,proyecto_id')
    .in('id', ids);

  if (procErr) throw new Error(procErr.message);

  const found = (procuras ?? []) as ProcuraRow[];
  if (found.length !== ids.length) {
    return { ...vacio, errores: ['Una o más procuras no existen.'] };
  }

  const errores: string[] = [];
  const vinculadas: ResultadoVinculoProcurasFactura['vinculadas'] = [];

  for (const proc of found) {
    const estado = parseEstadoProcura(proc.estado);
    if (!estado || !ESTADOS_VINCULO.has(estado)) {
      errores.push(`${proc.ticket}: estado «${proc.estado}» no permite vincular factura.`);
      continue;
    }

    const piProc = String(proc.purchase_invoice_id ?? '').trim();
    if (piProc && piProc !== purchaseInvoiceId) {
      errores.push(`${proc.ticket}: ya está vinculada a otra factura.`);
      continue;
    }

    if (
      compraRow.proyecto_id &&
      proc.proyecto_id &&
      proc.proyecto_id !== compraRow.proyecto_id
    ) {
      errores.push(`${proc.ticket}: obra distinta a la de la factura seleccionada.`);
      continue;
    }

    const resultado = await vincularProcuraCompraContabilidad(supabase, {
      purchaseInvoiceId,
      procuraId: proc.id,
      contabilidadCompraId: compraId,
      autoMatch: false,
    });

    if (!resultado.ok) {
      errores.push(`${proc.ticket}: ${resultado.error ?? 'error al vincular'}`);
      continue;
    }
    if (!resultado.vinculado) {
      errores.push(`${proc.ticket}: no se pudo vincular con la factura.`);
      continue;
    }

    vinculadas.push({
      procuraId: proc.id,
      ticket: resultado.ticket ?? proc.ticket,
      desviacionUsd: resultado.desviacionUsd,
    });
  }

  if (!vinculadas.length) {
    return {
      ...vacio,
      invoiceNumber: compraRow.invoice_number,
      supplierName: compraRow.supplier_name,
      errores,
    };
  }

  return {
    ok: true,
    contabilidadCompraId: compraId,
    invoiceNumber: compraRow.invoice_number,
    supplierName: compraRow.supplier_name,
    vinculadas,
    errores,
  };
}
