import type { SupabaseClient } from '@supabase/supabase-js';
/**
 * Confirmación de compras desde canal Telegram / web.
 *
 * Imputación contable: las filas en `contabilidad_compras` usan `proyecto_id` y
 * `entidad_id` (patrono fiscal en `ci_entidades`). No hay `customer_id` en compras;
 * el vínculo al CRM es indirecto vía `ci_proyectos.customer_id` → `customers`
 * (puede ser null en obras tipo talento / patrono DIMAQUINAS).
 */
import {
  liberarConfirmacionCompraCanal,
  reclamarConfirmacionCompraCanal,
} from '@/lib/canal/reservarFacturaCanalTelegram';
import { buscarCompraContablePorFactura } from '@/lib/contabilidad/buscarCompraContablePorFactura';
import { updateContabilidadCompraRow } from '@/lib/contabilidad/updateContabilidadCompraRow';
import {
  condicionPagoExtractedConfirmada,
  diasCreditoExtractedValido,
  formaPagoExtractedCompleta,
  monedaExtractedConfirmada,
  normalizarMonedaExtracted,
  parseCondicionPagoExtracted,
  type ExtractedCanalHeader,
} from '@/lib/contabilidad/extractedCanal';
import type { LineaCompraContabilidadInput } from '@/lib/contabilidad/registerCompraDesdeRecepcion';
import { registerCompraDesdeRecepcion } from '@/lib/contabilidad/registerCompraDesdeRecepcion';
import { resolverEntidadIdDesdeProyecto } from '@/lib/contabilidad/resolverEntidadProyecto';
import {
  IMPUTACION_ENTIDAD,
  IMPUTACION_OBRA,
} from '@/lib/contabilidad/imputacionCompra';
import type { ClasificacionGastoEntidad } from '@/lib/contabilidad/clasificacionGastoEntidad';
import {
  payloadCompraBimonetario,
  resolverMontosCompraBimonetario,
} from '@/lib/contabilidad/comprasBimonetario';
import { copiarDocumentoProcurementAInvoice } from '@/lib/almacen/procurementDocumentStorage';
import {
  auditoriaFechaCompra,
  exigeConfirmacionFechaAnomala,
  FechaCompraAnomalaError,
} from '@/lib/contabilidad/auditoriaFechaCompra';
import {
  asegurarMaterialesLineasCompra,
  mensajeLineasSinMaterialSku,
  resolverMaterialIdLineasCompra,
} from '@/lib/almacen/resolverMaterialIdPorSku';
import { crearCuarentenaDesdeFactura } from '@/lib/almacen/crearCuarentenaDesdeFactura';
import { notificarCuarentenaParaInvoice } from '@/lib/almacen/notificarCuarentenaParaInvoice';

export function linkConfirmarCompraTelegram(pendingId: string, baseUrl?: string): string {
  const base = (
    baseUrl ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://casainteligente.company'
  )
    .trim()
    .replace(/\/$/, '');
  return `${base}/contabilidad/compras/telegram/${pendingId}`;
}

type PendienteRow = {
  id: string;
  estado: string;
  extracted: ExtractedCanalHeader | null;
  proyecto_id: string | null;
  entidad_id: string | null;
  ubicacion_destino_id: string | null;
  document_storage_path: string | null;
  document_file_name: string | null;
  document_mime_type: string | null;
  purchase_invoice_id: string | null;
  chat_id?: string | number | null;
  chat_label?: string | null;
};

function auditarCompraConfirmadaCanal(params: {
  row: PendienteRow;
  compraId: string;
  facturaNum: string;
  yaExistia: boolean;
}): void {
  if (params.yaExistia) return;
  void import('@/lib/telegram/logBotAuditoria').then(({ notificarEventoSistemaLogAsync }) => {
    notificarEventoSistemaLogAsync({
      chatId: params.row.chat_id != null ? String(params.row.chat_id) : null,
      chatLabel: params.row.chat_label,
      modulo: 'Contabilidad · Compra',
      evento: 'Compra confirmada en cuadro',
      detalle: `Nº ${params.facturaNum} · compra ${params.compraId}`,
    });
  });
}

function lineasDesdeExtracted(ex: ExtractedCanalHeader): LineaCompraContabilidadInput[] {
  return (ex.items ?? [])
    .filter((it) => String(it.description ?? '').trim())
    .map((it) => {
      const cantidad = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
      const precio = Number(it.unit_price) >= 0 ? Number(it.unit_price) : 0;
      return {
        descripcion: String(it.description ?? '').trim(),
        item_code: String(it.item_code ?? '').trim() || null,
        unidad: String(it.unit ?? 'UND').trim() || 'UND',
        cantidad,
        precio_unitario: precio,
      };
    });
}

async function retornarDesdeCompraExistente(
  supabase: SupabaseClient,
  params: {
    pendingId: string;
    purchaseInvoiceId: string;
    compraId: string;
    proyectoId: string;
    ubicacionDestinoId: string;
    entidadId: string;
    extracted: ExtractedCanalHeader;
  },
): Promise<{
  compraId: string;
  purchaseInvoiceId: string;
  yaExistia: boolean;
  cuarentena?: { lineasCreadas: number; yaExistia: boolean; notificado?: boolean };
}> {
  await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      estado: 'confirmado',
      proyecto_id: params.proyectoId,
      ubicacion_destino_id: params.ubicacionDestinoId,
      ...(params.entidadId ? { entidad_id: params.entidadId } : {}),
      purchase_invoice_id: params.purchaseInvoiceId,
      extracted: params.extracted,
      mensaje_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.pendingId);

  const resuelto = await resolverMaterialIdLineasCompra(supabase, params.compraId);
  const cuarentena = await crearCuarentenaDesdeFactura(supabase, {
    purchaseInvoiceId: params.purchaseInvoiceId,
    ubicacionDestinoId: params.ubicacionDestinoId,
    lineas: resuelto.lineas.map((l) => ({
      material_id: l.material_id,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
    })),
  });
  let notificado = false;
  if (cuarentena.lineasCreadas > 0 || cuarentena.yaExistia) {
    const notify = await notificarCuarentenaParaInvoice(supabase, params.purchaseInvoiceId);
    notificado = Boolean(notify.ok && !notify.skipped);
  }
  return {
    compraId: params.compraId,
    purchaseInvoiceId: params.purchaseInvoiceId,
    yaExistia: true,
    cuarentena: { ...cuarentena, notificado },
  };
}

export async function confirmarCompraDesdeCanal(
  supabase: SupabaseClient,
  params: {
    pendingId: string;
    proyectoId: string;
    ubicacionDestinoId: string;
    entidadId?: string;
    /** Gasto absorbido por la entidad; no entra en valuación AD. */
    imputacionEntidad?: boolean;
    extractedOverride?: ExtractedCanalHeader;
    lineasOverride?: LineaCompraContabilidadInput[];
    confirmarFechaAnomala?: boolean;
    clasificacionGastoEntidad?: ClasificacionGastoEntidad | null;
  },
): Promise<{
  compraId: string;
  purchaseInvoiceId: string;
  yaExistia: boolean;
  cuarentena?: { lineasCreadas: number; yaExistia: boolean; notificado?: boolean };
}> {
  const { data: pendiente, error: pErr } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select(
      'id,estado,extracted,entidad_id,proyecto_id,ubicacion_destino_id,document_storage_path,document_file_name,document_mime_type,purchase_invoice_id,chat_id,chat_label',
    )
    .eq('id', params.pendingId)
    .single();

  if (pErr || !pendiente) {
    throw new Error(pErr?.message ?? 'Factura de Telegram no encontrada');
  }

  const row = pendiente as PendienteRow;
  if (row.estado === 'confirmado' && row.purchase_invoice_id) {
    const { data: compraExistente } = await supabase
      .from('contabilidad_compras')
      .select('id')
      .eq('purchase_invoice_id', row.purchase_invoice_id)
      .maybeSingle();
    if (compraExistente?.id) {
      return retornarDesdeCompraExistente(supabase, {
        pendingId: params.pendingId,
        purchaseInvoiceId: row.purchase_invoice_id,
        compraId: compraExistente.id,
        proyectoId: params.proyectoId.trim() || row.proyecto_id?.trim() || '',
        ubicacionDestinoId:
          params.ubicacionDestinoId.trim() || row.ubicacion_destino_id?.trim() || '',
        entidadId: params.entidadId?.trim() || row.entidad_id?.trim() || '',
        extracted: params.extractedOverride ?? row.extracted ?? {},
      });
    }
  }

  const reclamo = await reclamarConfirmacionCompraCanal(supabase, params.pendingId);
  if (reclamo.status === 'not_found') {
    throw new Error('Factura de Telegram no encontrada');
  }
  if (reclamo.status === 'already_done') {
    if (reclamo.purchaseInvoiceId) {
      const { data: compraExistente } = await supabase
        .from('contabilidad_compras')
        .select('id')
        .eq('purchase_invoice_id', reclamo.purchaseInvoiceId)
        .maybeSingle();
      if (compraExistente?.id) {
        return retornarDesdeCompraExistente(supabase, {
          pendingId: params.pendingId,
          purchaseInvoiceId: reclamo.purchaseInvoiceId,
          compraId: compraExistente.id,
          proyectoId: params.proyectoId.trim() || row.proyecto_id?.trim() || '',
          ubicacionDestinoId:
            params.ubicacionDestinoId.trim() || row.ubicacion_destino_id?.trim() || '',
          entidadId: params.entidadId?.trim() || row.entidad_id?.trim() || '',
          extracted: params.extractedOverride ?? row.extracted ?? {},
        });
      }
    }
    throw new Error('La compra ya está en contabilidad. Use el botón de ingreso al almacén.');
  }
  if (reclamo.status === 'busy') {
    throw new Error('Otra confirmación está en curso. Espere unos segundos e intente de nuevo.');
  }
  if (reclamo.status === 'invalid') {
    throw new Error(
      reclamo.estado === 'procesando' || reclamo.estado === 'pendiente'
        ? 'La factura aún se está procesando. Espere unos segundos y actualice.'
        : reclamo.estado === 'confirmado'
          ? 'La compra ya está en contabilidad. Use el botón de ingreso al almacén.'
          : `Estado no válido para confirmar: ${reclamo.estado}`,
    );
  }

  const estadoPrevio = reclamo.estadoPrevio;

  try {
    return await confirmarCompraDesdeCanalInterno(supabase, params, row, estadoPrevio);
  } catch (err) {
    await liberarConfirmacionCompraCanal(supabase, params.pendingId, estadoPrevio);
    throw err;
  }
}

async function confirmarCompraDesdeCanalInterno(
  supabase: SupabaseClient,
  params: {
    pendingId: string;
    proyectoId: string;
    ubicacionDestinoId: string;
    entidadId?: string;
    imputacionEntidad?: boolean;
    extractedOverride?: ExtractedCanalHeader;
    lineasOverride?: LineaCompraContabilidadInput[];
    confirmarFechaAnomala?: boolean;
    clasificacionGastoEntidad?: ClasificacionGastoEntidad | null;
  },
  row: PendienteRow,
  _estadoPrevio: string,
): Promise<{
  compraId: string;
  purchaseInvoiceId: string;
  yaExistia: boolean;
  cuarentena?: { lineasCreadas: number; yaExistia: boolean; notificado?: boolean };
}> {
  if (!['extraido', 'error', 'aprobado_sistema'].includes(row.estado) && row.estado !== 'procesando') {
    throw new Error(`Estado no válido para confirmar: ${row.estado}`);
  }

  const extracted = params.extractedOverride ?? row.extracted;
  if (!extracted?.supplier_name?.trim() && !extracted?.invoice_number?.trim()) {
    throw new Error('Sin datos extraídos. Edite la factura o reenvíe la imagen.');
  }
  if (!monedaExtractedConfirmada(extracted.moneda)) {
    throw new Error('Indique si la factura está en bolívares (Bs) o dólares (USD).');
  }
  if (!condicionPagoExtractedConfirmada(extracted.condicion_pago)) {
    throw new Error('Indique si la compra es a contado o a crédito.');
  }
  if (!diasCreditoExtractedValido(extracted)) {
    throw new Error('Indique los días de crédito de la compra.');
  }

  const gastoEntidad = params.imputacionEntidad === true;

  const proyectoIdRaw = params.proyectoId.trim() || row.proyecto_id?.trim() || '';
  let entidadId =
    params.entidadId?.trim() || row.entidad_id?.trim() || '';
  if (!entidadId && proyectoIdRaw) {
    entidadId = (await resolverEntidadIdDesdeProyecto(supabase, proyectoIdRaw)) ?? '';
  }

  if (gastoEntidad) {
    if (!entidadId) {
      throw new Error('Seleccione la entidad que absorbe este gasto.');
    }
  } else if (!proyectoIdRaw) {
    throw new Error('Seleccione el proyecto al que pertenece la compra.');
  }

  const proyectoId = gastoEntidad ? null : proyectoIdRaw;

  const ubicacionDestinoId =
    params.ubicacionDestinoId.trim() || row.ubicacion_destino_id?.trim() || '';
  if (!gastoEntidad && !ubicacionDestinoId) {
    throw new Error('Seleccione el almacén de ingreso del material.');
  }

  const facturaParams = {
    invoice_number: (extracted.invoice_number ?? 'S/N').trim(),
    supplier_rif: extracted.supplier_rif,
    supplier_name: extracted.supplier_name,
  };

  const compraDuplicada = await buscarCompraContablePorFactura(supabase, {
    ...facturaParams,
    proyecto_id: proyectoIdRaw || undefined,
    ignorar_proyecto: true,
  });
  if (compraDuplicada?.id && !gastoEntidad) {
    let purchaseInvoiceId =
      compraDuplicada.purchase_invoice_id?.trim() || row.purchase_invoice_id?.trim() || '';
    if (purchaseInvoiceId) {
      if (!compraDuplicada.purchase_invoice_id?.trim()) {
        await supabase
          .from('contabilidad_compras')
          .update({ purchase_invoice_id: purchaseInvoiceId } as never)
          .eq('id', compraDuplicada.id);
      }
      return retornarDesdeCompraExistente(supabase, {
        pendingId: params.pendingId,
        purchaseInvoiceId,
        compraId: compraDuplicada.id,
        proyectoId: proyectoIdRaw,
        ubicacionDestinoId,
        entidadId,
        extracted,
      });
    }
  }

  const fecha = (extracted.date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const auditFecha = auditoriaFechaCompra(fecha);
  const fechaConfirmada =
    Boolean(params.confirmarFechaAnomala) ||
    Boolean(extracted.fecha_auditoria_confirmada);
  if (exigeConfirmacionFechaAnomala(auditFecha) && !fechaConfirmada) {
    throw new FechaCompraAnomalaError(auditFecha);
  }
  const lineasBase = params.lineasOverride?.length
    ? params.lineasOverride
    : lineasDesdeExtracted(extracted);
  if (lineasBase.length === 0) {
    throw new Error('Agregue al menos una línea con descripción.');
  }

  let lineas = lineasBase;
  let lineasConMaterial = lineasBase;

  if (!gastoEntidad) {
    const resuelto = await asegurarMaterialesLineasCompra(supabase, lineasBase, {
      proyectoId: proyectoIdRaw,
      fecha,
      ubicacionDestinoId,
    });
    lineas = resuelto.lineas;
    lineasConMaterial = lineas.filter((l) => l.material_id?.trim());
    if (!lineasConMaterial.length) {
      const detalle = mensajeLineasSinMaterialSku(resuelto.sinMatch);
      throw new Error(
        detalle ||
          'No se pudo vincular ninguna línea al catálogo. Revise descripciones o códigos SAP en la factura.',
      );
    }
  }

  const sumLineas = lineas.reduce((s, l) => s + l.cantidad * l.precio_unitario, 0);
  const totalManual =
    extracted.total_amount != null && Number(extracted.total_amount) > 0
      ? Number(extracted.total_amount)
      : sumLineas;

  const montos = await resolverMontosCompraBimonetario({
    montoTotal: totalManual,
    moneda: normalizarMonedaExtracted(extracted.moneda),
    fecha,
  });

  let purchaseInvoiceId = row.purchase_invoice_id ?? '';
  let docStoragePath = row.document_storage_path?.trim() || null;
  let docFileName = row.document_file_name?.trim() || null;
  let docMimeType = row.document_mime_type?.trim() || null;

  if (!purchaseInvoiceId) {
    const duplicadaRace = await buscarCompraContablePorFactura(supabase, {
      ...facturaParams,
      ignorar_proyecto: true,
    });
    if (duplicadaRace?.purchase_invoice_id) {
      purchaseInvoiceId = duplicadaRace.purchase_invoice_id;
    }
  }

  if (!purchaseInvoiceId) {
    const invPayload = {
      invoice_number: (extracted.invoice_number ?? 'S/N').trim().slice(0, 80),
      supplier_rif: (extracted.supplier_rif ?? 'S/R').trim().slice(0, 40),
      supplier_name: (extracted.supplier_name ?? 'Proveedor').trim().slice(0, 200),
      date: fecha,
      status: 'REGISTRADA',
      proyecto_id: proyectoId,
      ...(ubicacionDestinoId ? { ubicacion_destino_id: ubicacionDestinoId } : {}),
      ...(entidadId ? { entidad_id: entidadId } : {}),
      ...payloadCompraBimonetario(montos),
      document_storage_path: docStoragePath,
      document_file_name: docFileName,
      document_mime_type: docMimeType,
    };

    const { data: inv, error: invErr } = await supabase
      .from('purchase_invoices')
      .insert(invPayload)
      .select('id')
      .single();

    if (invErr) throw new Error(`No se pudo crear la factura: ${invErr.message}`);
    purchaseInvoiceId = String((inv as { id: string }).id);
  } else {
    await supabase
      .from('purchase_invoices')
      .update({
        proyecto_id: proyectoId,
        ...(ubicacionDestinoId ? { ubicacion_destino_id: ubicacionDestinoId } : {}),
        ...(entidadId ? { entidad_id: entidadId } : {}),
      })
      .eq('id', purchaseInvoiceId);
  }

  if (docStoragePath && purchaseInvoiceId) {
    const enCarpetaFactura = docStoragePath.startsWith(`${purchaseInvoiceId}/`);
    const enColaCanal = /-pending\//i.test(docStoragePath);
    if (!enCarpetaFactura || enColaCanal) {
      const copiado = await copiarDocumentoProcurementAInvoice(supabase, {
        sourcePath: docStoragePath,
        purchaseInvoiceId,
        fileName: docFileName,
        mimeType: docMimeType,
      });
      if (copiado) {
        docStoragePath = copiado.path;
        docFileName = copiado.fileName;
        docMimeType = copiado.mimeType;
      } else {
        docStoragePath = null;
        docFileName = null;
        docMimeType = null;
      }
      await supabase
        .from('purchase_invoices')
        .update({
          document_storage_path: docStoragePath,
          document_file_name: docFileName,
          document_mime_type: docMimeType,
        })
        .eq('id', purchaseInvoiceId);
    }
  }

  const { compraId, yaExistia } = await registerCompraDesdeRecepcion(supabase, {
    purchase_invoice_id: purchaseInvoiceId,
    proyecto_id: proyectoId,
    invoice_number: (extracted.invoice_number ?? 'S/N').trim(),
    supplier_rif: (extracted.supplier_rif ?? 'S/R').trim(),
    supplier_name: (extracted.supplier_name ?? 'Proveedor').trim(),
    fecha,
    total_amount: montos.totalAmountLegacy,
    moneda: montos.monedaOriginal,
    tasa_bcv_ves_por_usd: montos.tasaApplied,
    total_amount_usd: montos.montoUsd,
    document_storage_path: docStoragePath,
    document_file_name: docFileName,
    lineas,
    origen: 'TELEGRAM',
    ubicacion_destino_id: ubicacionDestinoId || null,
    entidad_id: entidadId || null,
    imputacion: gastoEntidad ? IMPUTACION_ENTIDAD : IMPUTACION_OBRA,
    clasificacion_gasto_entidad: gastoEntidad
      ? params.clasificacionGastoEntidad ?? null
      : null,
  });

  const patchAuditoria = {
    alerta_fecha: auditFecha.nivel === 'ok' ? null : auditFecha.nivel,
    fecha_confirmada_manual:
      auditFecha.nivel === 'critico' ? fechaConfirmada : false,
  };
  const { error: auditErr } = await updateContabilidadCompraRow(supabase, compraId, patchAuditoria);
  if (auditErr && !auditErr.message?.includes('alerta_fecha')) {
    console.warn('[confirmarCompraDesdeCanal] alerta_fecha:', auditErr.message);
  }

  await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      estado: 'confirmado',
      proyecto_id: proyectoId,
      ubicacion_destino_id: ubicacionDestinoId || null,
      ...(entidadId ? { entidad_id: entidadId } : {}),
      purchase_invoice_id: purchaseInvoiceId,
      extracted,
      mensaje_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.pendingId);

  if (gastoEntidad) {
    auditarCompraConfirmadaCanal({
      row,
      compraId,
      facturaNum: (extracted.invoice_number ?? 'S/N').trim(),
      yaExistia,
    });
    return {
      compraId,
      purchaseInvoiceId,
      yaExistia,
      cuarentena: undefined,
    };
  }

  const cuarentena = await crearCuarentenaDesdeFactura(supabase, {
    purchaseInvoiceId,
    ubicacionDestinoId,
    lineas: lineasConMaterial.map((l) => ({
      material_id: l.material_id!,
      descripcion: l.descripcion,
      item_code: l.item_code,
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
      unidad: l.unidad,
    })),
  });

  let notificado = false;
  if (cuarentena.lineasCreadas > 0 || cuarentena.yaExistia) {
    const notify = await notificarCuarentenaParaInvoice(supabase, purchaseInvoiceId);
    notificado = Boolean(notify.ok && !notify.skipped);
  }

  auditarCompraConfirmadaCanal({
    row,
    compraId,
    facturaNum: (extracted.invoice_number ?? 'S/N').trim(),
    yaExistia,
  });

  return {
    compraId,
    purchaseInvoiceId,
    yaExistia,
    cuarentena: { ...cuarentena, notificado },
  };
}
