import type { SupabaseClient } from '@supabase/supabase-js';

export type LineaConteoRecepcion = {
  material_id: string;
  cantidad: number;
  unidad?: string | null;
  descripcion?: string | null;
};

export type RegistrarRecepcionCampoDesdeConteoInput = {
  proyectoId: string;
  ubicacionId: string;
  pendienteCanalId?: string | null;
  purchaseInvoiceId?: string | null;
  proveedorNombre?: string | null;
  numDoc?: string | null;
  soporteStoragePath?: string | null;
  lineas: LineaConteoRecepcion[];
  observaciones?: string | null;
};

/**
 * Deja constancia del conteo del depositario en ci_recepciones_campo **sin** volver a
 * sumar stock. El stock ya lo aplicó el pipeline de compras (cuarentena / compras_facturas).
 * Idempotente por factura_canal_pendiente_id.
 */
export async function registrarRecepcionCampoDesdeConteo(
  supabase: SupabaseClient,
  input: RegistrarRecepcionCampoDesdeConteoInput,
): Promise<{ ok: true; recepcionId: string; yaExistia?: boolean } | { ok: false; error: string }> {
  const proyectoId = input.proyectoId.trim();
  const ubicacionId = input.ubicacionId.trim();
  if (!proyectoId || !ubicacionId) {
    return { ok: false, error: 'Falta obra o almacén para registrar la recepción de campo.' };
  }

  const lineas = input.lineas.filter(
    (l) => l.material_id?.trim() && Number(l.cantidad) > 0,
  );
  if (!lineas.length) {
    return { ok: false, error: 'No hay cantidades recibidas para documentar.' };
  }

  const pendienteId = input.pendienteCanalId?.trim() || null;
  if (pendienteId) {
    const { data: previa, error: prevErr } = await supabase
      .from('ci_recepciones_campo')
      .select('id')
      .eq('factura_canal_pendiente_id', pendienteId)
      .maybeSingle();
    if (!prevErr && previa?.id) {
      return { ok: true, recepcionId: String(previa.id), yaExistia: true };
    }
  }

  const row: Record<string, unknown> = {
    proyecto_id: proyectoId,
    ubicacion_id: ubicacionId,
    proveedor_nombre: (input.proveedorNombre ?? '').trim() || 'Proveedor',
    tipo: 'factura_canal',
    num_doc: (input.numDoc ?? '').trim() || 'S/N',
    estado: 'registrado',
    observaciones:
      input.observaciones?.trim() ||
      'Conteo del depositario (Telegram /ingreso). Stock ya ingresado por compras; sin duplicar.',
    soporte_storage_path: input.soporteStoragePath?.trim() || null,
    factura_canal_pendiente_id: pendienteId,
    contabilidad_sync_pendiente: false,
    contabilidad_sync_at: new Date().toISOString(),
  };

  const { data: rec, error: recErr } = await supabase
    .from('ci_recepciones_campo')
    .insert(row)
    .select('id')
    .single();

  if (recErr) {
    if (pendienteId && /factura_canal_pendiente_id|23505/i.test(recErr.message ?? '')) {
      const { data: race } = await supabase
        .from('ci_recepciones_campo')
        .select('id')
        .eq('factura_canal_pendiente_id', pendienteId)
        .maybeSingle();
      if (race?.id) return { ok: true, recepcionId: String(race.id), yaExistia: true };
    }
    return { ok: false, error: recErr.message };
  }

  const recepcionId = String((rec as { id: string }).id);
  const detalle = lineas.map((l, i) => ({
    recepcion_id: recepcionId,
    material_id: l.material_id.trim(),
    cantidad: Number(l.cantidad),
    unidad: (l.unidad ?? 'UND').trim() || 'UND',
    descripcion: (l.descripcion ?? '').trim() || 'Material',
    observaciones: 'Conteo Telegram /ingreso',
    forma_ingreso: 'con_factura',
    orden: i,
  }));

  const { error: lnErr } = await supabase.from('ci_recepciones_campo_lineas').insert(detalle);
  if (lnErr) {
    return { ok: false, error: `Recepción creada pero falló el detalle: ${lnErr.message}` };
  }

  return { ok: true, recepcionId };
}

async function nombresMateriales(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, { nombre: string; unidad: string }>> {
  if (!ids.length) return new Map();
  const { data } = await supabase
    .from('global_inventory')
    .select('id, name, unit')
    .in('id', ids.slice(0, 200));
  return new Map(
    (data ?? []).map((r) => [
      String(r.id),
      {
        nombre: String(r.name ?? 'Material'),
        unidad: String(r.unit ?? 'UND'),
      },
    ]),
  );
}

/**
 * Tras un ingreso por factura precargada: documenta el conteo en ci_recepciones_campo.
 * No falla el ingreso si la recepción no se puede escribir.
 */
export async function documentarConteoDepositarioTrasIngresoCanal(
  supabase: SupabaseClient,
  pendingId: string,
  opts?: {
    purchaseInvoiceId?: string;
    cantidadesRecibidas?: Array<{ material_id: string; cantidad: number }>;
    documentoStoragePath?: string | null;
  },
): Promise<void> {
  const id = pendingId.trim();
  if (!id) return;

  let proyectoId = '';
  let ubicacionId = '';
  let proveedor = '';
  let numDoc = '';
  let pendienteCanalId: string | null = null;

  const { data: canal } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('id, proyecto_id, ubicacion_destino_id, purchase_invoice_id')
    .eq('id', id)
    .maybeSingle();

  if (canal?.id) {
    pendienteCanalId = String(canal.id);
    proyectoId = String(canal.proyecto_id ?? '').trim();
    ubicacionId = String(canal.ubicacion_destino_id ?? '').trim();
  }

  const purchaseInvoiceId = String(
    opts?.purchaseInvoiceId?.trim() || canal?.purchase_invoice_id || '',
  ).trim();

  if (purchaseInvoiceId) {
    const { data: compra } = await supabase
      .from('contabilidad_compras')
      .select('proyecto_id, ubicacion_destino_id, supplier_name, invoice_number')
      .eq('purchase_invoice_id', purchaseInvoiceId)
      .maybeSingle();
    if (!proyectoId) proyectoId = String(compra?.proyecto_id ?? '').trim();
    if (!ubicacionId) ubicacionId = String(compra?.ubicacion_destino_id ?? '').trim();
    proveedor = String(compra?.supplier_name ?? '').trim();
    numDoc = String(compra?.invoice_number ?? '').trim();
  }

  if (!proyectoId || !ubicacionId) return;

  let lineas: LineaConteoRecepcion[] = (opts?.cantidadesRecibidas ?? [])
    .filter((l) => l.material_id?.trim() && Number(l.cantidad) > 0)
    .map((l) => ({ material_id: l.material_id.trim(), cantidad: Number(l.cantidad) }));

  if (!lineas.length && purchaseInvoiceId) {
    const { data: cf } = await supabase
      .from('compras_facturas')
      .select('id')
      .eq('purchase_invoice_id', purchaseInvoiceId)
      .maybeSingle();
    if (cf?.id) {
      const { data: ln } = await supabase
        .from('compras_factura_lineas')
        .select('material_id, cantidad, descripcion')
        .eq('factura_id', cf.id);
      lineas = (ln ?? [])
        .map((r) => ({
          material_id: String(r.material_id ?? ''),
          cantidad: Number(r.cantidad) || 0,
          descripcion: String(r.descripcion ?? ''),
        }))
        .filter((l) => l.material_id && l.cantidad > 0);
    }
  }

  if (!lineas.length) return;

  const nombres = await nombresMateriales(
    supabase,
    lineas.map((l) => l.material_id),
  );
  const conNombre = lineas.map((l) => {
    const n = nombres.get(l.material_id);
    return {
      ...l,
      descripcion: l.descripcion || n?.nombre || 'Material',
      unidad: l.unidad || n?.unidad || 'UND',
    };
  });

  const r = await registrarRecepcionCampoDesdeConteo(supabase, {
    proyectoId,
    ubicacionId,
    pendienteCanalId,
    purchaseInvoiceId: purchaseInvoiceId || null,
    proveedorNombre: proveedor,
    numDoc,
    soporteStoragePath: opts?.documentoStoragePath,
    lineas: conNombre,
  });
  if (!r.ok) {
    console.warn('[ingreso canal] no se documentó ci_recepciones_campo:', r.error);
  }
}
