import type { SupabaseClient } from '@supabase/supabase-js';
import { patronIlike } from '@/lib/contabilidad/comprasQueryFiltros';
import { enviarMensajeTelegram } from '@/lib/telegram/botApi';

const DEPOSITO_GENERAL = 'Depósito Principal / General';

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function nombreObraDesdeUbicacion(
  ubicacion: StockRow['ubicacion'],
): string {
  const ub = Array.isArray(ubicacion) ? ubicacion[0] : ubicacion;
  if (!ub) return DEPOSITO_GENERAL;
  const p = ub.ci_proyectos;
  const raw = Array.isArray(p) ? p[0]?.nombre : p?.nombre;
  const n = (raw ?? '').trim();
  return n || DEPOSITO_GENERAL;
}

/** Suma cantidad_disponible (inventario_stock) por frente de obra. */
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
    '<i>Stock físico desde inventario_stock (ubicaciones de obra).</i>',
  );

  return lineas.join('\n');
}

/**
 * Consulta express de inventario: /stock &lt;material&gt;
 * Busca SKU en global_inventory y suma inventario_stock por obra.
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

  const { data: materiales, error: matErr } = await opts.supabase
    .from('global_inventory')
    .select('id, name')
    .ilike('name', pattern)
    .order('name', { ascending: true })
    .limit(120);

  if (matErr) {
    console.error('[telegram /stock] materiales', matErr);
    await enviarMensajeTelegram(
      opts.chatId,
      '❌ Hubo un error técnico al consultar el inventario en la base de datos.',
    );
    return;
  }

  const matches = (materiales ?? []) as MaterialMatch[];
  if (!matches.length) {
    await enviarMensajeTelegram(
      opts.chatId,
      `📦 No se encontraron materiales «<b>${escapeHtml(argumento)}</b>» en el catálogo.`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  const materialIds = matches.map((m) => String(m.id));
  const { data: stockRows, error: stockErr } = await opts.supabase
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
      opts.chatId,
      '⚠️ Tabla inventario_stock no disponible. Aplique migraciones 180+ en Supabase.',
    );
    return;
  }

  if (stockErr) {
    console.error('[telegram /stock] stock', stockErr);
    await enviarMensajeTelegram(
      opts.chatId,
      '❌ Error al leer stock físico por ubicación.',
    );
    return;
  }

  const nombresMaterial = new Map(matches.map((m) => [String(m.id), m.name]));
  const consolidado = consolidarPorObra(
    (stockRows ?? []) as StockRow[],
    nombresMaterial,
  );
  const mensaje = construirMensajeConsolidado(argumento, consolidado);

  await enviarMensajeTelegram(opts.chatId, mensaje, { parse_mode: 'HTML' });
}

/** Extrae la palabra clave tras /stock (soporta /stock@BotName). */
export function extraerArgumentoStock(texto: string): string {
  const t = texto.trim();
  if (!t.toLowerCase().startsWith('/stock')) return '';
  return t.replace(/^\/stock(?:@\S+)?\s*/i, '').trim();
}
