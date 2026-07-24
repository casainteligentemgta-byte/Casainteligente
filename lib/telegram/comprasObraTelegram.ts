import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calcularTotalesComprasObra,
  formatearTotalesComprasObra,
} from '@/lib/contabilidad/resumenComprasObra';
import { calcularTotalesStockObra } from '@/lib/almacen/resumenStockObra';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import {
  loadCatalogoProyectosApp,
  type ProyectoCatalogo,
} from '@/lib/proyectos/proyectosUnificados';
import { isValidProyectoUuid } from '@/lib/proyectos/validarProyectoUuid';

const PREFIX_SEL = 'co:';

function normTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function truncar(s: string, max = 40): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function buscarProyectosPorTexto(
  proyectos: ProyectoCatalogo[],
  texto: string,
): ProyectoCatalogo[] {
  const q = normTexto(texto);
  if (!q) return [];
  return proyectos.filter((p) => normTexto(p.nombre).includes(q));
}

export function esCallbackComprasObra(data: string): boolean {
  return data.startsWith(PREFIX_SEL);
}

export function parseCallbackComprasObra(data: string): string | null {
  if (!data.startsWith(PREFIX_SEL)) return null;
  const id = data.slice(PREFIX_SEL.length);
  return isValidProyectoUuid(id) ? id : null;
}

async function enviarResumenComprasObra(
  supabase: SupabaseClient,
  chatId: string,
  proyecto: ProyectoCatalogo,
): Promise<void> {
  const [compras, stock] = await Promise.all([
    calcularTotalesComprasObra(supabase, proyecto.id),
    calcularTotalesStockObra(supabase, proyecto.id, proyecto.nombre),
  ]);

  const nFacturas = compras.facturasContabilidad + compras.facturasCanalExtra;
  const lineasUb = stock.ubicaciones
    .slice(0, 8)
    .map(
      (u) =>
        `▪️ <b>${escapeHtml(truncar(u.ubicacion_nombre, 32))}</b>: ${u.unidades.toLocaleString('es-VE')} u. (${u.materiales} mat.)`,
    )
    .join('\n');

  const masUb =
    stock.ubicaciones.length > 8
      ? `\n<i>… y ${stock.ubicaciones.length - 8} ubicación(es) más</i>`
      : '';

  const texto =
    `🛒 <b>Compras e inventario</b>\n` +
    `🏗 Obra: <b>${escapeHtml(proyecto.nombre)}</b>\n\n` +
    `💰 <b>Total gastado en compras</b>\n` +
    `${formatearTotalesComprasObra(compras)}\n` +
    `<i>${nFacturas} factura(s) · ${compras.facturasContabilidad} en contabilidad` +
    (compras.facturasCanalExtra
      ? ` · ${compras.facturasCanalExtra} Telegram pendiente(s)`
      : '') +
    `</i>\n\n` +
    `📦 <b>Stock en almacenes de la obra</b>\n` +
    `<b>${stock.totalUnidades.toLocaleString('es-VE')}</b> unidades · ` +
    `${stock.materialesDistintos} material(es) · ` +
    `${stock.ubicaciones.length} ubicación(es)\n` +
    (lineasUb || '<i>Sin stock disponible en ubicaciones de esta obra.</i>') +
    masUb +
    `\n\n<i>Periodo: /comprasdia · /comprassemana · /comprasmes</i>`;

  await sendTelegramMessage(chatId, texto, { parse_mode: 'HTML' });
}

async function enviarPickerObra(
  chatId: string,
  coincidencias: ProyectoCatalogo[],
  busqueda: string,
): Promise<void> {
  const rows = coincidencias.slice(0, 8).map((p) => [
    {
      text: truncar(p.nombre, 56),
      callback_data: `${PREFIX_SEL}${p.id}`,
    },
  ]);

  await sendTelegramMessage(
    chatId,
    `🔍 Varias obras coinciden con «<b>${escapeHtml(busqueda)}</b>».\nElige una:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } },
  );
}

export async function manejarComandoComprasObraTelegram(
  supabase: SupabaseClient,
  chatId: string,
  textoObra: string,
): Promise<void> {
  const busqueda = textoObra.trim();
  if (!busqueda) {
    await sendTelegramMessage(
      chatId,
      '🛒 <b>Compras por obra</b>\n\n' +
        'Escriba el nombre de la obra después del comando:\n' +
        '<code>/compras Flamboyant</code>\n' +
        '<code>/compras Video de frente</code>',
      { parse_mode: 'HTML' },
    );
    return;
  }

  if (isValidProyectoUuid(busqueda)) {
    const { data } = await supabase
      .from('ci_proyectos')
      .select('id,nombre,entidad_id')
      .eq('id', busqueda)
      .maybeSingle();
    if (data?.id) {
      await enviarResumenComprasObra(supabase, chatId, {
        id: String(data.id),
        nombre: String(data.nombre ?? 'Obra').trim(),
        entidad_id: data.entidad_id ? String(data.entidad_id) : null,
      });
      return;
    }
  }

  const { proyectos, error } = await loadCatalogoProyectosApp(supabase);
  if (error) throw new Error(error);

  const exactas = proyectos.filter((p) => normTexto(p.nombre) === normTexto(busqueda));
  const coincidencias = exactas.length ? exactas : buscarProyectosPorTexto(proyectos, busqueda);

  if (!coincidencias.length) {
    await sendTelegramMessage(
      chatId,
      `❌ No encontré ninguna obra con «<b>${escapeHtml(busqueda)}</b>».\n` +
        'Prueba con otra palabra o usa <code>/proyecto</code> para ver la lista.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  if (coincidencias.length === 1) {
    await enviarResumenComprasObra(supabase, chatId, coincidencias[0]!);
    return;
  }

  await enviarPickerObra(chatId, coincidencias, busqueda);
}

export async function manejarCallbackComprasObraTelegram(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  const proyectoId = parseCallbackComprasObra(params.data);
  if (!proyectoId) return false;

  const { data, error } = await supabase
    .from('ci_proyectos')
    .select('id,nombre,entidad_id')
    .eq('id', proyectoId)
    .maybeSingle();

  if (error || !data?.id) {
    await answerCallbackQuery(params.callbackId, 'Obra no encontrada');
    await sendTelegramMessage(params.chatId, '❌ Obra no encontrada.');
    return true;
  }

  await answerCallbackQuery(params.callbackId, String(data.nombre ?? 'Obra'));
  await enviarResumenComprasObra(supabase, params.chatId, {
    id: String(data.id),
    nombre: String(data.nombre ?? 'Obra').trim(),
    entidad_id: data.entidad_id ? String(data.entidad_id) : null,
  });
  return true;
}
