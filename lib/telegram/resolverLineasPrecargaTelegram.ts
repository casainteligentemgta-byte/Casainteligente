import type { SupabaseClient } from '@supabase/supabase-js';
import { confirmarCompraDesdeCanal } from '@/lib/contabilidad/confirmarCompraDesdeCanal';
import { resolverEntidadIdCatalogo } from '@/lib/almacen/catalogoEntidad';
import {
  obtenerNotaPrecargada,
  type LineaPrecarga,
  type NotaPrecargada,
} from '@/lib/almacen/notasPrecargadas';
import { crearMaterialParaLineaCompra } from '@/lib/almacen/resolverMaterialParaCompra';
import { sendTelegramMessage } from '@/lib/telegram/botApi';
import { getTelegramEstado, setTelegramContexto, type TelegramEstado } from '@/lib/telegram/estados';
import { mensajeCompradorFacturaConfirmadaHtml } from '@/lib/telegram/mensajesFactura';
import { avisarDepositariosNotaPrecargada } from '@/lib/telegram/notaPrecargaAvisos';

/**
 * Resolución de líneas sin material al cargar una factura o una nota del comprador.
 * El sistema pregunta antes de crear: el comprador elige un material del catálogo o confirma
 * la creación. Nunca crea materiales en silencio. En la nota, además puede dejar la línea
 * para el depositario; en la factura no, porque debe quedar completa para confirmarse.
 */

export const CONTEXTO_RESOLVER_LINEAS = 'resolver_lineas' as const;
const PREFIX = 'rl:';

type Fuente = 'nota' | 'factura';

type MetaResolver = {
  fuente?: Fuente;
  precarga_id?: string;
  pending_id?: string;
  ubicacion_destino_id?: string;
  procura_id?: string | null;
  linea_idx?: number;
  paso?: 'elegir' | 'buscar' | 'crear';
};

/** Línea vista de forma uniforme, sea de nota o de factura. */
type LineaVista = {
  descripcion: string;
  cantidad: number;
  unidad: string;
  material_id: string | null;
  item_code: string | null;
};

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

/** Pura: índices (dentro de la lista original) de las líneas con descripción y sin material. */
export function indicesSinMaterialFactura(
  items: Array<{ description?: string; material_id?: string }>,
): number[] {
  const out: number[] = [];
  items.forEach((it, i) => {
    if (String(it.description ?? '').trim() && !String(it.material_id ?? '').trim()) out.push(i);
  });
  return out;
}

function lineasNotaVista(lineas: LineaPrecarga[]): LineaVista[] {
  return lineas.map((l) => ({
    descripcion: l.descripcion,
    cantidad: Number(l.cantidad),
    unidad: l.unidad,
    material_id: l.material_id?.trim() || null,
    item_code: l.item_code,
  }));
}

type ItemFactura = {
  description?: string;
  item_code?: string;
  unit?: string;
  quantity?: number;
  unit_price?: number;
  material_id?: string;
  material_nombre?: string;
};

async function leerFactura(
  supabase: SupabaseClient,
  pendingId: string,
): Promise<{ items: ItemFactura[]; extracted: Record<string, unknown>; proyectoId: string | null; ubicacionId: string | null } | null> {
  const { data } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('extracted, proyecto_id, ubicacion_destino_id')
    .eq('id', pendingId)
    .maybeSingle();
  if (!data?.extracted) return null;
  const extracted = data.extracted as Record<string, unknown>;
  return {
    items: Array.isArray(extracted.items) ? (extracted.items as ItemFactura[]) : [],
    extracted,
    proyectoId: (data.proyecto_id as string | null) ?? null,
    ubicacionId: (data.ubicacion_destino_id as string | null) ?? null,
  };
}

/** Lee las líneas de la fuente activa como vista uniforme y sus índices originales. */
async function cargarVista(
  supabase: SupabaseClient,
  m: MetaResolver,
): Promise<{ vista: LineaVista[]; indices: number[]; proyectoId: string | null } | null> {
  if (m.fuente === 'factura') {
    const f = m.pending_id ? await leerFactura(supabase, m.pending_id) : null;
    if (!f) return null;
    const vista = f.items.map((it) => ({
      descripcion: String(it.description ?? '').trim(),
      cantidad: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
      unidad: String(it.unit ?? 'UND').trim() || 'UND',
      material_id: String(it.material_id ?? '').trim() || null,
      item_code: String(it.item_code ?? '').trim() || null,
    }));
    return { vista, indices: indicesSinMaterialFactura(f.items), proyectoId: f.proyectoId };
  }
  if (!m.precarga_id) return null;
  const nota = await obtenerNotaPrecargada(supabase, m.precarga_id);
  if (!nota || nota.estado !== 'pendiente') return null;
  const vista = lineasNotaVista(nota.lineas);
  const indices = vista.flatMap((l, i) => (l.material_id ? [] : [i]));
  return { vista, indices, proyectoId: nota.proyecto_id };
}

async function vincularLinea(
  supabase: SupabaseClient,
  m: MetaResolver,
  idx: number,
  materialId: string,
  materialNombre: string,
): Promise<void> {
  if (m.fuente === 'factura') {
    const f = m.pending_id ? await leerFactura(supabase, m.pending_id) : null;
    if (!f) return;
    const items = f.items.map((it, i) =>
      i === idx ? { ...it, material_id: materialId, material_nombre: materialNombre } : it,
    );
    const { error } = await supabase
      .from('ci_facturas_canal_pendientes')
      .update({ extracted: { ...f.extracted, items }, updated_at: new Date().toISOString() })
      .eq('id', m.pending_id as string);
    if (error) throw new Error(error.message);
    return;
  }
  const nota = m.precarga_id ? await obtenerNotaPrecargada(supabase, m.precarga_id) : null;
  if (!nota) return;
  const lineas = nota.lineas.map((l, i) =>
    i === idx ? { ...l, material_id: materialId, material_nombre: materialNombre } : l,
  );
  const { error } = await supabase
    .from('ci_notas_precargadas')
    .update({ lineas, updated_at: new Date().toISOString() })
    .eq('id', nota.id)
    .eq('estado', 'pendiente');
  if (error) throw new Error(error.message);
}

function botonesLinea(fuente: Fuente): Array<Array<{ text: string; callback_data: string }>> {
  const filas = [
    [{ text: '🔎 Buscar en catálogo', callback_data: `${PREFIX}buscar` }],
    [{ text: '➕ Crear material nuevo', callback_data: `${PREFIX}crear` }],
  ];
  if (fuente === 'nota') {
    filas.push([{ text: '⏭ Dejar para el depositario', callback_data: `${PREFIX}omitir` }]);
  }
  return filas;
}

async function enviarLinea(chatId: string, m: MetaResolver, vista: LineaVista[], indices: number[], idx: number): Promise<void> {
  const pos = Math.max(1, indices.indexOf(idx) + 1);
  const linea = vista[idx];
  const fuente: Fuente = m.fuente ?? 'nota';
  const cabecera = fuente === 'factura' ? 'factura' : 'nota';
  await sendTelegramMessage(
    chatId,
    `🔎 <b>Línea de ${cabecera} sin material</b> (${pos} de ${indices.length})\n` +
      `${esc(linea.descripcion)} · ${linea.cantidad} ${esc(linea.unidad)}\n\n` +
      '¿Qué es? Si no existe en el catálogo, confirme la creación.',
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: botonesLinea(fuente) },
    },
  );
}

/** Pasa a la siguiente línea sin material; si no quedan, cierra según la fuente. */
async function avanzar(
  supabase: SupabaseClient,
  chatId: string,
  desdeIdx: number,
): Promise<void> {
  const estado = await getTelegramEstado(supabase, chatId);
  const m = metaResolver(estado);
  const cargada = await cargarVista(supabase, m);
  if (!cargada) {
    await setTelegramContexto(supabase, chatId, { contexto: 'menu', pending_factura_id: null, metadata: {} });
    return;
  }
  const siguiente = cargada.indices.find((i) => i > desdeIdx);
  if (siguiente !== undefined) {
    await setTelegramContexto(supabase, chatId, {
      metadata: { ...m, linea_idx: siguiente, paso: 'elegir' },
    });
    await enviarLinea(chatId, m, cargada.vista, cargada.indices, siguiente);
    return;
  }
  await cerrar(supabase, chatId, m, cargada);
}

async function cerrar(
  supabase: SupabaseClient,
  chatId: string,
  m: MetaResolver,
  cargada: { vista: LineaVista[]; indices: number[]; proyectoId: string | null },
): Promise<void> {
  await setTelegramContexto(supabase, chatId, { contexto: 'menu', pending_factura_id: null, metadata: {} });

  if (m.fuente === 'factura' && m.pending_id) {
    const proyectoId = cargada.proyectoId ?? '';
    const ubicacionId = m.ubicacion_destino_id ?? '';
    try {
      await confirmarCompraDesdeCanal(supabase, {
        pendingId: m.pending_id,
        proyectoId,
        ubicacionDestinoId: ubicacionId,
        procuraId: m.procura_id ?? null,
      });
      const f = await leerFactura(supabase, m.pending_id);
      await sendTelegramMessage(
        chatId,
        mensajeCompradorFacturaConfirmadaHtml('obra', f?.extracted ?? {}),
        { parse_mode: 'HTML' },
      );
    } catch (e) {
      const det = e instanceof Error ? e.message : 'Error al registrar en Contabilidad';
      await sendTelegramMessage(
        chatId,
        `⚠️ <b>No se pudo registrar en Contabilidad</b>\n<i>${esc(det.slice(0, 280))}</i>`,
        { parse_mode: 'HTML' },
      );
    }
    return;
  }

  const nota = m.precarga_id ? await obtenerNotaPrecargada(supabase, m.precarga_id) : null;
  if (!nota) return;
  const sin = cargada.indices.length ? cargada.vista.filter((l) => !l.material_id).length : 0;
  await sendTelegramMessage(
    chatId,
    `✅ Líneas revisadas: ${cargada.vista.length - sin} vinculada(s)` +
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

/** Nota precargada: arranca la revisión si tiene líneas sin material. */
export async function iniciarResolverLineasPrecarga(
  supabase: SupabaseClient,
  chatId: string,
  notaId: string,
): Promise<boolean> {
  const nota: NotaPrecargada | null = await obtenerNotaPrecargada(supabase, notaId);
  if (!nota) return false;
  const vista = lineasNotaVista(nota.lineas);
  const indices = vista.flatMap((l, i) => (l.material_id ? [] : [i]));
  if (!indices.length) return false;

  const m: MetaResolver = { fuente: 'nota', precarga_id: nota.id, linea_idx: indices[0], paso: 'elegir' };
  await setTelegramContexto(supabase, chatId, {
    contexto: CONTEXTO_RESOLVER_LINEAS,
    proyecto_id: nota.proyecto_id,
    pending_factura_id: null,
    metadata: m as Record<string, unknown>,
  });
  await enviarLinea(chatId, m, vista, indices, indices[0]);
  return true;
}

/**
 * Factura del comprador: antes de confirmar en Contabilidad, revisa las líneas sin material.
 * Devuelve false si no hay líneas sin material (el llamador confirma directo).
 */
export async function iniciarResolverLineasFactura(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
  opts: { proyectoId: string; ubicacionDestinoId: string; procuraId?: string | null },
): Promise<boolean> {
  const f = await leerFactura(supabase, pendingId);
  if (!f) return false;
  const indices = indicesSinMaterialFactura(f.items);
  if (!indices.length) return false;

  const vista: LineaVista[] = f.items.map((it) => ({
    descripcion: String(it.description ?? '').trim(),
    cantidad: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
    unidad: String(it.unit ?? 'UND').trim() || 'UND',
    material_id: String(it.material_id ?? '').trim() || null,
    item_code: String(it.item_code ?? '').trim() || null,
  }));
  const m: MetaResolver = {
    fuente: 'factura',
    pending_id: pendingId,
    ubicacion_destino_id: opts.ubicacionDestinoId,
    procura_id: opts.procuraId ?? null,
    linea_idx: indices[0],
    paso: 'elegir',
  };
  await setTelegramContexto(supabase, chatId, {
    contexto: CONTEXTO_RESOLVER_LINEAS,
    proyecto_id: opts.proyectoId,
    pending_factura_id: pendingId,
    metadata: m as Record<string, unknown>,
  });
  await enviarLinea(chatId, m, vista, indices, indices[0]);
  return true;
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
  const idx = m.linea_idx;
  const cargada = await cargarVista(supabase, m);
  if (idx === undefined || !cargada || !cargada.vista[idx]) {
    await setTelegramContexto(supabase, chatId, { contexto: 'menu', pending_factura_id: null, metadata: {} });
    await sendTelegramMessage(chatId, '⚠️ Ya no hay líneas pendientes de revisión.', { parse_mode: 'HTML' });
    return true;
  }
  const linea = cargada.vista[idx];
  const accion = params.data.slice(PREFIX.length);

  if (accion === 'buscar') {
    await setTelegramContexto(supabase, chatId, { metadata: { ...m, paso: 'buscar' } });
    await sendTelegramMessage(chatId, 'Escriba el nombre o parte del material (ej. <code>cemento</code>).', {
      parse_mode: 'HTML',
    });
    return true;
  }

  if (accion === 'volver') {
    await setTelegramContexto(supabase, chatId, { metadata: { ...m, paso: 'elegir' } });
    await enviarLinea(chatId, m, cargada.vista, cargada.indices, idx);
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
    await vincularLinea(supabase, m, idx, String(mat.id), String(mat.name));
    await avanzar(supabase, chatId, idx);
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
    const proyectoId = cargada.proyectoId ?? estado.proyecto_id ?? '';
    const matId = await crearMaterialParaLineaCompra(supabase, {
      descripcion: linea.descripcion,
      item_code: linea.item_code,
      unidad: linea.unidad,
      precio_unitario: 0,
      fecha: new Date().toISOString().slice(0, 10),
      proyectoId,
    });
    await vincularLinea(supabase, m, idx, matId, linea.descripcion);
    await sendTelegramMessage(chatId, `🆕 Material creado: <b>${esc(linea.descripcion)}</b>.`, {
      parse_mode: 'HTML',
    });
    await avanzar(supabase, chatId, idx);
    return true;
  }

  if (accion === 'omitir' && m.fuente !== 'factura') {
    await avanzar(supabase, chatId, idx);
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
