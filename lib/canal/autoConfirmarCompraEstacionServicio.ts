import type { SupabaseClient } from '@supabase/supabase-js';
import { calcularConfidenceScoreOcr } from '@/lib/canal/calcularConfidenceScoreOcr';
import { esFacturaEstacionServicio } from '@/lib/canal/esFacturaEstacionServicio';
import {
  auditoriaFechaCompra,
  exigeConfirmacionFechaAnomala,
} from '@/lib/contabilidad/auditoriaFechaCompra';
import {
  condicionPagoExtractedConfirmada,
  monedaExtractedConfirmada,
  normalizarMonedaExtracted,
  parseCondicionPagoExtracted,
  type ExtractedCanalHeader,
} from '@/lib/contabilidad/extractedCanal';
import type { ClasificacionGastoEntidad } from '@/lib/contabilidad/clasificacionGastoEntidad';
import { textoAvisoPropietario } from '@/lib/telegram/propietarioAvisoTelegram';

/**
 * Piso de confianza OCR para auto-confirmar EDS.
 * Más bajo que fast-track (95 %): los tickets de bomba casi nunca traen SKU,
 * y `calcularConfidenceScoreOcr` resta 15 puntos si faltan códigos.
 */
export const UMBRAL_CONFIANZA_AUTO_CONFIRM_EDS = 60;

const LOG = '[autoConfirmarCompraEstacionServicio]';

export type AuditoriaAutoConfirmEds = {
  evaluado_at: string;
  aplicado: boolean;
  motivo?: string;
};

export type ExtractedEstacionServicio = ExtractedCanalHeader & {
  confidence_score?: number;
  auto_confirm_estacion_servicio?: AuditoriaAutoConfirmEds;
};

export type ResultadoAutoConfirmEstacion = {
  aplicado: boolean;
  detectada: boolean;
  motivo?: string;
  compraId?: string;
  extracted?: ExtractedEstacionServicio;
};

export type ContextoTelegramEds = {
  proyectoId: string;
  procuraId: string | null;
};

type ConfirmarCompraEdsFn = (
  supabase: SupabaseClient,
  params: {
    pendingId: string;
    proyectoId: string;
    ubicacionDestinoId: string;
    entidadId?: string;
    imputacionEntidad?: boolean;
    extractedOverride?: ExtractedCanalHeader;
    clasificacionGastoEntidad?: ClasificacionGastoEntidad | null;
    procuraId?: string | null;
  },
) => Promise<{ compraId: string; purchaseInvoiceId: string; yaExistia: boolean }>;

export type DepsAutoConfirmEstacion = {
  confirmar?: ConfirmarCompraEdsFn;
  asegurarAlmacen?: (
    supabase: SupabaseClient,
    proyectoId: string,
    nombreObra: string,
  ) => Promise<string>;
  obraSugerida?: (
    supabase: SupabaseClient,
    extracted: unknown,
  ) => Promise<{ proyectoId: string; entidadId: string | null } | null>;
  buscarPropietario?: (
    supabase: SupabaseClient,
    proyectoId: string,
  ) => Promise<{ nombre: string | null; rif: string | null } | null>;
  leerContextoTelegram?: (chatId: string) => Promise<ContextoTelegramEds>;
};

type PendienteEds = {
  id: string;
  estado: string;
  extracted: ExtractedEstacionServicio | null;
  proyecto_id: string | null;
  entidad_id: string | null;
  ubicacion_destino_id: string | null;
  chat_id?: string | number | null;
};

/** VES + contado: en Venezuela la bomba cobra en Bs y se paga al momento. */
export function extractedListoEstacionServicio(
  extracted: ExtractedEstacionServicio,
): ExtractedEstacionServicio {
  return {
    ...extracted,
    moneda: monedaExtractedConfirmada(extracted.moneda)
      ? normalizarMonedaExtracted(extracted.moneda)
      : 'VES',
    condicion_pago: condicionPagoExtractedConfirmada(extracted.condicion_pago)
      ? parseCondicionPagoExtracted(extracted.condicion_pago)
      : 'contado',
  };
}

export function confianzaOcrEstacionServicio(extracted: ExtractedEstacionServicio): number {
  const items = (extracted.items ?? []).map((it) => ({
    description: String(it.description ?? ''),
    item_code: String(it.item_code ?? ''),
    unit: String(it.unit ?? 'UND'),
    quantity: Number(it.quantity) || 0,
    unit_price: Number(it.unit_price) || 0,
  }));
  const estructural = calcularConfidenceScoreOcr({
    invoice_number: String(extracted.invoice_number ?? ''),
    supplier_rif: String(extracted.supplier_rif ?? ''),
    supplier_name: String(extracted.supplier_name ?? ''),
    date: String(extracted.date ?? ''),
    total_amount: extracted.total_amount ?? null,
    items,
  });
  const gemini = extracted.confidence_score;
  if (typeof gemini === 'number' && Number.isFinite(gemini)) {
    // Lo más pesimista: campos presentes no salvan un OCR que se declara inseguro.
    return Math.min(estructural, Math.max(0, Math.min(100, gemini)));
  }
  return estructural;
}

/**
 * Motivos para NO auto-confirmar una EDS ya detectada (faltan datos o la fecha es crítica).
 * Obra / almacén / entidad se resuelven aparte: si faltan, se deja pendiente.
 */
export function motivoCamposInsuficientesEstacionServicio(
  extracted: ExtractedEstacionServicio,
): string | null {
  if (!String(extracted.invoice_number ?? '').trim()) return 'Sin número de factura';
  if (!(Number(extracted.total_amount) > 0)) return 'Sin total de factura';
  const lineas = (extracted.items ?? []).filter((it) => String(it.description ?? '').trim());
  if (!lineas.length) return 'Sin líneas con descripción';
  const score = confianzaOcrEstacionServicio(extracted);
  if (score < UMBRAL_CONFIANZA_AUTO_CONFIRM_EDS) {
    return `Confianza OCR ${score}% < ${UMBRAL_CONFIANZA_AUTO_CONFIRM_EDS}%`;
  }
  const fecha = String(extracted.date ?? '').slice(0, 10);
  if (fecha && exigeConfirmacionFechaAnomala(auditoriaFechaCompra(fecha))) {
    return 'Fecha anómala: requiere confirmación manual';
  }
  return null;
}

async function persistirAuditoria(
  supabase: SupabaseClient,
  pendingId: string,
  extracted: ExtractedEstacionServicio,
  audit: AuditoriaAutoConfirmEds,
): Promise<void> {
  const { error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      extracted: { ...extracted, auto_confirm_estacion_servicio: audit },
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingId);
  if (error) {
    console.warn(`${LOG} no se pudo guardar auditoría:`, error.message);
  }
}

function skip(
  detectada: boolean,
  motivo: string,
): ResultadoAutoConfirmEstacion {
  return { aplicado: false, detectada, motivo };
}

async function leerContextoTelegramDefault(
  supabase: SupabaseClient,
  chatId: string,
): Promise<ContextoTelegramEds> {
  const { getTelegramEstado } = await import('@/lib/telegram/estados');
  const estado = await getTelegramEstado(supabase, chatId);
  const procuraId = String(estado.metadata?.procura_id ?? '').trim() || null;
  return { proyectoId: String(estado.proyecto_id ?? '').trim(), procuraId };
}

/**
 * Tras un OCR exitoso: si es estación de servicio y hay destino (obra+almacén o entidad),
 * registra la compra con el mismo `confirmarCompraDesdeCanal` que usa Confirmar.
 * Si faltan campos o falla, deja `extraido` y deja rastro en logs + extracted.
 */
export async function autoConfirmarCompraEstacionServicio(
  supabase: SupabaseClient,
  pendingId: string,
  extractedInput?: ExtractedEstacionServicio | null,
  deps: DepsAutoConfirmEstacion = {},
): Promise<ResultadoAutoConfirmEstacion> {
  const confirmar =
    deps.confirmar ??
    (await import('@/lib/contabilidad/confirmarCompraDesdeCanal')).confirmarCompraDesdeCanal;
  const asegurarAlmacen =
    deps.asegurarAlmacen ??
    (await import('@/lib/almacen/ubicacionesInventario')).asegurarAlmacenObra;
  const obraSugerida =
    deps.obraSugerida ??
    (await import('@/lib/telegram/flujoFacturaCompradorTelegram')).obraSugeridaPorReceptor;
  const buscarPropietario =
    deps.buscarPropietario ??
    (await import('@/lib/telegram/propietarioAvisoTelegram')).buscarPropietarioObra;

  const { data: pendiente, error: pErr } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select(
      'id,estado,extracted,proyecto_id,entidad_id,ubicacion_destino_id,chat_id',
    )
    .eq('id', pendingId)
    .maybeSingle();

  if (pErr || !pendiente) {
    const motivo = pErr?.message ?? 'Factura pendiente no encontrada';
    console.warn(`${LOG} ${pendingId}: ${motivo}`);
    return skip(false, motivo);
  }

  const row = pendiente as PendienteEds;
  if (row.estado === 'confirmado') {
    return { aplicado: true, detectada: true, motivo: 'Ya estaba confirmada' };
  }
  if (!['extraido', 'error', 'aprobado_sistema'].includes(String(row.estado ?? ''))) {
    return skip(false, `Estado no válido para auto-confirmar: ${row.estado}`);
  }

  const extracted = extractedInput ?? row.extracted ?? {};
  if (!esFacturaEstacionServicio(extracted)) {
    return skip(false, 'No es factura de estación de servicio');
  }

  const motivoCampos = motivoCamposInsuficientesEstacionServicio(extracted);
  if (motivoCampos) {
    console.warn(`${LOG} ${pendingId}: ${motivoCampos}`);
    await persistirAuditoria(supabase, pendingId, extracted, {
      evaluado_at: new Date().toISOString(),
      aplicado: false,
      motivo: motivoCampos,
    });
    return skip(true, motivoCampos);
  }

  let proyectoId = String(row.proyecto_id ?? '').trim();
  let entidadId = String(row.entidad_id ?? '').trim();
  let ubicacionId = String(row.ubicacion_destino_id ?? '').trim();
  let procuraId: string | null = null;

  const chatId = row.chat_id != null ? String(row.chat_id).trim() : '';
  if (chatId) {
    try {
      const ctx = deps.leerContextoTelegram
        ? await deps.leerContextoTelegram(chatId)
        : await leerContextoTelegramDefault(supabase, chatId);
      if (!proyectoId) proyectoId = String(ctx.proyectoId ?? '').trim();
      procuraId = ctx.procuraId;
    } catch (e) {
      console.warn(
        `${LOG} ${pendingId}: no se pudo leer contexto Telegram:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  if (!proyectoId) {
    try {
      const sug = await obraSugerida(supabase, extracted);
      if (sug) {
        proyectoId = sug.proyectoId;
        if (!entidadId) entidadId = String(sug.entidadId ?? '').trim();
      }
    } catch (e) {
      console.warn(
        `${LOG} ${pendingId}: obra sugerida falló:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  const imputacionEntidad = !proyectoId && Boolean(entidadId);
  if (!proyectoId && !entidadId) {
    const motivo = 'Sin obra ni entidad: requiere confirmación manual';
    console.warn(`${LOG} ${pendingId}: ${motivo}`);
    await persistirAuditoria(supabase, pendingId, extracted, {
      evaluado_at: new Date().toISOString(),
      aplicado: false,
      motivo,
    });
    return skip(true, motivo);
  }

  if (proyectoId && !ubicacionId) {
    try {
      const { data: proy } = await supabase
        .from('ci_proyectos')
        .select('nombre')
        .eq('id', proyectoId)
        .maybeSingle();
      ubicacionId = await asegurarAlmacen(
        supabase,
        proyectoId,
        String(proy?.nombre ?? 'Obra'),
      );
    } catch (e) {
      const motivo = `No se pudo asegurar almacén: ${
        e instanceof Error ? e.message : 'error'
      }`;
      console.warn(`${LOG} ${pendingId}: ${motivo}`);
      await persistirAuditoria(supabase, pendingId, extracted, {
        evaluado_at: new Date().toISOString(),
        aplicado: false,
        motivo,
      });
      return skip(true, motivo);
    }
  }

  if (proyectoId && !ubicacionId) {
    const motivo = 'Sin almacén de ingreso: requiere confirmación manual';
    console.warn(`${LOG} ${pendingId}: ${motivo}`);
    await persistirAuditoria(supabase, pendingId, extracted, {
      evaluado_at: new Date().toISOString(),
      aplicado: false,
      motivo,
    });
    return skip(true, motivo);
  }

  if (proyectoId) {
    try {
      const propietario = await buscarPropietario(supabase, proyectoId);
      const aviso = propietario ? textoAvisoPropietario(extracted as Record<string, unknown>, propietario) : null;
      if (aviso) {
        const motivo = 'La factura no está a nombre del propietario de la obra';
        console.warn(`${LOG} ${pendingId}: ${motivo}`);
        await persistirAuditoria(supabase, pendingId, extracted, {
          evaluado_at: new Date().toISOString(),
          aplicado: false,
          motivo,
        });
        return skip(true, motivo);
      }
    } catch (e) {
      console.warn(
        `${LOG} ${pendingId}: no se pudo verificar propietario:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  const listo: ExtractedEstacionServicio = {
    ...extractedListoEstacionServicio(extracted),
    auto_confirm_estacion_servicio: {
      evaluado_at: new Date().toISOString(),
      aplicado: true,
    },
  };

  try {
    const result = await confirmar(supabase, {
      pendingId,
      proyectoId: imputacionEntidad ? '' : proyectoId,
      ubicacionDestinoId: imputacionEntidad ? '' : ubicacionId,
      entidadId: entidadId || undefined,
      imputacionEntidad,
      clasificacionGastoEntidad: imputacionEntidad ? 'operacional' : null,
      extractedOverride: listo,
      procuraId,
    });
    console.info(
      `${LOG} ${pendingId}: compra ${result.compraId} registrada automáticamente (EDS)`,
    );
    return {
      aplicado: true,
      detectada: true,
      compraId: result.compraId,
      extracted: listo,
    };
  } catch (e) {
    const motivo = e instanceof Error ? e.message : 'Error al registrar la compra';
    console.warn(`${LOG} ${pendingId}: Confirmar falló — ${motivo}`);
    await persistirAuditoria(supabase, pendingId, extracted, {
      evaluado_at: new Date().toISOString(),
      aplicado: false,
      motivo,
    });
    return skip(true, motivo);
  }
}
