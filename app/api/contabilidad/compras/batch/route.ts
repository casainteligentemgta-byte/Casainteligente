import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  IMPUTACION_ENTIDAD,
  IMPUTACION_OBRA,
  parseImputacionCompra,
} from '@/lib/contabilidad/imputacionCompra';
import { resolverEntidadIdDesdeProyecto } from '@/lib/contabilidad/resolverEntidadProyecto';
import {
  parseMontoBimonetario,
  validarMontosCompraBimonetarios,
} from '@/lib/contabilidad/validarCompraBimonetaria';
import type { UpsertCompraDedupInput } from '@/lib/contabilidad/upsertCompraContableDedup';
import { upsertComprasContablesBatch } from '@/lib/contabilidad/upsertComprasContablesBatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Import CSV grande: más tiempo de CPU en serverless. */
export const maxDuration = 60;

type LineaCompraBody = {
  descripcion?: string;
  item_code?: string | null;
  unidad?: string;
  cantidad?: number | string;
  precio_unitario?: number | string;
  subtotal?: number | string;
};

type CompraBatchItem = {
  key?: string;
  proyecto_id?: string | null;
  entidad_id?: string | null;
  imputacion?: string;
  invoice_number?: string;
  supplier_rif?: string;
  supplier_name?: string;
  fecha?: string;
  monto_ves?: number | string;
  monto_usd?: number | string;
  tasa_bcv_fecha?: number | string;
  tasa_bcv_ves_por_usd?: number | string;
  moneda_original?: string;
  origen?: string;
  notas?: string | null;
  document_storage_path?: string | null;
  document_file_name?: string | null;
  lineas?: LineaCompraBody[];
  upsert_dedup?: boolean;
};

const MAX_BATCH = 80;

function normalizarFecha(fecha?: string): string {
  const s = (fecha ?? '').trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date().toISOString().slice(0, 10);
}

function origenHistorico(origen: string): boolean {
  return /^HISTORICO_/i.test(origen);
}

/**
 * POST /api/contabilidad/compras/batch
 * Body: { compras: CompraBatchItem[] } — hasta 80 por request.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { compras?: CompraBatchItem[] };
    const compras = Array.isArray(body.compras) ? body.compras : [];
    if (!compras.length) {
      return NextResponse.json({ error: 'compras[] vacío' }, { status: 400 });
    }
    if (compras.length > MAX_BATCH) {
      return NextResponse.json(
        { error: `Máximo ${MAX_BATCH} compras por lote`, hint: `Recibido: ${compras.length}` },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Resolver entidad una vez por proyecto (cache)
    const entidadCache = new Map<string, string | null>();
    async function entidadDe(proyectoId: string | null): Promise<string | null> {
      if (!proyectoId) return null;
      if (entidadCache.has(proyectoId)) return entidadCache.get(proyectoId) ?? null;
      const e = (await resolverEntidadIdDesdeProyecto(supabase, proyectoId)) ?? null;
      entidadCache.set(proyectoId, e);
      return e;
    }

    const prepared: Array<{
      originalIndex: number;
      input: UpsertCompraDedupInput & { clientKey?: string };
    } | null> = [];
    const prepErrors: Array<{ index: number; key?: string; error: string; hint?: string }> = [];

    for (let i = 0; i < compras.length; i++) {
      const raw = compras[i]!;
      const imputacion = parseImputacionCompra(raw.imputacion);
      const gastoEntidad = imputacion === IMPUTACION_ENTIDAD;
      const proyectoId = raw.proyecto_id?.trim() || null;
      const invoiceNumber = raw.invoice_number?.trim();
      const supplierRif = raw.supplier_rif?.trim();
      const supplierName = raw.supplier_name?.trim();
      const fecha = normalizarFecha(raw.fecha);
      const origen = raw.origen?.trim() || 'HISTORICO_TABLA';

      if (!gastoEntidad && !proyectoId) {
        prepErrors.push({
          index: i,
          key: raw.key,
          error: 'proyecto_id obligatorio para obra',
        });
        prepared.push(null);
        continue;
      }
      if (!invoiceNumber || !supplierRif || !supplierName) {
        prepErrors.push({
          index: i,
          key: raw.key,
          error: 'Factura/proveedor incompleto',
        });
        prepared.push(null);
        continue;
      }

      const montoVes = parseMontoBimonetario(raw.monto_ves);
      const montoUsd = parseMontoBimonetario(raw.monto_usd);
      const tasaRaw = raw.tasa_bcv_fecha ?? raw.tasa_bcv_ves_por_usd;
      const tasaBcvFecha = parseMontoBimonetario(tasaRaw);
      const validacion = validarMontosCompraBimonetarios({
        montoVes,
        montoUsd,
        tasaBcvFecha: tasaBcvFecha != null && tasaBcvFecha > 0 ? tasaBcvFecha : null,
        tasaFuente: 'cliente',
      });
      if (!validacion.ok) {
        prepErrors.push({
          index: i,
          key: raw.key,
          error: validacion.error,
          hint: validacion.hint,
        });
        prepared.push(null);
        continue;
      }

      let entidadId = raw.entidad_id?.trim() || null;
      if (!entidadId && proyectoId) entidadId = await entidadDe(proyectoId);
      if (gastoEntidad && !entidadId) {
        prepErrors.push({ index: i, key: raw.key, error: 'entidad_id requerido' });
        prepared.push(null);
        continue;
      }

      const monedaOriginal =
        String(raw.moneda_original ?? 'VES').trim().toUpperCase() === 'USD' ? 'USD' : 'VES';

      const upsert =
        raw.upsert_dedup !== undefined ? Boolean(raw.upsert_dedup) : origenHistorico(origen);

      const lineas = Array.isArray(raw.lineas)
        ? raw.lineas.map((l) => ({
            descripcion: l.descripcion,
            item_code: l.item_code,
            unidad: l.unidad,
            cantidad: parseMontoBimonetario(l.cantidad) ?? 0,
            precio_unitario: parseMontoBimonetario(l.precio_unitario) ?? 0,
            subtotal: parseMontoBimonetario(l.subtotal) ?? undefined,
          }))
        : [];

      prepared.push({
        originalIndex: i,
        input: {
          clientKey: raw.key,
          purchase_invoice_id: null,
          proyecto_id: gastoEntidad ? null : proyectoId,
          entidad_id: entidadId,
          imputacion: gastoEntidad ? IMPUTACION_ENTIDAD : IMPUTACION_OBRA,
          invoice_number: invoiceNumber,
          supplier_rif: supplierRif,
          supplier_name: supplierName,
          fecha,
          monto_ves: validacion.montoVes,
          monto_usd: validacion.montoUsd,
          tasa_bcv_ves_por_usd: validacion.tasaBcvFecha,
          moneda_original: monedaOriginal,
          origen,
          notas: raw.notas ?? null,
          document_storage_path: raw.document_storage_path ?? null,
          document_file_name: raw.document_file_name ?? null,
          lineas,
          upsert,
        },
      });
    }

    const validEntries = prepared.filter(
      (p): p is { originalIndex: number; input: UpsertCompraDedupInput & { clientKey?: string } } =>
        Boolean(p),
    );

    const batchResults = validEntries.length
      ? await upsertComprasContablesBatch(
          supabase,
          validEntries.map((e) => e.input),
        )
      : [];

    const out: Array<{
      index: number;
      key?: string;
      ok: boolean;
      action?: string;
      id?: string;
      error?: string;
      hint?: string;
    }> = [];

    for (const err of prepErrors) {
      out.push({
        index: err.index,
        key: err.key,
        ok: false,
        error: err.error,
        hint: err.hint,
      });
    }

    for (let j = 0; j < validEntries.length; j++) {
      const entry = validEntries[j]!;
      const r = batchResults[j];
      if (!r) {
        out.push({
          index: entry.originalIndex,
          key: entry.input.clientKey,
          ok: false,
          error: 'Sin resultado',
        });
        continue;
      }
      if (r.ok) {
        out.push({
          index: entry.originalIndex,
          key: r.key ?? entry.input.clientKey,
          ok: true,
          action: r.action,
          id: r.id,
        });
      } else {
        out.push({
          index: entry.originalIndex,
          key: r.key ?? entry.input.clientKey,
          ok: false,
          error: r.error,
          hint: r.hint,
          id: r.id,
        });
      }
    }

    out.sort((a, b) => a.index - b.index);

    const created = out.filter((x) => x.ok && x.action === 'created').length;
    const updated = out.filter((x) => x.ok && x.action === 'updated').length;
    const failed = out.filter((x) => !x.ok).length;

    return NextResponse.json({
      ok: true,
      total: out.length,
      created,
      updated,
      failed,
      results: out,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error en batch de compras.';
    console.error('[POST /api/contabilidad/compras/batch]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
