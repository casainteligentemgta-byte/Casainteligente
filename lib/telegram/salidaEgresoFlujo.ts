import type { SupabaseClient } from '@supabase/supabase-js';
import { cargarOpcionesPartidaDespachoFlexible } from '@/lib/almacen/cargarPartidasDespacho';
import type { PartidaDespachoFila } from '@/types/inventario-obra';
import { listarEmpleadosProyectoEgreso } from '@/lib/almacen/listarEmpleadosProyectoEgreso';
import { listarTareasCronogramaPartida } from '@/lib/almacen/listarTareasCronogramaPartida';
import {
  listarStockUbicacionEgreso,
  registrarEgresoCampo,
  type LineaEgresoCampoInput,
} from '@/lib/almacen/registrarEgresoCampo';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import type { TelegramEstado } from '@/lib/telegram/estados';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import { nombreProyectoTelegram } from '@/lib/telegram/proyectoPicker';
import { enviarPickerOrigenSalidaTelegram } from '@/lib/telegram/salidaOrigenPicker';

export const FLUJO_EGRESO_V2 = 'egreso_v2';

export type PasoSalidaEgreso =
  | 'origen'
  | 'obrero'
  | 'obrero_texto'
  | 'material'
  | 'cantidad'
  | 'partida'
  | 'tarea'
  | 'mas_lineas'
  | 'foto'
  | 'observacion'
  | 'confirmar';

export type LineaEgresoDraft = {
  material_id: string;
  material_nombre: string;
  unidad: string;
  cantidad: number;
  ci_presupuesto_partida_id?: string | null;
  partida_id?: string | null;
  partida_label: string;
  cronograma_tarea_id?: string | null;
  tarea_label?: string | null;
};

export type MetadataSalidaEgreso = {
  flujo?: string;
  paso?: PasoSalidaEgreso;
  origen_ubicacion_id?: string;
  origen_nombre?: string;
  obrero_empleado_id?: string;
  obrero_nombre?: string;
  obrero_oficio?: string;
  lineas?: LineaEgresoDraft[];
  draft_material_id?: string;
  draft_material_nombre?: string;
  draft_unidad?: string;
  draft_cantidad?: number;
  draft_partida_id?: string;
  /** Partida cascada (`partidas.id`) cuando no hay fila en ci_presupuesto_partidas. */
  draft_partida_legacy_id?: string;
  draft_partida_label?: string;
  foto_storage_path?: string;
  foto_url?: string;
  observaciones?: string;
  telegram_user_id?: string;
  telegram_username?: string | null;
};

const PREFIX = 'se:';
const PAGE_SIZE = 6;

function truncar(s: string, max = 54): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function meta(estado: TelegramEstado): MetadataSalidaEgreso {
  return (estado.metadata ?? {}) as MetadataSalidaEgreso;
}

export function esFlujoEgresoV2(estado: TelegramEstado): boolean {
  return meta(estado).flujo === FLUJO_EGRESO_V2 && estado.contexto === 'salida_obra';
}

export function esCallbackSalidaEgreso(data: string): boolean {
  return data.startsWith(PREFIX);
}

function baseUrlApp(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://casainteligente.company'
  )
    .trim()
    .replace(/\/$/, '');
}

async function patchMeta(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  patch: Partial<MetadataSalidaEgreso>,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    metadata: { ...meta(estado), ...patch },
  });
}

export async function manejarComandoSalidaEgresoTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'salida_obra',
    proyecto_id: null,
    metadata: { flujo: FLUJO_EGRESO_V2, paso: 'origen' },
  });
  await sendTelegramMessage(
    chatId,
    '📤 <b>Egreso de material</b>\n\n' +
      'Registre quién recibe el material, a qué partida/actividad va y las cantidades.\n' +
      'La foto es <b>opcional</b>. Puede incluir varios productos en un mismo egreso.',
    { parse_mode: 'HTML' },
  );
  const { enviarPickerProyectosTelegram } = await import('@/lib/telegram/proyectoPicker');
  await enviarPickerProyectosTelegram(supabase, chatId, 'salida_obra');
}

export async function iniciarSalidaEgresoTrasObra(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
): Promise<void> {
  const nombre = (await nombreProyectoTelegram(supabase, proyectoId)) ?? 'Obra';
  await setTelegramContexto(supabase, chatId, {
    contexto: 'salida_obra',
    proyecto_id: proyectoId,
    metadata: {
      flujo: FLUJO_EGRESO_V2,
      paso: 'origen',
      lineas: [],
    },
  });
  await sendTelegramMessage(
    chatId,
    `📤 Obra: <b>${nombre}</b>\n\nElige el <b>almacén</b> de donde sale el material:`,
    { parse_mode: 'HTML' },
  );
  await enviarPickerOrigenSalidaTelegram(supabase, chatId, {
    proyectoId,
    nombreObra: nombre,
    nMateriales: 0,
  });
}

async function enviarPickerObrero(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
  page = 0,
): Promise<void> {
  const empleados = await listarEmpleadosProyectoEgreso(supabase, proyectoId);
  const totalPages = Math.max(1, Math.ceil((empleados.length + 1) / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const sliceStart = safePage * PAGE_SIZE;
  const slice = empleados.slice(sliceStart, sliceStart + PAGE_SIZE - (safePage === 0 ? 1 : 0));

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
  if (safePage === 0) {
    buttons.push([{ text: '✏️ Escribir nombre y apellido', callback_data: `${PREFIX}obr:manual` }]);
  }
  for (const e of slice) {
    const oficio = e.oficio ? ` · ${e.oficio}` : '';
    buttons.push([
      {
        text: truncar(`${e.nombre_completo}${oficio}`),
        callback_data: `${PREFIX}obr:${e.id}`,
      },
    ]);
  }
  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX}obrp:${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX}obrp:${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX}obrp:${safePage + 1}` });
    buttons.push(nav);
  }

  await sendTelegramMessage(
    chatId,
    '👷 <b>¿Quién recibe el material?</b>\nElige de la cuadrilla o escribe el nombre.',
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

async function enviarPickerMaterial(
  supabase: SupabaseClient,
  chatId: string,
  origenId: string,
  page = 0,
): Promise<void> {
  const stock = await listarStockUbicacionEgreso(supabase, origenId);
  if (!stock.length) {
    await sendTelegramMessage(
      chatId,
      '⚠️ No hay stock disponible en este almacén. Elija otro origen o reinicie con <code>/salida</code>.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const totalPages = Math.max(1, Math.ceil(stock.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = stock.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((s) => [
    {
      text: truncar(`${s.nombre} (${s.cantidad_disponible} ${s.unidad})`),
      callback_data: `${PREFIX}mat:${s.material_id}`,
    },
  ]);

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX}matp:${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX}matp:${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX}matp:${safePage + 1}` });
    buttons.push(nav);
  }

  await sendTelegramMessage(
    chatId,
    '📦 <b>Seleccione el material</b> a egresar:',
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

async function enviarPickerPartida(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
  materialId: string,
  page = 0,
): Promise<void> {
  const { partidas, modo } = await cargarOpcionesPartidaDespachoFlexible(supabase, {
    proyectoId,
    materialId,
  });

  if (!partidas.length) {
    await sendTelegramMessage(
      chatId,
      '📂 <b>Imputación a partida</b>\n\n' +
        'No hay partidas de presupuesto en esta obra (aún puede egresar material).\n\n' +
        'Pulse <b>Continuar sin partida</b> para descontar stock. Más adelante podrá vincular el APU en control de obra.',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏭ Continuar sin partida', callback_data: `${PREFIX}par:skip` }],
          ],
        },
      },
    );
    return;
  }

  const totalPages = Math.max(1, Math.ceil(partidas.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = partidas.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((p) => [
    {
      text: truncar(p.nombre_partida),
      callback_data: callbackDataPartida(p),
    },
  ]);

  buttons.push([{ text: '⏭ Sin partida (solo stock)', callback_data: `${PREFIX}par:skip` }]);

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX}parp:${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX}parp:${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX}parp:${safePage + 1}` });
    buttons.push(nav);
  }

  const hintApu =
    modo === 'todo_presupuesto'
      ? '\n\n<i>Sin vínculo APU para este material: se listan todas las partidas del presupuesto.</i>'
      : '';

  await sendTelegramMessage(
    chatId,
    '📂 <b>Partida presupuestaria</b> a la que va este material (opcional):' + hintApu,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

async function enviarPickerTarea(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
  partidaId: string,
  page = 0,
): Promise<void> {
  const tareas = await listarTareasCronogramaPartida(supabase, {
    proyectoId,
    ciPresupuestoPartidaId: partidaId,
  });

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [
    [{ text: '⏭ Sin actividad Gantt', callback_data: `${PREFIX}tar:skip` }],
  ];

  if (tareas.length) {
    const totalPages = Math.max(1, Math.ceil(tareas.length / PAGE_SIZE));
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    const slice = tareas.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

    for (const t of slice) {
      buttons.push([
        {
          text: truncar(t.nombre_tarea),
          callback_data: `${PREFIX}tar:${t.id}`,
        },
      ]);
    }

    if (totalPages > 1) {
      const nav: Array<{ text: string; callback_data: string }> = [];
      if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX}tarp:${safePage - 1}` });
      nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX}tarp:${safePage}` });
      if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX}tarp:${safePage + 1}` });
      buttons.push(nav);
    }
  }

  await sendTelegramMessage(
    chatId,
    '📅 <b>Actividad del cronograma</b> (opcional si no hay tarea):',
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

async function preguntarMasLineas(supabase: SupabaseClient, chatId: string, nLineas: number): Promise<void> {
  await patchMeta(
    supabase,
    chatId,
    await getTelegramEstado(supabase, chatId),
    { paso: 'mas_lineas' },
  );
  await sendTelegramMessage(
    chatId,
    `✅ Línea registrada (${nLineas} en total).\n\n¿Agregar <b>otro material</b>?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '➕ Sí, otro material', callback_data: `${PREFIX}mas:si` },
            { text: '✔ No, continuar', callback_data: `${PREFIX}mas:no` },
          ],
        ],
      },
    },
  );
}

async function preguntarFotoOpcional(supabase: SupabaseClient, chatId: string): Promise<void> {
  await patchMeta(
    supabase,
    chatId,
    await getTelegramEstado(supabase, chatId),
    { paso: 'foto' },
  );
  await sendTelegramMessage(
    chatId,
    '📷 ¿Desea adjuntar una <b>foto</b>? (opcional)',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '⏭ Omitir foto', callback_data: `${PREFIX}foto:skip` }]],
      },
    },
  );
}

function callbackDataPartida(p: PartidaDespachoFila): string {
  if (p.ci_presupuesto_partida_id) {
    return `${PREFIX}par:cpp:${p.ci_presupuesto_partida_id}`;
  }
  if (p.partida_id) {
    return `${PREFIX}par:pd:${p.partida_id}`;
  }
  return `${PREFIX}par:skip`;
}

function partidaDesdeCallback(
  partidas: PartidaDespachoFila[],
  data: string,
): PartidaDespachoFila | 'skip' | null {
  if (data === 'par:skip') return 'skip';
  if (data.startsWith('par:cpp:')) {
    const id = data.slice(8);
    return partidas.find((p) => p.ci_presupuesto_partida_id === id) ?? null;
  }
  if (data.startsWith('par:pd:')) {
    const id = data.slice(7);
    return partidas.find((p) => p.partida_id === id) ?? null;
  }
  return null;
}

function resumenLineas(lineas: LineaEgresoDraft[]): string {
  return lineas
    .map(
      (l, i) =>
        `${i + 1}. ${l.material_nombre} × ${l.cantidad} ${l.unidad}\n   └ ${l.partida_label}` +
        (l.tarea_label ? `\n   └ 📅 ${l.tarea_label}` : ''),
    )
    .join('\n');
}

async function enviarConfirmacion(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const m = meta(estado);
  const lineas = m.lineas ?? [];
  await patchMeta(supabase, chatId, estado, { paso: 'confirmar' });

  const texto =
    '📋 <b>Confirmar egreso</b>\n\n' +
    `👷 ${m.obrero_nombre ?? '—'}` +
    (m.obrero_oficio ? ` (${m.obrero_oficio})` : '') +
    `\n🏭 Origen: ${m.origen_nombre ?? '—'}\n\n` +
    resumenLineas(lineas) +
    (m.observaciones?.trim() ? `\n\n📝 ${m.observaciones.trim()}` : '') +
    (m.foto_storage_path ? '\n\n📷 Con foto adjunta' : '');

  await sendTelegramMessage(chatId, texto, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{ text: '✅ Confirmar egreso', callback_data: `${PREFIX}conf:ok` }]],
    },
  });
}

async function finalizarLineaDraft(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  tareaId: string | null,
  tareaLabel: string | null,
  opts?: { sinPartida?: boolean },
): Promise<void> {
  const m = meta(estado);
  if (!m.draft_material_id || !m.draft_cantidad || !m.draft_material_nombre) {
    await sendTelegramMessage(chatId, '❌ Datos incompletos. Reinicie con <code>/salida</code>.', {
      parse_mode: 'HTML',
    });
    return;
  }

  const sinPartida = opts?.sinPartida ?? false;

  const nueva: LineaEgresoDraft = {
    material_id: m.draft_material_id,
    material_nombre: m.draft_material_nombre,
    unidad: m.draft_unidad ?? 'UND',
    cantidad: m.draft_cantidad,
    ci_presupuesto_partida_id: sinPartida ? null : (m.draft_partida_id ?? null),
    partida_id: sinPartida ? null : (m.draft_partida_legacy_id ?? null),
    partida_label: sinPartida
      ? 'Sin imputación a partida'
      : (m.draft_partida_label ?? 'Partida'),
    cronograma_tarea_id: sinPartida ? null : tareaId,
    tarea_label: sinPartida ? null : tareaLabel,
  };

  const lineas = [...(m.lineas ?? []), nueva];
  await patchMeta(supabase, chatId, estado, {
    lineas,
    draft_material_id: undefined,
    draft_material_nombre: undefined,
    draft_unidad: undefined,
    draft_cantidad: undefined,
    draft_partida_id: undefined,
    draft_partida_legacy_id: undefined,
    draft_partida_label: undefined,
    paso: 'mas_lineas',
  });

  await preguntarMasLineas(supabase, chatId, lineas.length);
}

export async function manejarOrigenSalidaEgreso(
  supabase: SupabaseClient,
  chatId: string,
  origenUbicacionId: string,
  origenNombre: string,
): Promise<void> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esFlujoEgresoV2(estado) || !estado.proyecto_id) return;

  await patchMeta(supabase, chatId, estado, {
    paso: 'obrero',
    origen_ubicacion_id: origenUbicacionId,
    origen_nombre: origenNombre,
  });
  await enviarPickerObrero(supabase, chatId, estado.proyecto_id);
}

export async function manejarCallbackSalidaEgreso(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!params.data.startsWith(PREFIX)) return false;

  const estado = await getTelegramEstado(supabase, params.chatId);
  if (!esFlujoEgresoV2(estado) || !estado.proyecto_id) {
    await answerCallbackQuery(params.callbackId, 'Flujo de salida no activo', true);
    return true;
  }

  const data = params.data.slice(PREFIX.length);
  const proyectoId = estado.proyecto_id;
  const m = meta(estado);

  if (data.startsWith('obrp:')) {
    const page = Number(data.slice(5));
    await answerCallbackQuery(params.callbackId);
    await enviarPickerObrero(supabase, params.chatId, proyectoId, page);
    return true;
  }

  if (data === 'obr:manual') {
    await answerCallbackQuery(params.callbackId);
    await patchMeta(supabase, params.chatId, estado, { paso: 'obrero_texto' });
    await sendTelegramMessage(
      params.chatId,
      '✏️ Escribe <b>nombre y apellido</b> del obrero.\nOpcional: añade oficio separado por coma.\nEj: <code>Juan Pérez, Electricista</code>',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (data.startsWith('obr:')) {
    const empId = data.slice(4);
    const empleados = await listarEmpleadosProyectoEgreso(supabase, proyectoId);
    const hit = empleados.find((e) => e.id === empId);
    if (!hit) {
      await answerCallbackQuery(params.callbackId, 'Obrero no encontrado', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, hit.nombre_completo);
    await patchMeta(supabase, params.chatId, estado, {
      paso: 'material',
      obrero_empleado_id: hit.id,
      obrero_nombre: hit.nombre_completo,
      obrero_oficio: hit.oficio ?? undefined,
    });
    if (!m.origen_ubicacion_id) {
      await sendTelegramMessage(params.chatId, '❌ Falta almacén origen.', { parse_mode: 'HTML' });
      return true;
    }
    await enviarPickerMaterial(supabase, params.chatId, m.origen_ubicacion_id);
    return true;
  }

  if (data.startsWith('matp:')) {
    const page = Number(data.slice(5));
    await answerCallbackQuery(params.callbackId);
    if (m.origen_ubicacion_id) {
      await enviarPickerMaterial(supabase, params.chatId, m.origen_ubicacion_id, page);
    }
    return true;
  }

  if (data.startsWith('mat:')) {
    const materialId = data.slice(4);
    const stock = m.origen_ubicacion_id
      ? await listarStockUbicacionEgreso(supabase, m.origen_ubicacion_id)
      : [];
    const hit = stock.find((s) => s.material_id === materialId);
    if (!hit) {
      await answerCallbackQuery(params.callbackId, 'Material no disponible', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, hit.nombre);
    await patchMeta(supabase, params.chatId, estado, {
      paso: 'cantidad',
      draft_material_id: hit.material_id,
      draft_material_nombre: hit.nombre,
      draft_unidad: hit.unidad,
    });
    await sendTelegramMessage(
      params.chatId,
      `🔢 Indique la <b>cantidad</b> de «${hit.nombre}» (máx. ${hit.cantidad_disponible} ${hit.unidad}):`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (data.startsWith('parp:')) {
    const page = Number(data.slice(5));
    await answerCallbackQuery(params.callbackId);
    if (m.draft_material_id) {
      await enviarPickerPartida(supabase, params.chatId, proyectoId, m.draft_material_id, page);
    }
    return true;
  }

  if (data.startsWith('par:')) {
    if (data === 'par:skip') {
      await answerCallbackQuery(params.callbackId, 'Sin partida');
      await finalizarLineaDraft(supabase, params.chatId, estado, null, null, { sinPartida: true });
      return true;
    }

    const partidas = m.draft_material_id
      ? (
          await cargarOpcionesPartidaDespachoFlexible(supabase, {
            proyectoId,
            materialId: m.draft_material_id,
          })
        ).partidas
      : [];
    const hit = partidaDesdeCallback(partidas, data);
    if (!hit || hit === 'skip') {
      await answerCallbackQuery(params.callbackId, 'Partida no encontrada', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, truncar(hit.nombre_partida, 40));
    const partidaPresupuestoId = hit.ci_presupuesto_partida_id ?? undefined;
    await patchMeta(supabase, params.chatId, estado, {
      paso: partidaPresupuestoId ? 'tarea' : 'mas_lineas',
      draft_partida_id: partidaPresupuestoId,
      draft_partida_legacy_id: hit.partida_id ?? undefined,
      draft_partida_label: hit.nombre_partida,
    });
    if (partidaPresupuestoId) {
      await enviarPickerTarea(supabase, params.chatId, proyectoId, partidaPresupuestoId);
    } else {
      await finalizarLineaDraft(supabase, params.chatId, await getTelegramEstado(supabase, params.chatId), null, null);
    }
    return true;
  }

  if (data.startsWith('tarp:')) {
    const page = Number(data.slice(5));
    await answerCallbackQuery(params.callbackId);
    if (m.draft_partida_id) {
      await enviarPickerTarea(supabase, params.chatId, proyectoId, m.draft_partida_id, page);
    }
    return true;
  }

  if (data === 'tar:skip') {
    await answerCallbackQuery(params.callbackId, 'Sin actividad Gantt');
    await finalizarLineaDraft(supabase, params.chatId, estado, null, null);
    return true;
  }

  if (data.startsWith('tar:')) {
    const tareaId = data.slice(4);
    const tareas = m.draft_partida_id
      ? await listarTareasCronogramaPartida(supabase, {
          proyectoId,
          ciPresupuestoPartidaId: m.draft_partida_id,
        })
      : [];
    const hit = tareas.find((t) => t.id === tareaId);
    await answerCallbackQuery(params.callbackId, hit?.nombre_tarea ?? 'Actividad');
    await finalizarLineaDraft(
      supabase,
      params.chatId,
      estado,
      tareaId,
      hit?.nombre_tarea ?? null,
    );
    return true;
  }

  if (data === 'mas:si') {
    await answerCallbackQuery(params.callbackId);
    await patchMeta(supabase, params.chatId, estado, { paso: 'material' });
    if (m.origen_ubicacion_id) {
      await enviarPickerMaterial(supabase, params.chatId, m.origen_ubicacion_id);
    }
    return true;
  }

  if (data === 'mas:no') {
    await answerCallbackQuery(params.callbackId);
    await preguntarFotoOpcional(supabase, params.chatId);
    return true;
  }

  if (data === 'foto:skip') {
    await answerCallbackQuery(params.callbackId);
    await patchMeta(supabase, params.chatId, estado, { paso: 'observacion' });
    await sendTelegramMessage(
      params.chatId,
      '📝 Escriba <b>observaciones</b> del egreso (opcional; envíe <code>-</code> para omitir):',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (data === 'conf:ok') {
    await answerCallbackQuery(params.callbackId, 'Procesando…');
    const fresh = await getTelegramEstado(supabase, params.chatId);
    const fm = meta(fresh);
    const lineas = fm.lineas ?? [];
    if (!lineas.length || !fm.origen_ubicacion_id || !fm.obrero_nombre) {
      await sendTelegramMessage(params.chatId, '❌ Egreso incompleto.', { parse_mode: 'HTML' });
      return true;
    }

    const nombreObra = (await nombreProyectoTelegram(supabase, proyectoId)) ?? 'Obra';
    const lineasInput: LineaEgresoCampoInput[] = lineas.map((l) => ({
      material_id: l.material_id,
      material_nombre: l.material_nombre,
      cantidad: l.cantidad,
      unidad: l.unidad,
      ci_presupuesto_partida_id: l.ci_presupuesto_partida_id ?? null,
      partida_id: l.partida_id ?? null,
      partida_label: l.partida_label,
      cronograma_tarea_id: l.cronograma_tarea_id,
      tarea_label: l.tarea_label,
    }));

    const resultado = await registrarEgresoCampo(supabase, {
      proyectoId,
      nombreObra,
      origenUbicacionId: fm.origen_ubicacion_id,
      obreroEmpleadoId: fm.obrero_empleado_id,
      obreroNombre: fm.obrero_nombre,
      obreroOficio: fm.obrero_oficio,
      observaciones: fm.observaciones,
      fotoStoragePath: fm.foto_storage_path,
      fotoUrl: fm.foto_url,
      chatId: params.chatId,
      telegramUserId: fm.telegram_user_id,
      telegramUsername: fm.telegram_username,
      lineas: lineasInput,
    });

    await setTelegramContexto(supabase, params.chatId, { contexto: 'menu', metadata: {} });

    if (!resultado.ok) {
      await sendTelegramMessage(params.chatId, `❌ ${resultado.error}`, { parse_mode: 'HTML' });
      return true;
    }

    const link = `${baseUrlApp()}/almacen`;
    await sendTelegramMessage(
      params.chatId,
      `✅ <b>Egreso registrado</b>\n\n` +
        `📦 Transferencia <b>${resultado.codigoTransferencia}</b>\n` +
        `👷 ${fm.obrero_nombre}\n` +
        `📋 ${resultado.nLineas} material(es)\n` +
        `✅ Stock descontado\n\n` +
        `<a href="${link}">Ver movimientos</a>`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  return false;
}

export async function manejarTextoSalidaEgreso(
  supabase: SupabaseClient,
  chatId: string,
  texto: string,
  userId?: string,
  username?: string | null,
): Promise<boolean> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esFlujoEgresoV2(estado)) return false;

  const paso = meta(estado).paso;
  const trimmed = texto.trim();

  if (paso === 'obrero_texto') {
    if (trimmed.length < 3) {
      await sendTelegramMessage(chatId, 'Nombre muy corto. Intente de nuevo.', { parse_mode: 'HTML' });
      return true;
    }
    const parts = trimmed.split(',').map((s) => s.trim());
    const nombre = parts[0] ?? trimmed;
    const oficio = parts[1] || undefined;
    await patchMeta(supabase, chatId, estado, {
      paso: 'material',
      obrero_empleado_id: undefined,
      obrero_nombre: nombre,
      obrero_oficio: oficio,
      telegram_user_id: userId,
      telegram_username: username ?? null,
    });
    const m = meta(await getTelegramEstado(supabase, chatId));
    if (m.origen_ubicacion_id) {
      await enviarPickerMaterial(supabase, chatId, m.origen_ubicacion_id);
    }
    return true;
  }

  if (paso === 'cantidad') {
    const qty = Number(trimmed.replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) {
      await sendTelegramMessage(chatId, 'Cantidad inválida. Escriba un número mayor a cero.', {
        parse_mode: 'HTML',
      });
      return true;
    }
    const m = meta(estado);
    if (m.origen_ubicacion_id && m.draft_material_id) {
      const stock = await listarStockUbicacionEgreso(supabase, m.origen_ubicacion_id);
      const hit = stock.find((s) => s.material_id === m.draft_material_id);
      if (hit && qty > hit.cantidad_disponible + 0.0001) {
        await sendTelegramMessage(
          chatId,
          `Cantidad supera stock (${hit.cantidad_disponible} ${hit.unidad}).`,
          { parse_mode: 'HTML' },
        );
        return true;
      }
    }
    await patchMeta(supabase, chatId, estado, { paso: 'partida', draft_cantidad: qty });
    if (estado.proyecto_id && m.draft_material_id) {
      await enviarPickerPartida(supabase, chatId, estado.proyecto_id, m.draft_material_id);
    }
    return true;
  }

  if (paso === 'observacion') {
    const obs = trimmed === '-' ? '' : trimmed;
    await patchMeta(supabase, chatId, estado, {
      paso: 'confirmar',
      observaciones: obs,
      telegram_user_id: userId ?? meta(estado).telegram_user_id,
      telegram_username: username ?? meta(estado).telegram_username,
    });
    await enviarConfirmacion(supabase, chatId, await getTelegramEstado(supabase, chatId));
    return true;
  }

  if (paso === 'foto') {
    await sendTelegramMessage(
      chatId,
      'Envíe la foto o pulse <b>Omitir foto</b> en el mensaje anterior.',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  return false;
}

export async function manejarFotoSalidaEgreso(params: {
  supabase: SupabaseClient;
  chatId: string;
  userId: string;
  username?: string | null;
  buffer: Buffer;
  mimeType: string;
  ext: string;
  caption?: string;
}): Promise<boolean> {
  const estado = await getTelegramEstado(params.supabase, params.chatId);
  if (!esFlujoEgresoV2(estado)) return false;

  const paso = meta(estado).paso;
  if (paso !== 'foto' && paso !== 'observacion') {
    return false;
  }

  if (!estado.proyecto_id) return false;

  const storagePath = `telegram-movimientos/${estado.proyecto_id}/salida/${Date.now()}.${params.ext}`;
  const { error } = await params.supabase.storage
    .from('ci-proyectos-media')
    .upload(storagePath, params.buffer, { contentType: params.mimeType, upsert: false });

  if (error) {
    await sendTelegramMessage(params.chatId, '❌ No se pudo guardar la foto.', { parse_mode: 'HTML' });
    return true;
  }

  const { data } = params.supabase.storage.from('ci-proyectos-media').getPublicUrl(storagePath);

  await patchMeta(params.supabase, params.chatId, estado, {
    foto_storage_path: storagePath,
    foto_url: data.publicUrl ?? undefined,
    telegram_user_id: params.userId,
    telegram_username: params.username ?? null,
    paso: 'observacion',
    observaciones: params.caption?.trim() || meta(estado).observaciones,
  });

  await sendTelegramMessage(
    params.chatId,
    '✅ Foto guardada.\n\n📝 Escriba <b>observaciones</b> (opcional; <code>-</code> para omitir):',
    { parse_mode: 'HTML' },
  );
  return true;
}
