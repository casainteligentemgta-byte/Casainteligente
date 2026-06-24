import type { SupabaseClient } from '@supabase/supabase-js';
import { resolverEntidadIdDesdeProyecto } from '@/lib/contabilidad/resolverEntidadProyecto';
import type { ContextoAuditoriaSupervisor } from '@/lib/procuras/auditoriaSupervisorProcura';
import { obtenerCapituloMaestroPorId } from '@/lib/compras/capitulosMaestro';
import { marcarTtlPendienteAtomico } from '@/lib/compras/telegramTtlAtomico';
import type { PrioridadProcura } from '@/lib/compras/viaRapidaProcura';
import { evaluarViaRapidaProcura } from '@/lib/compras/viaRapidaProcura';
import type { UsuarioSistemaTelegram } from '@/lib/compras/usuariosSistemaTelegram';
import { enviarAlertaProcuraPendienteAdmin } from '@/lib/procuras/alertaAdminProcuraTelegram';
import {
  confirmarAbastecimientoProcura,
  evaluarStockProcuraRegistro,
  procesarAbastecimientoProcuraAprobada,
} from '@/lib/procuras/abastecimientoProcuraAprobada';
import { actualizarTicketProcuraSolicitante } from '@/lib/procuras/ticketProcuraSolicitanteTelegram';
import {
  evaluarStockRegistroProcura,
  montoUsdSaldoCompra,
  procesarProcuraStockSuficiente,
} from '@/lib/procuras/procuraRegistroStock';
import { rechazarProcuraConMotivo } from '@/lib/procuras/rechazarProcura';
import { normalizarUnidadProcura } from '@/lib/procuras/unidadesProcura';
import type { EstadoProcura } from '@/lib/procuras/procuraEstados';

const PREFIJO_POR_VERIFICAR = '[POR VERIFICAR]';

export type RegistrarProcuraDepartamentoInput = {
  usuario: UsuarioSistemaTelegram;
  /** Obra de la sesión Telegram (prioridad sobre usuario.proyecto_id). */
  proyectoId?: string | null;
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
  stockSuficiente?: boolean;
  cantidadCompra?: number;
  stockDisponible?: number;
  almacenNombre?: string | null;
  depositarioNotificado?: boolean;
  alertaPmAdminEnviada?: boolean;
  alertaPmAdminDms?: number;
  compraEmitidaViaRapida?: boolean;
  necesitaAbastecimientoViaRapida?: boolean;
};

export async function registrarProcuraDepartamento(
  supabase: SupabaseClient,
  input: RegistrarProcuraDepartamentoInput,
): Promise<{ data: RegistrarProcuraDepartamentoResult | null; error: Error | null }> {
  const chatId = String(input.usuario.telegram_id ?? '').trim();
  if (chatId) {
    const { marked, error: errRpc } = await marcarTtlPendienteAtomico(supabase, chatId);
    if (!errRpc && !marked) {
      return {
        data: null,
        error: new Error(
          'La solicitud ya se está registrando. Espere unos segundos antes de confirmar de nuevo.',
        ),
      };
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

  const proyectoId =
    input.proyectoId?.trim() || input.usuario.proyecto_id?.trim() || null;
  const materialId = input.materialId?.trim() || null;
  let entidadId: string | null = null;
  if (!proyectoId) {
    return {
      data: null,
      error: new Error(
        'Indique la obra para la procura. Use /procura y elija la obra al inicio del flujo.',
      ),
    };
  }
  entidadId = await resolverEntidadIdDesdeProyecto(supabase, proyectoId);

  const evalStock = await evaluarStockRegistroProcura(supabase, {
    proyecto_id: proyectoId,
    material_id: materialId,
    cantidad,
  });

  if (evalStock.stockSuficiente) {
    const obsParts: string[] = [];
    if (input.observaciones?.trim()) obsParts.push(input.observaciones.trim());
    obsParts.push(`Capítulo: ${capitulo.codigo} — ${capitulo.nombre}`);
    obsParts.push(`Prioridad: ${input.prioridad}`);
    obsParts.push(
      `Stock almacén obra: ${evalStock.stockDisponible} ${normalizarUnidadProcura(input.unidad)} — despacho directo`,
    );
    if (input.porVerificar) obsParts.push('Material texto libre — por verificar en catálogo');

    const row: Record<string, unknown> = {
      material_txt: materialTxt,
      cantidad,
      unidad: normalizarUnidadProcura(input.unidad),
      estado: 'aprobada' satisfies EstadoProcura,
      prioridad: input.prioridad,
      capitulo_maestro_id: capitulo.id,
      monto_estimado_usd: input.montoEstimadoUsd ?? null,
      es_consumible: Boolean(input.esConsumible),
      via_rapida: false,
      observaciones: obsParts.join('\n').slice(0, 2000),
      solicitante_nombre: input.usuario.nombre.slice(0, 150),
      solicitante_telegram_chat_id: input.usuario.telegram_id,
      cantidad_despacho: evalStock.cantidadDespacho,
      cantidad_compra: 0,
      stock_almacen_detectado: evalStock.stockDisponible,
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
      return { data: null, error: new Error(error.message) };
    }

    const out = data as { id: string; ticket: string; estado: EstadoProcura };
    let depositarioNotificado = false;
    try {
      const proc = await procesarProcuraStockSuficiente(supabase, String(out.id));
      depositarioNotificado = proc.depositarioNotificado;
    } catch (e) {
      console.warn('[registrarProcuraDepartamento] stock suficiente', e);
    }

    return {
      data: {
        id: String(out.id),
        ticket: String(out.ticket ?? ''),
        estado: out.estado,
        viaRapida: false,
        motivoVia: 'Stock suficiente en almacén de la obra',
        stockSuficiente: true,
        cantidadCompra: 0,
        stockDisponible: evalStock.stockDisponible,
        almacenNombre: evalStock.origenUbicacionNombre,
        depositarioNotificado,
      },
      error: null,
    };
  }

  const cantidadCompra = evalStock.cantidadCompra;
  const montoSaldo = montoUsdSaldoCompra(input.montoEstimadoUsd, cantidad, cantidadCompra);

  let via: Awaited<ReturnType<typeof evaluarViaRapidaProcura>>;
  try {
    via = await evaluarViaRapidaProcura(supabase, {
      descripcionMaterial: materialTxt,
      montoEstimadoUsd: montoSaldo,
      esConsumible: input.esConsumible ?? false,
      cantidad: cantidadCompra,
      materialId,
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

  const obsParts: string[] = [];
  if (input.observaciones?.trim()) obsParts.push(input.observaciones.trim());
  obsParts.push(`Capítulo: ${capitulo.codigo} — ${capitulo.nombre}`);
  obsParts.push(`Prioridad: ${input.prioridad}`);
  if (evalStock.stockDisponible > 0) {
    obsParts.push(
      `Stock almacén obra: ${evalStock.stockDisponible} — despacho ${evalStock.cantidadDespacho}, compra ${cantidadCompra}`,
    );
  } else {
    obsParts.push('Sin stock en almacén de la obra');
  }
  if (via.califica) obsParts.push(`Vía rápida (saldo): ${via.motivo}`);
  if (!via.califica && montoSaldo == null) {
    obsParts.push(`Análisis sin monto: ${via.motivo}`);
  }
  if (via.precioUnitarioHistoricoUsd != null && via.montoEstimadoEfectivoUsd != null) {
    obsParts.push(
      `Costo histórico ref. saldo: USD ${via.precioUnitarioHistoricoUsd.toFixed(2)}/u × ${cantidadCompra} = USD ${via.montoEstimadoEfectivoUsd.toFixed(2)}`,
    );
  }
  if (input.porVerificar) obsParts.push('Material texto libre — por verificar en catálogo');

  const row: Record<string, unknown> = {
    material_txt: materialTxt,
    cantidad,
    unidad: normalizarUnidadProcura(input.unidad),
    estado,
    prioridad: input.prioridad,
    capitulo_maestro_id: capitulo.id,
    monto_estimado_usd: montoSaldo ?? via.montoEstimadoEfectivoUsd ?? input.montoEstimadoUsd ?? null,
    es_consumible: Boolean(input.esConsumible),
    via_rapida: via.califica,
    observaciones: obsParts.join('\n').slice(0, 2000),
    solicitante_nombre: input.usuario.nombre.slice(0, 150),
    solicitante_telegram_chat_id: input.usuario.telegram_id,
    cantidad_despacho: evalStock.cantidadDespacho,
    cantidad_compra: cantidadCompra,
    stock_almacen_detectado: evalStock.stockDisponible,
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

  if (out.id) {
    try {
      await evaluarStockProcuraRegistro(supabase, String(out.id), {
        proyecto_id: proyectoId,
        material_id: materialId,
        cantidad,
      });
    } catch (e) {
      console.warn('[registrarProcuraDepartamento] stock registro', e);
    }
  }

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

  let compraEmitidaViaRapida = false;
  const necesitaAbastecimientoViaRapida = Boolean(via.califica && out.id);

  return {
    data: {
      id: String(out.id),
      ticket: String(out.ticket ?? ''),
      estado: out.estado,
      viaRapida: Boolean(out.via_rapida),
      motivoVia: via.motivo,
      errorConsultaHistorico: Boolean(via.errorConsultaHistorico),
      stockSuficiente: false,
      cantidadCompra,
      stockDisponible: evalStock.stockDisponible,
      alertaPmAdminEnviada,
      alertaPmAdminDms,
      compraEmitidaViaRapida,
      necesitaAbastecimientoViaRapida,
    },
    error: null,
  };
}

/** Aprobador / Administrador: PM aprueba → avisa comprador; en_compra al vincular factura. */
export async function resolverProcuraDepartamento(
  supabase: SupabaseClient,
  params: {
    procuraId: string;
    accion: 'aprobar' | 'rechazar';
    aprobadorTelegramId: number;
    aprobadorNombre: string;
    motivoRechazo?: string | null;
    auditoriaSupervisor?: ContextoAuditoriaSupervisor | null;
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

    const { data: prev } = await supabase
      .from('ci_procuras')
      .select('estado')
      .eq('id', params.procuraId.trim())
      .maybeSingle();

    const est = String((prev as { estado?: string } | null)?.estado ?? '').toLowerCase();
    if (est !== 'pendiente_pm') {
      return {
        ok: false,
        error:
          est === 'solicitada'
            ? 'La procura espera revisión de fondos del Contador.'
            : 'La procura ya fue resuelta.',
      };
    }

    const resultado = await rechazarProcuraConMotivo(supabase, {
      procuraId: params.procuraId,
      motivo,
      aprobadorNombre: params.aprobadorNombre,
      auditoriaSupervisor: params.auditoriaSupervisor,
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

  const { data: prevAprob } = await supabase
    .from('ci_procuras')
    .select('estado,material_txt,solicitante_telegram_chat_id,ticket')
    .eq('id', params.procuraId.trim())
    .maybeSingle();

  const estAprob = String((prevAprob as { estado?: string } | null)?.estado ?? '').toLowerCase();
  if (estAprob !== 'pendiente_pm') {
    return {
      ok: false,
      error:
        estAprob === 'solicitada'
          ? 'La procura espera revisión de fondos del Contador.'
          : 'La procura ya fue resuelta.',
    };
  }

  const abas = await procesarAbastecimientoProcuraAprobada(supabase, {
    procuraId: params.procuraId,
    autorNombre: params.aprobadorNombre,
    auditoriaSupervisor: params.auditoriaSupervisor,
  });

  if (!abas.ok) {
    return { ok: false, error: abas.error };
  }

  await actualizarTicketProcuraSolicitante(supabase, params.procuraId, {
    pmAprobadorNombre: params.aprobadorNombre,
    ordenCompraEmitida: Boolean(abas.compraEmitida),
    despachoCodigo: abas.despachoCodigo ?? null,
  });

  return {
    ok: true,
    ticket: abas.ticket,
    estado: abas.estado ?? 'aprobada',
    compradoresNotificados: abas.compraEmitida ? 1 : 0,
  };
}
