import type { SupabaseClient } from '@supabase/supabase-js';
import { hashLlaveNaturalCompra } from '@/lib/contabilidad/compraDedupHash';
import { IMPUTACION_ENTIDAD } from '@/lib/contabilidad/imputacionCompra';
import type {
  LineaUpsertCompra,
  UpsertCompraDedupInput,
  UpsertCompraDedupResult,
} from '@/lib/contabilidad/upsertCompraContableDedup';

export type BatchItemResult = {
  index: number;
  key?: string;
} & UpsertCompraDedupResult;

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

async function fetchExistentesPorHash(
  supabase: SupabaseClient,
  hashes: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const CHUNK = 120;
  for (let i = 0; i < hashes.length; i += CHUNK) {
    const slice = hashes.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('contabilidad_compras')
      .select('id, dedup_hash')
      .in('dedup_hash', slice);
    if (error) {
      if (/dedup_hash|42703|PGRST204|schema cache/i.test(error.message)) {
        return map;
      }
      throw new Error(error.message);
    }
    for (const row of data ?? []) {
      const h = (row as { dedup_hash?: string }).dedup_hash;
      const id = (row as { id?: string }).id;
      if (h && id) map.set(h, String(id));
    }
  }
  return map;
}

function buildRow(input: UpsertCompraDedupInput, dedup_hash: string): Record<string, unknown> {
  const gastoEntidad = input.imputacion === IMPUTACION_ENTIDAD;
  const proyectoId = gastoEntidad ? null : input.proyecto_id;
  const row: Record<string, unknown> = {
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
    dedup_hash,
    updated_at: new Date().toISOString(),
  };
  return row;
}

/**
 * Upsert masivo optimizado para import CSV:
 * 1 lookup de hashes en lote → inserts/updates en chunks → líneas en bulk.
 */
export async function upsertComprasContablesBatch(
  supabase: SupabaseClient,
  items: Array<UpsertCompraDedupInput & { clientKey?: string }>,
): Promise<BatchItemResult[]> {
  if (!items.length) return [];

  const prepared = items.map((input, index) => {
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
    return { index, input, dedup_hash, clientKey: input.clientKey };
  });

  const existentes = await fetchExistentesPorHash(
    supabase,
    prepared.map((p) => p.dedup_hash),
  );

  const results: BatchItemResult[] = new Array(items.length);
  const toInsert: typeof prepared = [];
  const toUpdate: Array<(typeof prepared)[0] & { id: string }> = [];

  for (const p of prepared) {
    const id = existentes.get(p.dedup_hash);
    if (id) {
      if (!p.input.upsert) {
        results[p.index] = {
          index: p.index,
          key: p.clientKey,
          ok: false,
          status: 409,
          error: 'Compra duplicada (misma llave natural).',
          hint: `dedup_hash ya existe · compra_id: ${id}`,
          id,
        };
        continue;
      }
      toUpdate.push({ ...p, id });
    } else {
      toInsert.push(p);
    }
  }

  const INSERT_CHUNK = 40;
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK);
    const rows = chunk.map((p) => buildRow(p.input, p.dedup_hash));
    const { data, error } = await supabase
      .from('contabilidad_compras')
      .insert(rows)
      .select('id, dedup_hash');

    if (error) {
      // Fallback: si el bulk falla (p.ej. carrera), marca error por ítem
      for (const p of chunk) {
        results[p.index] = {
          index: p.index,
          key: p.clientKey,
          ok: false,
          status: 500,
          error: `No se pudo registrar la compra: ${error.message}`,
          hint: /dedup_hash/i.test(error.message)
            ? 'Ejecuta la migración 268_contabilidad_compras_dedup_hash.sql.'
            : undefined,
        };
      }
      continue;
    }

    const byHash = new Map<string, string>();
    for (const row of data ?? []) {
      const h = (row as { dedup_hash?: string }).dedup_hash;
      const id = (row as { id?: string }).id;
      if (h && id) byHash.set(h, String(id));
    }

    for (const p of chunk) {
      const id = byHash.get(p.dedup_hash);
      if (!id) {
        results[p.index] = {
          index: p.index,
          key: p.clientKey,
          ok: false,
          status: 500,
          error: 'Insert OK pero no se devolvió id.',
        };
        continue;
      }
      results[p.index] = {
        index: p.index,
        key: p.clientKey,
        ok: true,
        id,
        action: 'created',
        dedup_hash: p.dedup_hash,
      };
    }
  }

  const UPDATE_CHUNK = 25;
  for (let i = 0; i < toUpdate.length; i += UPDATE_CHUNK) {
    const chunk = toUpdate.slice(i, i + UPDATE_CHUNK);
    await Promise.all(
      chunk.map(async (p) => {
        const { error } = await supabase
          .from('contabilidad_compras')
          .update(buildRow(p.input, p.dedup_hash))
          .eq('id', p.id);
        if (error) {
          results[p.index] = {
            index: p.index,
            key: p.clientKey,
            ok: false,
            status: 500,
            error: error.message,
            id: p.id,
          };
          return;
        }
        results[p.index] = {
          index: p.index,
          key: p.clientKey,
          ok: true,
          id: p.id,
          action: 'updated',
          dedup_hash: p.dedup_hash,
        };
      }),
    );
  }

  // Líneas: borrar e insertar en bulk por los que salieron OK
  const okWithLines: Array<{ id: string; lineas: LineaUpsertCompra[] }> = [];
  for (const r of results) {
    if (!r || !r.ok) continue;
    const lineas = items[r.index]?.lineas ?? [];
    if (!lineas.length) continue;
    okWithLines.push({ id: r.id, lineas });
  }

  if (okWithLines.length) {
    const ids = okWithLines.map((x) => x.id);
    const DEL_CHUNK = 80;
    for (let i = 0; i < ids.length; i += DEL_CHUNK) {
      const slice = ids.slice(i, i + DEL_CHUNK);
      await supabase.from('contabilidad_compra_lineas').delete().in('compra_id', slice);
    }

    const allLineas = okWithLines.flatMap((x) => mapLineas(x.id, x.lineas));
    const LINE_CHUNK = 200;
    for (let i = 0; i < allLineas.length; i += LINE_CHUNK) {
      const slice = allLineas.slice(i, i + LINE_CHUNK);
      const { error } = await supabase.from('contabilidad_compra_lineas').insert(slice);
      if (error) {
        // No revertimos cabeceras; reportamos en consola (cabecera ya útil en CCO)
        console.error('[upsertComprasContablesBatch] lineas', error.message);
      }
    }
  }

  // Rellenar huecos (no debería haber)
  for (let i = 0; i < results.length; i++) {
    if (!results[i]) {
      results[i] = {
        index: i,
        ok: false,
        status: 500,
        error: 'Sin resultado de batch.',
      };
    }
  }

  return results;
}
