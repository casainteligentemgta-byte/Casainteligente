import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram/botApi';
import {
  buscarMaterialesPorPrefijo,
  etiquetaMaterialCatalogo,
} from '@/lib/almacen/buscarMaterialesCatalogo';
import { listarMaterialesObraRecepcion } from '@/lib/almacen/listarMaterialesObraRecepcion';
import { resolverEntidadIdCatalogo } from '@/lib/almacen/catalogoEntidad';
import { normalizarUnidadProcura } from '@/lib/procuras/unidadesProcura';
import type { TelegramEstado } from '@/lib/telegram/estados';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';

export const PRC_MAT_PREFIX = 'prc:mat:';
export const PRC_MAT_PAGE_PREFIX = 'prc:matp:';
export const PRC_MAT_BUSCAR = 'prc:mat:buscar';
export const PRC_MAT_OTRO = 'prc:mat:otro';
export const PRC_MAT_CAT = 'prc:mat:cat';
export const PRC_SRCH_PAGE_PREFIX = 'prc:srchp:';
export const PRC_MAT_TXT_OK = 'prc:mat:txtok';

const MAT_PAGE_SIZE = 6;
const SRCH_PAGE_SIZE = 6;

function truncar(s: string, max = 56): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function patchMeta(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  patch: Record<string, unknown>,
): Promise<TelegramEstado> {
  return setTelegramContexto(supabase, chatId, {
    metadata: { ...estado.metadata, ...patch },
  });
}

export async function enviarPickerMaterialProcura(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
  page = 0,
): Promise<void> {
  const estado = await getTelegramEstado(supabase, chatId);
  await patchMeta(supabase, chatId, estado, { paso: 'material_elegir' });

  const materiales = await listarMaterialesObraRecepcion(supabase, proyectoId);
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

  if (materiales.length) {
    const totalPages = Math.max(1, Math.ceil(materiales.length / MAT_PAGE_SIZE));
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    const slice = materiales.slice(safePage * MAT_PAGE_SIZE, safePage * MAT_PAGE_SIZE + MAT_PAGE_SIZE);

    for (const m of slice) {
      buttons.push([
        {
          text: truncar(etiquetaMaterialCatalogo(m)),
          callback_data: `${PRC_MAT_PREFIX}${m.id}`,
        },
      ]);
    }

    if (totalPages > 1) {
      const nav: Array<{ text: string; callback_data: string }> = [];
      if (safePage > 0) nav.push({ text: '◀', callback_data: `${PRC_MAT_PAGE_PREFIX}${safePage - 1}` });
      nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PRC_MAT_PAGE_PREFIX}${safePage}` });
      if (safePage < totalPages - 1) {
        nav.push({ text: '▶', callback_data: `${PRC_MAT_PAGE_PREFIX}${safePage + 1}` });
      }
      buttons.push(nav);
    }
  }

  buttons.push([{ text: '🔍 Buscar por nombre/SKU', callback_data: PRC_MAT_BUSCAR }]);
  buttons.push([{ text: '✏️ Otro material (texto libre)', callback_data: PRC_MAT_OTRO }]);

  const intro = materiales.length
    ? '1️⃣ <b>Elige el material</b> del catálogo de la obra:\n' +
      '<i>O escribe letras del nombre (ej. <code>c</code>) para filtrar.</i>'
    : '1️⃣ <b>Sin materiales en el catálogo de la obra</b>.\n' +
      'Escribe letras del nombre, busca en inventario o describe otro:';

  await sendTelegramMessage(chatId, intro, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons },
  });
}

export async function enviarBusquedaMaterialProcura(chatId: string): Promise<void> {
  await sendTelegramMessage(
    chatId,
    '🔍 Escribe letras del <b>nombre o SKU</b> (desde 1 letra).\n' +
      'Verás materiales que <b>empiezan</b> con lo que escribas.\n' +
      '<i>Ej.: c · ce · VAR</i>',
    { parse_mode: 'HTML' },
  );
}

export async function enviarTextoLibreMaterialProcura(chatId: string): Promise<void> {
  await sendTelegramMessage(
    chatId,
    '✏️ Escribe la <b>descripción del material</b>.\n' +
      'Te sugerimos del catálogo según escribes (desde 1 letra).\n' +
      'Si no aparece, confirma tu texto libre.\n' +
      '<i>Ej.: Cemento gris 42.5 kg</i>',
    { parse_mode: 'HTML' },
  );
}

export async function enviarResultadosBusquedaMaterialProcura(
  chatId: string,
  resultados: Array<{ id: string; name: string; sap_code: string | null }>,
  opts: {
    term: string;
    page?: number;
    total?: number;
    modoLibre?: boolean;
  },
): Promise<void> {
  const total = opts.total ?? resultados.length;
  const totalPages = Math.max(1, Math.ceil(total / SRCH_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, opts.page ?? 0), totalPages - 1);
  const slice = resultados.slice(safePage * SRCH_PAGE_SIZE, safePage * SRCH_PAGE_SIZE + SRCH_PAGE_SIZE);

  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((m) => [
    {
      text: truncar(m.sap_code ? `${m.name} (${m.sap_code})` : m.name),
      callback_data: `${PRC_MAT_PREFIX}${m.id}`,
    },
  ]);

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PRC_SRCH_PAGE_PREFIX}${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PRC_SRCH_PAGE_PREFIX}${safePage}` });
    if (safePage < totalPages - 1) {
      nav.push({ text: '▶', callback_data: `${PRC_SRCH_PAGE_PREFIX}${safePage + 1}` });
    }
    buttons.push(nav);
  }

  const term = opts.term.trim();
  if (opts.modoLibre && term.length >= 2) {
    buttons.push([
      {
        text: truncar(`✅ Usar texto: ${term}`, 48),
        callback_data: PRC_MAT_TXT_OK,
      },
    ]);
  }

  buttons.push([{ text: '↩️ Volver al catálogo de obra', callback_data: PRC_MAT_CAT }]);

  const acotar =
    total > SRCH_PAGE_SIZE && term.length === 1
      ? '\n<i>Escribe más letras para acotar la lista.</i>'
      : '';

  await sendTelegramMessage(
    chatId,
    `🔍 <b>${escHtml(term)}</b> — ${total} material(es)${acotar}\nSelecciona o confirma tu texto:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

export async function confirmarTextoLibreMaterialProcura(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  texto: string,
): Promise<void> {
  const t = texto.trim().slice(0, 500);
  if (t.length < 2) {
    await sendTelegramMessage(chatId, '⚠️ La descripción debe tener al menos 2 caracteres.', {
      parse_mode: 'HTML',
    });
    return;
  }
  await patchMeta(supabase, chatId, estado, {
    paso: 'cantidad',
    material_id: '',
    material_txt: t,
    unidad: '',
    busqueda_material: '',
    texto_libre_borrador: '',
  });
  await sendTelegramMessage(
    chatId,
    `📦 Material: <b>${escHtml(t)}</b>\n\n` +
      `2️⃣ Indica la <b>cantidad</b> (y unidad opcional).\n` +
      `<i>Ej.: 50 SAC · 2.5 M3 · 100 · 20 Litros</i>`,
    { parse_mode: 'HTML' },
  );
}

export async function aplicarMaterialCatalogoProcura(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  material: { id: string; name: string; sap_code?: string | null; unit?: string | null },
): Promise<void> {
  const etiqueta = material.sap_code
    ? `${material.name} (${material.sap_code})`
    : material.name;
  const unidadCat = normalizarUnidadProcura(material.unit);

  await patchMeta(supabase, chatId, estado, {
    paso: 'cantidad',
    material_id: material.id,
    material_txt: etiqueta.slice(0, 500),
    unidad: unidadCat,
  });

  await sendTelegramMessage(
    chatId,
    `📦 Material: <b>${escHtml(etiqueta)}</b>\n` +
      `Unidad catálogo: <b>${escHtml(unidadCat)}</b>\n\n` +
      `2️⃣ Indica la <b>cantidad</b> (y unidad opcional).\n` +
      `<i>Ej.: 50 SAC · 2.5 M3 · 100 · 20 Litros</i>`,
    { parse_mode: 'HTML' },
  );
}

export async function resolverMaterialProcuraPorId(
  supabase: SupabaseClient,
  materialId: string,
  proyectoId: string | null,
): Promise<{ id: string; name: string; sap_code: string | null; unit: string } | null> {
  const id = materialId.trim();
  if (!id) return null;

  if (proyectoId) {
    const lista = await listarMaterialesObraRecepcion(supabase, proyectoId);
    const hit = lista.find((m) => m.id === id);
    if (hit) return hit;
  }

  const { data, error } = await supabase
    .from('global_inventory')
    .select('id,name,sap_code,unit')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: String(data.id),
    name: String(data.name ?? 'Material'),
    sap_code: data.sap_code?.trim() || null,
    unit: String(data.unit ?? 'UND'),
  };
}

export async function buscarYMostrarMaterialesProcura(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  term: string,
  opts?: { page?: number; modoLibre?: boolean },
): Promise<boolean> {
  const t = term.trim();
  if (!t) return false;

  try {
    const proyectoId = estado.proyecto_id?.trim() || null;
    const entidadId = await resolverEntidadIdCatalogo(supabase, { proyectoId });
    const todos = await buscarMaterialesPorPrefijo(supabase, t, {
      limit: 60,
      proyectoId,
      entidadId,
    });

    await patchMeta(supabase, chatId, estado, {
      busqueda_material: t,
      texto_libre_borrador: opts?.modoLibre ? t : '',
    });

    if (!todos.length) {
      if (opts?.modoLibre && t.length >= 2) {
        await sendTelegramMessage(
          chatId,
          '❌ Ningún material del catálogo empieza así.\n' +
            'Pulsa abajo para usar tu descripción tal cual.',
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: truncar(`✅ Usar texto: ${t}`, 48), callback_data: PRC_MAT_TXT_OK }],
                [{ text: '↩️ Volver al catálogo de obra', callback_data: PRC_MAT_CAT }],
              ],
            },
          },
        );
        return true;
      }
      await sendTelegramMessage(
        chatId,
        t.length === 1
          ? `❌ Ningún material empieza por <b>${escHtml(t)}</b>. Prueba otra letra o más caracteres.`
          : '❌ Sin coincidencias por prefijo. Prueba otro término.',
        { parse_mode: 'HTML' },
      );
      return true;
    }

    await enviarResultadosBusquedaMaterialProcura(chatId, todos, {
      term: t,
      page: opts?.page ?? 0,
      total: todos.length,
      modoLibre: opts?.modoLibre,
    });
    return true;
  } catch (e) {
    await sendTelegramMessage(
      chatId,
      `❌ Error al buscar: ${escHtml(e instanceof Error ? e.message : 'Error')}`,
      { parse_mode: 'HTML' },
    );
    return true;
  }
}
