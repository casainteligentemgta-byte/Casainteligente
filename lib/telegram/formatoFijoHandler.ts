import type { SupabaseClient } from '@supabase/supabase-js';
import { aplicarDeltaStockInventario } from '@/lib/almacen/aplicarDeltaStockInventario';
import { fijarStockMaterialUbicacion } from '@/lib/almacen/fijarStockMaterialUbicacion';
import { listarMaterialesObraRecepcion } from '@/lib/almacen/listarMaterialesObraRecepcion';
import { assertUbicacionPerteneceAProyecto } from '@/lib/almacen/validarUbicacionProyecto';
import { sincronizarContabilidadDesdeRecepcionCampo } from '@/lib/contabilidad/sincronizarContabilidadDesdeRecepcionCampo';
import { resolverEntidadIdDesdeProyecto } from '@/lib/contabilidad/resolverEntidadProyecto';
import { sendTelegramMessage } from '@/lib/telegram/botApi';
import { MENSAJE_NO_DISPONIBLE_COMPRADOR, esChatComprador } from '@/lib/telegram/compradorRestricciones';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import {
  emparejarLineaFormatoFijo,
  validarStockSalidaFormatoFijo,
  type MaterialFormatoFijo,
  type ProblemaLineaFormatoFijo,
} from '@/lib/telegram/formatoFijoMatching';
import {
  MENSAJE_FORMATO_FIJO_AYUDA,
  esMensajeFormatoFijo,
  escHtmlFormatoFijo,
  etiquetaTipoFormatoFijo,
  fechaIsoCaracas,
  fechaMovimientoDesdeMensajeTelegram,
  formatearFechaMensajeCaracas,
  parsearFormatoFijoMovimiento,
  resolverDocIngresoFormatoFijo,
  resumenLineasFormatoFijo,
  type MensajeTelegramFecha,
  type MovimientoFormatoFijo,
} from '@/lib/telegram/formatoFijoMovimiento';
import { esChatDepositarioNomina } from '@/lib/telegram/menuDepositarioTelegram';
import {
  alcanceObrasDepositarioParaChat,
  MENSAJE_OBRA_NO_ASIGNADA_DEPOSITARIO,
  MENSAJE_SIN_OBRA_DEPOSITARIO,
} from '@/lib/telegram/obrasDepositarioTelegram';
import { esChatAdministradorTelegram } from '@/lib/telegram/permisosAlmacenTelegram';
import { almacenOrigenObra } from '@/lib/telegram/salidaOrigenPicker';
import { normalizarTextoMaterial } from '@/lib/almacen/normalizarTextoMaterial';

export const TABLA_MOVIMIENTOS_FORMATO = 'ci_telegram_movimientos_formato';

export type ResultadoFormatoFijo = {
  handled: boolean;
  duplicate?: boolean;
  pendiente?: boolean;
  registrado?: boolean;
};

type FilaFormato = {
  id?: string;
  chat_id?: string;
  telegram_message_id?: number;
  estado?: string;
  respuesta_html?: string | null;
};

function tablaAusente(error: { code?: string; message?: string } | null): boolean {
  return error?.code === '42P01' || /does not exist|schema cache/i.test(error?.message ?? '');
}

async function catalogoMaterialesAlmacen(
  supabase: SupabaseClient,
  params: { ubicacionId: string; proyectoId: string; incluirObra: boolean },
): Promise<MaterialFormatoFijo[]> {
  const byId = new Map<string, MaterialFormatoFijo>();

  const { data: stockRows, error: stockErr } = await supabase
    .from('inventario_stock')
    .select('material_id, cantidad_disponible')
    .eq('ubicacion_id', params.ubicacionId)
    .limit(400);

  if (stockErr && !tablaAusente(stockErr)) throw new Error(stockErr.message);

  const ids = Array.from(
    new Set((stockRows ?? []).map((r) => String(r.material_id ?? '').trim()).filter(Boolean)),
  );
  const stockPorId = new Map(
    (stockRows ?? []).map((r) => [String(r.material_id), Number(r.cantidad_disponible) || 0]),
  );

  if (ids.length) {
    const { data: mats, error: matErr } = await supabase
      .from('global_inventory')
      .select('id,name,sap_code,unit')
      .in('id', ids.slice(0, 400));
    if (matErr && !tablaAusente(matErr)) throw new Error(matErr.message);
    for (const row of mats ?? []) {
      const id = String(row.id);
      byId.set(id, {
        id,
        name: String(row.name ?? 'Material').trim() || 'Material',
        sap_code: String(row.sap_code ?? '').trim() || null,
        unit: String(row.unit ?? 'UND').trim() || 'UND',
        cantidadDisponible: stockPorId.get(id) ?? 0,
        enAlmacen: true,
      });
    }
  }

  if (params.incluirObra) {
    try {
      const obra = await listarMaterialesObraRecepcion(supabase, params.proyectoId);
      for (const m of obra) {
        const prev = byId.get(m.id);
        if (prev) continue;
        byId.set(m.id, {
          ...m,
          cantidadDisponible: 0,
          enAlmacen: false,
        });
      }
    } catch (e) {
      console.warn('[formatoFijo] catálogo obra', e);
    }
  }

  return Array.from(byId.values());
}

function coincidirObraPorNombre<T extends { id: string; nombre: string }>(
  nombre: string,
  obras: T[],
): T | null {
  const t = normalizarTextoMaterial(nombre);
  if (!t) return null;
  const exactas = obras.filter((o) => normalizarTextoMaterial(o.nombre) === t);
  if (exactas.length === 1) return exactas[0] ?? null;
  const parciales = obras.filter((o) => {
    const n = normalizarTextoMaterial(o.nombre);
    return n.includes(t) || t.includes(n);
  });
  return parciales.length === 1 ? parciales[0] ?? null : null;
}

async function obrasDelChat(
  supabase: SupabaseClient,
  chatId: string,
): Promise<{ id: string; nombre: string; entidad_id?: string | null }[]> {
  const alcance = await alcanceObrasDepositarioParaChat(supabase, chatId);
  let q = supabase.from('ci_proyectos').select('id,nombre,entidad_id');
  if (alcance instanceof Set) {
    const ids = Array.from(alcance);
    if (!ids.length) return [];
    q = q.in('id', ids);
  }
  const { data, error } = await q.order('nombre').limit(80);
  if (error) throw new Error(error.message);
  let filas = (data ?? []) as Array<{ id: string; nombre?: string | null; entidad_id?: string | null; activo?: boolean }>;
  if (alcance instanceof Set) {
    filas = filas.filter((f) => alcance.has(String(f.id)));
  }
  return filas.map((f) => ({
    id: String(f.id),
    nombre: String(f.nombre ?? '').trim() || 'Obra',
    entidad_id: f.entidad_id ?? null,
  }));
}

async function resolverContextoObra(
  supabase: SupabaseClient,
  chatId: string,
  mov: MovimientoFormatoFijo,
): Promise<
  | { ok: true; proyectoId: string; nombreObra: string; ubicacionId: string; ubicacionNombre: string }
  | { ok: false; mensaje: string }
> {
  const alcance = await alcanceObrasDepositarioParaChat(supabase, chatId);
  if (alcance === null) {
    const admin = await esChatAdministradorTelegram(supabase, chatId);
    if (!admin) {
      return {
        ok: false,
        mensaje:
          '⛔ El formato fijo es para el depositario de la obra. Use /ingreso o /salida si tiene permiso.',
      };
    }
  }

  const obras = await obrasDelChat(supabase, chatId);
  if (!obras.length) {
    return { ok: false, mensaje: MENSAJE_SIN_OBRA_DEPOSITARIO };
  }

  let elegida = obras.length === 1 ? obras[0]! : null;
  if (mov.obra) {
    elegida = coincidirObraPorNombre(mov.obra, obras);
    if (!elegida) {
      return {
        ok: false,
        mensaje:
          `⚠️ No identifiqué la obra «${escHtmlFormatoFijo(mov.obra)}». ` +
          `Use <code>obra: ${escHtmlFormatoFijo(obras[0]?.nombre ?? '')}</code>.`,
      };
    }
  }
  if (!elegida) {
    const estado = await getTelegramEstado(supabase, chatId);
    const pid = String(estado.proyecto_id ?? '').trim();
    if (pid) elegida = obras.find((o) => o.id === pid) ?? null;
  }
  if (!elegida) {
    const lista = obras
      .slice(0, 8)
      .map((o) => `• ${escHtmlFormatoFijo(o.nombre)}`)
      .join('\n');
    return {
      ok: false,
      mensaje:
        '⚠️ Tienes varias obras. Agrega una línea <code>obra: nombre</code>.\n' + lista,
    };
  }

  if (alcance instanceof Set && !alcance.has(elegida.id)) {
    return { ok: false, mensaje: MENSAJE_OBRA_NO_ASIGNADA_DEPOSITARIO };
  }

  const almacen = await almacenOrigenObra(supabase, elegida.id, chatId);
  if (!almacen) {
    return {
      ok: false,
      mensaje: `⚠️ La obra <b>${escHtmlFormatoFijo(elegida.nombre)}</b> no tiene almacén.`,
    };
  }
  return {
    ok: true,
    proyectoId: elegida.id,
    nombreObra: elegida.nombre,
    ubicacionId: almacen.id,
    ubicacionNombre: almacen.nombre,
  };
}

type Claim =
  | { duplicate: true; respuesta: string }
  | { duplicate: false; id: string | null };

async function claimMensajeFormatoFijo(
  supabase: SupabaseClient,
  params: {
    chatId: string;
    messageId: number;
    fecha: Date;
    tipo: string;
    texto: string;
  },
): Promise<Claim> {
  const { data: existente, error: selErr } = await supabase
    .from(TABLA_MOVIMIENTOS_FORMATO)
    .select('id,estado,respuesta_html')
    .eq('chat_id', params.chatId)
    .eq('telegram_message_id', params.messageId)
    .maybeSingle();

  if (tablaAusente(selErr)) {
    return claimViaEstadoTelegram(supabase, params);
  }
  if (selErr) throw new Error(selErr.message);
  const prev = existente as FilaFormato | null;
  if (prev?.id) {
    return {
      duplicate: true,
      respuesta:
        String(prev.respuesta_html ?? '').trim() ||
        '✅ Este mensaje ya se procesó. No se duplicó el movimiento.',
    };
  }

  const { data: insertada, error: insErr } = await supabase
    .from(TABLA_MOVIMIENTOS_FORMATO)
    .insert({
      chat_id: params.chatId,
      telegram_message_id: params.messageId,
      telegram_date: params.fecha.toISOString(),
      tipo: params.tipo,
      estado: 'procesando',
      texto_original: params.texto.slice(0, 8000),
    })
    .select('id')
    .single();

  if (insErr?.code === '23505') {
    const { data: otra } = await supabase
      .from(TABLA_MOVIMIENTOS_FORMATO)
      .select('respuesta_html')
      .eq('chat_id', params.chatId)
      .eq('telegram_message_id', params.messageId)
      .maybeSingle();
    return {
      duplicate: true,
      respuesta:
        String((otra as FilaFormato | null)?.respuesta_html ?? '').trim() ||
        '✅ Este mensaje ya se procesó. No se duplicó el movimiento.',
    };
  }
  if (tablaAusente(insErr)) {
    return claimViaEstadoTelegram(supabase, params);
  }
  if (insErr) throw new Error(insErr.message);
  return { duplicate: false, id: String((insertada as FilaFormato | null)?.id ?? '') || null };
}

async function claimViaEstadoTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; messageId: number; texto: string },
): Promise<Claim> {
  const estado = await getTelegramEstado(supabase, params.chatId);
  const vistos = (estado.metadata.formato_fijo_vistos ?? {}) as Record<string, string>;
  const clave = String(params.messageId);
  if (Object.prototype.hasOwnProperty.call(vistos, clave)) {
    return {
      duplicate: true,
      respuesta: vistos[clave] || '✅ Este mensaje ya se procesó. No se duplicó el movimiento.',
    };
  }
  const next = { ...vistos, [clave]: '' };
  const keys = Object.keys(next);
  if (keys.length > 40) {
    for (const k of keys.slice(0, keys.length - 40)) delete next[k];
  }
  await setTelegramContexto(supabase, params.chatId, {
    metadata: { formato_fijo_vistos: next },
  });
  return { duplicate: false, id: null };
}

async function guardarRespuestaFormato(
  supabase: SupabaseClient,
  params: {
    chatId: string;
    messageId: number;
    id: string | null;
    estado: 'registrado' | 'pendiente_revision' | 'error';
    respuesta: string;
    patch?: Record<string, unknown>;
  },
): Promise<void> {
  if (params.id) {
    const { error } = await supabase
      .from(TABLA_MOVIMIENTOS_FORMATO)
      .update({
        estado: params.estado,
        respuesta_html: params.respuesta.slice(0, 4000),
        ...(params.patch ?? {}),
      })
      .eq('id', params.id);
    if (error && !tablaAusente(error)) {
      console.warn('[formatoFijo] update', error.message);
    }
  }
  const estado = await getTelegramEstado(supabase, params.chatId);
  const vistos = { ...((estado.metadata.formato_fijo_vistos ?? {}) as Record<string, string>) };
  vistos[String(params.messageId)] = params.respuesta.slice(0, 3500);
  await setTelegramContexto(supabase, params.chatId, {
    metadata: { formato_fijo_vistos: vistos },
  }).catch(() => undefined);
}

function mensajeProblemas(
  tipo: string,
  problemas: ProblemaLineaFormatoFijo[],
  extra?: string,
): string {
  const lineas = problemas.map(
    (p) => `⚠️ L${p.indice}: ${escHtmlFormatoFijo(p.lineaOriginal)} — ${escHtmlFormatoFijo(p.detalle)}`,
  );
  return (
    `⚠️ No registré ${escHtmlFormatoFijo(tipo)}. Quedó <b>pendiente de revisión</b> (no se movió stock).\n\n` +
    lineas.join('\n') +
    (extra ? `\n\n${extra}` : '') +
    '\n\nCorrija el nombre o la cantidad y reenvíe el mensaje, o use /ingreso · /salida con botones.'
  );
}

async function registrarIngresoEmergenciaFormato(
  supabase: SupabaseClient,
  params: {
    proyectoId: string;
    ubicacionId: string;
    proveedorNombre: string;
    numDoc: string;
    fecha: Date;
    chatId: string;
    lineas: Array<{ material_id: string; material_nombre: string; unidad: string; cantidad: number }>;
    observaciones: string;
    idempotencyKey: string;
  },
): Promise<{ ok: true; recepcionId: string } | { ok: false; error: string }> {
  const ubiOk = await assertUbicacionPerteneceAProyecto(
    supabase,
    params.ubicacionId,
    params.proyectoId,
  );
  if (!ubiOk.ok) return { ok: false, error: ubiOk.error };

  const lineasRpc = params.lineas.map((l) => ({
    material_id: l.material_id,
    cantidad: l.cantidad,
    unidad: l.unidad,
    descripcion: l.material_nombre,
    observaciones: params.observaciones,
    forma_ingreso: 'sin_nota',
  }));

  const { data: recepcionId, error: rpcErr } = await supabase.rpc(
    'ci_registrar_ingreso_manual_campo',
    {
      p_proyecto_id: params.proyectoId,
      p_ubicacion_id: params.ubicacionId,
      p_proveedor_id: null,
      p_tipo: 'emergencia',
      p_num_doc: params.numDoc,
      p_lineas: lineasRpc,
      p_usuario_id: null,
      p_procura_id: null,
      p_idempotency_key: params.idempotencyKey,
      p_precarga_id: null,
      p_proveedor_nombre: params.proveedorNombre.trim() || null,
      p_soporte_storage_path: null,
      p_soporte_file_name: null,
      p_soporte_mime_type: null,
    } as never,
  );

  if (rpcErr) return { ok: false, error: rpcErr.message ?? 'Error al registrar ingreso' };
  const id = String(recepcionId ?? '');
  if (!id) return { ok: false, error: 'No se obtuvo ID de recepción.' };

  await supabase
    .from('ci_recepciones_campo')
    .update({
      proveedor_nombre: params.proveedorNombre.trim() || 'Proveedor',
      observaciones: params.observaciones,
    } as never)
    .eq('id', id);

  const entidadId = await resolverEntidadIdDesdeProyecto(supabase, params.proyectoId);
  const conta = await sincronizarContabilidadDesdeRecepcionCampo(supabase, {
    recepcionCampoId: id,
    proyectoId: params.proyectoId,
    ubicacionId: params.ubicacionId,
    entidadId,
    proveedorNombre: params.proveedorNombre.trim() || 'Proveedor',
    numDoc: params.numDoc,
    tipoRecepcion: 'emergencia',
    lineas: params.lineas,
    fechaEmision: fechaIsoCaracas(params.fecha),
  });
  if (!conta.ok) {
    console.warn('[formatoFijo] contabilidad', conta.error);
  }

  return { ok: true, recepcionId: id };
}

export async function manejarComandoFormatoTelegram(chatId: string): Promise<void> {
  await sendTelegramMessage(chatId, MENSAJE_FORMATO_FIJO_AYUDA, { parse_mode: 'HTML' });
}

export async function manejarTextoFormatoFijo(
  supabase: SupabaseClient,
  params: {
    chatId: string;
    texto: string;
    messageId: number;
    message: MensajeTelegramFecha;
    userId?: string | null;
    username?: string | null;
  },
): Promise<ResultadoFormatoFijo> {
  const texto = params.texto.trim();
  if (!esMensajeFormatoFijo(texto)) return { handled: false };

  const parsed = parsearFormatoFijoMovimiento(texto);
  if (parsed.ok === false && parsed.motivo === 'no_es_formato') return { handled: false };

  if (await esChatComprador(supabase, params.chatId)) {
    await sendTelegramMessage(params.chatId, MENSAJE_NO_DISPONIBLE_COMPRADOR, {
      parse_mode: 'HTML',
    });
    return { handled: true };
  }

  const depositario = await esChatDepositarioNomina(supabase, params.chatId);
  const admin = await esChatAdministradorTelegram(supabase, params.chatId);
  if (!depositario && !admin) {
    await sendTelegramMessage(
      params.chatId,
      '⛔ El formato fijo es para el depositario de la obra.',
      { parse_mode: 'HTML' },
    );
    return { handled: true };
  }

  if (parsed.ok === false) {
    const hint =
      parsed.motivo === 'varios_tipos'
        ? 'Un mensaje = un movimiento. Envíe INGRESO, SALIDA o INVENTARIO por separado.'
        : 'Falta al menos una línea de artículo (ej. <code>20 cemento</code>).';
    await sendTelegramMessage(
      params.chatId,
      `⚠️ ${hint}\n\n${MENSAJE_FORMATO_FIJO_AYUDA}`,
      { parse_mode: 'HTML' },
    );
    return { handled: true };
  }

  const mov = parsed.movimiento;
  const fecha = fechaMovimientoDesdeMensajeTelegram(params.message);
  const fechaTxt = formatearFechaMensajeCaracas(fecha);

  const claim = await claimMensajeFormatoFijo(supabase, {
    chatId: params.chatId,
    messageId: params.messageId,
    fecha,
    tipo: mov.tipo,
    texto,
  });
  if (claim.duplicate) {
    await sendTelegramMessage(params.chatId, claim.respuesta, { parse_mode: 'HTML' });
    return { handled: true, duplicate: true };
  }

  const ctx = await resolverContextoObra(supabase, params.chatId, mov);
  if (!ctx.ok) {
    await guardarRespuestaFormato(supabase, {
      chatId: params.chatId,
      messageId: params.messageId,
      id: claim.id,
      estado: 'pendiente_revision',
      respuesta: ctx.mensaje,
    });
    await sendTelegramMessage(params.chatId, ctx.mensaje, { parse_mode: 'HTML' });
    return { handled: true, pendiente: true };
  }

  const catalogo = await catalogoMaterialesAlmacen(supabase, {
    ubicacionId: ctx.ubicacionId,
    proyectoId: ctx.proyectoId,
    incluirObra: mov.tipo === 'ingreso',
  });

  const matchesOk: Array<Extract<ReturnType<typeof emparejarLineaFormatoFijo>, { ok: true }>> = [];
  const problemas: ProblemaLineaFormatoFijo[] = [];
  for (const ln of mov.lineas) {
    const r = emparejarLineaFormatoFijo(ln, catalogo);
    if (r.ok) matchesOk.push(r);
    else problemas.push(r.problema);
  }

  if (mov.tipo === 'salida' && matchesOk.length) {
    problemas.push(...validarStockSalidaFormatoFijo(matchesOk));
  }

  const tipoEtiqueta = etiquetaTipoFormatoFijo(mov.tipo);
  if (problemas.length) {
    const respuesta = mensajeProblemas(tipoEtiqueta, problemas);
    await guardarRespuestaFormato(supabase, {
      chatId: params.chatId,
      messageId: params.messageId,
      id: claim.id,
      estado: 'pendiente_revision',
      respuesta,
      patch: {
        proyecto_id: ctx.proyectoId,
        ubicacion_id: ctx.ubicacionId,
        num_doc: mov.doc,
        proveedor_nombre: mov.proveedor,
        destino_uso: mov.destinoUso,
        lineas: mov.lineas,
        problemas,
      },
    });
    await sendTelegramMessage(params.chatId, respuesta, { parse_mode: 'HTML' });
    return { handled: true, pendiente: true };
  }

  const obsFecha = `Formato fijo Telegram · fecha del mensaje ${fechaTxt}`;
  const idempotencyKey = claim.id || `tg:${params.chatId}:${params.messageId}`;

  try {
    if (mov.tipo === 'ingreso') {
      const doc = resolverDocIngresoFormatoFijo({
        doc: mov.doc,
        fecha,
        chatId: params.chatId,
        messageId: params.messageId,
      });
      const resultado = await registrarIngresoEmergenciaFormato(supabase, {
        proyectoId: ctx.proyectoId,
        ubicacionId: ctx.ubicacionId,
        proveedorNombre: mov.proveedor?.trim() || 'Proveedor',
        numDoc: doc.doc,
        fecha,
        chatId: params.chatId,
        observaciones:
          `${obsFecha}${mov.proveedor ? ` · proveedor ${mov.proveedor}` : ''}` +
          (params.userId ? ` · Telegram user: ${params.userId}` : ''),
        idempotencyKey,
        lineas: matchesOk.map((m) => ({
          material_id: m.material.id,
          material_nombre: m.material.name,
          unidad: m.material.unit,
          cantidad: m.cantidad,
        })),
      });
      if (!resultado.ok) throw new Error(resultado.error);
      const resumen = resumenLineasFormatoFijo(
        matchesOk.map((m) => ({ cantidad: m.cantidad, nombre: m.material.name })),
      );
      const respuesta =
        `✅ Registré INGRESO doc ${escHtmlFormatoFijo(doc.doc)}: ${escHtmlFormatoFijo(resumen)}` +
        ` (fecha del mensaje ${fechaTxt})`;
      await guardarRespuestaFormato(supabase, {
        chatId: params.chatId,
        messageId: params.messageId,
        id: claim.id,
        estado: 'registrado',
        respuesta,
        patch: {
          proyecto_id: ctx.proyectoId,
          ubicacion_id: ctx.ubicacionId,
          num_doc: doc.doc,
          proveedor_nombre: mov.proveedor,
          recepcion_campo_id: resultado.recepcionId,
          lineas: mov.lineas,
        },
      });
      await sendTelegramMessage(params.chatId, respuesta, { parse_mode: 'HTML' });
      return { handled: true, registrado: true };
    }

    if (mov.tipo === 'salida') {
      for (const m of matchesOk) {
        await aplicarDeltaStockInventario(supabase, {
          ubicacionId: ctx.ubicacionId,
          materialId: m.material.id,
          deltaDisponible: -m.cantidad,
          tipoMovimiento: 'salida_obra',
          referenciaTipo: 'telegram_formato_fijo',
          referenciaId: claim.id,
          notas:
            `${obsFecha} · SALIDA ${m.cantidad} ${m.material.name}` +
            (mov.destinoUso ? ` · destino/uso: ${mov.destinoUso}` : ''),
        });
      }
      const resumen = resumenLineasFormatoFijo(
        matchesOk.map((m) => ({ cantidad: m.cantidad, nombre: m.material.name })),
      );
      const dest = mov.destinoUso ? ` → ${escHtmlFormatoFijo(mov.destinoUso)}` : '';
      const respuesta =
        `✅ Registré SALIDA${dest}: ${escHtmlFormatoFijo(resumen)} (fecha del mensaje ${fechaTxt})`;
      await guardarRespuestaFormato(supabase, {
        chatId: params.chatId,
        messageId: params.messageId,
        id: claim.id,
        estado: 'registrado',
        respuesta,
        patch: {
          proyecto_id: ctx.proyectoId,
          ubicacion_id: ctx.ubicacionId,
          destino_uso: mov.destinoUso,
          lineas: mov.lineas,
        },
      });
      await sendTelegramMessage(params.chatId, respuesta, { parse_mode: 'HTML' });
      return { handled: true, registrado: true };
    }

    for (const m of matchesOk) {
      const notas =
        `${obsFecha} · INVENTARIO conteo físico ${m.cantidad} ${m.material.name}` +
        ` (ajuste kardex, no se sobrescribe el saldo en silencio)`;
      await fijarStockMaterialUbicacion(supabase, {
        materialId: m.material.id,
        ubicacionId: ctx.ubicacionId,
        cantidadNueva: m.cantidad,
        notas,
      });
    }
    const resumen = resumenLineasFormatoFijo(
      matchesOk.map((m) => ({ cantidad: m.cantidad, nombre: m.material.name })),
    );
    const respuesta =
      `✅ Registré INVENTARIO (ajuste): ${escHtmlFormatoFijo(resumen)} (fecha del mensaje ${fechaTxt})`;
    await guardarRespuestaFormato(supabase, {
      chatId: params.chatId,
      messageId: params.messageId,
      id: claim.id,
      estado: 'registrado',
      respuesta,
      patch: {
        proyecto_id: ctx.proyectoId,
        ubicacion_id: ctx.ubicacionId,
        lineas: mov.lineas,
      },
    });
    await sendTelegramMessage(params.chatId, respuesta, { parse_mode: 'HTML' });
    return { handled: true, registrado: true };
  } catch (err) {
    const detalle = err instanceof Error ? err.message : 'Error interno';
    const respuesta = `❌ No pude registrar ${tipoEtiqueta}: ${escHtmlFormatoFijo(detalle.slice(0, 280))}`;
    await guardarRespuestaFormato(supabase, {
      chatId: params.chatId,
      messageId: params.messageId,
      id: claim.id,
      estado: 'error',
      respuesta,
    });
    await sendTelegramMessage(params.chatId, respuesta, { parse_mode: 'HTML' });
    return { handled: true };
  }
}
