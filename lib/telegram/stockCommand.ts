import type { SupabaseClient } from '@supabase/supabase-js';
import { patronIlike } from '@/lib/contabilidad/comprasQueryFiltros';
import { enviarMensajeTelegram } from '@/lib/telegram/botApi';

const DEPOSITO_GENERAL = 'Depósito Principal / General';

type FilaInventario = {
  name: string;
  stock_available: number | null;
  proyecto_id: string | null;
  ci_proyectos: { nombre: string | null } | { nombre: string | null }[] | null;
};

function nombreObra(row: FilaInventario): string {
  const p = row.ci_proyectos;
  if (!p) return DEPOSITO_GENERAL;
  const raw = Array.isArray(p) ? p[0]?.nombre : p.nombre;
  const n = (raw ?? '').trim();
  return n || DEPOSITO_GENERAL;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Suma stock_available por frente de obra. */
function consolidarPorObra(filas: FilaInventario[]): Record<string, number> {
  const consolidado: Record<string, number> = {};

  for (const row of filas) {
    const obra = nombreObra(row);
    const cant = Number(row.stock_available) || 0;
    consolidado[obra] = (consolidado[obra] ?? 0) + cant;
  }

  return consolidado;
}

function construirMensajeConsolidado(
  argumento: string,
  consolidado: Record<string, number>,
): string {
  const entradas = Object.entries(consolidado)
    .filter(([, total]) => total > 0)
    .sort(([a], [b]) => a.localeCompare(b, 'es'));

  if (!entradas.length) {
    return (
      `🔍 No hay <b>existencias disponibles</b> de «${escapeHtml(argumento)}» en ningún frente.\n\n` +
      'Prueba otro término: <code>/stock cabilla</code>'
    );
  }

  const lineas: string[] = [];
  lineas.push(
    `📦 <b>Inventario disponible para: «${escapeHtml(argumento.toUpperCase())}»</b>`,
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
  lineas.push(
    '<i>Consulta generada en tiempo real desde el ERP Casa Inteligente.</i>',
  );

  return lineas.join('\n');
}

/**
 * Consulta express de inventario: /stock &lt;material&gt;
 * 1. Búsqueda difusa: global_inventory.name ilike %término%
 * 2. Join: ci_proyectos(nombre) vía proyecto_id
 * 3. Consolidado en memoria por nombre de obra (suma stock_available)
 * 4. Respuesta formateada a Telegram
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
      '⚠️ Por favor, indica el material que deseas buscar.\n' +
        'Ejemplo: <code>/stock cemento</code> o <code>/stock cabilla</code>',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const pattern = patronIlike(argumento);
  if (!pattern) {
    await enviarMensajeTelegram(opts.chatId, '⚠️ Término de búsqueda no válido.');
    return;
  }

  await enviarMensajeTelegram(
    opts.chatId,
    `🔍 Buscando «<b>${escapeHtml(argumento)}</b>» en todos los frentes de obra e inventarios…`,
    { parse_mode: 'HTML' },
  );

  const { data, error } = await opts.supabase
    .from('global_inventory')
    .select('name, stock_available, proyecto_id, ci_proyectos(nombre)')
    .ilike('name', pattern)
    .order('name', { ascending: true })
    .limit(500);

  if (error) {
    console.error('[telegram /stock]', error);
    await enviarMensajeTelegram(
      opts.chatId,
      '❌ Hubo un error técnico al consultar el inventario en la base de datos.',
    );
    return;
  }

  const filas = (data ?? []) as FilaInventario[];

  if (!filas.length) {
    await enviarMensajeTelegram(
      opts.chatId,
      `📦 No se encontraron existencias de «<b>${escapeHtml(argumento)}</b>» en ningún almacén de Casa Inteligente.`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  const consolidado = consolidarPorObra(filas);
  const mensaje = construirMensajeConsolidado(argumento, consolidado);

  await enviarMensajeTelegram(opts.chatId, mensaje, { parse_mode: 'HTML' });
}

/** Extrae la palabra clave tras /stock (soporta /stock@BotName). */
export function extraerArgumentoStock(texto: string): string {
  const t = texto.trim();
  if (!t.toLowerCase().startsWith('/stock')) return '';
  return t.replace(/^\/stock(?:@\S+)?\s*/i, '').trim();
}
