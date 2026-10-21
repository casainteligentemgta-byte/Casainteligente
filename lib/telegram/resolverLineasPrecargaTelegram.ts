import type { SupabaseClient } from '@supabase/supabase-js';
import { resolverEntidadIdCatalogo } from '@/lib/almacen/catalogoEntidad';
import {
  obtenerNotaPrecargada,
  type LineaPrecarga,
  type NotaPrecargada,
} from '@/lib/almacen/notasPrecargadas';
import { crearMaterialParaLineaCompra } from '@/lib/almacen/resolverMaterialParaCompra';
import { sendTelegramMessage } from '@/lib/telegram/botApi';
import { getTelegramEstado, setTelegramContexto, type TelegramEstado } from '@/lib/telegram/estados';
import { avisarDepositariosNotaPrecargada } from '@/lib/telegram/notaPrecargaAvisos';

/**
 * Resolución de líneas sin material de una nota precargada. Lo hace quien carga la nota
 * (comprador): vincular a un material del catálogo, crearlo (solo con confirmación) o
 * dejarlo para el depositario. Nunca crea catálogo sin preguntar.
 */

export const CONTEXTO_RESOLVER_LINEAS = 'resolver_lineas' as const;
const PREFIX = 'rl:';

type MetaResolver = { precarga_id?: string; linea_idx?: number; paso?: 'elegir' | 'buscar' | 'crear' };

function metaResolver(estado: TelegramEstado): MetaResolver {
  return (estado.metadata ?? {}) as MetaResolver;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function esCallbackResolverLineas(data: string): boolean {
  return data.startsWith(PREFIX);
}

export function esFlujoResolverLineas(estado: TelegramEstado): boolean {
  return estado.contexto === CONTEXTO_RESOLVER_LINEAS;
}

function indicesSinMaterial(lineas: LineaPrecarga[]): number[] {
  const out: number[] = [];
  lineas.forEach((l, i) => {
    if (!l.material_id?.trim()) out.push(i);
  });
  return out;
}

async function enviarLinea(
  chatId: string,
  nota: NotaPrecargada,
  idx: number,
): Promise<void> {
  const pendientes = indicesSinMaterial(nota.lineas);
  const pos = Math.max(1, pendientes.indexOf(idx) + 1);
  const linea = nota.lineas[idx];
  await sendTelegramMessage(
    chatId,
    `🔎 <b>Línea sin material</b> (${pos} de ${pendientes.length})\n` +
      `${esc(linea.descripcion)} · ${linea.cantidad} ${esc(linea.unidad)}\n\n` +
      '¿Qué es?',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔎 Buscar en catálogo', callback_data: `${PREFIX}buscar` }],
          [{ text: '➕ Crear material nuevo', callback_data: `${PREFIX}crear` }],
          [{ text: '⏭ Dejar para el depositario', callback_data: `${PREFIX}omitir` }],
        ],
      },
    },
  );
}

/** Arranca la resolución si la nota tiene líneas sin material. Devuelve false si no hay nada que resolver. */
export async function iniciarResolverLineasPrecarga(
  supabase: SupabaseClient,
  chatId: string,
  notaId: string,
): Promise<boolean> {
  const nota = await obtenerNotaPrecargada(supabase, notaId);
  if (!nota) return false;
  const pendientes = indicesSinMaterial(nota.lineas);
  if (!pendientes.length) return false;

  await setTelegramContexto(supabase, chatId, {
    contexto: CONTEXTO_RESOLVER_LINEAS,
    proyecto_id: nota.proyecto_id,
    pending_factura_id: null,
    metadata: { precarga_id: nota.id, linea_idx: pendientes[0], paso: 'elegir' },
  });
  await enviarLinea(chatId, nota, pendientes[0]);
  return true;
}

/** Pasa a la siguiente línea sin material; si no quedan, cierra y avisa al depositario. */
async function avanzar(
  supabase: SupabaseClient,
  chatId: string,
  notaId: string,
  desdeIdx: number,
): Promise<void> {
  const nota = await obtenerNotaPrecargada(supabase, notaId);
  if (!nota) return;
  const siguiente = indicesSinMaterial(nota.lineas).find((i) => i > desdeIdx);

  if (siguiente !== undefined) {
    await setTelegramContexto(supabase, chatId, {
      metadata: { precarga_id: nota.id, linea_idx: siguiente, paso: 'elegir' },
    });
    await enviarLinea(chatId, nota, siguiente);
    return;
  }

  await setTelegramContexto(supabase, chatId, {
    contexto: 'menu',
    pending_factura_id: null,
    metadata: {},
  });
  const sin = indicesSinMaterial(nota.lineas).length;
  const vinc = nota.lineas.length - sin;
  await sendTelegramMessage(
    chatId,
    `✅ Líneas revisadas: ${vinc} vinculada(s)` +
      (sin ? `, ${sin} pendiente(s) para el depositario.` : '.') +
      '\n\nLa nota ya está precargada para el depositario de la obra.',
    { parse_mode: 'HTML' },
  );
  await avisarDepositariosNotaPrecargada(
    supabase,
    nota.proyecto_id,
    chatId,
    `📥 <b>Nota precargada por compras</b>\n${esc(nota.proveedor_nombre)} · #${esc(nota.num_doc)}\n` +
      `${nota.lineas.length} artículo(s). Ingrésela en <code>/nota</code> cuando esté en el almacén.`,
  );
}

async function vincularLinea(
  supabase: SupabaseClient,
  notaId: string,
  idx: number,
  materialId: string,
  materialNombre: string,
): Promise<void> {
  const nota = await obtenerNotaPrecargada(supabase, notaId);
  if (!nota) return;
  const lineas = nota.lineas.map((l, i) =>
    i === idx ? { ...l, material_id: materialId, material_nombre: materialNombre } : l,
  );
  const { error } = await supabase
    .from('ci_notas_precargadas')
    .update({ lineas, updated_at: new Date().toISOString() })
    .eq('id', notaId)
    .eq('estado', 'pendiente');
  if (error) throw new Error(error.message);
}

export async function manejarCallbackResolverLineas(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!esCallbackResolverLineas(params.data)) return false;
  const { chatId } = params;
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esFlujoResolverLineas(estado)) return true;

  const m = metaResolver(estado);
  const notaId = m.precarga_id;
  const idx = m.linea_idx;
  if (!notaId || idx === undefined) return true;
  const nota = await obtenerNotaPrecargada(supabase, notaId);
  if (!nota || nota.estado !== 'pendiente' || !nota.lineas[idx]) {
    await setTelegramContexto(supabase, chatId, { contexto: 'menu', metadata: {} });
    await sendTelegramMessage(chatId, '⚠️ Esa nota ya no está pendiente de revisión.', { parse_mode: 'HTML' });
    return true;
  }
  const linea = nota.lineas[idx];
  const accion = params.data.slice(PREFIX.length);

  if (accion === 'buscar') {
    await setTelegramContexto(supabase, chatId, { metadata: { ...m, paso: 'buscar' } });
    await sendTelegramMessage(
      chatId,
      'Escriba el nombre o parte del material (ej. <code>cemento</code>).',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (accion === 'volver') {
    await setTelegramContexto(supabase, chatId, { metadata: { ...m, paso: 'elegir' } });
    await enviarLinea(chatId, nota, idx);
    return true;
  }

  if (accion.startsWith('link:')) {
    const matId = accion.slice(5);
    const { data: mat } = await supabase
      .from('global_inventory')
      .select('id, name')
      .eq('id', matId)
      .maybeSingle();
    if (!mat) {
      await sendTelegramMessage(chatId, '⚠️ Ese material ya no existe. Busque de nuevo.', { parse_mode: 'HTML' });
      return true;
    }
    await vincularLinea(supabase, notaId, idx, String(mat.id), String(mat.name));
    await avanzar(supabase, chatId, notaId, idx);
    return true;
  }

  if (accion === 'crear') {
    await setTelegramContexto(supabase, chatId, { metadata: { ...m, paso: 'crear' } });
    await sendTelegramMessage(
      chatId,
      `¿Crear <b>${esc(linea.descripcion)}</b> (unidad ${esc(linea.unidad)}) como material nuevo en el catálogo?`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Sí, crear', callback_data: `${PREFIX}crearok` }],
            [{ text: '↩️ No, volver', callback_data: `${PREFIX}volver` }],
          ],
        },
      },
    );
    return true;
  }

  if (accion === 'crearok') {
    const matId = await crearMaterialParaLineaCompra(supabase, {
      descripcion: linea.descripcion,
      item_code: linea.item_code,
      unidad: linea.unidad,
      precio_unitario: 0,
      fecha: new Date().toISOString().slice(0, 10),
      proyectoId: nota.proyecto_id,
    });
    await vincularLinea(supabase, notaId, idx, matId, linea.descripcion);
    await sendTelegramMessage(chatId, `🆕 Material creado: <b>${esc(linea.descripcion)}</b>.`, {
      parse_mode: 'HTML',
    });
    await avanzar(supabase, chatId, notaId, idx);
    return true;
  }

  if (accion === 'omitir') {
    await avanzar(supabase, chatId, notaId, idx);
    return true;
  }

  return true;
}

/** Texto libre: sólo se usa para buscar en el catálogo mientras se espera el término. */
export async function manejarTextoResolverLineas(
  supabase: SupabaseClient,
  chatId: string,
  texto: string,
): Promise<boolean> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esFlujoResolverLineas(estado)) return false;
  const m = metaResolver(estado);
  if (m.paso !== 'buscar') return false;

  const termino = texto.trim();
  if (termino.length < 2) {
    await sendTelegramMessage(chatId, 'Escriba al menos 2 letras.', { parse_mode: 'HTML' });
    return true;
  }

  const entidadId = await resolverEntidadIdCatalogo(supabase, { proyectoId: estado.proyecto_id });
  let q = supabase.from('global_inventory').select('id, name').ilike('name', `%${termino}%`).limit(8);
  if (entidadId) q = q.eq('entidad_id', entidadId);
  const { data } = await q;
  const rows = (data ?? []) as Array<{ id: string; name: string }>;

  if (!rows.length) {
    await sendTelegramMessage(chatId, 'Sin coincidencias en el catálogo.', {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '➕ Crear material nuevo', callback_data: `${PREFIX}crear` }],
          [{ text: '↩️ Volver', callback_data: `${PREFIX}volver` }],
        ],
      },
    });
    return true;
  }

  const buttons = rows.map((r) => [{ text: r.name.slice(0, 60), callback_data: `${PREFIX}link:${r.id}` }]);
  buttons.push([{ text: '↩️ Volver', callback_data: `${PREFIX}volver` }]);
  await sendTelegramMessage(chatId, 'Elija el material:', {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons },
  });
  return true;
}

