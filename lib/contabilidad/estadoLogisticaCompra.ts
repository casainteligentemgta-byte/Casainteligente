import type { SupabaseClient } from '@supabase/supabase-js';

import type { CompraListaUnificada } from '@/lib/contabilidad/mapCanalPendienteCompra';



/** Flujo logístico unificado: contabilidad → cuarentena → stock. */

export type EstadoLogisticaCompra =

  | 'sin_documento'

  | 'registrada'

  | 'cuarentena'

  | 'en_almacen_parcial'

  | 'en_almacen'

  | 'rechazo_cuarentena';



export type LogisticaConteos = {

  pendiente: number;

  aprobado: number;

  rechazado: number;

  total: number;

};



export function etiquetaEstadoLogistica(

  estado: EstadoLogisticaCompra,

  conteos?: LogisticaConteos | null,

): string {

  switch (estado) {

    case 'sin_documento':

      return 'Sin documento';

    case 'registrada':

      return 'Registrada';

    case 'cuarentena':

      return conteos?.pendiente

        ? `En tránsito (${conteos.pendiente}/${conteos.total})`

        : 'En tránsito';

    case 'en_almacen_parcial':

      return conteos?.pendiente

        ? `En almacén · ${conteos.aprobado}/${conteos.total} liberadas`

        : 'En almacén (parcial)';

    case 'en_almacen':

      return 'En almacén';

    case 'rechazo_cuarentena':

      return 'Rechazado en tránsito';

  }

}



export function coloresEstadoLogistica(estado: EstadoLogisticaCompra): {

  background: string;

  color: string;

} {

  switch (estado) {

    case 'sin_documento':

      return { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' };

    case 'registrada':

      return { background: 'rgba(167,139,250,0.15)', color: '#c4b5fd' };

    case 'cuarentena':

      return { background: 'rgba(245,158,11,0.18)', color: '#fcd34d' };

    case 'en_almacen_parcial':

      return { background: 'rgba(56,189,248,0.18)', color: '#7dd3fc' };

    case 'en_almacen':

      return { background: 'rgba(52,199,89,0.18)', color: '#86efac' };

    case 'rechazo_cuarentena':

      return { background: 'rgba(239,68,68,0.18)', color: '#fca5a5' };

  }

}



/** true si aún puede liberarse o ingresar stock pendiente */

export function compraPermiteIngresoAlmacen(estado: EstadoLogisticaCompra | null | undefined): boolean {

  if (!estado || estado === 'sin_documento') return false;

  return estado === 'cuarentena' || estado === 'registrada' || estado === 'en_almacen_parcial';

}



/** Recepción física ya cerrada (no mostrar «Confirmación recepción»). */

export function compraRecepcionYaConfirmada(c: {

  estado_logistica?: EstadoLogisticaCompra | null;

  ingresado_almacen_at?: string | null;

}): boolean {

  const estado = c.estado_logistica;

  if (estado === 'en_almacen') return true;

  if (estado === 'cuarentena' || estado === 'en_almacen_parcial') return false;

  return Boolean(c.ingresado_almacen_at?.trim());

}



/** Botón «Confirmación recepción» / «Liberar pendiente» en cuadro compras. */

export function compraMuestraBotonConfirmacionRecepcion(c: {

  estado_logistica?: EstadoLogisticaCompra | null;

  ingresado_almacen_at?: string | null;

}): boolean {

  return compraPermiteIngresoAlmacen(c.estado_logistica) && !compraRecepcionYaConfirmada(c);

}



type ConteosPorInvoice = Map<string, LogisticaConteos>;



function acumularConteo(map: ConteosPorInvoice, invoiceId: string, status: string): void {

  const prev = map.get(invoiceId) ?? { pendiente: 0, aprobado: 0, rechazado: 0, total: 0 };

  if (status === 'PENDIENTE') prev.pendiente += 1;

  else if (status === 'APROBADO') prev.aprobado += 1;

  else if (status === 'RECHAZADO') prev.rechazado += 1;

  prev.total += 1;

  map.set(invoiceId, prev);

}



function resolverEstadoLogistica(params: {

  invId: string | undefined;

  enAlmacen: boolean;

  conteos: LogisticaConteos | undefined;

  rechazoTotalDb: boolean;

}): EstadoLogisticaCompra {

  const { invId, enAlmacen, conteos, rechazoTotalDb } = params;



  if (!invId) return 'sin_documento';



  if (rechazoTotalDb && !enAlmacen) return 'rechazo_cuarentena';



  const pendiente = conteos?.pendiente ?? 0;

  const total = conteos?.total ?? 0;



  if (pendiente > 0 && enAlmacen) return 'en_almacen_parcial';

  if (pendiente > 0) return 'cuarentena';

  if (enAlmacen) return 'en_almacen';

  if (total > 0 && conteos && conteos.rechazado === total) return 'rechazo_cuarentena';



  return 'registrada';

}



/** Resuelve estado logístico por lote (inspecciones + compras_facturas + flag rechazo). */

export async function enriquecerComprasEstadoLogistica(

  supabase: SupabaseClient,

  compras: CompraListaUnificada[],

): Promise<CompraListaUnificada[]> {

  if (!compras.length) return compras;



  const invoiceIds = Array.from(

    new Set(

      compras

        .map((c) => c.purchase_invoice_id)

        .filter((id): id is string => Boolean(id?.trim())),

    ),

  );



  const enAlmacenSet = new Set<string>();

  const conteosMap: ConteosPorInvoice = new Map();

  const rechazoTotalSet = new Set<string>();



  if (invoiceIds.length) {

    const slice = invoiceIds.slice(0, 400);

    const [inspeccionesRes, facturasRes, comprasContResRaw] = await Promise.all([

      supabase

        .from('quality_inspections')

        .select('invoice_id, status')

        .in('invoice_id', slice),

      supabase

        .from('compras_facturas')

        .select('purchase_invoice_id')

        .in('purchase_invoice_id', slice),

      supabase

        .from('contabilidad_compras')

        .select('purchase_invoice_id, cuarentena_rechazo_total')

        .in('purchase_invoice_id', slice),

    ]);

    let comprasContData: Array<{
      purchase_invoice_id: string;
      cuarentena_rechazo_total?: boolean;
    }> | null = comprasContResRaw.data as Array<{
      purchase_invoice_id: string;
      cuarentena_rechazo_total?: boolean;
    }> | null;
    if (
      comprasContResRaw.error &&
      /cuarentena_rechazo_total|42703|schema cache/i.test(comprasContResRaw.error.message ?? '')
    ) {
      const fallback = await supabase
        .from('contabilidad_compras')
        .select('purchase_invoice_id')
        .in('purchase_invoice_id', slice);
      comprasContData = fallback.data as Array<{
        purchase_invoice_id: string;
        cuarentena_rechazo_total?: boolean;
      }> | null;
    }



    for (const row of inspeccionesRes.data ?? []) {

      const id = String((row as { invoice_id: string }).invoice_id ?? '').trim();

      const status = String((row as { status: string }).status ?? '');

      if (id) acumularConteo(conteosMap, id, status);

    }

    for (const row of facturasRes.data ?? []) {

      const id = String(

        (row as { purchase_invoice_id: string | null }).purchase_invoice_id ?? '',

      ).trim();

      if (id) enAlmacenSet.add(id);

    }

    for (const row of comprasContData ?? []) {

      const id = String((row as { purchase_invoice_id: string }).purchase_invoice_id ?? '').trim();

      if (id && (row as { cuarentena_rechazo_total?: boolean }).cuarentena_rechazo_total) {

        rechazoTotalSet.add(id);

      }

    }

  }



  return compras.map((c) => {

    const invId = c.purchase_invoice_id?.trim();

    const conteos = invId ? conteosMap.get(invId) : undefined;

    const ingresadoContabilidad = Boolean(

      c.ingresado_almacen_at?.trim() || c.compra_factura_id?.trim(),

    );

    const estado_logistica = resolverEstadoLogistica({

      invId,

      enAlmacen:

        Boolean(invId && enAlmacenSet.has(invId)) || ingresadoContabilidad,

      conteos,

      rechazoTotalDb: Boolean(invId && rechazoTotalSet.has(invId)),

    });



    return {

      ...c,

      estado_logistica,

      logistica_conteos: conteos ?? null,

    };

  });

}

