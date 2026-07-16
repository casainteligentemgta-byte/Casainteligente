import type { SupabaseClient } from '@supabase/supabase-js';
import { patronIlike } from '@/lib/contabilidad/comprasQueryFiltros';
import { completarTransferenciaInventario } from '@/lib/almacen/completarTransferenciaInventario';
import { crearTransferenciaInventario } from '@/lib/almacen/crearTransferenciaInventario';
import {
  etiquetaUbicacionSelector,
  listarUbicacionesInventario,
  propagarObraIdFlat,
} from '@/lib/almacen/ubicacionesInventario';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import type { TelegramEstado } from '@/lib/telegram/estados';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import type { UbicacionInventario } from '@/types/inventario-obra';

export type PasoTraspasoTelegram =
  | 'origen'
  | 'destino'
  | 'producto'
  | 'cantidad'
  | 'nota'
  | 'confirmar';

export type MetadataTraspasoTelegram = {
  paso?: PasoTraspasoTelegram;
  origen_id?: string;
  origen_nombre?: string;
  destino_id?: string;
  destino_nombre?: string;
  producto_id?: string;
  producto_nombre?: string;
  cantidad?: number;
  nota?: string;
};

const PREFIX_ORIGEN = 'tso:';
const PREFIX_DESTINO = 'tsd:';
const PREFIX_PAGE_ORIGEN = 'tsop:';
const PREFIX_PAGE_DESTINO = 'tsdp:';
const PREFIX_MAT = 'tsm:';
const PREFIX_OK = 'tsok';
const PREFIX_CANCEL = 'tsc';

const PAGE_SIZE = 8;

function truncar(s: string, max = 58): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function meta(estado: TelegramEstado): MetadataTraspasoTelegram {
  return (estado.metadata ?? {}) as MetadataTraspasoTelegram;
}

export function esFlujoTraspasoTelegram(estado: TelegramEstado): boolean {
  return estado.contexto === 'traspaso_inventario';
}

export function esCallbackTraspasoTelegram(data: string): boolean {
  return (
    data.startsWith(PREFIX_ORIGEN) ||
    data.startsWith(PREFIX_DESTINO) ||
    data.startsWith(PREFIX_PAGE_ORIGEN) ||
    data.startsWith(PREFIX_PAGE_DESTINO) ||
    data.startsWith(PREFIX_MAT) ||
    data === PREFIX_OK ||
    data === PREFIX_CANCEL
  );
}

async function patchMeta(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  patch: Partial<MetadataTraspasoTelegram>,
): Promise<TelegramEstado> {
  return setTelegramContexto(supabase, chatId, {
    metadata: { ...meta(estado), ...patch },
  });
}

async function listarUbicacionesTraspaso(
  supabase: SupabaseClient,
): Promise<UbicacionInventario[]> {
  const todas = await listarUbicacionesInventario(supabase, { soloActivas: true });
  propagarObraIdFlat(todas);
  return todas
    .filter((u) => u.tipo !== 'cuarentena' && u.tipo !== 'garantias')
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

function indentNivel(u: UbicacionInventario, flat: UbicacionInventario[]): number {
  let n = 0;
  let pid = u.ubicacion_padre_id;
  const byId = new Map(flat.map((x) => [x.id, x]));
  while (pid && n < 5) {
    n += 1;
    pid = byId.get(pid)?.ubicacion_padre_id;
  }
  return n;
}

function buildKeyboardUbicaciones(
  ubicaciones: UbicacionInventario[],
  page: number,
  fase: 'origen' | 'destino',
  excluirId?: string,
): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  const filtradas = excluirId
    ? ubicaciones.filter((u) => u.id !== excluirId)
    : ubicaciones;
  const prefixSel = fase === 'origen' ? PREFIX_ORIGEN : PREFIX_DESTINO;
  const prefixPage = fase === 'origen' ? PREFIX_PAGE_ORIGEN : PREFIX_PAGE_DESTINO;

  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = filtradas.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const rows: Array<Array<{ text: string; callback_data: string }>> = slice.map((u) => [
    {
      text: truncar(etiquetaUbicacionSelector(u, indentNivel(u, ubicaciones))),
      callback_data: `${prefixSel}${u.id}`,
    },
  ]);

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${prefixPage}${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${prefixPage}${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${prefixPage}${safePage + 1}` });
    rows.push(nav);
  }

  return { inline_keyboard: rows };
}

async function enviarPickerUbicaciones(
  supabase: SupabaseClient,
  chatId: string,
  fase: 'origen' | 'destino',
  page = 0,
  excluirId?: string,
): Promise<void> {
  const ubicaciones = await listarUbicacionesTraspaso(supabase);
  if (!ubicaciones.length) {
    await sendTelegramMessage(
      chatId,
      '❌ No hay ubicaciones de inventario activas. Configure almacenes en la app.',
    );
    return;
  }

  const titulo =
    fase === 'origen'
      ? '🔄 <b>Traspaso / préstamo</b>\n\nSeleccione la obra o almacén de <b>ORIGEN</b>:'
      : '🔄 Seleccione la ubicación de <b>DESTINO</b>:';

  await sendTelegramMessage(chatId, titulo, {
    parse_mode: 'HTML',
    reply_markup: buildKeyboardUbicaciones(ubicaciones, page, fase, excluirId),
  });
}

async function nombreUbicacion(
  supabase: SupabaseClient,
  ubicacionId: string,
): Promise<{ nombre: string; proyectoId: string | null }> {
  const { data } = await supabase
    .from('inv_ubicaciones')
    .select('nombre, ci_proyecto_id')
    .eq('id', ubicacionId)
    .maybeSingle();
  return {
    nombre: String(data?.nombre ?? 'Ubicación').trim() || 'Ubicación',
    proyectoId: data?.ci_proyecto_id ? String(data.ci_proyecto_id) : null,
  };
}

async function stockDisponibleOrigen(
  supabase: SupabaseClient,
  ubicacionId: string,
  materialId: string,
): Promise<number> {
  const { data } = await supabase
    .from('inventario_stock')
    .select('cantidad_disponible')
    .eq('ubicacion_id', ubicacionId)
    .eq('material_id', materialId)
    .maybeSingle();
  return Math.max(0, Number(data?.cantidad_disponible) || 0);
}

async function finalizarSesionTraspaso(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'menu',
    metadata: {},
  });
}

export async function cancelarTraspasoTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await finalizarSesionTraspaso(supabase, chatId);
  await sendTelegramMessage(chatId, '❌ Traspaso cancelado. Usa /traspaso para iniciar otro.');
}

export async function manejarComandoTraspasoTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'traspaso_inventario',
    proyecto_id: null,
    metadata: { paso: 'origen' },
  });
  await enviarPickerUbicaciones(supabase, chatId, 'origen', 0);
}

export async function manejarCallbackTraspasoTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!esCallbackTraspasoTelegram(params.data)) return false;

  const estado = await getTelegramEstado(supabase, params.chatId);
  if (!esFlujoTraspasoTelegram(estado) && params.data !== PREFIX_CANCEL) {
    await answerCallbackQuery(params.callbackId, 'Sesión de traspaso no activa. Use /traspaso');
    return true;
  }

  if (params.data === PREFIX_CANCEL) {
    await answerCallbackQuery(params.callbackId);
    await cancelarTraspasoTelegram(supabase, params.chatId);
    return true;
  }

  const m = meta(estado);

  if (params.data.startsWith(PREFIX_PAGE_ORIGEN)) {
    const page = Number(params.data.slice(PREFIX_PAGE_ORIGEN.length));
    await answerCallbackQuery(params.callbackId);
    await enviarPickerUbicaciones(supabase, params.chatId, 'origen', Number.isFinite(page) ? page : 0);
    return true;
  }

  if (params.data.startsWith(PREFIX_PAGE_DESTINO)) {
    const page = Number(params.data.slice(PREFIX_PAGE_DESTINO.length));
    await answerCallbackQuery(params.callbackId);
    await enviarPickerUbicaciones(
      supabase,
      params.chatId,
      'destino',
      Number.isFinite(page) ? page : 0,
      m.origen_id,
    );
    return true;
  }

  if (params.data.startsWith(PREFIX_ORIGEN)) {
    const ubicacionId = params.data.slice(PREFIX_ORIGEN.length);
    const { nombre } = await nombreUbicacion(supabase, ubicacionId);
    await answerCallbackQuery(params.callbackId, `Origen: ${nombre}`);
    await patchMeta(supabase, params.chatId, estado, {
      paso: 'destino',
      origen_id: ubicacionId,
      origen_nombre: nombre,
    });
    await sendTelegramMessage(
      params.chatId,
      `✅ Origen: <b>${nombre}</b>\n\nAhora elija el <b>destino</b>:`,
      { parse_mode: 'HTML' },
    );
    await enviarPickerUbicaciones(supabase, params.chatId, 'destino', 0, ubicacionId);
    return true;
  }

  if (params.data.startsWith(PREFIX_DESTINO)) {
    const ubicacionId = params.data.slice(PREFIX_DESTINO.length);
    if (ubicacionId === m.origen_id) {
      await answerCallbackQuery(params.callbackId, 'Destino debe ser distinto al origen');
      return true;
    }
    const { nombre } = await nombreUbicacion(supabase, ubicacionId);
    await answerCallbackQuery(params.callbackId, `Destino: ${nombre}`);
    await patchMeta(supabase, params.chatId, estado, {
      paso: 'producto',
      destino_id: ubicacionId,
      destino_nombre: nombre,
    });
    await sendTelegramMessage(
      params.chatId,
      `✅ Destino: <b>${nombre}</b>\n\n` +
        'Escriba el <b>nombre del material</b> (parcial, ej. <code>cemento</code> o <code>cabilla</code>):',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (params.data.startsWith(PREFIX_MAT)) {
    const materialId = params.data.slice(PREFIX_MAT.length);
    const { data: mat } = await supabase
      .from('global_inventory')
      .select('id, name')
      .eq('id', materialId)
      .maybeSingle();
    const nombre = String(mat?.name ?? 'Material').trim();
    await answerCallbackQuery(params.callbackId, nombre);
    await patchMeta(supabase, params.chatId, estado, {
      paso: 'cantidad',
      producto_id: materialId,
      producto_nombre: nombre,
    });
    const disp = m.origen_id
      ? await stockDisponibleOrigen(supabase, m.origen_id, materialId)
      : 0;
    await sendTelegramMessage(
      params.chatId,
      `📦 <b>${nombre}</b>\n` +
        `Disponible en origen: <b>${disp.toLocaleString('es-VE')}</b> u.\n\n` +
        'Ingrese la <b>cantidad</b> a traspasar:',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (params.data === PREFIX_OK) {
    await answerCallbackQuery(params.callbackId, 'Procesando…');
    await ejecutarTraspasoTelegram(supabase, params.chatId, estado);
    return true;
  }

  return false;
}

async function enviarResumenConfirmacion(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const m = meta(estado);
  const resumen =
    '🚀 <b>Confirmación de traspaso / préstamo</b>\n\n' +
    `📤 Origen: <b>${m.origen_nombre ?? '—'}</b>\n` +
    `📥 Destino: <b>${m.destino_nombre ?? '—'}</b>\n` +
    `📦 Material: <b>${m.producto_nombre ?? '—'}</b>\n` +
    `🔢 Cantidad: <b>${m.cantidad ?? 0}</b> u.\n` +
    `📝 Observaciones: ${m.nota ? `"${m.nota}"` : '—'}\n\n` +
    '<i>Al confirmar, el stock se restará del origen y se sumará al destino.</i>';

  await patchMeta(supabase, chatId, estado, { paso: 'confirmar' });
  await sendTelegramMessage(chatId, resumen, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔒 Confirmar despacho', callback_data: PREFIX_OK },
          { text: '❌ Cancelar', callback_data: PREFIX_CANCEL },
        ],
      ],
    },
  });
}

async function ejecutarTraspasoTelegram(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const m = meta(estado);
  if (!m.origen_id || !m.destino_id || !m.producto_id || !m.cantidad) {
    await sendTelegramMessage(chatId, '❌ Datos incompletos. Reinicie con /traspaso.');
    await cancelarTraspasoTelegram(supabase, chatId);
    return;
  }

  const disp = await stockDisponibleOrigen(supabase, m.origen_id, m.producto_id);
  if (m.cantidad > disp + 0.0001) {
    await sendTelegramMessage(
      chatId,
      `❌ Stock insuficiente en origen (disponible: ${disp.toLocaleString('es-VE')} u.).`,
    );
    return;
  }

  const [origen, destino] = await Promise.all([
    nombreUbicacion(supabase, m.origen_id),
    nombreUbicacion(supabase, m.destino_id),
  ]);
  const proyectoId = destino.proyectoId ?? origen.proyectoId;
  if (!proyectoId) {
    await sendTelegramMessage(
      chatId,
      '❌ No se pudo vincular la transferencia a una obra. Revise ci_proyecto_id en las ubicaciones.',
    );
    return;
  }

  const obs = [
    m.nota?.trim(),
    'Registro vía Telegram /traspaso',
    `Chat ${chatId}`,
  ]
    .filter(Boolean)
    .join(' · ');

  try {
    const { transferenciaId, codigo } = await crearTransferenciaInventario(supabase, {
      origen_ubicacion_id: m.origen_id,
      destino_ubicacion_id: m.destino_id,
      ci_proyecto_id: proyectoId,
      tipo_movimiento: 'transferencia',
      observaciones: obs || null,
      lineas: [
        {
          material_id: m.producto_id,
          cantidad: m.cantidad,
          imputaciones: [],
        },
      ],
    });
    await completarTransferenciaInventario(supabase, transferenciaId);

    await finalizarSesionTraspaso(supabase, chatId);
    await sendTelegramMessage(
      chatId,
      '✅ <b>Traspaso registrado</b>\n\n' +
        `Código: <code>${codigo}</code>\n` +
        `📦 ${m.producto_nombre}: <b>${m.cantidad}</b> u.\n` +
        `${m.origen_nombre} → ${m.destino_nombre}`,
      { parse_mode: 'HTML' },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al registrar traspaso';
    await sendTelegramMessage(chatId, `❌ ${msg}\n\nPuede reintentar con /traspaso.`);
  }
}

export async function manejarTextoTraspasoTelegram(
  supabase: SupabaseClient,
  chatId: string,
  texto: string,
): Promise<boolean> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esFlujoTraspasoTelegram(estado)) return false;

  const m = meta(estado);
  const t = texto.trim();

  if (m.paso === 'producto') {
    if (!m.origen_id) {
      await sendTelegramMessage(chatId, '❌ Falta origen. Use /traspaso de nuevo.');
      return true;
    }
    const pattern = patronIlike(t);
    if (!pattern) {
      await sendTelegramMessage(chatId, '⚠️ Escriba al menos una palabra para buscar el material.');
      return true;
    }

    const { data: materiales, error } = await supabase
      .from('global_inventory')
      .select('id, name')
      .ilike('name', pattern)
      .order('name', { ascending: true })
      .limit(12);

    if (error) {
      await sendTelegramMessage(chatId, '❌ Error al buscar materiales.');
      return true;
    }

    const conStock: Array<{ id: string; name: string; disp: number }> = [];
    for (const row of materiales ?? []) {
      const id = String(row.id);
      const disp = await stockDisponibleOrigen(supabase, m.origen_id, id);
      if (disp > 0) {
        conStock.push({ id, name: String(row.name ?? 'Material'), disp });
      }
    }

    if (!conStock.length) {
      await sendTelegramMessage(
        chatId,
        '❌ No hay stock en el origen para materiales con ese nombre. Pruebe otro término:',
      );
      return true;
    }

    const botones = {
      inline_keyboard: conStock.slice(0, 6).map((p) => [
        {
          text: truncar(`📦 ${p.name} (${p.disp} u.)`, 56),
          callback_data: `${PREFIX_MAT}${p.id}`,
        },
      ]),
    };
    await sendTelegramMessage(chatId, '🔍 Seleccione el material exacto:', {
      reply_markup: botones,
    });
    return true;
  }

  if (m.paso === 'cantidad') {
    const cant = Number.parseFloat(t.replace(',', '.'));
    if (!Number.isFinite(cant) || cant <= 0) {
      await sendTelegramMessage(chatId, '⚠️ Ingrese una cantidad válida mayor a cero:');
      return true;
    }
    if (!m.origen_id || !m.producto_id) {
      await sendTelegramMessage(chatId, '❌ Sesión incompleta. /traspaso');
      return true;
    }
    const disp = await stockDisponibleOrigen(supabase, m.origen_id, m.producto_id);
    if (cant > disp + 0.0001) {
      await sendTelegramMessage(
        chatId,
        `⚠️ Máximo en origen: <b>${disp.toLocaleString('es-VE')}</b> u. Ingrese otra cantidad:`,
        { parse_mode: 'HTML' },
      );
      return true;
    }
    await patchMeta(supabase, chatId, estado, { paso: 'nota', cantidad: cant });
    await sendTelegramMessage(
      chatId,
      '📝 Escriba una nota breve (chofer, placas, motivo del préstamo, etc.):',
    );
    return true;
  }

  if (m.paso === 'nota') {
    await patchMeta(supabase, chatId, estado, { nota: t });
    const actualizado = await getTelegramEstado(supabase, chatId);
    await enviarResumenConfirmacion(supabase, chatId, actualizado);
    return true;
  }

  return false;
}
