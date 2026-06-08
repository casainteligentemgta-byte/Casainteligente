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

/**
 * POST /api/contabilidad/compras
 * Registra una compra en contabilidad_compras con validación bimonetaria estricta.
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
      const { data: existente } = await supabase
        .from('contabilidad_compras')
        .select('id')
        .eq('purchase_invoice_id', purchaseInvoiceId)
        .maybeSingle();

      if (existente?.id) {
        return NextResponse.json(
          {
            error: 'Ya existe un registro contable para esta factura de recepción.',
            hint: `compra_id: ${existente.id}`,
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

    const { data: compra, error: compraError } = await supabase
      .from('contabilidad_compras')
      .insert({
        purchase_invoice_id: purchaseInvoiceId,
        proyecto_id: gastoEntidad ? null : proyectoId,
        imputacion: gastoEntidad ? IMPUTACION_ENTIDAD : IMPUTACION_OBRA,
        ...(entidadId ? { entidad_id: entidadId } : {}),
        invoice_number: invoiceNumber,
        supplier_rif: supplierRif,
        supplier_name: supplierName,
        fecha,
        total_amount: validacion.montoVes,
        monto_ves: validacion.montoVes,
        monto_usd: validacion.montoUsd,
        total_amount_usd: validacion.montoUsd,
        tasa_bcv_ves_por_usd: validacion.tasaBcvFecha,
        moneda: monedaOriginal,
        moneda_original: monedaOriginal,
        origen: body.origen?.trim() || 'LIBRO_COMPRAS',
        estado: 'REGISTRADA',
        notas: body.notas ?? null,
        document_storage_path: body.document_storage_path ?? null,
        document_file_name: body.document_file_name ?? null,
      })
      .select('id')
      .single();

    if (compraError) {
      const hint = /monto_ves|tasa_bcv|moneda_original/i.test(compraError.message)
        ? 'Ejecuta las migraciones 144 y 148 en Supabase y recarga el schema.'
        : compraError.message;
      return NextResponse.json(
        { error: `No se pudo registrar la compra: ${compraError.message}`, hint },
        { status: 500 },
      );
    }

    const lineas = Array.isArray(body.lineas) ? body.lineas : [];
    if (lineas.length > 0) {
      const lineRows = lineas.map((l) => {
        const cantidad = parseMontoBimonetario(l.cantidad) ?? 0;
        const precioUnitario = parseMontoBimonetario(l.precio_unitario) ?? 0;
        const subtotal =
          parseMontoBimonetario(l.subtotal) ?? cantidad * precioUnitario;
        return {
          compra_id: compra.id,
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

      const { error: lineasError } = await supabase
        .from('contabilidad_compra_lineas')
        .insert(lineRows);

      if (lineasError) {
        await supabase.from('contabilidad_compras').delete().eq('id', compra.id);
        return NextResponse.json(
          {
            error: `Compra creada pero falló el detalle: ${lineasError.message}`,
            hint: 'Revisa lineas[] (descripcion, cantidad, precio_unitario).',
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      ok: true,
      id: compra.id,
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
