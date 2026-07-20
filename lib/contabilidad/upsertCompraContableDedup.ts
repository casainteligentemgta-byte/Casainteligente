import type { SupabaseClient } from '@supabase/supabase-js';
import { hashLlaveNaturalCompra } from '@/lib/contabilidad/compraDedupHash';
import { IMPUTACION_ENTIDAD, IMPUTACION_OBRA } from '@/lib/contabilidad/imputacionCompra';

export type LineaUpsertCompra = {
  descripcion?: string;
  item_code?: string | null;
  unidad?: string;
  cantidad?: number;
  precio_unitario?: number;
  subtotal?: number;
  purchase_detail_id?: string | null;
  material_id?: string | null;
};

export type UpsertCompraDedupInput = {
  purchase_invoice_id?: string | null;
  proyecto_id: string | null;
  entidad_id?: string | null;
  imputacion: typeof IMPUTACION_ENTIDAD | typeof IMPUTACION_OBRA;
  invoice_number: string;
  supplier_rif: string;
  supplier_name: string;
  fecha: string;
  monto_ves: number;
  monto_usd: number;
  tasa_bcv_ves_por_usd: number;
  moneda_original: string;
  origen: string;
  notas?: string | null;
  document_storage_path?: string | null;
  document_file_name?: string | null;
  lineas?: LineaUpsertCompra[];
  /** Si true: actualiza existente con mismo hash. Si false: 409. */
  upsert: boolean;
  /** Metadatos CCO V4 (migración 269). Ignorados si columnas no existen. */
  cco?: {
    tipo_gasto_cco?: string | null;
    contrato_obra_id?: string | null;
    admin_pct_override?: number | null;
    honorarios_usd?: number | null;
    capitulo_cco?: string | null;
    subcapitulo_cco?: string | null;
    tasa_binance?: number | null;
    tasa_usada?: string | null;
    porcentaje_brecha_real?: number | null;
    forma_pago_cco?: string | null;
    origen_v4_id?: number | null;
    cco_estado?: string | null;
  };
};

export type UpsertCompraDedupResult =
  | { ok: true; id: string; action: 'created' | 'updated'; dedup_hash: string }
  | { ok: false; status: number; error: string; hint?: string; id?: string };

function mapLineas(compraId: string, lineas: LineaUpsertCompra[]) {
  return lineas.map((l) => {
    const cantidad = Number(l.cantidad) || 0;
    const precioUnitario = Number(l.precio_unitario) || 0;
    const subtotal =
      l.subtotal != null && Number.isFinite(Number(l.subtotal))
        ? Number(l.subtotal)
        : cantidad * precioUnitario;
    return {
      compra_id: compraId,
      purchase_detail_id: l.purchase_detail_id ?? null,
      material_id: l.material_id ?? null,
      descripcion: (l.descripcion ?? 'Ítem').trim() || 'Ítem',
      item_code: l.item_code?.trim() || null,
      unidad: (l.unidad ?? 'UND').trim() || 'UND',
      cantidad,
      precio_unitario: precioUnitario,
      subtotal,
    };
  });
}

async function reemplazarLineas(
  supabase: SupabaseClient,
  compraId: string,
  lineas: LineaUpsertCompra[],
): Promise<string | null> {
  if (!lineas.length) return null;
  await supabase.from('contabilidad_compra_lineas').delete().eq('compra_id', compraId);
  const { error } = await supabase.from('contabilidad_compra_lineas').insert(mapLineas(compraId, lineas));
  return error?.message ?? null;
}

/**
 * Inserta o actualiza compra contable usando dedup_hash (SHA-256 llave natural).
 */
export async function upsertCompraContableDedup(
  supabase: SupabaseClient,
  input: UpsertCompraDedupInput,
): Promise<UpsertCompraDedupResult> {
  const gastoEntidad = input.imputacion === IMPUTACION_ENTIDAD;
  const proyectoId = gastoEntidad ? null : input.proyecto_id;

  const dedup_hash = hashLlaveNaturalCompra({
    fecha: input.fecha,
    invoice_number: input.invoice_number,
    supplier_rif: input.supplier_rif,
    supplier_name: input.supplier_name,
    monto_usd: input.monto_usd,
    monto_ves: input.monto_ves,
    proyecto_id: proyectoId,
  });

  let existente: { id: string } | null = null;
  const { data: byHash, error: findErr } = await supabase
    .from('contabilidad_compras')
    .select('id')
    .eq('dedup_hash', dedup_hash)
    .maybeSingle();

  if (findErr && !/dedup_hash|42703|PGRST204|schema cache/i.test(findErr.message)) {
    return { ok: false, status: 500, error: findErr.message };
  }

  const sinColumnaHash = Boolean(
    findErr && /dedup_hash|42703|PGRST204|schema cache/i.test(findErr.message),
  );
  if (byHash?.id) existente = { id: String(byHash.id) };

  // Reimport CSV/SQLite: misma obra + origen_v4_id (aunque cambie invoice/hash).
  if (!existente && input.cco?.origen_v4_id != null && proyectoId) {
    const { data: byV4 } = await supabase
      .from('contabilidad_compras')
      .select('id')
      .eq('proyecto_id', proyectoId)
      .eq('origen_v4_id', input.cco.origen_v4_id)
      .maybeSingle();
    if (byV4?.id) existente = { id: String(byV4.id) };
  }

  const rowBase: Record<string, unknown> = {
    purchase_invoice_id: input.purchase_invoice_id ?? null,
    proyecto_id: proyectoId,
    imputacion: input.imputacion,
    ...(input.entidad_id ? { entidad_id: input.entidad_id } : {}),
    invoice_number: input.invoice_number,
    supplier_rif: input.supplier_rif,
    supplier_name: input.supplier_name,
    fecha: input.fecha,
    total_amount: input.monto_ves,
    monto_ves: input.monto_ves,
    monto_usd: input.monto_usd,
    total_amount_usd: input.monto_usd,
    tasa_bcv_ves_por_usd: input.tasa_bcv_ves_por_usd,
    moneda: input.moneda_original,
    moneda_original: input.moneda_original,
    origen: input.origen,
    estado: 'REGISTRADA',
    notas: input.notas ?? null,
    document_storage_path: input.document_storage_path ?? null,
    document_file_name: input.document_file_name ?? null,
    updated_at: new Date().toISOString(),
  };

  if (!sinColumnaHash) {
    rowBase.dedup_hash = dedup_hash;
  }

  if (input.cco) {
    const c = input.cco;
    if (c.tipo_gasto_cco != null) rowBase.tipo_gasto_cco = c.tipo_gasto_cco;
    if (c.contrato_obra_id !== undefined) rowBase.contrato_obra_id = c.contrato_obra_id;
    if (c.admin_pct_override !== undefined) rowBase.admin_pct_override = c.admin_pct_override;
    if (c.honorarios_usd !== undefined) rowBase.honorarios_usd = c.honorarios_usd;
    if (c.capitulo_cco != null) rowBase.capitulo_cco = c.capitulo_cco;
    if (c.subcapitulo_cco != null) rowBase.subcapitulo_cco = c.subcapitulo_cco;
    if (c.tasa_binance !== undefined) rowBase.tasa_binance = c.tasa_binance;
    if (c.tasa_usada != null) rowBase.tasa_usada = c.tasa_usada;
    if (c.porcentaje_brecha_real !== undefined) {
      rowBase.porcentaje_brecha_real = c.porcentaje_brecha_real;
    }
    if (c.forma_pago_cco != null) rowBase.forma_pago_cco = c.forma_pago_cco;
    if (c.origen_v4_id !== undefined) rowBase.origen_v4_id = c.origen_v4_id;
    if (c.cco_estado != null) rowBase.cco_estado = c.cco_estado;
  }

  if (existente?.id) {
    if (!input.upsert) {
      return {
        ok: false,
        status: 409,
        error: 'Compra duplicada (misma llave natural).',
        hint: `dedup_hash ya existe · compra_id: ${existente.id}`,
        id: String(existente.id),
      };
    }

    const { error: updErr } = await supabase
      .from('contabilidad_compras')
      .update(rowBase)
      .eq('id', existente.id);

    if (updErr) {
      return { ok: false, status: 500, error: updErr.message };
    }

    const lineErr = await reemplazarLineas(supabase, String(existente.id), input.lineas ?? []);
    if (lineErr) {
      return {
        ok: false,
        status: 500,
        error: `Actualizada la cabecera pero falló el detalle: ${lineErr}`,
        id: String(existente.id),
      };
    }

    return { ok: true, id: String(existente.id), action: 'updated', dedup_hash };
  }

  const { data: compra, error: compraError } = await supabase
    .from('contabilidad_compras')
    .insert(rowBase)
    .select('id')
    .single();

  if (compraError) {
    if (/uq_contabilidad_compras_dedup_hash|dedup_hash|duplicate key/i.test(compraError.message)) {
      if (!input.upsert) {
        return {
          ok: false,
          status: 409,
          error: 'Compra duplicada (restricción única en BD).',
          hint: compraError.message,
        };
      }
      const { data: race } = await supabase
        .from('contabilidad_compras')
        .select('id')
        .eq('dedup_hash', dedup_hash)
        .maybeSingle();
      if (race?.id) {
        await supabase.from('contabilidad_compras').update(rowBase).eq('id', race.id);
        await reemplazarLineas(supabase, String(race.id), input.lineas ?? []);
        return { ok: true, id: String(race.id), action: 'updated', dedup_hash };
      }
    }

    const hint = /dedup_hash/i.test(compraError.message)
      ? 'Ejecuta la migración 268_contabilidad_compras_dedup_hash.sql en Supabase.'
      : /monto_ves|tasa_bcv|moneda_original/i.test(compraError.message)
        ? 'Ejecuta las migraciones 144/148 y recarga el schema.'
        : undefined;
    return {
      ok: false,
      status: 500,
      error: `No se pudo registrar la compra: ${compraError.message}`,
      hint,
    };
  }

  const lineErr = await reemplazarLineas(supabase, String(compra.id), input.lineas ?? []);
  if (lineErr) {
    await supabase.from('contabilidad_compras').delete().eq('id', compra.id);
    return {
      ok: false,
      status: 500,
      error: `Compra creada pero falló el detalle: ${lineErr}`,
      hint: 'Revisa lineas[] (descripcion, cantidad, precio_unitario).',
    };
  }

  return { ok: true, id: String(compra.id), action: 'created', dedup_hash };
}
