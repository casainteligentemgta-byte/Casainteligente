import type { SupabaseClient } from '@supabase/supabase-js';
import { listarStockUbicacionEgreso } from '@/lib/almacen/registrarEgresoCampo';
import {
  etiquetaUbicacionSelector,
  listarUbicacionesParaSelector,
} from '@/lib/almacen/ubicacionesInventario';
import {
  loadCatalogoProyectosApp,
  loadProyectosModuloIntegralPorEntidad,
} from '@/lib/proyectos/proyectosUnificados';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import type { TelegramEstado } from '@/lib/telegram/estados';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import {
  EntidadConNombre,
  SELECT_NOMBRE_ENTIDAD,
  nombreEntidad,
} from '@/lib/entidades/nombreEntidad';
import {
  MENSAJE_OBRA_NO_ASIGNADA_DEPOSITARIO,
  MENSAJE_SIN_OBRA_DEPOSITARIO,
  alcanceObrasDepositarioParaChat,
  exigirObraPermitidaDepositario,
  filtrarProyectosPorAlcanceDepositario,
  filtrarUbicacionesPorAlcanceDepositario,
  proyectoIdDeUbicacionId,
} from '@/lib/telegram/obrasDepositarioTelegram';

export const FLUJO_STOCK_CONSULTA = 'stock_consulta_almacen';

export type PasoStockConsulta = 'entidad' | 'obra' | 'almacen' | 'listado';

export type MetadataStockConsulta = {
  flujo?: string;
  paso?: PasoStockConsulta;
  entidad_id?: string;
  entidad_nombre?: string;
  proyecto_id?: string;
  proyecto_nombre?: string;
  ubicacion_id?: string;
  ubicacion_nombre?: string;
  stock_page?: number;
};

const PREFIX = 'st:';
const PICKER_SIZE = 8;
const STOCK_LINES_PAGE = 22;
const MAX_MSG = 3800;

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

function meta(estado: TelegramEstado): MetadataStockConsulta {
  return (estado.metadata ?? {}) as MetadataStockConsulta;
}

export function esFlujoStockConsultaTelegram(estado: TelegramEstado): boolean {
  return meta(estado).flujo === FLUJO_STOCK_CONSULTA && estado.contexto === 'consulta_stock';
}

export function esCallbackStockConsultaTelegram(data: string): boolean {
  return data.startsWith(PREFIX);
}

async function patchMeta(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  patch: Partial<MetadataStockConsulta>,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    metadata: { ...meta(estado), ...patch },
  });
}

type EntidadOption = { id: string; nombre: string };

async function listarEntidadesActivas(
  supabase: SupabaseClient,
): Promise<EntidadOption[]> {
  const { data: proys, error: pErr } = await supabase
    .from('ci_proyectos')
    .select('entidad_id')
    .not('entidad_id', 'is', null)
    .limit(500);
  if (pErr?.code === '42P01') return [];
  if (pErr) throw new Error(pErr.message);

  const ids = Array.from(
    new Set(
      (proys ?? [])
        .map((r) => String((r as { entidad_id?: string }).entidad_id ?? '').trim())
        .filter(Boolean),
    ),
  );
  if (!ids.length) return [];

  const { data: entidades, error: eErr } = await supabase
    .from('ci_entidades')
    .select(SELECT_NOMBRE_ENTIDAD)
    .in('id', ids.slice(0, 200));
  if (eErr?.code === '42P01') return [];
  if (eErr) throw new Error(eErr.message);

  return (entidades ?? []).map((e) => ({
    id: String(e.id),
    nombre: nombreEntidad(e as EntidadConNombre, 'Sin nombre'),
  }));
}

async function datosEntidadDeProyecto(
  supabase: SupabaseClient,
  entidadId: string | null | undefined,
): Promise<{ id?: string; nombre?: string }> {
  const id = String(entidadId ?? '').trim();
  if (!id) return {};
  const { data } = await supabase
    .from('ci_entidades')
    .select(SELECT_NOMBRE_ENTIDAD)
    .eq('id', id)
    .maybeSingle();
  if (!data) return { id };
  return { id, nombre: nombreEntidad(data as EntidadConNombre, 'Sin nombre') };
}

async function enviarPickerEntidades(
  supabase: SupabaseClient,
  chatId: string,
  page = 0,
): Promise<void> {
  let entidades = await listarEntidadesActivas(supabase);
  const alcance = await alcanceObrasDepositarioParaChat(supabase, chatId);
  if (alcance !== null && alcance !== 'todas') {
    const { proyectos } = await loadCatalogoProyectosApp(supabase);
    const mios = filtrarProyectosPorAlcanceDepositario(proyectos, alcance);
    const ids = new Set(mios.map((p) => String(p.entidad_id ?? '').trim()).filter(Boolean));
    entidades = entidades.filter((e) => ids.has(e.id));
  }
  if (!entidades.length) {
    await sendTelegramMessage(
      chatId,
      '⚠️ No hay entidades con obras configuradas.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const totalPages = Math.max(1, Math.ceil(entidades.length / PICKER_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = entidades.slice(safePage * PICKER_SIZE, safePage * PICKER_SIZE + PICKER_SIZE);

  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((e) => [
    { text: truncar(e.nombre), callback_data: `${PREFIX}e:${e.id}` },
  ]);

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX}ep:${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX}ep:${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX}ep:${safePage + 1}` });
    buttons.push(nav);
  }

  await sendTelegramMessage(
    chatId,
    '📦 <b>Consulta de stock</b>\n\n1️⃣ Elige la <b>entidad</b> de trabajo:',
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

async function enviarPickerObrasEntidad(
  supabase: SupabaseClient,
  chatId: string,
  entidadId: string,
  entidadNombre: string,
  page = 0,
): Promise<void> {
  const { proyectos, errors } = await loadProyectosModuloIntegralPorEntidad(supabase, entidadId);
  if (errors.length) {
    await sendTelegramMessage(chatId, `⚠️ ${escHtml(errors[0] ?? 'Error al cargar obras')}`, {
      parse_mode: 'HTML',
    });
    return;
  }
  const alcance = await alcanceObrasDepositarioParaChat(supabase, chatId);
  const permitidos = filtrarProyectosPorAlcanceDepositario(proyectos, alcance);
  if (!permitidos.length) {
    await sendTelegramMessage(
      chatId,
      `⚠️ La entidad <b>${escHtml(entidadNombre)}</b> no tiene obras/módulos.`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  const totalPages = Math.max(1, Math.ceil(permitidos.length / PICKER_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = permitidos.slice(safePage * PICKER_SIZE, safePage * PICKER_SIZE + PICKER_SIZE);

  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((p) => [
    { text: truncar(p.nombre), callback_data: `${PREFIX}p:${p.id}` },
  ]);

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX}pp:${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX}pp:${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX}pp:${safePage + 1}` });
    buttons.push(nav);
  }

  await sendTelegramMessage(
    chatId,
    `🏢 Entidad: <b>${escHtml(entidadNombre)}</b>\n\n2️⃣ Elige la <b>obra</b>:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

async function enviarPickerObrasDepositario(
  supabase: SupabaseClient,
  chatId: string,
  obras: Array<{ id: string; nombre: string }>,
  page = 0,
): Promise<void> {
  const totalPages = Math.max(1, Math.ceil(obras.length / PICKER_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = obras.slice(safePage * PICKER_SIZE, safePage * PICKER_SIZE + PICKER_SIZE);
  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((p) => [
    { text: truncar(p.nombre), callback_data: `${PREFIX}p:${p.id}` },
  ]);
  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX}dp:${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX}dp:${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX}dp:${safePage + 1}` });
    buttons.push(nav);
  }
  await sendTelegramMessage(
    chatId,
    '📦 <b>Consulta de stock</b>\n\nElige la <b>obra</b>:',
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

async function continuarStockTrasObra(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  proyecto: { id: string; nombre: string; entidad_id?: string | null },
): Promise<void> {
  const entidad = await datosEntidadDeProyecto(supabase, proyecto.entidad_id ?? meta(estado).entidad_id);
  await setTelegramContexto(supabase, chatId, {
    proyecto_id: proyecto.id,
    metadata: {
      ...meta(estado),
      flujo: FLUJO_STOCK_CONSULTA,
      paso: 'almacen',
      entidad_id: entidad.id ?? meta(estado).entidad_id,
      entidad_nombre: entidad.nombre ?? meta(estado).entidad_nombre,
      proyecto_id: proyecto.id,
      proyecto_nombre: proyecto.nombre,
      ubicacion_id: undefined,
      ubicacion_nombre: undefined,
    },
  });
  await enviarPickerAlmacenesObra(supabase, chatId, proyecto.id, proyecto.nombre);
}

async function enviarPickerAlmacenesObra(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
  proyectoNombre: string,
  page = 0,
): Promise<void> {
  const ubicaciones = await listarUbicacionesParaSelector(supabase, {
    proyectoId,
    soloAlmacenes: true,
  });
  const alcance = await alcanceObrasDepositarioParaChat(supabase, chatId);
  const almacenes = filtrarUbicacionesPorAlcanceDepositario(
    ubicaciones.filter((u) => u.tipo === 'almacen_central' || u.tipo === 'almacen_movil'),
    alcance,
  );

  if (!almacenes.length) {
    await sendTelegramMessage(
      chatId,
      `⚠️ La obra <b>${escHtml(proyectoNombre)}</b> no tiene almacenes configurados.`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  if (almacenes.length === 1 && alcance !== null && alcance !== 'todas') {
    const unico = almacenes[0]!;
    await sendTelegramMessage(
      chatId,
      `✅ Almacén: <b>${escHtml(unico.nombre)}</b>`,
      { parse_mode: 'HTML' },
    );
    const estado = await getTelegramEstado(supabase, chatId);
    await patchMeta(supabase, chatId, estado, {
      paso: 'listado',
      ubicacion_id: unico.id,
      ubicacion_nombre: unico.nombre,
      stock_page: 0,
    });
    await enviarListadoStock(supabase, chatId, await getTelegramEstado(supabase, chatId), 0);
    return;
  }

  const byId = new Map(almacenes.map((u) => [u.id, u]));
  const totalPages = Math.max(1, Math.ceil(almacenes.length / PICKER_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = almacenes.slice(safePage * PICKER_SIZE, safePage * PICKER_SIZE + PICKER_SIZE);

  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((u) => {
    let nivel = 0;
    let pid = u.ubicacion_padre_id;
    while (pid && nivel < 5) {
      nivel += 1;
      pid = byId.get(pid)?.ubicacion_padre_id;
    }
    return [
      {
        text: truncar(etiquetaUbicacionSelector(u, nivel)),
        callback_data: `${PREFIX}u:${u.id}`,
      },
    ];
  });

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX}up:${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX}up:${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX}up:${safePage + 1}` });
    buttons.push(nav);
  }

  await sendTelegramMessage(
    chatId,
    `🏗 Obra: <b>${escHtml(proyectoNombre)}</b>\n\n3️⃣ Elige el <b>almacén</b>:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

function lineasStockPagina(
  stock: Awaited<ReturnType<typeof listarStockUbicacionEgreso>>,
  page: number,
): { lineas: string[]; totalPages: number; safePage: number } {
  const sorted = [...stock].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const totalPages = Math.max(1, Math.ceil(sorted.length / STOCK_LINES_PAGE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = sorted.slice(safePage * STOCK_LINES_PAGE, safePage * STOCK_LINES_PAGE + STOCK_LINES_PAGE);
  const lineas = slice.map(
    (s, i) =>
      `${safePage * STOCK_LINES_PAGE + i + 1}. ${escHtml(s.nombre)} — <b>${s.cantidad_disponible}</b> ${escHtml(s.unidad)}`,
  );
  return { lineas, totalPages, safePage };
}

async function enviarListadoStock(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  page = 0,
): Promise<void> {
  const m = meta(estado);
  const ubicacionId = m.ubicacion_id;
  if (!ubicacionId) return;

  const stock = await listarStockUbicacionEgreso(supabase, ubicacionId);
  const totalUnidades = stock.reduce((a, s) => a + s.cantidad_disponible, 0);

  if (!stock.length) {
    await setTelegramContexto(supabase, chatId, { contexto: 'menu', metadata: {} });
    await sendTelegramMessage(
      chatId,
      `📦 <b>Stock en ${escHtml(m.ubicacion_nombre ?? 'almacén')}</b>\n\n` +
        `🏢 ${escHtml(m.entidad_nombre ?? '—')} · 🏗 ${escHtml(m.proyecto_nombre ?? '—')}\n\n` +
        '<i>Sin existencias disponibles en este almacén.</i>',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const { lineas, totalPages, safePage } = lineasStockPagina(stock, page);

  let texto =
    `📦 <b>Stock completo</b>\n` +
    `🏢 ${escHtml(m.entidad_nombre ?? '—')}\n` +
    `🏗 ${escHtml(m.proyecto_nombre ?? '—')}\n` +
    `🏭 ${escHtml(m.ubicacion_nombre ?? '—')}\n\n` +
    `${stock.length} material(es) · ${totalUnidades.toLocaleString('es-VE')} unidades\n\n` +
    lineas.join('\n');

  if (texto.length > MAX_MSG) {
    texto = texto.slice(0, MAX_MSG - 20) + '\n…';
  }

  const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];
  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX}sp:${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX}sp:${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX}sp:${safePage + 1}` });
    keyboard.push(nav);
  }
  keyboard.push([{ text: '🔄 Otra consulta', callback_data: `${PREFIX}again` }]);

  await patchMeta(supabase, chatId, estado, { paso: 'listado', stock_page: safePage });

  await sendTelegramMessage(chatId, texto, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard },
  });
}

export async function manejarComandoStockConsultaTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'consulta_stock',
    proyecto_id: null,
    metadata: { flujo: FLUJO_STOCK_CONSULTA, paso: 'entidad' },
  });
  await sendTelegramMessage(
    chatId,
    '📦 <b>Consulta de inventario por almacén</b>\n\n' +
      'Entidad → obra → almacén → listado completo de stock.\n\n' +
      '<code>/cancelar</code> para salir.\n' +
      '<i>Búsqueda rápida:</i> <code>/stock rancho flamboyant</code> (elige almacén / obra / total) · <code>/stock cemento</code>',
    { parse_mode: 'HTML' },
  );

  const alcance = await alcanceObrasDepositarioParaChat(supabase, chatId);
  if (alcance !== null && alcance !== 'todas') {
    const { proyectos } = await loadCatalogoProyectosApp(supabase);
    const mios = filtrarProyectosPorAlcanceDepositario(proyectos, alcance);
    if (!mios.length) {
      await sendTelegramMessage(chatId, MENSAJE_SIN_OBRA_DEPOSITARIO, { parse_mode: 'HTML' });
      return;
    }
    const estado = await getTelegramEstado(supabase, chatId);
    if (mios.length === 1) {
      const unico = mios[0]!;
      await sendTelegramMessage(chatId, `✅ Obra: <b>${escHtml(unico.nombre)}</b>`, {
        parse_mode: 'HTML',
      });
      await continuarStockTrasObra(supabase, chatId, estado, unico);
      return;
    }
    await patchMeta(supabase, chatId, estado, { paso: 'obra' });
    await enviarPickerObrasDepositario(supabase, chatId, mios);
    return;
  }

  await enviarPickerEntidades(supabase, chatId);
}

export async function manejarCallbackStockConsultaTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!params.data.startsWith(PREFIX)) return false;

  const estado = await getTelegramEstado(supabase, params.chatId);
  if (!esFlujoStockConsultaTelegram(estado) && params.data !== `${PREFIX}again`) {
    await answerCallbackQuery(params.callbackId, 'Use /stock para consultar', true);
    return true;
  }

  const data = params.data.slice(PREFIX.length);
  const m = meta(estado);

  if (data === 'again') {
    await answerCallbackQuery(params.callbackId);
    await manejarComandoStockConsultaTelegram(supabase, params.chatId);
    return true;
  }

  if (!esFlujoStockConsultaTelegram(estado)) return false;

  if (data.startsWith('ep:')) {
    await answerCallbackQuery(params.callbackId);
    await enviarPickerEntidades(supabase, params.chatId, Number(data.slice(3)));
    return true;
  }

  if (data.startsWith('e:')) {
    const entidadId = data.slice(2);
    const entidades = await listarEntidadesActivas(supabase);
    const hit = entidades.find((e) => e.id === entidadId);
    if (!hit) {
      await answerCallbackQuery(params.callbackId, 'Entidad no encontrada', true);
      return true;
    }
    const alcance = await alcanceObrasDepositarioParaChat(supabase, params.chatId);
    if (alcance !== null && alcance !== 'todas') {
      const { proyectos } = await loadCatalogoProyectosApp(supabase);
      const mios = filtrarProyectosPorAlcanceDepositario(proyectos, alcance);
      const permitida = mios.some((p) => String(p.entidad_id ?? '') === hit.id);
      if (!permitida) {
        await answerCallbackQuery(params.callbackId, MENSAJE_OBRA_NO_ASIGNADA_DEPOSITARIO, true);
        return true;
      }
    }
    await answerCallbackQuery(params.callbackId, truncar(hit.nombre, 40));
    await patchMeta(supabase, params.chatId, estado, {
      paso: 'obra',
      entidad_id: hit.id,
      entidad_nombre: hit.nombre,
      proyecto_id: undefined,
      proyecto_nombre: undefined,
      ubicacion_id: undefined,
      ubicacion_nombre: undefined,
    });
    await enviarPickerObrasEntidad(supabase, params.chatId, hit.id, hit.nombre);
    return true;
  }

  if (data.startsWith('dp:')) {
    await answerCallbackQuery(params.callbackId);
    const alcance = await alcanceObrasDepositarioParaChat(supabase, params.chatId);
    const { proyectos } = await loadCatalogoProyectosApp(supabase);
    const mios = filtrarProyectosPorAlcanceDepositario(proyectos, alcance);
    await enviarPickerObrasDepositario(supabase, params.chatId, mios, Number(data.slice(3)));
    return true;
  }

  if (data.startsWith('pp:')) {
    if (!m.entidad_id) return true;
    await answerCallbackQuery(params.callbackId);
    await enviarPickerObrasEntidad(
      supabase,
      params.chatId,
      m.entidad_id,
      m.entidad_nombre ?? 'Entidad',
      Number(data.slice(3)),
    );
    return true;
  }

  if (data.startsWith('p:')) {
    const proyectoId = data.slice(2);
    if (!(await exigirObraPermitidaDepositario(supabase, params.chatId, proyectoId, params.callbackId))) {
      return true;
    }
    let hit: { id: string; nombre: string; entidad_id?: string | null } | undefined;
    if (m.entidad_id) {
      const { proyectos } = await loadProyectosModuloIntegralPorEntidad(supabase, m.entidad_id);
      hit = filtrarProyectosPorAlcanceDepositario(
        proyectos,
        await alcanceObrasDepositarioParaChat(supabase, params.chatId),
      ).find((p) => p.id === proyectoId);
    }
    if (!hit) {
      const { proyectos } = await loadCatalogoProyectosApp(supabase);
      hit = filtrarProyectosPorAlcanceDepositario(
        proyectos,
        await alcanceObrasDepositarioParaChat(supabase, params.chatId),
      ).find((p) => p.id === proyectoId);
    }
    if (!hit) {
      await answerCallbackQuery(params.callbackId, 'Obra no encontrada', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, truncar(hit.nombre, 40));
    await continuarStockTrasObra(supabase, params.chatId, estado, hit);
    return true;
  }

  if (data.startsWith('up:')) {
    if (!estado.proyecto_id) return true;
    await answerCallbackQuery(params.callbackId);
    await enviarPickerAlmacenesObra(
      supabase,
      params.chatId,
      estado.proyecto_id,
      m.proyecto_nombre ?? 'Obra',
      Number(data.slice(3)),
    );
    return true;
  }

  if (data.startsWith('u:')) {
    const ubicacionId = data.slice(2);
    if (!estado.proyecto_id) return true;
    if (!(await exigirObraPermitidaDepositario(supabase, params.chatId, estado.proyecto_id, params.callbackId))) {
      return true;
    }
    const pidUbi = await proyectoIdDeUbicacionId(supabase, ubicacionId);
    if (pidUbi && pidUbi !== estado.proyecto_id) {
      await answerCallbackQuery(params.callbackId, MENSAJE_OBRA_NO_ASIGNADA_DEPOSITARIO, true);
      return true;
    }
    if (!(await exigirObraPermitidaDepositario(supabase, params.chatId, pidUbi ?? estado.proyecto_id, params.callbackId))) {
      return true;
    }
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
    const fresh = await getTelegramEstado(supabase, params.chatId);
    await patchMeta(supabase, params.chatId, fresh, {
      paso: 'listado',
      ubicacion_id: ubicacionId,
      ubicacion_nombre: String(ubi.nombre),
      stock_page: 0,
    });
    await enviarListadoStock(
      supabase,
      params.chatId,
      await getTelegramEstado(supabase, params.chatId),
      0,
    );
    return true;
  }

  if (data.startsWith('sp:')) {
    await answerCallbackQuery(params.callbackId);
    if (!m.ubicacion_id) return true;
    await enviarListadoStock(supabase, params.chatId, estado, Number(data.slice(3)));
    return true;
  }

  return false;
}
