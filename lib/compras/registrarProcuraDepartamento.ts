import type { SupabaseClient } from '@supabase/supabase-js';
import { resolverEntidadIdDesdeProyecto } from '@/lib/contabilidad/resolverEntidadProyecto';
import { obtenerCapituloMaestroPorId } from '@/lib/compras/capitulosMaestro';
import { marcarTtlPendienteAtomico } from '@/lib/compras/telegramTtlAtomico';
import type { PrioridadProcura } from '@/lib/compras/viaRapidaProcura';
import { evaluarViaRapidaProcura } from '@/lib/compras/viaRapidaProcura';
import type { UsuarioSistemaTelegram } from '@/lib/compras/usuariosSistemaTelegram';
import { enviarAlertaProcuraPendienteAdmin } from '@/lib/procuras/alertaAdminProcuraTelegram';
import { procesarAbastecimientoProcuraAprobada } from '@/lib/procuras/abastecimientoProcuraAprobada';
import { emitirOrdenCompraProcura } from '@/lib/procuras/emitirOrdenCompraProcura';
import { rechazarProcuraConMotivo } from '@/lib/procuras/rechazarProcura';
import { normalizarUnidadProcura } from '@/lib/procuras/unidadesProcura';
import type { EstadoProcura } from '@/lib/procuras/procuraEstados';

const PREFIJO_POR_VERIFICAR = '[POR VERIFICAR]';

export type RegistrarProcuraDepartamentoInput = {
  usuario: UsuarioSistemaTelegram;
  capituloMaestroId: string;
  descripcionMaterial: string;
  cantidad: number;
  unidad: string;
  prioridad: PrioridadProcura;
  montoEstimadoUsd?: number | null;
  esConsumible?: boolean;
  observaciones?: string | null;
  materialId?: string | null;
  porVerificar?: boolean;
};

export type RegistrarProcuraDepartamentoResult = {
  id: string;
  ticket: string;
  estado: EstadoProcura;
  viaRapida: boolean;
  motivoVia: string;
  errorConsultaHistorico?: boolean;
  /** Alerta Telegram a PM y Administrador (vía larga). */
  alertaPmAdminEnviada?: boolean;
  alertaPmAdminDms?: number;
};

export async function registrarProcuraDepartamento(
  supabase: SupabaseClient,
  input: RegistrarProcuraDepartamentoInput,
): Promise<{ data: RegistrarProcuraDepartamentoResult | null; error: Error | null }> {
  const chatId = String(input.usuario.telegram_id ?? '').trim();
  if (chatId) {
    const { marked, error: errRpc } = await marcarTtlPendienteAtomico(supabase, chatId);
    if (!errRpc && !marked) {
      return { data: null, error: null };
    }
  }

  const capitulo = await obtenerCapituloMaestroPorId(supabase, input.capituloMaestroId);
  if (!capitulo) {
    return { data: null, error: new Error('Capítulo no válido.') };
  }

  let materialTxt = input.descripcionMaterial.trim().slice(0, 500);
  if (!materialTxt) {
    return { data: null, error: new Error('Indique la descripción del material.') };
  }
  if (input.porVerificar && !materialTxt.startsWith(PREFIJO_POR_VERIFICAR)) {
    materialTxt = `${PREFIJO_POR_VERIFICAR} ${materialTxt}`.slice(0, 500);
  }

  const cantidad = input.cantidad;
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { data: null, error: new Error('Cantidad inválida.') };
  }

  let via: Awaited<ReturnType<typeof evaluarViaRapidaProcura>>;
  try {
    via = await evaluarViaRapidaProcura(supabase, {
      descripcionMaterial: materialTxt,
      montoEstimadoUsd: input.montoEstimadoUsd ?? null,
      esConsumible: input.esConsumible ?? false,
      cantidad,
      materialId: input.materialId ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al evaluar vía rápida';
    console.warn('[registrarProcuraDepartamento] viaRapida:', msg);
    return {
      data: null,
      error: new Error(`No se pudo evaluar la vía rápida. ${msg}`),
    };
  }

  const estado: EstadoProcura = via.califica ? 'aprobada_directa' : 'solicitada';
  const proyectoId = input.usuario.proyecto_id?.trim() || null;
  let entidadId: string | null = null;
  if (proyectoId) {
    entidadId = await resolverEntidadIdDesdeProyecto(supabase, proyectoId);
  }

  const obsParts: string[] = [];
  if (input.observaciones?.trim()) obsParts.push(input.observaciones.trim());
  obsParts.push(`Capítulo: ${capitulo.codigo} — ${capitulo.nombre}`);
  obsParts.push(`Prioridad: ${input.prioridad}`);
  if (via.califica) obsParts.push(`Vía rápida: ${via.motivo}`);
  if (!via.califica && input.montoEstimadoUsd == null) {
    obsParts.push(`Análisis sin monto: ${via.motivo}`);
  }
  if (via.precioUnitarioHistoricoUsd != null && via.montoEstimadoEfectivoUsd != null) {
    obsParts.push(
      `Costo histórico ref.: USD ${via.precioUnitarioHistoricoUsd.toFixed(2)}/u × ${cantidad} = USD ${via.montoEstimadoEfectivoUsd.toFixed(2)}`,
    );
  }
  if (input.porVerificar) obsParts.push('Material texto libre — por verificar en catálogo');
  const observaciones = obsParts.join('\n').slice(0, 2000);

  const materialId = input.materialId?.trim() || null;

  const row: Record<string, unknown> = {
    material_txt: materialTxt,
    cantidad,
    unidad: normalizarUnidadProcura(input.unidad),
    estado,
    prioridad: input.prioridad,
    capitulo_maestro_id: capitulo.id,
    monto_estimado_usd:
      input.montoEstimadoUsd ?? via.montoEstimadoEfectivoUsd ?? null,
    es_consumible: Boolean(input.esConsumible),
    via_rapida: via.califica,
    observaciones,
    solicitante_nombre: input.usuario.nombre.slice(0, 150),
    solicitante_telegram_chat_id: input.usuario.telegram_id,
  };

  if (proyectoId) row.proyecto_id = proyectoId;
  if (entidadId) row.entidad_id = entidadId;
  if (materialId) row.material_id = materialId;

  const { data, error } = await supabase
    .from('ci_procuras')
    .insert(row as never)
    .select('id, ticket, estado, via_rapida')
    .single();

  if (error) {
    const hint = /capitulo_maestro|prioridad|aprobada_directa|42P01|schema cache/i.test(error.message)
      ? ' Ejecute migración 230_ci_compras_departamento_telegram.sql y NOTIFY pgrst.'
      : '';
    return { data: null, error: new Error(`${error.message}${hint}`) };
  }

  const out = data as { id: string; ticket: string; estado: EstadoProcura; via_rapida?: boolean };

  let alertaPmAdminEnviada = false;
  let alertaPmAdminDms = 0;
  if (!via.califica && out.id) {
    try {
      const alerta = await enviarAlertaProcuraPendienteAdmin(supabase, String(out.id));
      alertaPmAdminEnviada = alerta.enviado;
      alertaPmAdminDms = alerta.dmsEnviados;
    } catch (e) {
      console.warn('[registrarProcuraDepartamento] alerta', e);
    }
  }

  if (via.califica && out.id) {
    void emitirOrdenCompraProcura(supabase, {
      procuraId: String(out.id),
      autorNombre: 'Vía rápida',
      motivo: via.motivo,
    }).catch((e) => {
      console.warn('[registrarProcuraDepartamento] orden compra vía rápida', e);
    });
  }

  return {
    data: {
      id: String(out.id),
      ticket: String(out.ticket ?? ''),
      estado: out.estado,
      viaRapida: Boolean(out.via_rapida),
      motivoVia: via.motivo,
      errorConsultaHistorico: Boolean(via.errorConsultaHistorico),
      alertaPmAdminEnviada,
      alertaPmAdminDms,
    },
    error: null,
  };
}

/** Aprobador / Administrador: PM aprueba → orden de compra (en_compra) para el comprador. */
export async function resolverProcuraDepartamento(
  supabase: SupabaseClient,
  params: {
    procuraId: string;
    accion: 'aprobar' | 'rechazar';
    aprobadorTelegramId: number;
    aprobadorNombre: string;
    motivoRechazo?: string | null;
  },
): Promise<{
  ok: boolean;
  ticket?: string;
  estado?: string;
  error?: string;
  compradoresNotificados?: number;
}> {
  if (params.accion === 'rechazar') {
    const motivo =
      params.motivoRechazo?.trim() ||
      `Rechazada por ${params.aprobadorNombre} (Telegram ${params.aprobadorTelegramId})`;

    const resultado = await rechazarProcuraConMotivo(supabase, {
      procuraId: params.procuraId,
      motivo,
      aprobadorNombre: params.aprobadorNombre,
    });

    if (!resultado.ok) {
      return { ok: false, error: resultado.error };
    }

    return {
      ok: true,
      ticket: resultado.ticket,
      estado: resultado.estado ?? 'rechazada',
    };
  }

  const abas = await procesarAbastecimientoProcuraAprobada(supabase, {
    procuraId: params.procuraId,
    autorNombre: params.aprobadorNombre,
  });

  if (!abas.ok) {
    return { ok: false, error: abas.error };
  }

  return {
    ok: true,
    ticket: abas.ticket,
    estado: abas.estado ?? 'aprobada',
    compradoresNotificados: abas.compraEmitida ? 1 : 0,
  };
}
