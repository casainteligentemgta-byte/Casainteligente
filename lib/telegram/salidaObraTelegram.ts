import type { SupabaseClient } from '@supabase/supabase-js';
import { crearCapituloObra, etiquetaCapituloObra, listarCapitulosObra } from '@/lib/almacen/capitulosObra';
import { listarEmpleadosProyectoEgreso } from '@/lib/almacen/listarEmpleadosProyectoEgreso';
import {
  asegurarUbicacionObra,
  etiquetaUbicacionSelector,
  listarUbicacionesInventario,
  listarUbicacionesParaSelector,
  listarUbicacionesPorEntidad,
} from '@/lib/almacen/ubicacionesInventario';
import {
  listarPartidasProyectoDespacho,
  type PartidaProyectoDespacho,
} from '@/lib/almacen/listarPartidasProyectoDespacho';
import { listarStockUbicacionEgreso } from '@/lib/almacen/registrarEgresoCampo';
import { registrarDespachoWeb } from '@/lib/almacen/registrarDespachoWeb';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import type { TelegramEstado } from '@/lib/telegram/estados';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import {
  enviarPickerProyectosTelegram,
  nombreProyectoTelegram,
} from '@/lib/telegram/proyectoPicker';

/** Flujo unificado: /salidaalmacen (alias /salidaobra, /despacho). */
export const FLUJO_SALIDA_ALMACEN = 'salida_almacen';
export const FLUJO_SALIDA_OBRA = FLUJO_SALIDA_ALMACEN;

export type PasoSalidaAlmacen =
  | 'almacen'
  | 'obrero'
  | 'obrero_nombre'
  | 'obrero_cedula'
  | 'destino_tipo'
  | 'destino_almacen'
  | 'capitulo'
  | 'nuevo_capitulo'
  | 'sabe_partida'
  | 'partida'
  | 'actividad'
  | 'observacion'
  | 'material'
  | 'cantidad'
  | 'mas_lineas'
  | 'foto'
  | 'confirmar';

export type LineaSalidaObraDraft = {
  material_id: string;
  material_nombre: string;
  unidad: string;
  cantidad: number;
};

export type MetadataSalidaObra = {
  flujo?: string;
  paso?: PasoSalidaAlmacen;
  origen_ubicacion_id?: string;
  origen_nombre?: string;
  obrero_empleado_id?: string;
  obrero_nombre?: string;
  obrero_oficio?: string;
  obrero_cedula?: string;
  destino_tipo?: 'obra' | 'almacen';
  proyecto_destino_id?: string;
  proyecto_destino_nombre?: string;
  destino_ubicacion_id?: string;
  destino_nombre?: string;
  destino_fisico?: 'obra_actual' | 'otro_almacen' | 'otra_obra';
  capitulo_id?: string;
  capitulo_nombre?: string;
  lineas?: LineaSalidaObraDraft[];
  draft_material_id?: string;
  draft_material_nombre?: string;
  draft_unidad?: string;
  draft_cantidad?: number;
  foto_storage_path?: string;
  foto_url?: string;
  observaciones?: string;
  telegram_user_id?: string;
  telegram_username?: string | null;
  imputacion_modo?: 'partida' | 'actividad';
  partida_key?: string;
  ci_presupuesto_partida_id?: string | null;
  partida_id?: string | null;
  partida_label?: string;
  actividad_texto?: string;
};

const PREFIX = 'sa:';
const PAGE_SIZE = 6;

function truncar(s: string, max = 54): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function meta(estado: TelegramEstado): MetadataSalidaObra {
  return (estado.metadata ?? {}) as MetadataSalidaObra;
}

export function esFlujoSalidaObraTelegram(estado: TelegramEstado): boolean {
  const f = meta(estado).flujo;
  return (f === FLUJO_SALIDA_ALMACEN || f === 'salida_obra_despacho') && estado.contexto === 'salida_obra';
}

export function esCallbackSalidaObraTelegram(data: string): boolean {
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
  patch: Partial<MetadataSalidaObra>,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    metadata: { ...meta(estado), ...patch },
  });
}

const MENSAJE_INICIO =
  '📤 <b>Salida desde almacén</b> (<code>/salidaalmacen</code>)\n\n' +
  '1️⃣ Obra y <b>almacén de origen</b>\n' +
  '2️⃣ <b>Obrero</b> que recibe (nómina o nombre + cédula)\n' +
  '3️⃣ Destino: <b>obra</b> (capítulo → partida o actividad) u <b>almacén de la entidad</b>\n' +
  '4️⃣ Observaciones opcionales → materiales del <b>stock</b> y cantidades\n' +
  '5️⃣ Foto opcional del material saliente\n' +
  '6️⃣ Confirmar — descuenta stock\n\n' +
  '<i>No configura alarmas de despacho.</i>\n' +
  '<code>/cancelar</code> para abortar.';

export async function manejarComandoSalidaObraTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'salida_obra',
    proyecto_id: null,
    metadata: { flujo: FLUJO_SALIDA_ALMACEN, paso: 'almacen', lineas: [] },
  });
  await sendTelegramMessage(chatId, MENSAJE_INICIO, { parse_mode: 'HTML' });
  await enviarPickerProyectosTelegram(supabase, chatId, 'salida_almacen');
}

export async function prepararSalidaObraTrasProyecto(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
): Promise<void> {
  const nombre = (await nombreProyectoTelegram(supabase, proyectoId)) ?? 'Obra';
  await asegurarUbicacionObra(supabase, proyectoId, nombre);
  await setTelegramContexto(supabase, chatId, {
    contexto: 'salida_obra',
    proyecto_id: proyectoId,
    metadata: { flujo: FLUJO_SALIDA_ALMACEN, paso: 'almacen', lineas: [] },
  });
  await enviarPickerAlmacenOrigen(supabase, chatId, proyectoId, nombre);
}

export async function prepararObraDestinoSalidaAlmacen(
  supabase: SupabaseClient,
  chatId: string,
  proyectoDestinoId: string,
): Promise<void> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esFlujoSalidaObraTelegram(estado) || !estado.proyecto_id) return;

  const nombre = (await nombreProyectoTelegram(supabase, proyectoDestinoId)) ?? 'Obra';
  await asegurarUbicacionObra(supabase, proyectoDestinoId, nombre);

  const origenId = estado.proyecto_id;
  const destinoFisico: MetadataSalidaObra['destino_fisico'] =
    proyectoDestinoId === origenId ? 'obra_actual' : 'otra_obra';

  await patchMeta(supabase, chatId, estado, {
    paso: 'capitulo',
    proyecto_destino_id: proyectoDestinoId,
    proyecto_destino_nombre: nombre,
    destino_fisico: destinoFisico,
    destino_tipo: 'obra',
  });

  await enviarPickerCapitulos(supabase, chatId, proyectoDestinoId, nombre);
}

async function enviarPickerAlmacenOrigen(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
  nombreObra: string,
  page = 0,
): Promise<void> {
  const ubicaciones = await listarUbicacionesParaSelector(supabase, {
    proyectoId,
    soloAlmacenes: true,
  });
  const almacenes = ubicaciones.filter(
    (u) => u.tipo === 'almacen_central' || u.tipo === 'almacen_movil',
  );

  if (!almacenes.length) {
    await sendTelegramMessage(
      chatId,
      '⚠️ No hay almacenes en esta obra. Configúrelos en la app web.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  await enviarPickerUbicacionesPaginado(
    supabase,
    chatId,
    almacenes,
    page,
    `${PREFIX}ub:`,
    `${PREFIX}ubp:`,
    `📤 Obra origen: <b>${nombreObra}</b>\n\n🏭 <b>Almacén de origen</b> (stock que sale):`,
  );
}

async function entidadIdDeProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('ci_proyectos')
    .select('entidad_id')
    .eq('id', proyectoId)
    .maybeSingle();
  const eid = data?.entidad_id != null ? String(data.entidad_id).trim() : '';
  return eid || null;
}

async function enviarPickerAlmacenDestino(
  supabase: SupabaseClient,
  chatId: string,
  proyectoOrigenId: string,
  origenUbicacionId: string,
  page = 0,
): Promise<void> {
  const entidadId = await entidadIdDeProyecto(supabase, proyectoOrigenId);
  if (!entidadId) {
    await sendTelegramMessage(
      chatId,
      '⚠️ La obra de origen no tiene <b>entidad de trabajo</b> asignada.\n' +
        'Configúrela en la app web para ver almacenes de la entidad.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const ubicacionesEntidad = await listarUbicacionesPorEntidad(supabase, entidadId);
  const almacenes = ubicacionesEntidad.filter(
    (u) =>
      (u.tipo === 'almacen_central' || u.tipo === 'almacen_movil') &&
      u.id !== origenUbicacionId,
  );

  if (!almacenes.length) {
    await sendTelegramMessage(
      chatId,
      '⚠️ No hay otros almacenes de esta entidad disponibles como destino.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  await enviarPickerUbicacionesPaginado(
    supabase,
    chatId,
    almacenes,
    page,
    `${PREFIX}dst:`,
    `${PREFIX}dstp:`,
    '🏭 <b>Almacén de destino</b> — almacenes de la misma entidad:',
  );
}

async function enviarPickerUbicacionesPaginado(
  supabase: SupabaseClient,
  chatId: string,
  ubicaciones: Awaited<ReturnType<typeof listarUbicacionesInventario>>,
  page: number,
  prefixSel: string,
  prefixPage: string,
  titulo: string,
): Promise<void> {
  const byId = new Map(ubicaciones.map((u) => [u.id, u]));
  const totalPages = Math.max(1, Math.ceil(ubicaciones.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = ubicaciones.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((u) => {
    let nivel = 0;
    let pid = u.ubicacion_padre_id;
    while (pid && nivel < 5) {
      nivel += 1;
      pid = byId.get(pid)?.ubicacion_padre_id;
    }
    return [{ text: truncar(etiquetaUbicacionSelector(u, nivel)), callback_data: `${prefixSel}${u.id}` }];
  });

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${prefixPage}${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${prefixPage}${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${prefixPage}${safePage + 1}` });
    buttons.push(nav);
  }

  await sendTelegramMessage(chatId, titulo, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons },
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
    buttons.push([{ text: '✏️ Escribir nombre y cédula', callback_data: `${PREFIX}obr:manual` }]);
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
    '👷 <b>¿Quién recibe el material?</b>\nElige de nómina/cuadrilla o escribe nombre y cédula.',
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

async function preguntarDestinoTipo(supabase: SupabaseClient, chatId: string): Promise<void> {
  await patchMeta(supabase, chatId, await getTelegramEstado(supabase, chatId), {
    paso: 'destino_tipo',
  });
  await sendTelegramMessage(
    chatId,
    '🎯 <b>¿A dónde sale el material?</b>',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🏗 A obra', callback_data: `${PREFIX}dest:obra` },
            { text: '🏭 A otro almacén', callback_data: `${PREFIX}dest:alm` },
          ],
        ],
      },
    },
  );
}

async function enviarPickerCapitulos(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
  nombreObra: string,
  page = 0,
): Promise<void> {
  const capitulos = await listarCapitulosObra(supabase, proyectoId, 48);
  const totalPages = Math.max(1, Math.ceil((capitulos.length + 1) / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const sliceStart = safePage * PAGE_SIZE;
  const slice = capitulos.slice(sliceStart, sliceStart + PAGE_SIZE - (safePage === 0 ? 1 : 0));

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
  if (safePage === 0) {
    buttons.push([{ text: '➕ Crear capítulo nuevo', callback_data: `${PREFIX}cap:nuevo` }]);
  }
  for (const c of slice) {
    buttons.push([
      {
        text: truncar(etiquetaCapituloObra(c)),
        callback_data: `${PREFIX}cap:${c.id}`,
      },
    ]);
  }
  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX}capp:${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX}capp:${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX}capp:${safePage + 1}` });
    buttons.push(nav);
  }

  await sendTelegramMessage(
    chatId,
    `🏗 Obra destino: <b>${nombreObra}</b>\n\n📂 Elige el <b>capítulo</b> presupuestario:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

async function enviarPickerMaterialStock(
  supabase: SupabaseClient,
  chatId: string,
  origenId: string,
  page = 0,
): Promise<void> {
  const stock = await listarStockUbicacionEgreso(supabase, origenId);
  if (!stock.length) {
    await sendTelegramMessage(
      chatId,
      '⚠️ No hay stock en este almacén. Reinicie con <code>/salidaalmacen</code>.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const totalPages = Math.max(1, Math.ceil(stock.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = stock.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((s) => [
    {
      text: truncar(`${s.nombre} · disp. ${s.cantidad_disponible} ${s.unidad}`),
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
    '📦 <b>Material / producto</b> — elige de la lista (stock del almacén origen):',
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

function resumenLineas(lineas: LineaSalidaObraDraft[]): string {
  return lineas.map((l, i) => `${i + 1}. ${l.material_nombre} × ${l.cantidad} ${l.unidad}`).join('\n');
}

async function preguntarSabePartida(supabase: SupabaseClient, chatId: string): Promise<void> {
  await patchMeta(supabase, chatId, await getTelegramEstado(supabase, chatId), { paso: 'sabe_partida' });
  await sendTelegramMessage(
    chatId,
    '📂 <b>Imputación presupuestaria</b>\n\n' +
      '¿Conoce el <b>código o partida</b> a la que va este despacho?',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Sí, elegir partida', callback_data: `${PREFIX}parp:si` },
            { text: '❌ No, escribir actividad', callback_data: `${PREFIX}parp:no` },
          ],
        ],
      },
    },
  );
}

async function enviarPickerPartidasProyecto(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
  page = 0,
): Promise<void> {
  const partidas = await listarPartidasProyectoDespacho(supabase, proyectoId);
  if (!partidas.length) {
    await sendTelegramMessage(
      chatId,
      '⚠️ No hay partidas en el presupuesto.\nPulse <b>No, escribir actividad</b>.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const totalPages = Math.max(1, Math.ceil(partidas.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = partidas.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((p) => [
    { text: truncar(p.nombre), callback_data: `${PREFIX}par:${p.key}` },
  ]);

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX}parpg:${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX}parpg:${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX}parpg:${safePage + 1}` });
    buttons.push(nav);
  }
  buttons.push([{ text: '❌ No sé la partida', callback_data: `${PREFIX}parp:no` }]);

  await sendTelegramMessage(chatId, '📂 <b>Seleccione la partida</b>:', {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons },
  });
}

function partidaDesdeKey(
  partidas: PartidaProyectoDespacho[],
  key: string,
): PartidaProyectoDespacho | undefined {
  return partidas.find((p) => p.key === key);
}

function resumenImputacion(m: MetadataSalidaObra): string {
  if (m.destino_tipo === 'almacen') {
    return `🏭 Destino almacén: <b>${escHtml(m.destino_nombre ?? '—')}</b>`;
  }
  const obra = m.proyecto_destino_nombre ?? '—';
  const cap = m.capitulo_nombre ? `\n📂 Cap.: ${escHtml(m.capitulo_nombre)}` : '';
  if (m.imputacion_modo === 'partida' && m.partida_label) {
    return `🏗 ${escHtml(obra)}${cap}\n📂 Partida: <b>${escHtml(m.partida_label)}</b>`;
  }
  if (m.imputacion_modo === 'actividad' && m.actividad_texto?.trim()) {
    return `🏗 ${escHtml(obra)}${cap}\n📅 Actividad: <b>${escHtml(m.actividad_texto.trim())}</b>`;
  }
  return `🏗 Obra: ${escHtml(obra)}${cap}`;
}

function resumenObrero(m: MetadataSalidaObra): string {
  const ced = m.obrero_cedula?.trim() ? ` · C.I. ${m.obrero_cedula.trim()}` : '';
  const ofi = m.obrero_oficio?.trim() ? ` (${m.obrero_oficio.trim()})` : '';
  return `👷 ${escHtml(m.obrero_nombre ?? '—')}${ofi}${ced}`;
}

async function preguntarMasLineas(supabase: SupabaseClient, chatId: string, nLineas: number): Promise<void> {
  await patchMeta(supabase, chatId, await getTelegramEstado(supabase, chatId), { paso: 'mas_lineas' });
  await sendTelegramMessage(
    chatId,
    `✅ Línea agregada (${nLineas} en total).\n\n¿Agregar <b>otro material</b>?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '➕ Otro material', callback_data: `${PREFIX}mas:si` },
            { text: '✔ Listo, continuar', callback_data: `${PREFIX}mas:no` },
          ],
        ],
      },
    },
  );
}

async function preguntarFotoOpcional(supabase: SupabaseClient, chatId: string): Promise<void> {
  await patchMeta(supabase, chatId, await getTelegramEstado(supabase, chatId), { paso: 'foto' });
  await sendTelegramMessage(
    chatId,
    '📷 <b>Foto del material saliente</b> (opcional)\nEnvía una imagen o omite:',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '⏭ Omitir foto', callback_data: `${PREFIX}foto:skip` }]],
      },
    },
  );
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
    '📋 <b>Confirmar salida de almacén</b>\n\n' +
    `🏭 Origen: ${escHtml(m.origen_nombre ?? '—')}\n` +
    `${resumenObrero(m)}\n` +
    `${resumenImputacion(m)}\n` +
    (m.observaciones?.trim() ? `📝 ${escHtml(m.observaciones.trim())}\n\n` : '\n') +
    resumenLineas(lineas) +
    (m.foto_storage_path ? '\n\n📷 Con foto adjunta' : '') +
    '\n\n<i>Al confirmar se descontará el stock del almacén origen.</i>';

  await sendTelegramMessage(chatId, texto, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{ text: '🚀 Registrar salida', callback_data: `${PREFIX}conf:ok` }]],
    },
  });
}

async function finalizarLineaDraft(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const m = meta(estado);
  if (!m.draft_material_id || !m.draft_cantidad || !m.draft_material_nombre) {
    await sendTelegramMessage(chatId, '❌ Línea incompleta.', { parse_mode: 'HTML' });
    return;
  }

  const linea: LineaSalidaObraDraft = {
    material_id: m.draft_material_id,
    material_nombre: m.draft_material_nombre,
    unidad: m.draft_unidad ?? 'UND',
    cantidad: m.draft_cantidad,
  };

  const lineas = [...(m.lineas ?? []), linea];
  await patchMeta(supabase, chatId, estado, {
    lineas,
    draft_material_id: undefined,
    draft_material_nombre: undefined,
    draft_unidad: undefined,
    draft_cantidad: undefined,
    paso: 'mas_lineas',
  });
  await preguntarMasLineas(supabase, chatId, lineas.length);
}

async function preguntarObservacionOpcional(supabase: SupabaseClient, chatId: string): Promise<void> {
  await patchMeta(supabase, chatId, await getTelegramEstado(supabase, chatId), { paso: 'observacion' });
  await sendTelegramMessage(
    chatId,
    '📝 <b>Observaciones</b> (opcional)\n' +
      'Escribe notas del despacho o envía <code>-</code> para continuar sin observaciones:',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '⏭ Sin observaciones', callback_data: `${PREFIX}obs:skip` }]],
      },
    },
  );
}

async function iniciarSeleccionMateriales(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const m = meta(estado);
  if (!m.origen_ubicacion_id) return;
  await patchMeta(supabase, chatId, estado, { paso: 'material', lineas: m.lineas ?? [] });
  await sendTelegramMessage(
    chatId,
    '📦 Elige el <b>material o producto</b> de la lista (stock disponible en el almacén origen):',
    { parse_mode: 'HTML' },
  );
  await enviarPickerMaterialStock(supabase, chatId, m.origen_ubicacion_id);
}

export async function manejarCallbackSalidaObraTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!params.data.startsWith(PREFIX)) return false;

  const estado = await getTelegramEstado(supabase, params.chatId);
  if (!esFlujoSalidaObraTelegram(estado) || !estado.proyecto_id) {
    await answerCallbackQuery(params.callbackId, 'Flujo no activo', true);
    return true;
  }

  const proyectoOrigenId = estado.proyecto_id;
  const m = meta(estado);
  const data = params.data.slice(PREFIX.length);
  const nombreObraOrigen =
    (await nombreProyectoTelegram(supabase, proyectoOrigenId)) ?? 'Obra';

  if (data.startsWith('ubp:')) {
    await answerCallbackQuery(params.callbackId);
    await enviarPickerAlmacenOrigen(
      supabase,
      params.chatId,
      proyectoOrigenId,
      nombreObraOrigen,
      Number(data.slice(4)),
    );
    return true;
  }

  if (data.startsWith('ub:')) {
    const ubicacionId = data.slice(3);
    const { data: ubi } = await supabase
      .from('inv_ubicaciones')
      .select('id, nombre')
      .eq('id', ubicacionId)
      .maybeSingle();
    if (!ubi) {
      await answerCallbackQuery(params.callbackId, 'Almacén no encontrado', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, String(ubi.nombre));
    await patchMeta(supabase, params.chatId, estado, {
      paso: 'obrero',
      origen_ubicacion_id: ubicacionId,
      origen_nombre: String(ubi.nombre),
    });
    await enviarPickerObrero(supabase, params.chatId, proyectoOrigenId);
    return true;
  }

  if (data.startsWith('obrp:')) {
    await answerCallbackQuery(params.callbackId);
    await enviarPickerObrero(supabase, params.chatId, proyectoOrigenId, Number(data.slice(5)));
    return true;
  }

  if (data === 'obr:manual') {
    await answerCallbackQuery(params.callbackId);
    await patchMeta(supabase, params.chatId, estado, { paso: 'obrero_nombre' });
    await sendTelegramMessage(
      params.chatId,
      '✏️ Escribe el <b>nombre y apellido</b> del obrero que recibe el material:',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (data.startsWith('obr:')) {
    const empId = data.slice(4);
    const empleados = await listarEmpleadosProyectoEgreso(supabase, proyectoOrigenId);
    const hit = empleados.find((e) => e.id === empId);
    if (!hit) {
      await answerCallbackQuery(params.callbackId, 'Obrero no encontrado', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, hit.nombre_completo);
    await patchMeta(supabase, params.chatId, estado, {
      obrero_empleado_id: hit.id,
      obrero_nombre: hit.nombre_completo,
      obrero_oficio: hit.oficio ?? undefined,
      obrero_cedula: undefined,
    });
    await preguntarDestinoTipo(supabase, params.chatId);
    return true;
  }

  if (data === 'dest:obra') {
    await answerCallbackQuery(params.callbackId);
    await patchMeta(supabase, params.chatId, estado, { destino_tipo: 'obra' });
    await sendTelegramMessage(
      params.chatId,
      '🏗 <b>Obra de destino</b> — elige la obra donde se usará el material:',
      { parse_mode: 'HTML' },
    );
    await enviarPickerProyectosTelegram(supabase, params.chatId, 'salida_almacen_dest');
    return true;
  }

  if (data === 'dest:alm') {
    await answerCallbackQuery(params.callbackId);
    await patchMeta(supabase, params.chatId, estado, {
      destino_tipo: 'almacen',
      destino_fisico: 'otro_almacen',
      paso: 'destino_almacen',
      proyecto_destino_id: undefined,
      capitulo_id: undefined,
      imputacion_modo: undefined,
    });
    if (m.origen_ubicacion_id) {
      await enviarPickerAlmacenDestino(
        supabase,
        params.chatId,
        proyectoOrigenId,
        m.origen_ubicacion_id,
      );
    }
    return true;
  }

  if (data.startsWith('dstp:')) {
    await answerCallbackQuery(params.callbackId);
    if (m.origen_ubicacion_id) {
      await enviarPickerAlmacenDestino(
        supabase,
        params.chatId,
        proyectoOrigenId,
        m.origen_ubicacion_id,
        Number(data.slice(5)),
      );
    }
    return true;
  }

  if (data.startsWith('dst:')) {
    const ubicacionId = data.slice(4);
    const { data: ubi } = await supabase
      .from('inv_ubicaciones')
      .select('id, nombre')
      .eq('id', ubicacionId)
      .maybeSingle();
    if (!ubi || ubicacionId === m.origen_ubicacion_id) {
      await answerCallbackQuery(params.callbackId, 'Destino inválido', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, String(ubi.nombre));
    await patchMeta(supabase, params.chatId, estado, {
      destino_ubicacion_id: ubicacionId,
      destino_nombre: String(ubi.nombre),
      destino_fisico: 'otro_almacen',
    });
    await preguntarObservacionOpcional(supabase, params.chatId);
    return true;
  }

  if (data === 'obs:skip') {
    await answerCallbackQuery(params.callbackId);
    await patchMeta(supabase, params.chatId, estado, { observaciones: '' });
    await iniciarSeleccionMateriales(
      supabase,
      params.chatId,
      await getTelegramEstado(supabase, params.chatId),
    );
    return true;
  }

  if (data.startsWith('capp:')) {
    const pid = m.proyecto_destino_id;
    if (!pid) return true;
    await answerCallbackQuery(params.callbackId);
    await enviarPickerCapitulos(
      supabase,
      params.chatId,
      pid,
      m.proyecto_destino_nombre ?? 'Obra',
      Number(data.slice(5)),
    );
    return true;
  }

  if (data === 'cap:nuevo') {
    await answerCallbackQuery(params.callbackId);
    await patchMeta(supabase, params.chatId, estado, { paso: 'nuevo_capitulo' });
    await sendTelegramMessage(
      params.chatId,
      '✏️ Escribe el <b>título del capítulo</b> (ej. <code>04 Instalación eléctrica</code>):',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (data.startsWith('cap:')) {
    const capituloId = data.slice(4);
    const { data: cap } = await supabase
      .from('capitulos')
      .select('id, codigo, nombre')
      .eq('id', capituloId)
      .maybeSingle();
    if (!cap?.id) {
      await answerCallbackQuery(params.callbackId, 'Capítulo no encontrado', true);
      return true;
    }
    const label = etiquetaCapituloObra({
      codigo: String(cap.codigo ?? ''),
      nombre: String(cap.nombre ?? ''),
    });
    await answerCallbackQuery(params.callbackId, truncar(label, 40));
    await patchMeta(supabase, params.chatId, estado, {
      capitulo_id: String(cap.id),
      capitulo_nombre: label,
    });
    await preguntarSabePartida(supabase, params.chatId);
    return true;
  }

  if (data.startsWith('matp:')) {
    await answerCallbackQuery(params.callbackId);
    if (m.origen_ubicacion_id) {
      await enviarPickerMaterialStock(supabase, params.chatId, m.origen_ubicacion_id, Number(data.slice(5)));
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
      await answerCallbackQuery(params.callbackId, 'Sin stock', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, truncar(hit.nombre, 40));
    await patchMeta(supabase, params.chatId, estado, {
      paso: 'cantidad',
      draft_material_id: hit.material_id,
      draft_material_nombre: hit.nombre,
      draft_unidad: hit.unidad,
    });
    await sendTelegramMessage(
      params.chatId,
      `🔢 <b>Cantidad</b> — «${hit.nombre}»\n\nDisponible: <b>${hit.cantidad_disponible}</b> ${hit.unidad}\nEscribe la cantidad:`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (data === 'mas:si') {
    await answerCallbackQuery(params.callbackId);
    await patchMeta(supabase, params.chatId, estado, { paso: 'material' });
    if (m.origen_ubicacion_id) {
      await enviarPickerMaterialStock(supabase, params.chatId, m.origen_ubicacion_id);
    }
    return true;
  }

  if (data === 'mas:no') {
    await answerCallbackQuery(params.callbackId);
    if (!(m.lineas ?? []).length) {
      await sendTelegramMessage(params.chatId, '⚠️ Agregue al menos un material.', { parse_mode: 'HTML' });
      return true;
    }
    await preguntarFotoOpcional(supabase, params.chatId);
    return true;
  }

  if (data === 'foto:skip') {
    await answerCallbackQuery(params.callbackId);
    await enviarConfirmacion(supabase, params.chatId, await getTelegramEstado(supabase, params.chatId));
    return true;
  }

  if (data === 'parp:si') {
    await answerCallbackQuery(params.callbackId);
    const pidDest = m.proyecto_destino_id ?? proyectoOrigenId;
    await patchMeta(supabase, params.chatId, estado, { paso: 'partida' });
    await enviarPickerPartidasProyecto(supabase, params.chatId, pidDest);
    return true;
  }

  if (data === 'parp:no') {
    await answerCallbackQuery(params.callbackId);
    await patchMeta(supabase, params.chatId, estado, {
      paso: 'actividad',
      imputacion_modo: 'actividad',
      partida_key: undefined,
      ci_presupuesto_partida_id: undefined,
      partida_id: undefined,
      partida_label: undefined,
    });
    await sendTelegramMessage(
      params.chatId,
      '📅 Escriba la <b>actividad</b> de destino (ej. <code>Instalación eléctrica planta baja</code>):',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (data.startsWith('parpg:')) {
    const pidDest = m.proyecto_destino_id ?? proyectoOrigenId;
    await answerCallbackQuery(params.callbackId);
    await enviarPickerPartidasProyecto(supabase, params.chatId, pidDest, Number(data.slice(6)));
    return true;
  }

  if (data.startsWith('par:')) {
    const partidaKey = data.slice(4);
    const pidDest = m.proyecto_destino_id ?? proyectoOrigenId;
    const partidas = await listarPartidasProyectoDespacho(supabase, pidDest);
    const hit = partidaDesdeKey(partidas, partidaKey);
    if (!hit) {
      await answerCallbackQuery(params.callbackId, 'Partida no encontrada', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, truncar(hit.nombre, 40));
    await patchMeta(supabase, params.chatId, estado, {
      imputacion_modo: 'partida',
      partida_key: hit.key,
      ci_presupuesto_partida_id: hit.ci_presupuesto_partida_id,
      partida_id: hit.partida_id,
      partida_label: hit.nombre,
      actividad_texto: undefined,
    });
    await preguntarObservacionOpcional(supabase, params.chatId);
    return true;
  }

  if (data === 'conf:ok') {
    await answerCallbackQuery(params.callbackId, 'Procesando…');
    const fresh = await getTelegramEstado(supabase, params.chatId);
    const fm = meta(fresh);
    const lineas = fm.lineas ?? [];

    if (!lineas.length || !fm.origen_ubicacion_id || !fm.obrero_nombre?.trim()) {
      await sendTelegramMessage(params.chatId, '❌ Salida incompleta.', { parse_mode: 'HTML' });
      return true;
    }

    let destinoUbicacionId = fm.destino_ubicacion_id;
    let destinoFisico = fm.destino_fisico ?? 'obra_actual';

    if (fm.destino_tipo === 'almacen') {
      if (!destinoUbicacionId) {
        await sendTelegramMessage(params.chatId, '❌ Falta almacén destino.', { parse_mode: 'HTML' });
        return true;
      }
      destinoFisico = 'otro_almacen';
    } else {
      const pidDest = fm.proyecto_destino_id ?? proyectoOrigenId;
      const nombreDest =
        fm.proyecto_destino_nombre ??
        (await nombreProyectoTelegram(supabase, pidDest)) ??
        'Obra';
      destinoUbicacionId = await asegurarUbicacionObra(supabase, pidDest, nombreDest);
      destinoFisico =
        pidDest === proyectoOrigenId ? 'obra_actual' : 'otra_obra';

      if (fm.imputacion_modo === 'partida' && !fm.partida_key) {
        await sendTelegramMessage(
          params.chatId,
          '⚠️ Elija partida o indique actividad.',
          { parse_mode: 'HTML' },
        );
        return true;
      }
      if (fm.imputacion_modo === 'actividad' && !fm.actividad_texto?.trim()) {
        await sendTelegramMessage(
          params.chatId,
          '⚠️ Escriba la actividad de destino.',
          { parse_mode: 'HTML' },
        );
        return true;
      }
    }

    const porPartida = fm.imputacion_modo === 'partida';
    const imputaObra = fm.destino_tipo !== 'almacen';
    const obreroOficio = [fm.obrero_oficio, fm.obrero_cedula ? `C.I. ${fm.obrero_cedula}` : null]
      .filter(Boolean)
      .join(' · ') || null;

    const obsPartes = [
      fm.capitulo_nombre ? `Cap. ${fm.capitulo_nombre}` : null,
      fm.observaciones?.trim() || null,
    ].filter(Boolean);

    const fotos =
      fm.foto_storage_path && fm.foto_url
        ? [{ storage_path: fm.foto_storage_path, url: fm.foto_url }]
        : fm.foto_storage_path
          ? [{ storage_path: fm.foto_storage_path, url: fm.foto_url ?? '' }]
          : undefined;

    const resultado = await registrarDespachoWeb(supabase, {
      proyectoId: proyectoOrigenId,
      obreroEmpleadoId: fm.obrero_empleado_id,
      obreroNombre: fm.obrero_nombre!.trim(),
      obreroOficio,
      observaciones: obsPartes.join(' · ') || null,
      fotos,
      lineas: lineas.map((l) => ({
        material_id: l.material_id,
        material_nombre: l.material_nombre,
        unidad: l.unidad,
        cantidad: l.cantidad,
        origen_ubicacion_id: fm.origen_ubicacion_id!,
        destino_ubicacion_id: destinoUbicacionId!,
        destino_fisico: destinoFisico,
        imputacion_tipo: imputaObra && porPartida ? ('partida_lulo' as const) : ('actividad' as const),
        imputaciones:
          imputaObra && porPartida
            ? [
                {
                  ci_presupuesto_partida_id: fm.ci_presupuesto_partida_id ?? null,
                  partida_id: fm.partida_id ?? null,
                  cantidad_imputada: l.cantidad,
                },
              ]
            : [],
        ci_presupuesto_partida_id: imputaObra && porPartida ? fm.ci_presupuesto_partida_id ?? null : null,
        partida_id: imputaObra && porPartida ? fm.partida_id ?? null : null,
        partida_label: imputaObra && porPartida ? fm.partida_label ?? null : null,
        tarea_label: imputaObra && !porPartida
          ? (fm.actividad_texto?.trim() || 'Despacho Telegram').slice(0, 200)
          : null,
      })),
    });

    await setTelegramContexto(supabase, params.chatId, { contexto: 'menu', metadata: {} });

    if (!resultado.ok) {
      await sendTelegramMessage(params.chatId, `❌ ${resultado.error}`, { parse_mode: 'HTML' });
      return true;
    }

    const codigos = resultado.codigos.join(', ') || '—';
    const link = `${baseUrlApp()}/almacen`;
    await sendTelegramMessage(
      params.chatId,
      `✅ <b>Salida registrada</b>\n\n` +
        `🏭 ${fm.origen_nombre ?? 'Almacén'}\n` +
        `👷 ${fm.obrero_nombre}\n` +
        `📦 ${lineas.length} material(es)\n` +
        `🔖 ${codigos}\n\n` +
        `<a href="${link}">Ver movimientos</a>`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  return false;
}

export async function manejarTextoSalidaObraTelegram(
  supabase: SupabaseClient,
  chatId: string,
  texto: string,
  userId?: string,
  username?: string | null,
): Promise<boolean> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esFlujoSalidaObraTelegram(estado)) return false;

  const paso = meta(estado).paso;
  const trimmed = texto.trim();

  if (paso === 'obrero_nombre') {
    if (trimmed.length < 3) {
      await sendTelegramMessage(chatId, 'Nombre muy corto. Intente de nuevo.', { parse_mode: 'HTML' });
      return true;
    }
    await patchMeta(supabase, chatId, estado, {
      paso: 'obrero_cedula',
      obrero_nombre: trimmed,
      obrero_empleado_id: undefined,
      obrero_oficio: undefined,
    });
    await sendTelegramMessage(
      chatId,
      '🪪 Escribe la <b>cédula</b> del obrero (puedes copiar y pegar):',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (paso === 'obrero_cedula') {
    if (trimmed.length < 4) {
      await sendTelegramMessage(chatId, 'Cédula inválida. Intente de nuevo.', { parse_mode: 'HTML' });
      return true;
    }
    await patchMeta(supabase, chatId, estado, {
      obrero_cedula: trimmed.replace(/\s/g, ''),
      telegram_user_id: userId,
      telegram_username: username ?? null,
    });
    await preguntarDestinoTipo(supabase, chatId);
    return true;
  }

  if (paso === 'nuevo_capitulo' && estado.proyecto_id) {
    const pidDest = meta(estado).proyecto_destino_id ?? estado.proyecto_id;
    try {
      const cap = await crearCapituloObra(supabase, { proyectoId: pidDest, titulo: trimmed });
      const label = etiquetaCapituloObra({
        codigo: String(cap.codigo ?? ''),
        nombre: String(cap.nombre ?? ''),
      });
      await patchMeta(supabase, chatId, estado, {
        paso: 'sabe_partida',
        capitulo_id: cap.id,
        capitulo_nombre: label,
      });
      await sendTelegramMessage(chatId, `✅ Capítulo: <b>${label}</b>`, { parse_mode: 'HTML' });
      await preguntarSabePartida(supabase, chatId);
    } catch (e) {
      await sendTelegramMessage(
        chatId,
        `❌ ${e instanceof Error ? e.message : 'No se pudo crear el capítulo'}`,
        { parse_mode: 'HTML' },
      );
    }
    return true;
  }

  if (paso === 'cantidad') {
    const qty = Number(trimmed.replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) {
      await sendTelegramMessage(chatId, 'Cantidad inválida.', { parse_mode: 'HTML' });
      return true;
    }
    const m = meta(estado);
    if (m.origen_ubicacion_id && m.draft_material_id) {
      const stock = await listarStockUbicacionEgreso(supabase, m.origen_ubicacion_id);
      const hit = stock.find((s) => s.material_id === m.draft_material_id);
      if (hit && qty > hit.cantidad_disponible + 0.0001) {
        await sendTelegramMessage(
          chatId,
          `Supera stock (${hit.cantidad_disponible} ${hit.unidad}).`,
          { parse_mode: 'HTML' },
        );
        return true;
      }
    }
    await patchMeta(supabase, chatId, estado, { draft_cantidad: qty });
    await finalizarLineaDraft(supabase, chatId, await getTelegramEstado(supabase, chatId));
    return true;
  }

  if (paso === 'actividad') {
    if (trimmed.length < 2) {
      await sendTelegramMessage(chatId, 'Describe la actividad (mín. 2 caracteres).', { parse_mode: 'HTML' });
      return true;
    }
    await patchMeta(supabase, chatId, estado, {
      imputacion_modo: 'actividad',
      actividad_texto: trimmed,
      partida_key: undefined,
      ci_presupuesto_partida_id: undefined,
      partida_id: undefined,
      partida_label: undefined,
    });
    await preguntarObservacionOpcional(supabase, chatId);
    return true;
  }

  if (paso === 'observacion') {
    const obs = trimmed === '-' ? '' : trimmed;
    await patchMeta(supabase, chatId, estado, {
      observaciones: obs,
      telegram_user_id: userId,
      telegram_username: username ?? null,
    });
    if (obs) {
      await sendTelegramMessage(chatId, '📝 Observaciones guardadas.', { parse_mode: 'HTML' });
    }
    await iniciarSeleccionMateriales(
      supabase,
      chatId,
      await getTelegramEstado(supabase, chatId),
    );
    return true;
  }

  if (paso === 'foto') {
    await sendTelegramMessage(
      chatId,
      'Envíe la foto o pulse <b>Omitir foto</b>.',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (
    paso === 'sabe_partida' ||
    paso === 'partida' ||
    paso === 'destino_almacen' ||
    paso === 'material' ||
    paso === 'mas_lineas' ||
    paso === 'destino_tipo' ||
    paso === 'obrero'
  ) {
    await sendTelegramMessage(
      chatId,
      'Use los botones del mensaje anterior o <code>/cancelar</code>.',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  return false;
}

export async function manejarFotoSalidaAlmacenTelegram(params: {
  supabase: SupabaseClient;
  chatId: string;
  userId: string;
  username?: string | null;
  buffer: Buffer;
  mimeType: string;
  ext: string;
}): Promise<boolean> {
  const estado = await getTelegramEstado(params.supabase, params.chatId);
  if (!esFlujoSalidaObraTelegram(estado)) return false;
  if (meta(estado).paso !== 'foto' || !estado.proyecto_id) return false;

  const storagePath = `telegram-movimientos/${estado.proyecto_id}/salida-almacen/${Date.now()}.${params.ext}`;
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
  });

  await sendTelegramMessage(params.chatId, '✅ Foto guardada.', { parse_mode: 'HTML' });
  await enviarConfirmacion(
    params.supabase,
    params.chatId,
    await getTelegramEstado(params.supabase, params.chatId),
  );
  return true;
}

export function esComandoSalidaObraTelegram(texto: string): boolean {
  const t = texto.trim().toLowerCase().split(/\s+/)[0]?.split('@')[0] ?? '';
  return t === '/salidaalmacen' || t === '/salidaobra' || t === '/despacho';
}
