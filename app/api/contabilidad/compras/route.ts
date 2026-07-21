import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { obtenerTasaBcvConfigNominaGlobal } from '@/lib/contabilidad/tasaBcvConfigNomina';
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
import { upsertCompraContableDedup } from '@/lib/contabilidad/upsertCompraContableDedup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LineaCompraBody = {
  descripcion?: string;
  item_code?: string | null;
  unidad?: string;
  cantidad?: number | string;
  precio_unitario?: number | string;
  subtotal?: number | string;
  purchase_detail_id?: string | null;
  material_id?: string | null;
};

type CompraInsertBody = {
  purchase_invoice_id?: string | null;
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
  /** Alias legacy / columna BD */
  tasa_bcv_ves_por_usd?: number | string;
  moneda_original?: string;
  origen?: string;
  notas?: string | null;
  document_storage_path?: string | null;
  document_file_name?: string | null;
  lineas?: LineaCompraBody[];
  /**
   * Upsert por llave natural (hash). Por defecto true en HISTORICO_*.
   * false → rechaza duplicado con 409.
   */
  upsert_dedup?: boolean;
  /** Metadatos CCO V4 (maestro / import CSV). */
  cco?: {
    tipo_gasto_cco?: string | null;
    capitulo_cco?: string | null;
    subcapitulo_cco?: string | null;
    honorarios_usd?: number | null;
    admin_pct_override?: number | null;
    cco_estado?: string | null;
    monto_pagado_usd?: number | null;
    porcentaje_brecha_real?: number | null;
    tasa_binance?: number | null;
    tasa_usada?: string | null;
    forma_pago_cco?: string | null;
  };
};

function extraerTasaCliente(body: CompraInsertBody): number | null {
  const raw = body.tasa_bcv_fecha ?? body.tasa_bcv_ves_por_usd;
  const tasa = parseMontoBimonetario(raw);
  return tasa != null && tasa > 0 ? tasa : null;
}

function normalizarFecha(fecha?: string): string {
  const s = (fecha ?? '').trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date().toISOString().slice(0, 10);
}

function origenHistorico(origen: string): boolean {
  return /^HISTORICO_/i.test(origen);
}

/**
 * POST /api/contabilidad/compras
 * Registra una compra en contabilidad_compras con validación bimonetaria y anti-duplicados (hash).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CompraInsertBody;

    const imputacion = parseImputacionCompra(body.imputacion);
    const gastoEntidad = imputacion === IMPUTACION_ENTIDAD;
    const proyectoId = body.proyecto_id?.trim() || null;
    const entidadIdBody = body.entidad_id?.trim() || null;
    const invoiceNumber = body.invoice_number?.trim();
    const supplierRif = body.supplier_rif?.trim();
    const supplierName = body.supplier_name?.trim();
    const fecha = normalizarFecha(body.fecha);
    const origen = body.origen?.trim() || 'LIBRO_COMPRAS';

    if (!gastoEntidad && !proyectoId) {
      return NextResponse.json(
        {
          error: 'El campo proyecto_id es obligatorio para compras de obra.',
          hint: 'Use imputacion: "entidad" para gastos del patrono sin proyecto.',
        },
        { status: 400 },
      );
    }
    if (!invoiceNumber) {
      return NextResponse.json(
        {
          error: 'El campo invoice_number es obligatorio.',
          hint: 'Indica el número de factura del proveedor.',
        },
        { status: 400 },
      );
    }
    if (!supplierRif || !supplierName) {
      return NextResponse.json(
        {
          error: 'Proveedor incompleto.',
          hint: 'Envía supplier_rif y supplier_name.',
        },
        { status: 400 },
      );
    }

    const montoVes = parseMontoBimonetario(body.monto_ves);
    const montoUsd = parseMontoBimonetario(body.monto_usd);

    const supabase = await createClient();

    let tasaBcvFecha = extraerTasaCliente(body);
    let tasaFuente: 'cliente' | 'ci_config_nomina' = 'cliente';

    if (tasaBcvFecha == null) {
      const configTasa = await obtenerTasaBcvConfigNominaGlobal(supabase);
      if (configTasa) {
        tasaBcvFecha = configTasa.tasa_bcv_ves_por_usd;
        tasaFuente = 'ci_config_nomina';
      }
    }

    const validacion = validarMontosCompraBimonetarios({
      montoVes,
      montoUsd,
      tasaBcvFecha,
      tasaFuente,
    });

    if (!validacion.ok) {
      return NextResponse.json(
        { error: validacion.error, hint: validacion.hint },
        { status: 400 },
      );
    }

    const monedaOriginal =
      String(body.moneda_original ?? 'VES')
        .trim()
        .toUpperCase() === 'USD'
        ? 'USD'
        : 'VES';

    const purchaseInvoiceId = body.purchase_invoice_id?.trim() || null;

    if (purchaseInvoiceId) {
      const { data: existentePi } = await supabase
        .from('contabilidad_compras')
        .select('id')
        .eq('purchase_invoice_id', purchaseInvoiceId)
        .maybeSingle();

      if (existentePi?.id) {
        return NextResponse.json(
          {
            error: 'Ya existe un registro contable para esta factura de recepción.',
            hint: `compra_id: ${existentePi.id}`,
          },
          { status: 409 },
        );
      }
    }

    let entidadId = entidadIdBody;
    if (!entidadId && proyectoId) {
      entidadId = (await resolverEntidadIdDesdeProyecto(supabase, proyectoId)) ?? null;
    }
    if (gastoEntidad && !entidadId) {
      return NextResponse.json(
        { error: 'entidad_id requerido para imputacion entidad' },
        { status: 400 },
      );
    }

    const upsert =
      body.upsert_dedup !== undefined
        ? Boolean(body.upsert_dedup)
        : origenHistorico(origen);

    const lineas = Array.isArray(body.lineas)
      ? body.lineas.map((l) => ({
          descripcion: l.descripcion,
          item_code: l.item_code,
          unidad: l.unidad,
          cantidad: parseMontoBimonetario(l.cantidad) ?? 0,
          precio_unitario: parseMontoBimonetario(l.precio_unitario) ?? 0,
          subtotal: parseMontoBimonetario(l.subtotal) ?? undefined,
          purchase_detail_id: l.purchase_detail_id,
          material_id: l.material_id,
        }))
      : [];

    const result = await upsertCompraContableDedup(supabase, {
      purchase_invoice_id: purchaseInvoiceId,
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
      notas: body.notas ?? null,
      document_storage_path: body.document_storage_path ?? null,
      document_file_name: body.document_file_name ?? null,
      lineas,
      upsert,
      cco: body.cco
        ? {
            tipo_gasto_cco: body.cco.tipo_gasto_cco ?? null,
            capitulo_cco: body.cco.capitulo_cco ?? null,
            subcapitulo_cco: body.cco.subcapitulo_cco ?? null,
            honorarios_usd:
              body.cco.honorarios_usd != null ? Number(body.cco.honorarios_usd) : null,
            admin_pct_override:
              body.cco.admin_pct_override != null ? Number(body.cco.admin_pct_override) : null,
            cco_estado: body.cco.cco_estado ?? null,
            monto_pagado_usd:
              body.cco.monto_pagado_usd != null ? Number(body.cco.monto_pagado_usd) : null,
            porcentaje_brecha_real:
              body.cco.porcentaje_brecha_real != null
                ? Number(body.cco.porcentaje_brecha_real)
                : null,
            tasa_binance:
              body.cco.tasa_binance != null ? Number(body.cco.tasa_binance) : null,
            tasa_usada: body.cco.tasa_usada ?? null,
            forma_pago_cco: body.cco.forma_pago_cco ?? null,
          }
        : undefined,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, hint: result.hint, id: result.id },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ok: true,
      id: result.id,
      action: result.action,
      dedup_hash: result.dedup_hash,
      monto_ves: validacion.montoVes,
      monto_usd: validacion.montoUsd,
      tasa_bcv_fecha: validacion.tasaBcvFecha,
      tasa_fuente: validacion.tasaFuente,
      fecha,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al registrar la compra.';
    console.error('[POST /api/contabilidad/compras]', err);
    return NextResponse.json(
      {
        error: message,
        hint: 'Revisa el body JSON y la conexión a Supabase.',
      },
      { status: 500 },
    );
  }
}
