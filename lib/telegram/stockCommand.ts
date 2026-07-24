import type { SupabaseClient } from '@supabase/supabase-js';
import { patronIlike } from '@/lib/contabilidad/comprasQueryFiltros';
import { getStockRealObra } from '@/lib/almacen/getStockRealObra';
import { esUbicacionAlmacenFisico } from '@/lib/almacen/inventarioFiltroUbicacion';
import type { StockProyectoItem } from '@/lib/almacen/listarStockProyecto';
import {
  answerCallbackQuery,
  enviarMensajeTelegram,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';
import {
  buscarProyectosPorTexto,
} from '@/lib/telegram/comprasObraTelegram';
import {
  loadCatalogoProyectosApp,
  type ProyectoCatalogo,
} from '@/lib/proyectos/proyectosUnificados';
import { isValidProyectoUuid } from '@/lib/proyectos/validarProyectoUuid';

const DEPOSITO_GENERAL = 'Depósito Principal / General';
const PREFIX_STOCK = 'sk:';
const STOCK_LINES_PAGE = 22;
const MAX_MSG = 3800;

/** Vista del listado tras elegir obra en /stock. */
export type StockVistaModo = 'almacen' | 'obra' | 'proyecto';

const ETIQUETA_VISTA: Record<StockVistaModo, string> = {
  almacen: 'Almacén / bodega',
  obra: 'En obra (egresado)',
  proyecto: 'Proyecto (total)',
};

type MaterialMatch = {
  id: string;
  name: string;
};

type StockRow = {
  material_id: string;
  cantidad_disponible: number | null;
  ubicacion: {
    ci_proyecto_id: string | null;
    ci_proyectos: { nombre: string | null } | { nombre: string | null }[] | null;
  } | Array<{
    ci_proyecto_id: string | null;
    ci_proyectos: { nombre: string | null } | { nombre: string | null }[] | null;
  }> | null;
};

type LineaStockAgregada = {
  nombre: string;
  unidad: string;
  /** Suma en almacenes / depósito (no tipo obra). */
  enAlmacen: number;
  /** Ubicación tipo obra (material ya egresado a frente). */
  enObra: number;
  cantidad: number;
  /** Cantidad mostrada según vista activa. */
  cantidadVista?: number;
};

function normTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncar(s: string, max = 56): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function nombreObraDesdeUbicacion(ubicacion: StockRow['ubicacion']): string {
  const ub = Array.isArray(ubicacion) ? ubicacion[0] : ubicacion;
  if (!ub) return DEPOSITO_GENERAL;
  const p = ub.ci_proyectos;
  const raw = Array.isArray(p) ? p[0]?.nombre : p?.nombre;
  const n = (raw ?? '').trim();
  return n || DEPOSITO_GENERAL;
}

function consolidarPorObra(
  filas: StockRow[],
  nombresMaterial: Map<string, string>,
): Record<string, number> {
  const consolidado: Record<string, number> = {};

  for (const row of filas) {
    const obra = nombreObraDesdeUbicacion(row.ubicacion);
    const cant = Number(row.cantidad_disponible) || 0;
    if (cant <= 0) continue;
    consolidado[obra] = (consolidado[obra] ?? 0) + cant;
    if (row.material_id && !nombresMaterial.has(row.material_id)) {
      nombresMaterial.set(row.material_id, row.material_id);
    }
  }

  return consolidado;
}

function construirMensajeConsolidadoMaterial(
  argumento: string,
  consolidado: Record<string, number>,
): string {
  const entradas = Object.entries(consolidado)
    .filter(([, total]) => total > 0)
    .sort(([a], [b]) => a.localeCompare(b, 'es'));

  if (!entradas.length) {
    return (
      `🔍 No hay <b>existencias disponibles</b> de «${escapeHtml(argumento)}» en ningún frente.\n\n` +
      'Prueba por obra: <code>/stock rancho flamboyant</code>\n' +
      'O por material: <code>/stock cabilla</code>'
    );
  }

  const lineas: string[] = [];
  lineas.push(
    `📦 <b>Material «${escapeHtml(argumento.toUpperCase())}»</b> — totales por obra`,
  );
  lineas.push('');

  let granTotal = 0;
  for (const [obra, total] of entradas) {
    granTotal += total;
    lineas.push(
      `▪️ <b>${escapeHtml(obra)}:</b> ${total.toLocaleString('es-VE')} unidades`,
    );
  }

  lineas.push('');
  lineas.push(
    `✅ <b>Total general:</b> ${granTotal.toLocaleString('es-VE')} unidades`,
  );
  lineas.push('');
  lineas.push('<i>Búsqueda por nombre de material en catálogo.</i>');

  return lineas.join('\n');
}

function agregarStockPorMaterial(filas: StockProyectoItem[]): LineaStockAgregada[] {
  const map = new Map<string, LineaStockAgregada>();
  for (const f of filas) {
    const qty = Number(f.cantidad_disponible) || 0;
    if (qty <= 0) continue;
    const prev = map.get(f.material_id);
    const enObra = f.ubicacion_tipo === 'obra';
    const enAlmacenQty = !enObra && (esUbicacionAlmacenFisico(f.ubicacion_tipo) || !f.ubicacion_tipo);
    if (prev) {
      prev.cantidad += qty;
      if (enObra) prev.enObra += qty;
      else if (enAlmacenQty) prev.enAlmacen += qty;
    } else {
      map.set(f.material_id, {
        nombre: f.nombre.trim() || 'Material',
        unidad: f.unidad.trim() || 'UND',
        cantidad: qty,
        enAlmacen: enAlmacenQty ? qty : 0,
        enObra: enObra ? qty : 0,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

function cantidadPorVista(l: LineaStockAgregada, modo: StockVistaModo): number {
  if (modo === 'almacen') return l.enAlmacen;
  if (modo === 'obra') return l.enObra;
  return l.cantidad;
}

function filtrarLineasPorVista(
  lineas: LineaStockAgregada[],
  modo: StockVistaModo,
): LineaStockAgregada[] {
  return lineas
    .map((l) => ({ ...l, cantidadVista: cantidadPorVista(l, modo) }))
    .filter((l) => l.cantidadVista > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

function formatearLineaStock(
  l: LineaStockAgregada & { cantidadVista?: number },
  indice: number,
  modo: StockVistaModo,
): string {
  const u = escapeHtml(l.unidad);
  const qty = (l.cantidadVista ?? cantidadPorVista(l, modo)).toLocaleString('es-VE');
  if (modo === 'proyecto' && l.enAlmacen > 0 && l.enObra > 0) {
    return (
      `${indice}. ${escapeHtml(l.nombre)} — <b>${qty}</b> ${u}` +
      ` <i>(alm ${l.enAlmacen.toLocaleString('es-VE')} + obra ${l.enObra.toLocaleString('es-VE')})</i>`
    );
  }
  return `${indice}. ${escapeHtml(l.nombre)} — <b>${qty}</b> ${u}`;
}

function letraVista(modo: StockVistaModo): string {
  return modo === 'almacen' ? 'a' : modo === 'obra' ? 'o' : 't';
}

function vistaDesdeLetra(c: string): StockVistaModo | null {
  if (c === 'a') return 'almacen';
  if (c === 'o') return 'obra';
  if (c === 't') return 'proyecto';
  return null;
}

function callbackStockModoPicker(proyectoId: string): string {
  return `${PREFIX_STOCK}m:${proyectoId}`;
}

function callbackStockList(modo: StockVistaModo, proyectoId: string, page: number): string {
  return `${PREFIX_STOCK}${letraVista(modo)}:${proyectoId}:${page}`;
}

export function esCallbackStockObra(data: string): boolean {
  return data.startsWith(PREFIX_STOCK);
}

export type StockCallbackParsed =
  | { type: 'modo'; proyectoId: string }
  | { type: 'list'; proyectoId: string; modo: StockVistaModo; page: number };

export function parseCallbackStock(data: string): StockCallbackParsed | null {
  const m = data.match(/^sk:([amotp]):([0-9a-f-]{36})(?::(\d+))?$/i);
  if (!m) return null;
  const tag = m[1]!.toLowerCase();
  const proyectoId = m[2]!;
  if (!isValidProyectoUuid(proyectoId)) return null;

  if (tag === 'm') return { type: 'modo', proyectoId };

  if (tag === 'p') {
    const page = m[3] != null ? Math.floor(Number(m[3])) : 0;
    if (!Number.isFinite(page) || page < 0) return null;
    return { type: 'modo', proyectoId };
  }

  const modo = vistaDesdeLetra(tag);
  if (!modo) return null;
  const page = m[3] != null ? Math.floor(Number(m[3])) : 0;
  if (!Number.isFinite(page) || page < 0) return null;
  return { type: 'list', proyectoId, modo, page };
}

/** @deprecated Use parseCallbackStock */
export function parseCallbackStockObra(
  data: string,
): { proyectoId: string; page: number } | null {
  const p = parseCallbackStock(data);
  if (!p || p.type !== 'list') return null;
  return { proyectoId: p.proyectoId, page: p.page };
}

async function resolverProyectosPorTexto(
  supabase: SupabaseClient,
  busqueda: string,
): Promise<ProyectoCatalogo[]> {
  const q = busqueda.trim();
  if (!q) return [];

  if (isValidProyectoUuid(q)) {
    const { data } = await supabase
      .from('ci_proyectos')
      .select('id,nombre,entidad_id')
      .eq('id', q)
      .maybeSingle();
    if (data?.id) {
      return [
        {
          id: String(data.id),
          nombre: String(data.nombre ?? 'Obra').trim(),
          entidad_id: data.entidad_id ? String(data.entidad_id) : null,
        },
      ];
    }
  }

  const { proyectos, error } = await loadCatalogoProyectosApp(supabase);
  if (error) throw new Error(error);

  const exactas = proyectos.filter((p) => normTexto(p.nombre) === normTexto(q));
  return exactas.length ? exactas : buscarProyectosPorTexto(proyectos, q);
}

async function enviarPickerObraStock(
  chatId: string,
  coincidencias: ProyectoCatalogo[],
  busqueda: string,
): Promise<void> {
  const rows = coincidencias.slice(0, 8).map((p) => [
    {
      text: truncar(p.nombre),
      callback_data: callbackStockModoPicker(p.id),
    },
  ]);

  await sendTelegramMessage(
    chatId,
    `🔍 Varias obras coinciden con «<b>${escapeHtml(busqueda)}</b>».\nElige una para ver el stock:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } },
  );
}

function tecladoVistaStock(proyectoId: string, modoActivo?: StockVistaModo) {
  const btn = (modo: StockVistaModo, emoji: string, label: string) => ({
    text: modoActivo === modo ? `✓ ${emoji} ${label}` : `${emoji} ${label}`,
    callback_data: callbackStockList(modo, proyectoId, 0),
  });
  return [
    [btn('almacen', '🏭', 'Almacén'), btn('obra', '🏗', 'Obra')],
    [btn('proyecto', '📊', 'Proyecto')],
  ];
}

async function enviarPickerVistaStock(
  chatId: string,
  proyecto: ProyectoCatalogo,
): Promise<void> {
  await sendTelegramMessage(
    chatId,
    `📦 <b>${escapeHtml(proyecto.nombre)}</b>\n\n` +
      '¿Qué stock deseas consultar?\n\n' +
      '🏭 <b>Almacén</b> — bodega / depósito (disponible para salida)\n' +
      '🏗 <b>Obra</b> — ya egresado al frente\n' +
      '📊 <b>Proyecto</b> — suma almacén + obra',
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: tecladoVistaStock(proyecto.id) },
    },
  );
}

async function enviarListadoStockObra(
  supabase: SupabaseClient,
  chatId: string,
  proyecto: ProyectoCatalogo,
  modo: StockVistaModo,
  page = 0,
): Promise<void> {
  const filas = await getStockRealObra(supabase, proyecto.id, {
    soloConStock: true,
    proyectoNombre: proyecto.nombre,
  });
  const lineasAgregadas = agregarStockPorMaterial(filas);
  const lineasVista = filtrarLineasPorVista(lineasAgregadas, modo);
  const totalVista = lineasVista.reduce((a, l) => a + (l.cantidadVista ?? 0), 0);

  if (!lineasVista.length) {
    const vacio =
      modo === 'almacen'
        ? 'Sin existencias en almacén/bodega de esta obra.'
        : modo === 'obra'
          ? 'Sin material registrado «en obra» (aún no hay egresos a frente).'
          : 'Sin existencias en este proyecto.';
    await sendTelegramMessage(
      chatId,
      `📦 <b>Stock ${escapeHtml(ETIQUETA_VISTA[modo])}</b>\n` +
        `<b>${escapeHtml(proyecto.nombre)}</b>\n\n` +
        `<i>${vacio}</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: tecladoVistaStock(proyecto.id, modo) },
      },
    );
    return;
  }

  const totalPages = Math.max(1, Math.ceil(lineasVista.length / STOCK_LINES_PAGE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = lineasVista.slice(
    safePage * STOCK_LINES_PAGE,
    safePage * STOCK_LINES_PAGE + STOCK_LINES_PAGE,
  );

  const detalle = slice
    .map((l, i) => formatearLineaStock(l, safePage * STOCK_LINES_PAGE + i + 1, modo))
    .join('\n');

  let texto =
    `📦 <b>Stock ${escapeHtml(ETIQUETA_VISTA[modo])}</b>\n` +
    `<b>${escapeHtml(proyecto.nombre)}</b>\n` +
    `${lineasVista.length} material(es) · <b>${totalVista.toLocaleString('es-VE')}</b> uds\n\n` +
    detalle;

  if (texto.length > MAX_MSG) {
    texto = texto.slice(0, MAX_MSG - 20) + '\n…';
  }

  const keyboard: Array<Array<{ text: string; callback_data: string }>> = [
    ...tecladoVistaStock(proyecto.id, modo),
  ];
  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) {
      nav.push({
        text: '◀',
        callback_data: callbackStockList(modo, proyecto.id, safePage - 1),
      });
    }
    nav.push({
      text: `${safePage + 1}/${totalPages}`,
      callback_data: callbackStockList(modo, proyecto.id, safePage),
    });
    if (safePage < totalPages - 1) {
      nav.push({
        text: '▶',
        callback_data: callbackStockList(modo, proyecto.id, safePage + 1),
      });
    }
    keyboard.push(nav);
  }

  await sendTelegramMessage(chatId, texto, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard },
  });
}

async function buscarStockPorObra(
  supabase: SupabaseClient,
  chatId: string,
  argumento: string,
): Promise<boolean> {
  let coincidencias: ProyectoCatalogo[];
  try {
    coincidencias = await resolverProyectosPorTexto(supabase, argumento);
  } catch (e) {
    console.error('[telegram /stock] proyectos', e);
    return false;
  }

  if (!coincidencias.length) return false;

  await enviarMensajeTelegram(
    chatId,
    `🔍 Consultando stock de la obra «<b>${escapeHtml(argumento)}</b>»…`,
    { parse_mode: 'HTML' },
  );

  if (coincidencias.length === 1) {
    await enviarPickerVistaStock(chatId, coincidencias[0]!);
    return true;
  }

  await enviarPickerObraStock(chatId, coincidencias, argumento);
  return true;
}

async function buscarStockPorMaterial(
  supabase: SupabaseClient,
  chatId: string,
  argumento: string,
): Promise<void> {
  const pattern = patronIlike(argumento);
  if (!pattern) {
    await enviarMensajeTelegram(chatId, '⚠️ Término de búsqueda no válido.');
    return;
  }

  const { data: materiales, error: matErr } = await supabase
    .from('global_inventory')
    .select('id, name')
    .ilike('name', pattern)
    .order('name', { ascending: true })
    .limit(120);

  if (matErr) {
    console.error('[telegram /stock] materiales', matErr);
    await enviarMensajeTelegram(
      chatId,
      '❌ Hubo un error técnico al consultar el inventario en la base de datos.',
    );
    return;
  }

  const matches = (materiales ?? []) as MaterialMatch[];
  if (!matches.length) {
    await enviarMensajeTelegram(
      chatId,
      `📦 No se encontró obra ni material «<b>${escapeHtml(argumento)}</b>».\n\n` +
        'Ejemplos:\n' +
        '· Obra: <code>/stock rancho flamboyant</code>\n' +
        '· Material: <code>/stock cemento</code>\n' +
        '· Guiado: <code>/stock</code>',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const materialIds = matches.map((m) => String(m.id));
  const { data: stockRows, error: stockErr } = await supabase
    .from('inventario_stock')
    .select(
      `
      material_id,
      cantidad_disponible,
      ubicacion:inv_ubicaciones (
        ci_proyecto_id,
        ci_proyectos ( nombre )
      )
    `,
    )
    .in('material_id', materialIds)
    .gt('cantidad_disponible', 0)
    .limit(800);

  if (stockErr?.code === '42P01') {
    await enviarMensajeTelegram(
      chatId,
      '⚠️ Tabla inventario_stock no disponible. Aplique migraciones 180+ en Supabase.',
    );
    return;
  }

  if (stockErr) {
    console.error('[telegram /stock] stock', stockErr);
    await enviarMensajeTelegram(chatId, '❌ Error al leer stock físico por ubicación.');
    return;
  }

  const nombresMaterial = new Map(matches.map((m) => [String(m.id), m.name]));
  const consolidado = consolidarPorObra((stockRows ?? []) as StockRow[], nombresMaterial);
  const mensaje = construirMensajeConsolidadoMaterial(argumento, consolidado);
  await enviarMensajeTelegram(chatId, mensaje, { parse_mode: 'HTML' });
}

/**
 * /stock — sin argumento: flujo guiado (webhookRoute).
 * /stock &lt;obra&gt; — listado de materiales y cantidades en la obra.
 * /stock &lt;material&gt; — totales del material por frente de obra.
 */
export async function manejarComandoStockTelegram(opts: {
  supabase: SupabaseClient;
  chatId: string;
  keyword: string;
}): Promise<void> {
  const argumento = opts.keyword.trim();

  if (!argumento) {
    await enviarMensajeTelegram(
      opts.chatId,
      '⚠️ Indica la <b>obra</b> o el <b>material</b>:\n' +
        '· <code>/stock rancho flamboyant</code> → elige almacén, obra o total\n' +
        '· <code>/stock cemento</code>\n' +
        '· <code>/stock</code> (entidad → obra → almacén)',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const porObra = await buscarStockPorObra(opts.supabase, opts.chatId, argumento);
  if (porObra) return;

  await enviarMensajeTelegram(
    opts.chatId,
    `🔍 Buscando material «<b>${escapeHtml(argumento)}</b>» en catálogo…`,
    { parse_mode: 'HTML' },
  );
  await buscarStockPorMaterial(opts.supabase, opts.chatId, argumento);
}

export async function manejarCallbackStockObraTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  const parsed = parseCallbackStock(params.data);
  if (!parsed) return false;

  const { data, error } = await supabase
    .from('ci_proyectos')
    .select('id,nombre,entidad_id')
    .eq('id', parsed.proyectoId)
    .maybeSingle();

  if (error || !data?.id) {
    await answerCallbackQuery(params.callbackId, 'Obra no encontrada', true);
    return true;
  }

  const proyecto: ProyectoCatalogo = {
    id: String(data.id),
    nombre: String(data.nombre ?? 'Obra').trim(),
    entidad_id: data.entidad_id ? String(data.entidad_id) : null,
  };

  if (parsed.type === 'modo') {
    await answerCallbackQuery(params.callbackId, truncar(proyecto.nombre, 40));
    await enviarPickerVistaStock(params.chatId, proyecto);
    return true;
  }

  const etiqueta = ETIQUETA_VISTA[parsed.modo].slice(0, 30);
  await answerCallbackQuery(params.callbackId, etiqueta);
  await enviarListadoStockObra(
    supabase,
    params.chatId,
    proyecto,
    parsed.modo,
    parsed.page,
  );
  return true;
}

/** Extrae la palabra clave tras /stock (soporta /stock@BotName). */
export function extraerArgumentoStock(texto: string): string {
  const t = texto.trim();
  if (!t.toLowerCase().startsWith('/stock')) return '';
  return t.replace(/^\/stock(?:@\S+)?\s*/i, '').trim();
}
