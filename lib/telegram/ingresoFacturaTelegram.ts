import type { SupabaseClient } from '@supabase/supabase-js';
import {
  listarFacturasPendientesIngreso,
  type FacturaPendienteIngreso,
} from '@/lib/almacen/listarFacturasPendientesIngreso';
import { PROCUREMENT_DOCUMENTS_BUCKET } from '@/lib/almacen/procurementDocumentStorage';
import { linkConfirmarCompraTelegram } from '@/lib/contabilidad/confirmarCompraDesdeCanal';
import type { ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';
import { ingresoAlmacenDesdePendienteCanal } from '@/lib/contabilidad/ingresoAlmacenDesdePendienteCanal';
import { resolverMaterialIdLineasCompra } from '@/lib/almacen/resolverMaterialIdPorSku';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import type { TelegramEstado } from '@/lib/telegram/estados';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';

export const FLUJO_INGRESO_FACTURA = 'ingreso_factura';

const PREFIX = 'ifp:';
const PREFIX_PROV = `${PREFIX}pr:`;
const PREFIX_FACT = `${PREFIX}fc:`;
const PREFIX_PAGE_PROV = `${PREFIX}pp:`;
const PREFIX_PAGE_FACT = `${PREFIX}fp:`;
const PAGE_SIZE = 8;

const MENSAJE_PASOS_INGRESO_FISICO =
  '1️⃣ Elige la <b>Obra</b>.\n' +
  '2️⃣ Elige el <b>almacén</b>.\n' +
  '3️⃣ Escribe el <b>proveedor</b> y <b>número de factura</b>.\n' +
  '4️⃣ <b>Nº o referencia</b> de factura o nota (<code>S/N</code> si no hay).\n' +
  '5️⃣ <b>Material</b> (catálogo o nuevo), <b>cantidad</b>, <b>foto</b>.\n' +
  '6️⃣ <b>Observaciones</b> (opcional).\n' +
  '7️⃣ <b>Confirmar</b> ingreso.\n\n' +
  '<code>/cancelar</code> para abortar.';

export type PasoIngresoFactura =
  | 'proveedor'
  | 'factura'
  | 'preview'
  | 'cantidad'
  | 'foto'
  | 'confirmar';

export type LineaIngresoFacturaVerificacion = {
  linea_id: string;
  material_id: string;
  material_nombre: string;
  material_codigo: string;
  cantidad_facturada: number;
  cantidad_real?: number;
};

export type MetadataIngresoFactura = {
  flujo?: string;
  paso?: PasoIngresoFactura;
  proveedor_key?: string;
  proveedor_nombre?: string;
  factura_key?: string;
  pendiente_id?: string;
  purchase_invoice_id?: string | null;
  invoice_number?: string | null;
  origen_label?: string;
  items?: LineaIngresoFacturaVerificacion[];
  indice_cantidad?: number;
  fotos_storage_paths?: string[];
  telegram_user_id?: string;
};

function truncar(s: string, max = 52): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function proveedorKey(name: string | null | undefined): string {
  const k = String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
  return k || 'SINPROVEEDOR';
}

function meta(estado: TelegramEstado): MetadataIngresoFactura {
  return (estado.metadata ?? {}) as MetadataIngresoFactura;
}

export function esFlujoIngresoFactura(estado: TelegramEstado): boolean {
  return meta(estado).flujo === FLUJO_INGRESO_FACTURA && estado.contexto === 'entrada_obra';
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
  patch: Partial<MetadataIngresoFactura>,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    metadata: { ...meta(estado), ...patch },
  });
}

function facturasIngresoAlmacen(facturas: FacturaPendienteIngreso[]): FacturaPendienteIngreso[] {
  return facturas.filter((f) => f.accion === 'ingreso_almacen');
}

function agruparProveedores(facturas: FacturaPendienteIngreso[]): Array<{
  key: string;
  nombre: string;
  count: number;
}> {
  const map = new Map<string, { nombre: string; count: number }>();
  for (const f of facturas) {
    const key = proveedorKey(f.supplier_name);
    const nombre = f.supplier_name?.trim() || 'Proveedor';
    const prev = map.get(key);
    if (prev) prev.count += 1;
    else map.set(key, { nombre, count: 1 });
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, nombre: v.nombre, count: v.count }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function esCallbackIngresoFactura(data: string): boolean {
  return data.startsWith(PREFIX);
}

export function parseCallbackIngresoFactura(data: string):
  | { type: 'prov'; key: string }
  | { type: 'fact'; key: string }
  | { type: 'page_prov'; page: number }
  | { type: 'page_fact'; page: number }
  | { type: 'foto_skip' }
  | { type: 'foto_done' }
  | { type: 'conf_ok' }
  | { type: 'volver_prov' }
  | null {
  if (data === `${PREFIX}foto:skip`) return { type: 'foto_skip' };
  if (data === `${PREFIX}foto:done`) return { type: 'foto_done' };
  if (data === `${PREFIX}conf:ok`) return { type: 'conf_ok' };
  if (data === `${PREFIX}back:prov`) return { type: 'volver_prov' };
  if (data.startsWith(PREFIX_PROV)) {
    const key = data.slice(PREFIX_PROV.length);
    return key ? { type: 'prov', key } : null;
  }
  if (data.startsWith(PREFIX_FACT)) {
    const key = data.slice(PREFIX_FACT.length);
    return key ? { type: 'fact', key } : null;
  }
  if (data.startsWith(PREFIX_PAGE_PROV)) {
    const page = Number(data.slice(PREFIX_PAGE_PROV.length));
    if (!Number.isFinite(page) || page < 0) return null;
    return { type: 'page_prov', page: Math.floor(page) };
  }
  if (data.startsWith(PREFIX_PAGE_FACT)) {
    const page = Number(data.slice(PREFIX_PAGE_FACT.length));
    if (!Number.isFinite(page) || page < 0) return null;
    return { type: 'page_fact', page: Math.floor(page) };
  }
  return null;
}

async function cargarLineasFacturaPendiente(
  supabase: SupabaseClient,
  hit: FacturaPendienteIngreso,
): Promise<LineaIngresoFacturaVerificacion[]> {
  const pi = hit.purchase_invoice_id?.trim();
  if (pi) {
    const { data: cf } = await supabase
      .from('compras_facturas')
      .select('id')
      .eq('purchase_invoice_id', pi)
      .maybeSingle();

    if (cf?.id) {
      const { data: lineas, error } = await supabase.rpc('obtener_lineas_para_depositario', {
        p_factura_id: String(cf.id),
      });
      if (!error && lineas?.length) {
        return (
          lineas as Array<{
            linea_id: string;
            material_id: string;
            material_nombre: string;
            material_codigo: string;
            cantidad_facturada: number;
          }>
        ).map((row) => ({
          linea_id: String(row.linea_id),
          material_id: String(row.material_id),
          material_nombre: String(row.material_nombre ?? 'Material'),
          material_codigo: String(row.material_codigo ?? ''),
          cantidad_facturada: Number(row.cantidad_facturada) || 0,
        }));
      }
    }
  }

  const { data: pendiente } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('id, proyecto_id, extracted')
    .eq('id', hit.pendienteId)
    .maybeSingle();

  const extracted = (pendiente?.extracted ?? null) as ExtractedCanalHeader | null;
  const items = extracted?.items ?? [];
  if (!items.length) return [];

  const { data: compra } = pi
    ? await supabase
        .from('contabilidad_compras')
        .select('id')
        .eq('purchase_invoice_id', pi)
        .maybeSingle()
    : { data: null };

  const lineasExtracted = items
    .filter((it) => String(it.description ?? '').trim())
    .map((it) => ({
      descripcion: String(it.description ?? '').trim(),
      item_code: String(it.item_code ?? '').trim() || null,
      unidad: String(it.unit ?? 'UND').trim() || 'UND',
      cantidad: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
      precio_unitario: Number(it.unit_price) >= 0 ? Number(it.unit_price) : 0,
    }));

  if (!compra?.id) {
    return lineasExtracted.map((l, i) => ({
      linea_id: `ext:${i}`,
      material_id: '',
      material_nombre: l.descripcion,
      material_codigo: l.item_code ?? '',
      cantidad_facturada: l.cantidad,
    }));
  }

  const resuelto = await resolverMaterialIdLineasCompra(supabase, String(compra.id), {
    proyectoIdFallback: String(pendiente?.proyecto_id ?? '').trim() || null,
    purchaseInvoiceId: pi ?? null,
    lineasExtracted,
  });

  return resuelto.lineas.map((l, i) => ({
    linea_id: `res:${i}`,
    material_id: String(l.material_id ?? ''),
    material_nombre: l.descripcion?.trim() || 'Material',
    material_codigo: '',
    cantidad_facturada: Number(l.cantidad) || 0,
  }));
}

function buildKeyboardProveedores(
  proveedores: Array<{ key: string; nombre: string; count: number }>,
  page: number,
) {
  const totalPages = Math.max(1, Math.ceil(proveedores.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = proveedores.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((p) => [
    {
      text: truncar(`🏢 ${p.nombre} (${p.count})`),
      callback_data: `${PREFIX_PROV}${p.key}`,
    },
  ]);
  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX_PAGE_PROV}${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX_PAGE_PROV}${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX_PAGE_PROV}${safePage + 1}` });
    buttons.push(nav);
  }
  return { inline_keyboard: buttons };
}

export function callbackFacturaPrecargada(key: string): string {
  return `${PREFIX_FACT}${key}`;
}

export function etiquetaFacturaBoton(f: FacturaPendienteIngreso): string {
  const prov = truncar(f.supplier_name?.trim() || 'Proveedor', 18);
  const icon = f.accion === 'ingreso_almacen' ? '📥' : '⏳';
  const accion = f.accion === 'ingreso_almacen' ? 'ingreso' : 'confirmar';
  return truncar(`${icon} #${f.invoice_number ?? 'S/N'} · ${prov} · ${accion}`, 58);
}

/** Selecciona una factura precargada (menú /ingreso o flujo depositario). */
export async function seleccionarFacturaPrecargadaTelegram(
  supabase: SupabaseClient,
  chatId: string,
  key: string,
): Promise<'ok' | 'confirmar' | 'not_found'> {
  const todas = await listarFacturasPendientesIngreso(supabase);
  const hit = todas.find((f) => f.key === key);
  if (!hit) return 'not_found';

  if (hit.accion === 'confirmar') {
    const link = linkConfirmarCompraTelegram(hit.pendienteId);
    await sendTelegramMessage(
      chatId,
      `⏳ <b>Confirmar compra primero</b>\n` +
        `${hit.supplier_name ?? 'Proveedor'} · #${hit.invoice_number ?? 'S/N'}\n` +
        `${hit.origenLabel}\n\n` +
        'Esta factura está en tránsito: debe registrarse la compra en contabilidad y quedar ' +
        'lista para ingreso a almacén.\n\n' +
        `<a href="${link}">Abrir y confirmar en la app</a>\n\n` +
        'Luego vuelva a usar <code>/ingreso</code> — aparecerá como 📥 ingreso.',
      { parse_mode: 'HTML' },
    );
    return 'confirmar';
  }

  await iniciarVerificacionFactura(supabase, chatId, hit);
  return 'ok';
}

function buildKeyboardFacturas(facturas: FacturaPendienteIngreso[], page: number) {
  const totalPages = Math.max(1, Math.ceil(facturas.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = facturas.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((f) => [
    {
      text: etiquetaFacturaBoton(f),
      callback_data: `${PREFIX_FACT}${f.key}`,
    },
  ]);
  buttons.push([{ text: '◀ Proveedores', callback_data: `${PREFIX}back:prov` }]);
  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX_PAGE_FACT}${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX_PAGE_FACT}${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX_PAGE_FACT}${safePage + 1}` });
    buttons.push(nav);
  }
  return { inline_keyboard: buttons };
}

async function enviarListaProveedores(
  supabase: SupabaseClient,
  chatId: string,
  page = 0,
): Promise<void> {
  const todas = await listarFacturasPendientesIngreso(supabase);

  if (!todas.length) {
    await setTelegramContexto(supabase, chatId, { contexto: 'menu', metadata: {} });
    await sendTelegramMessage(
      chatId,
      '✅ No hay facturas precargadas pendientes (ni ingreso ni confirmación de compra).',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const proveedores = agruparProveedores(todas);
  const nConfirmar = todas.filter((f) => f.accion === 'confirmar').length;
  await setTelegramContexto(supabase, chatId, {
    contexto: 'entrada_obra',
    metadata: { flujo: FLUJO_INGRESO_FACTURA, paso: 'proveedor' },
  });

  const notaConfirmar =
    nConfirmar > 0
      ? `\n⏳ <b>${nConfirmar}</b> factura(s) requieren <b>confirmar compra</b> en la app antes del ingreso.\n` +
        '📥 Las marcadas como <b>ingreso</b> siguen el flujo completo aquí.\n'
      : '';

  await sendTelegramMessage(
    chatId,
    '📥 <b>INGRESO FÍSICO — DEPOSITARIO</b>\n\n' + MENSAJE_PASOS_INGRESO_FISICO + notaConfirmar,
    { parse_mode: 'HTML', reply_markup: buildKeyboardProveedores(proveedores, page) },
  );
}

async function enviarListaFacturasProveedor(
  supabase: SupabaseClient,
  chatId: string,
  provKey: string,
  page = 0,
): Promise<void> {
  const todas = await listarFacturasPendientesIngreso(supabase);
  const facturas = todas.filter((f) => proveedorKey(f.supplier_name) === provKey);

  if (!facturas.length) {
    await enviarListaProveedores(supabase, chatId);
    return;
  }

  const nombre = facturas[0]?.supplier_name ?? 'Proveedor';
  const estado = await getTelegramEstado(supabase, chatId);
  await patchMeta(supabase, chatId, estado, {
    paso: 'factura',
    proveedor_key: provKey,
    proveedor_nombre: nombre,
  });

  await sendTelegramMessage(
    chatId,
    `🏢 <b>${escHtml(nombre)}</b>\n\nElige la factura a ingresar:`,
    { parse_mode: 'HTML', reply_markup: buildKeyboardFacturas(facturas, page) },
  );
}

function resumenLineasPreview(items: LineaIngresoFacturaVerificacion[]): string {
  return items
    .map(
      (it, i) =>
        `${i + 1}. <b>${escHtml(it.material_nombre)}</b>` +
        (it.material_codigo ? ` (<code>${escHtml(it.material_codigo)}</code>)` : '') +
        ` · <b>${it.cantidad_facturada}</b>`,
    )
    .join('\n');
}

async function mensajeItemCantidad(
  chatId: string,
  item: LineaIngresoFacturaVerificacion,
  indice: number,
  total: number,
): Promise<void> {
  const codigo = item.material_codigo
    ? `\nCódigo: <code>${escHtml(item.material_codigo)}</code>`
    : '';
  await sendTelegramMessage(
    chatId,
    `📦 <b>Ítem ${indice + 1} de ${total}</b>\n\n` +
      `🔹 <b>${escHtml(item.material_nombre)}</b>${codigo}\n` +
      `📋 Cantidad facturada: <b>${item.cantidad_facturada}</b>\n\n` +
      `✍️ Escribe la <b>cantidad física recibida</b>:`,
    { parse_mode: 'HTML' },
  );
}

async function preguntarFotos(supabase: SupabaseClient, chatId: string): Promise<void> {
  const estado = await getTelegramEstado(supabase, chatId);
  await patchMeta(supabase, chatId, estado, { paso: 'foto' });
  await sendTelegramMessage(
    chatId,
    '📷 <b>Soporte fotográfico</b>\n\n' +
      'Envía una o varias fotos del material o comprobante.\n' +
      'Cuando termines, pulsa <b>Listo con fotos</b> o <b>Omitir fotos</b>.',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Listo con fotos', callback_data: `${PREFIX}foto:done` },
            { text: '⏭ Omitir fotos', callback_data: `${PREFIX}foto:skip` },
          ],
        ],
      },
    },
  );
}

async function enviarResumenConfirmacion(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const m = meta(estado);
  const items = m.items ?? [];
  let texto =
    '📋 <b>Resumen antes de ingresar a almacén</b>\n\n' +
    `🏢 ${escHtml(m.proveedor_nombre ?? 'Proveedor')}\n` +
    `📄 #${escHtml(m.invoice_number ?? 'S/N')}\n` +
    (m.origen_label ? `${m.origen_label}\n\n` : '\n');

  for (const item of items) {
    const ok = item.cantidad_facturada === item.cantidad_real;
    const icono = ok ? '✅' : '⚠️';
    texto +=
      `${icono} <b>${escHtml(item.material_nombre)}</b>\n` +
      `   Facturado: ${item.cantidad_facturada} · Recibido: ${item.cantidad_real ?? '—'}\n`;
  }

  const nFotos = m.fotos_storage_paths?.length ?? 0;
  if (nFotos > 0) texto += `\n📷 ${nFotos} foto(s) de soporte`;

  await patchMeta(supabase, chatId, estado, { paso: 'confirmar' });
  await sendTelegramMessage(chatId, texto, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{ text: '🚀 Registrar ingreso a almacén', callback_data: `${PREFIX}conf:ok` }]],
    },
  });
}

async function iniciarVerificacionFactura(
  supabase: SupabaseClient,
  chatId: string,
  hit: FacturaPendienteIngreso,
): Promise<boolean> {
  const lineas = await cargarLineasFacturaPendiente(supabase, hit);
  if (!lineas.length) {
    await sendTelegramMessage(
      chatId,
      '❌ Esta factura no tiene productos para verificar. Revísala en la app.',
      { parse_mode: 'HTML' },
    );
    return false;
  }

  const sinMaterial = lineas.filter((l) => !l.material_id?.trim());
  if (sinMaterial.length === lineas.length) {
    await sendTelegramMessage(
      chatId,
      '❌ No se pudieron vincular los materiales. Confirma la compra en la app e intenta de nuevo.',
      { parse_mode: 'HTML' },
    );
    return false;
  }

  await setTelegramContexto(supabase, chatId, {
    contexto: 'entrada_obra',
    pending_factura_id: hit.pendienteId,
    metadata: {
      flujo: FLUJO_INGRESO_FACTURA,
      paso: 'preview',
      proveedor_nombre: hit.supplier_name,
      factura_key: hit.key,
      pendiente_id: hit.pendienteId,
      purchase_invoice_id: hit.purchase_invoice_id,
      invoice_number: hit.invoice_number,
      origen_label: hit.origenLabel,
      items: lineas,
      indice_cantidad: 0,
      fotos_storage_paths: [],
    },
  });

  await sendTelegramMessage(
    chatId,
    `📄 <b>Factura #${escHtml(hit.invoice_number ?? 'S/N')}</b>\n` +
      `${hit.origenLabel}\n\n` +
      '<b>Productos y cantidades facturadas:</b>\n' +
      resumenLineasPreview(lineas) +
      '\n\n<i>A continuación verificarás la cantidad física de cada ítem.</i>',
    { parse_mode: 'HTML' },
  );

  await patchMeta(supabase, chatId, await getTelegramEstado(supabase, chatId), {
    paso: 'cantidad',
    indice_cantidad: 0,
  });
  await mensajeItemCantidad(chatId, lineas[0]!, 0, lineas.length);
  return true;
}

export async function manejarComandoIngresoFacturaTelegram(
  supabase: SupabaseClient,
  chatId: string,
  _page = 0,
): Promise<void> {
  await enviarListaProveedores(supabase, chatId, _page);
}

export async function manejarCallbackIngresoFacturaTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  const parsed = parseCallbackIngresoFactura(params.data);
  if (!parsed) return false;

  if (parsed.type === 'page_prov') {
    await answerCallbackQuery(params.callbackId);
    await enviarListaProveedores(supabase, params.chatId, parsed.page);
    return true;
  }

  if (parsed.type === 'volver_prov') {
    await answerCallbackQuery(params.callbackId);
    await enviarListaProveedores(supabase, params.chatId);
    return true;
  }

  if (parsed.type === 'page_fact') {
    await answerCallbackQuery(params.callbackId);
    const estado = await getTelegramEstado(supabase, params.chatId);
    const provKey = meta(estado).proveedor_key;
    if (!provKey) {
      await enviarListaProveedores(supabase, params.chatId);
      return true;
    }
    await enviarListaFacturasProveedor(supabase, params.chatId, provKey, parsed.page);
    return true;
  }

  if (parsed.type === 'prov') {
    await answerCallbackQuery(params.callbackId);
    await enviarListaFacturasProveedor(supabase, params.chatId, parsed.key);
    return true;
  }

  if (parsed.type === 'fact') {
    const todas = await listarFacturasPendientesIngreso(supabase);
    const hit = todas.find((f) => f.key === parsed.key);
    if (!hit) {
      await answerCallbackQuery(params.callbackId, 'Factura no encontrada', true);
      return true;
    }
    if (hit.accion === 'confirmar') {
      await answerCallbackQuery(params.callbackId);
    } else {
      await answerCallbackQuery(params.callbackId, 'Cargando productos…');
    }
    const resultado = await seleccionarFacturaPrecargadaTelegram(supabase, params.chatId, parsed.key);
    if (resultado === 'not_found') {
      await sendTelegramMessage(params.chatId, '⚠️ Factura no encontrada o ya ingresada.', {
        parse_mode: 'HTML',
      });
    }
    return true;
  }

  const estado = await getTelegramEstado(supabase, params.chatId);
  if (!esFlujoIngresoFactura(estado)) {
    await answerCallbackQuery(params.callbackId);
    return true;
  }

  if (parsed.type === 'foto_skip' || parsed.type === 'foto_done') {
    await answerCallbackQuery(params.callbackId);
    await enviarResumenConfirmacion(supabase, params.chatId, estado);
    return true;
  }

  if (parsed.type === 'conf_ok') {
    await answerCallbackQuery(params.callbackId, 'Procesando ingreso…');
    const m = meta(estado);
    const items = m.items ?? [];
    const pendienteId = m.pendiente_id?.trim();
    if (!pendienteId) {
      await sendTelegramMessage(params.chatId, '❌ Sesión incompleta. Reinicia con /ingresofactura.', {
        parse_mode: 'HTML',
      });
      return true;
    }

    const incompletos = items.some(
      (i) => i.cantidad_real == null || !Number.isFinite(i.cantidad_real),
    );
    if (incompletos) {
      await sendTelegramMessage(
        params.chatId,
        '⚠️ Faltan cantidades por registrar.',
        { parse_mode: 'HTML' },
      );
      return true;
    }

    const cantidadesRecibidas = items
      .filter((i) => i.material_id?.trim() && (i.cantidad_real ?? 0) > 0)
      .map((i) => ({
        material_id: i.material_id.trim(),
        cantidad: i.cantidad_real!,
      }));

    const resultado = await ingresoAlmacenDesdePendienteCanal(supabase, pendienteId, {
      purchaseInvoiceId: m.purchase_invoice_id ?? undefined,
      cantidadesRecibidas,
      documentoStoragePath: m.fotos_storage_paths?.[0] ?? null,
    });

    await setTelegramContexto(supabase, params.chatId, {
      contexto: 'menu',
      pending_factura_id: null,
      metadata: {},
    });

    if (!resultado.success) {
      const link = linkConfirmarCompraTelegram(pendienteId);
      await sendTelegramMessage(
        params.chatId,
        `❌ <b>No se pudo ingresar</b>\n` +
          `${m.proveedor_nombre ?? 'Proveedor'} · #${m.invoice_number ?? 'S/N'}\n` +
          `${resultado.error ?? 'Error desconocido'}\n\n` +
          `<a href="${link}">Revisar en la app</a>`,
        { parse_mode: 'HTML' },
      );
      return true;
    }

    const linkMov = `${baseUrlApp()}/almacen/movimientos?vista=ingresos`;
    const avisos =
      resultado.avisos?.length ?
        `\n\n⚠️ <b>Aviso</b>\n${resultado.avisos.map((a) => `• ${a}`).join('\n')}`
      : '';
    const huboDiff = items.some((i) => i.cantidad_facturada !== i.cantidad_real);
    await sendTelegramMessage(
      params.chatId,
      `✅ <b>Ingreso a almacén registrado</b>\n\n` +
        `${m.proveedor_nombre ?? 'Proveedor'} · #${m.invoice_number ?? 'S/N'}\n` +
        (resultado.yaExistia ? '\n<i>El stock ya estaba registrado.</i>\n' : '') +
        (huboDiff ? '\n⚠️ Hubo diferencias entre facturado y recibido.\n' : '') +
        avisos +
        `\n<a href="${linkMov}">Ver movimientos</a>`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  return false;
}

export async function manejarTextoIngresoFactura(
  supabase: SupabaseClient,
  chatId: string,
  texto: string,
): Promise<boolean> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esFlujoIngresoFactura(estado)) return false;

  const m = meta(estado);
  if (m.paso !== 'cantidad') return false;

  const items = m.items ?? [];
  const idx = m.indice_cantidad ?? 0;
  if (!items.length || idx >= items.length) return false;

  const cantidad = parseFloat(texto.replace(',', '.'));
  if (!Number.isFinite(cantidad) || cantidad < 0) {
    await sendTelegramMessage(
      chatId,
      '⚠️ Cantidad inválida. Escribe un número ≥ 0 (ej. <code>12</code> o <code>12.5</code>).',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  items[idx]!.cantidad_real = cantidad;

  if (idx + 1 < items.length) {
    await patchMeta(supabase, chatId, estado, {
      items,
      indice_cantidad: idx + 1,
    });
    await mensajeItemCantidad(chatId, items[idx + 1]!, idx + 1, items.length);
    return true;
  }

  await patchMeta(supabase, chatId, estado, { items, indice_cantidad: idx + 1 });
  await preguntarFotos(supabase, chatId);
  return true;
}

export async function manejarFotoIngresoFactura(params: {
  supabase: SupabaseClient;
  chatId: string;
  userId: string;
  buffer: Buffer;
  mimeType: string;
  ext: string;
}): Promise<boolean> {
  const estado = await getTelegramEstado(params.supabase, params.chatId);
  if (!esFlujoIngresoFactura(estado)) return false;
  if (meta(estado).paso !== 'foto') return false;

  const storagePath = `recepciones-campo/telegram-factura-${params.chatId}/${Date.now()}.${params.ext}`;
  const { error } = await params.supabase.storage
    .from(PROCUREMENT_DOCUMENTS_BUCKET)
    .upload(storagePath, params.buffer, { contentType: params.mimeType, upsert: false });

  if (error) {
    await sendTelegramMessage(params.chatId, '❌ No se pudo guardar la foto.', { parse_mode: 'HTML' });
    return true;
  }

  const fotos = [...(meta(estado).fotos_storage_paths ?? []), storagePath];
  await patchMeta(params.supabase, params.chatId, estado, {
    fotos_storage_paths: fotos,
    telegram_user_id: params.userId,
  });

  await sendTelegramMessage(
    params.chatId,
    `✅ Foto ${fotos.length} guardada.\n\nPuedes enviar más fotos o pulsar <b>Listo con fotos</b>.`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Listo con fotos', callback_data: `${PREFIX}foto:done` },
            { text: '⏭ Omitir fotos', callback_data: `${PREFIX}foto:skip` },
          ],
        ],
      },
    },
  );
  return true;
}

/** @deprecated Usar manejarComandoIngresoFacturaTelegram */
export const manejarComandoEntradaComprasTelegram = manejarComandoIngresoFacturaTelegram;

/** @deprecated Usar manejarCallbackIngresoFacturaTelegram */
export async function manejarCallbackEntradaCompraTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  return manejarCallbackIngresoFacturaTelegram(supabase, params);
}

export function esCallbackEntradaCompra(data: string): boolean {
  return esCallbackIngresoFactura(data);
}

export function esComandoIngresoFactura(texto: string): boolean {
  const t = texto.trim().toLowerCase().split(/\s+/)[0]?.split('@')[0] ?? '';
  return t === '/ingresofactura' || t === '/ingresofacturas';
}
