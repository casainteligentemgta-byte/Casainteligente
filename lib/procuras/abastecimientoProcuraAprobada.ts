import type { SupabaseClient } from '@supabase/supabase-js';
import { obtenerConfigTelegramAlmacenProyecto } from '@/lib/almacen/depositarioObra';
import { completarTransferenciaInventario } from '@/lib/almacen/completarTransferenciaInventario';
import { crearTransferenciaInventario } from '@/lib/almacen/crearTransferenciaInventario';
import { esUbicacionAlmacenFisico } from '@/lib/almacen/inventarioFiltroUbicacion';
import { getStockRealObra } from '@/lib/almacen/getStockRealObra';
import { asegurarUbicacionObra } from '@/lib/almacen/ubicacionesInventario';
import { etiquetaCapituloMaestro } from '@/lib/compras/capitulosMaestro';
import {
  cargarProcuraOrdenCompra,
  emitirOrdenCompraProcura,
  type ProcuraOrdenCompraRow,
} from '@/lib/procuras/emitirOrdenCompraProcura';
import { etiquetaEstadoProcura } from '@/lib/procuras/procuraEstados';
import { sendTelegramMessage } from '@/lib/telegram/botApi';

export const CB_PROCURA_ABASTECIMIENTO_OK = 'cmp:prc_abas:';

export type EvaluacionAbastecimientoProcura = {
  stockDisponible: number;
  cantidadSolicitada: number;
  cantidadDespacho: number;
  cantidadCompra: number;
  origenUbicacionId: string | null;
  origenUbicacionNombre: string | null;
};

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function nombreProyecto(
  rel: { nombre?: string } | { nombre?: string }[] | null | undefined,
): string {
  if (!rel) return 'Obra';
  if (Array.isArray(rel)) return rel[0]?.nombre?.trim() || 'Obra';
  return rel.nombre?.trim() || 'Obra';
}

export async function cargarProcuraAbastecimiento(
  supabase: SupabaseClient,
  procuraId: string,
): Promise<
  | (ProcuraOrdenCompraRow & {
      proyecto_id: string | null;
      material_id: string | null;
      capitulo_maestro_id: string | null;
    })
  | null
> {
  const { data, error } = await supabase
    .from('ci_procuras')
    .select(
      'id,ticket,estado,material_txt,material_id,cantidad,unidad,solicitante_nombre,solicitante_telegram_chat_id,prioridad,monto_estimado_usd,observaciones,proyecto_id,capitulo_maestro_id,cantidad_despacho,cantidad_compra,stock_almacen_detectado,ci_proyectos(nombre),ci_entidades(nombre),ci_compras_capitulos_maestro(codigo,nombre)',
    )
    .eq('id', procuraId.trim())
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as ProcuraOrdenCompraRow & {
    proyecto_id: string | null;
    material_id: string | null;
    capitulo_maestro_id: string | null;
  };
}

export async function evaluarAbastecimientoProcura(
  supabase: SupabaseClient,
  procura: {
    proyecto_id: string | null;
    material_id: string | null;
    cantidad: number;
  },
): Promise<EvaluacionAbastecimientoProcura> {
  const cantidadSolicitada = Number(procura.cantidad);
  const proyectoId = procura.proyecto_id?.trim() || null;
  const materialId = procura.material_id?.trim() || null;

  if (!proyectoId || !materialId || !Number.isFinite(cantidadSolicitada) || cantidadSolicitada <= 0) {
    return {
      stockDisponible: 0,
      cantidadSolicitada,
      cantidadDespacho: 0,
      cantidadCompra: cantidadSolicitada,
      origenUbicacionId: null,
      origenUbicacionNombre: null,
    };
  }

  const filas = await getStockRealObra(supabase, proyectoId, {
    materialId,
    soloConStock: true,
  });

  let mejor: { ubicacion_id: string; ubicacion_nombre: string; qty: number } | null = null;
  let stockTotal = 0;

  for (const f of filas) {
    if (!esUbicacionAlmacenFisico(f.ubicacion_tipo)) continue;
    stockTotal += f.cantidad_disponible;
    if (!mejor || f.cantidad_disponible > mejor.qty) {
      mejor = {
        ubicacion_id: f.ubicacion_id,
        ubicacion_nombre: f.ubicacion_nombre,
        qty: f.cantidad_disponible,
      };
    }
  }

  const cantidadDespacho = Math.min(cantidadSolicitada, stockTotal);
  const cantidadCompra = Math.max(0, cantidadSolicitada - cantidadDespacho);

  return {
    stockDisponible: stockTotal,
    cantidadSolicitada,
    cantidadDespacho,
    cantidadCompra,
    origenUbicacionId: mejor?.ubicacion_id ?? null,
    origenUbicacionNombre: mejor?.ubicacion_nombre ?? null,
  };
}

/** Evalúa stock en obra y persiste split despacho/compra al registrar (vía larga). */
export async function evaluarStockProcuraRegistro(
  supabase: SupabaseClient,
  procuraId: string,
  params: {
    proyecto_id: string | null;
    material_id: string | null;
    cantidad: number;
  },
): Promise<EvaluacionAbastecimientoProcura> {
  const evaluacion = await evaluarAbastecimientoProcura(supabase, params);
  await persistirEvaluacionAbastecimiento(supabase, procuraId, evaluacion);
  return evaluacion;
}

async function persistirEvaluacionAbastecimiento(
  supabase: SupabaseClient,
  procuraId: string,
  evaluacion: EvaluacionAbastecimientoProcura,
): Promise<void> {
  const { error } = await supabase
    .from('ci_procuras')
    .update({
      cantidad_despacho: evaluacion.cantidadDespacho,
      cantidad_compra: evaluacion.cantidadCompra,
      stock_almacen_detectado: evaluacion.stockDisponible,
      verificacion_almacen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', procuraId.trim());

  if (error && !/cantidad_despacho|42P01|schema cache/i.test(error.message)) {
    throw new Error(error.message);
  }
}

function resumenPlanAbastecimiento(evaluacion: EvaluacionAbastecimientoProcura): string {
  const { cantidadDespacho, cantidadCompra, stockDisponible } = evaluacion;
  if (cantidadDespacho > 0 && cantidadCompra > 0) {
    return (
      `📦 <b>Plan:</b> despachar <b>${cantidadDespacho}</b> desde almacén y ` +
      `comprar el saldo <b>${cantidadCompra}</b>.`
    );
  }
  if (cantidadDespacho > 0) {
    return `📦 <b>Plan:</b> despachar <b>${cantidadDespacho}</b> desde almacén (stock ${stockDisponible}).`;
  }
  return `🛒 <b>Plan:</b> sin stock en almacén — generar <b>orden de compra</b> por ${evaluacion.cantidadSolicitada}.`;
}

export async function enviarOrdenVerificacionDepositarioProcura(
  supabase: SupabaseClient,
  procura: ProcuraOrdenCompraRow & { proyecto_id: string | null },
  evaluacion: EvaluacionAbastecimientoProcura,
): Promise<{ enviado: boolean; destinos: number }> {
  const proyectoId = procura.proyecto_id?.trim();
  if (!proyectoId) return { enviado: false, destinos: 0 };

  const config = await obtenerConfigTelegramAlmacenProyecto(supabase, proyectoId);
  const destinos = new Set<string>();

  const depChat = config?.depositarioAsignado?.telegram_chat_id;
  if (depChat != null && Number.isFinite(depChat)) destinos.add(String(depChat));
  const grupo = config?.telegramGrupoAlmacenId;
  if (grupo != null && Number.isFinite(grupo)) destinos.add(String(grupo));

  if (!destinos.size) return { enviado: false, destinos: 0 };

  const cap = procura.ci_compras_capitulos_maestro;
  const capLabel = cap
    ? etiquetaCapituloMaestro({
        codigo: String(cap.codigo ?? ''),
        nombre: String(cap.nombre ?? ''),
      })
    : nombreProyecto(procura.ci_proyectos);

  const msg =
    '📋 <b>ORDEN DE VERIFICACIÓN DE ALMACÉN</b>\n\n' +
    `🎫 <b>${escHtml(procura.ticket)}</b>\n` +
    `📁 ${escHtml(capLabel)}\n` +
    `📦 ${escHtml(procura.material_txt)}\n` +
    `🔢 Solicitado: <b>${Number(procura.cantidad).toLocaleString('es-VE')} ${escHtml(procura.unidad)}</b>\n` +
    `🏪 Stock sistema en almacén: <b>${evaluacion.stockDisponible.toLocaleString('es-VE')}</b>` +
    (evaluacion.origenUbicacionNombre
      ? ` (${escHtml(evaluacion.origenUbicacionNombre)})`
      : '') +
    '\n\n' +
    resumenPlanAbastecimiento(evaluacion) +
    '\n\nConfirma la verificación física y ejecuta el abastecimiento:';

  const reply_markup = {
    inline_keyboard: [
      [
        {
          text: '✅ Confirmar verificación y abastecer',
          callback_data: `${CB_PROCURA_ABASTECIMIENTO_OK}${procura.id}`,
        },
      ],
    ],
  };

  let enviados = 0;
  for (const chatId of Array.from(destinos)) {
    try {
      await sendTelegramMessage(chatId, msg, { parse_mode: 'HTML', reply_markup });
      enviados += 1;
    } catch (e) {
      console.warn('[abastecimientoProcura] verificación depositario', chatId, e);
    }
  }

  return { enviado: enviados > 0, destinos: enviados };
}

/** Orden al depositario cuando hay stock suficiente al registrar la procura. */
export async function enviarOrdenDespachoDepositarioProcura(
  supabase: SupabaseClient,
  procura: ProcuraOrdenCompraRow & {
    proyecto_id: string | null;
    solicitante_nombre?: string | null;
  },
  evaluacion: EvaluacionAbastecimientoProcura,
): Promise<{ enviado: boolean; destinos: number }> {
  const proyectoId = procura.proyecto_id?.trim();
  if (!proyectoId) return { enviado: false, destinos: 0 };

  const config = await obtenerConfigTelegramAlmacenProyecto(supabase, proyectoId);
  const destinos = new Set<string>();

  const depChat = config?.depositarioAsignado?.telegram_chat_id;
  if (depChat != null && Number.isFinite(depChat)) destinos.add(String(depChat));
  const grupo = config?.telegramGrupoAlmacenId;
  if (grupo != null && Number.isFinite(grupo)) destinos.add(String(grupo));

  if (!destinos.size) return { enviado: false, destinos: 0 };

  const cap = procura.ci_compras_capitulos_maestro;
  const capLabel = cap
    ? etiquetaCapituloMaestro({
        codigo: String(cap.codigo ?? ''),
        nombre: String(cap.nombre ?? ''),
      })
    : nombreProyecto(procura.ci_proyectos);

  const solicitante = procura.solicitante_nombre?.trim() || '—';
  const almacen = evaluacion.origenUbicacionNombre?.trim() || 'Almacén obra';

  const msg =
    '📋 <b>SOLICITUD DE MATERIAL — DESPACHO ALMACÉN</b>\n\n' +
    `🎫 <b>${escHtml(procura.ticket)}</b>\n` +
    `👷 <b>Solicitó:</b> ${escHtml(solicitante)}\n` +
    `📁 ${escHtml(capLabel)}\n` +
    `📦 ${escHtml(procura.material_txt)}\n` +
    `🔢 <b>Cantidad:</b> ${Number(procura.cantidad).toLocaleString('es-VE')} ${escHtml(procura.unidad)}\n` +
    `🏪 <b>Stock sistema:</b> ${evaluacion.stockDisponible.toLocaleString('es-VE')} (${escHtml(almacen)})\n\n` +
    'Verifica físicamente y despacha el material al solicitante.';

  const reply_markup = {
    inline_keyboard: [
      [
        {
          text: '✅ Confirmar despacho',
          callback_data: `${CB_PROCURA_ABASTECIMIENTO_OK}${procura.id}`,
        },
      ],
    ],
  };

  let enviados = 0;
  for (const chatId of Array.from(destinos)) {
    try {
      await sendTelegramMessage(chatId, msg, { parse_mode: 'HTML', reply_markup });
      enviados += 1;
    } catch (e) {
      console.warn('[abastecimientoProcura] despacho depositario', chatId, e);
    }
  }

  return { enviado: enviados > 0, destinos: enviados };
}

async function ejecutarDespachoProcura(
  supabase: SupabaseClient,
  params: {
    procura: ProcuraOrdenCompraRow & {
      proyecto_id: string | null;
      material_id: string | null;
    };
    evaluacion: EvaluacionAbastecimientoProcura;
    autorNombre: string;
  },
): Promise<{ ok: boolean; codigo?: string; error?: string }> {
  const { procura, evaluacion } = params;
  const proyectoId = procura.proyecto_id?.trim();
  const materialId = procura.material_id?.trim();
  const origenId = evaluacion.origenUbicacionId;

  if (
    evaluacion.cantidadDespacho <= 0 ||
    !proyectoId ||
    !materialId ||
    !origenId
  ) {
    return { ok: true };
  }

  const nombreObra = nombreProyecto(procura.ci_proyectos);
  const destinoId = await asegurarUbicacionObra(supabase, proyectoId, nombreObra);
  if (origenId === destinoId) {
    return { ok: false, error: 'Origen y destino de despacho son la misma ubicación.' };
  }

  try {
    const { transferenciaId, codigo } = await crearTransferenciaInventario(supabase, {
      origen_ubicacion_id: origenId,
      destino_ubicacion_id: destinoId,
      ci_proyecto_id: proyectoId,
      tipo_movimiento: 'salida_obra',
      observaciones:
        `[Procura ${procura.ticket}] Despacho automático tras verificación depositario · ${params.autorNombre}`.slice(
          0,
          500,
        ),
      lineas: [
        {
          material_id: materialId,
          cantidad: evaluacion.cantidadDespacho,
          imputaciones: [],
        },
      ],
    });

    await completarTransferenciaInventario(supabase, transferenciaId);

    await supabase
      .from('ci_procuras')
      .update({
        abastecimiento_codigo_despacho: codigo,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', procura.id);

    return { ok: true, codigo };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al despachar' };
  }
}

async function transicionProcura(
  supabase: SupabaseClient,
  procuraId: string,
  nuevoEstado: string,
  motivo: string,
): Promise<void> {
  const { error } = await supabase.rpc(
    'procesar_procuras_lote' as 'ci_registrar_ingreso_manual_campo',
    {
      p_ids: [procuraId.trim()],
      p_nuevo_estado: nuevoEstado,
      p_motivo: motivo.slice(0, 500),
    } as never,
  );
  if (error) throw new Error(error.message);
}

export type ResultadoAbastecimientoProcura = {
  ok: boolean;
  ticket?: string;
  estado?: string;
  error?: string;
  verificacionEnviada?: boolean;
  despachoCodigo?: string;
  compraEmitida?: boolean;
  modo?: 'pendiente_depositario' | 'ejecutado';
};

/** PM aprueba: evalúa stock, orden al depositario y (si no hay depositario) ejecuta de inmediato. */
export async function procesarAbastecimientoProcuraAprobada(
  supabase: SupabaseClient,
  params: { procuraId: string; autorNombre: string },
): Promise<ResultadoAbastecimientoProcura> {
  const procuraId = params.procuraId.trim();
  let procura = await cargarProcuraAbastecimiento(supabase, procuraId);
  if (!procura) return { ok: false, error: 'Procura no encontrada.' };

  const estado = String(procura.estado ?? '').toLowerCase();
  if (estado === 'pendiente_pm') {
    await transicionProcura(
      supabase,
      procuraId,
      'aprobada',
      `Aprobada por ${params.autorNombre} — verificación de almacén`,
    );
    procura = (await cargarProcuraAbastecimiento(supabase, procuraId)) ?? procura;
  } else if (estado === 'solicitada') {
    return {
      ok: false,
      error: 'La procura espera validación del Administrador (viabilidad presupuestaria).',
    };
  }

  const evaluacion = await evaluarAbastecimientoProcura(supabase, procura);
  await persistirEvaluacionAbastecimiento(supabase, procuraId, evaluacion);

  const verificacion = await enviarOrdenVerificacionDepositarioProcura(
    supabase,
    procura,
    evaluacion,
  );

  if (verificacion.enviado) {
    return {
      ok: true,
      ticket: procura.ticket,
      estado: 'aprobada',
      verificacionEnviada: true,
      modo: 'pendiente_depositario',
    };
  }

  return confirmarAbastecimientoProcura(supabase, {
    procuraId,
    autorNombre: params.autorNombre,
  });
}

/** Depositario confirma (o fallback sin depositario): despacho + orden de compra según stock. */
export async function confirmarAbastecimientoProcura(
  supabase: SupabaseClient,
  params: { procuraId: string; autorNombre: string },
): Promise<ResultadoAbastecimientoProcura> {
  const procuraId = params.procuraId.trim();
  const procura = await cargarProcuraAbastecimiento(supabase, procuraId);
  if (!procura) return { ok: false, error: 'Procura no encontrada.' };

  const evaluacion = await evaluarAbastecimientoProcura(supabase, procura);
  const despacho = await ejecutarDespachoProcura(supabase, {
    procura,
    evaluacion,
    autorNombre: params.autorNombre,
  });

  if (!despacho.ok) {
    return { ok: false, error: despacho.error ?? 'No se pudo despachar desde almacén.' };
  }

  let estadoFinal = procura.estado;
  let compraEmitida = false;
  const parcial = evaluacion.cantidadDespacho > 0 && evaluacion.cantidadCompra > 0;
  const soloDespacho = evaluacion.cantidadDespacho > 0 && evaluacion.cantidadCompra <= 0;
  const soloCompra = evaluacion.cantidadDespacho <= 0 && evaluacion.cantidadCompra > 0;

  if (parcial) {
    await transicionProcura(
      supabase,
      procuraId,
      'recibida_parcial',
      `Despacho parcial ${despacho.codigo ?? ''}; compra pendiente por saldo`,
    );
    estadoFinal = 'recibida_parcial';
  } else if (soloDespacho) {
    await transicionProcura(
      supabase,
      procuraId,
      'recibida',
      `Material despachado desde almacén (${despacho.codigo ?? 'SAL'})`,
    );
    estadoFinal = 'recibida';
  }

  if (soloCompra || parcial) {
    const oc = await emitirOrdenCompraProcura(supabase, {
      procuraId,
      autorNombre: params.autorNombre,
      motivo: parcial
        ? `Orden de compra por saldo (${evaluacion.cantidadCompra} ${procura.unidad}) tras despacho ${despacho.codigo ?? ''}`
        : 'Orden de compra — sin stock en almacén',
      cantidadCompra: parcial || soloCompra ? evaluacion.cantidadCompra : null,
    });
    if (!oc.ok) {
      return { ok: false, error: oc.error ?? 'No se pudo emitir orden de compra.' };
    }
    compraEmitida = true;
    estadoFinal = parcial ? 'recibida_parcial' : 'aprobada';
  }

  return {
    ok: true,
    ticket: procura.ticket,
    estado: estadoFinal,
    despachoCodigo: despacho.codigo,
    compraEmitida,
    modo: 'ejecutado',
  };
}

export function esCallbackAbastecimientoProcura(data: string): boolean {
  return data.startsWith(CB_PROCURA_ABASTECIMIENTO_OK);
}

export function parseCallbackAbastecimientoProcura(data: string): string | null {
  if (!data.startsWith(CB_PROCURA_ABASTECIMIENTO_OK)) return null;
  const id = data.slice(CB_PROCURA_ABASTECIMIENTO_OK.length).trim();
  return id.length >= 32 ? id : null;
}

export function etiquetaResultadoAbastecimiento(r: ResultadoAbastecimientoProcura): string {
  if (!r.ok) return r.error ?? 'Error de abastecimiento';
  if (r.modo === 'pendiente_depositario') {
    return 'Aprobada — orden de verificación enviada al depositario.';
  }
  const partes: string[] = [];
  if (r.despachoCodigo) partes.push(`Despacho ${r.despachoCodigo}`);
  if (r.compraEmitida) partes.push('Orden enviada al comprador (pendiente factura)');
  if (r.estado) partes.push(etiquetaEstadoProcura(r.estado));
  return partes.join(' · ') || 'Abastecimiento procesado';
}
