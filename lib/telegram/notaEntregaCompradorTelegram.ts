/**
 * Comprador (solo Telegram): completa proveedor, RIF, entidad y obra de una
 * nota de entrega. No pide precios — Luis los carga en la web.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { MENSAJE_ERROR_NOTA_ENTREGA } from '@/lib/compras/notaEntregaCanal';
import { proveedorKeyIngresoManual } from '@/lib/almacen/listarProveedoresSugeridosIngreso';
import { normalizarNombreEmpresa } from '@/lib/contabilidad/propietarioFactura';
import { esRifVenezolano, normalizarRifVenezolano } from '@/lib/contabilidad/rifVenezolano';
import {
  EntidadConNombre,
  SELECT_NOMBRE_ENTIDAD,
  nombreEntidad,
} from '@/lib/entidades/nombreEntidad';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import type { TelegramEstado } from '@/lib/telegram/estados';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';

export const FLUJO_NOTA_ENTREGA_COMPRADOR = 'nota_entrega_comprador';
export const PREFIX_NOTA_ENTREGA_COMPRADOR = 'ne:';

const PAGE_SIZE = 8;
const MAX_PROVEEDORES = 16;

const CLAVES_ENTIDAD = ['dimaquinas', 'casa inteligente', 'neroca', 'procodima'] as const;

export type PasoNotaEntregaComprador =
  | 'proveedor'
  | 'proveedor_escribir'
  | 'rif'
  | 'rif_escribir'
  | 'entidad'
  | 'obra'
  | 'completo';

type ProveedorOpcion = { key: string; nombre: string; rif: string | null };
type EntidadOpcion = { id: string; nombre: string };
type ObraOpcion = { id: string; nombre: string };

type MetaNota = {
  flujo?: string;
  paso?: string;
  proveedores?: ProveedorOpcion[];
  rif_sugerido?: string;
};

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncar(s: string, max = 54): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function texto(v: unknown): string {
  return String(v ?? '').trim();
}

function metaDe(estado: TelegramEstado): MetaNota {
  return (estado.metadata ?? {}) as MetaNota;
}

function sinAcentosLower(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function esCallbackNotaEntregaComprador(data: string): boolean {
  return data.startsWith(PREFIX_NOTA_ENTREGA_COMPRADOR);
}

export function esFlujoNotaEntregaComprador(estado: TelegramEstado): boolean {
  return (
    estado.contexto === 'factura' &&
    Boolean(estado.pending_factura_id) &&
    String(estado.metadata?.flujo ?? '') === FLUJO_NOTA_ENTREGA_COMPRADOR
  );
}

export function esperandoTextoNotaEntregaComprador(estado: TelegramEstado): boolean {
  if (!esFlujoNotaEntregaComprador(estado)) return false;
  const paso = String(estado.metadata?.paso ?? '');
  return paso === 'proveedor_escribir' || paso === 'rif_escribir';
}

export function siguientePasoNotaEntregaComprador(
  extracted: Record<string, unknown> | null | undefined,
  row?: { entidad_id?: string | null; proyecto_id?: string | null } | null,
): PasoNotaEntregaComprador {
  if (!texto(extracted?.supplier_name ?? extracted?.proveedor)) return 'proveedor';
  if (!texto(extracted?.supplier_rif)) return 'rif';
  if (!texto(row?.entidad_id)) return 'entidad';
  if (!texto(row?.proyecto_id)) return 'obra';
  return 'completo';
}

export function parsearRifNotaEntrega(raw: string): string | null {
  const canon = normalizarRifVenezolano(raw);
  if (canon) return canon;
  const t = raw.trim().toUpperCase();
  if (esRifVenezolano(t)) return t;
  if (/^[VEJPG][-\s]?\d{6,9}(-\d)?$/i.test(t)) return t.replace(/\s+/g, '');
  return null;
}

async function leerPendiente(
  supabase: SupabaseClient,
  pendingId: string,
): Promise<{
  extracted: Record<string, unknown>;
  entidad_id: string | null;
  proyecto_id: string | null;
} | null> {
  const { data, error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('extracted, entidad_id, proyecto_id')
    .eq('id', pendingId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    extracted: (data.extracted ?? {}) as Record<string, unknown>,
    entidad_id: data.entidad_id ? String(data.entidad_id) : null,
    proyecto_id: data.proyecto_id ? String(data.proyecto_id) : null,
  };
}

async function guardarPendiente(
  supabase: SupabaseClient,
  pendingId: string,
  patch: {
    extracted?: Record<string, unknown>;
    entidad_id?: string | null;
    proyecto_id?: string | null;
  },
): Promise<boolean> {
  const { error } = await supabase
    .from('ci_facturas_canal_pendientes')
    .update({
      ...patch,
      requiere_revision: true,
      mensaje_error: MENSAJE_ERROR_NOTA_ENTREGA,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingId);
  if (error && /requiere_revision|PGRST204|schema cache/i.test(error.message)) {
    const retry = await supabase
      .from('ci_facturas_canal_pendientes')
      .update({
        ...patch,
        mensaje_error: MENSAJE_ERROR_NOTA_ENTREGA,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pendingId);
    return !retry.error;
  }
  return !error;
}

async function setPaso(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
  paso: PasoNotaEntregaComprador,
  extra?: Record<string, unknown>,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'factura',
    pending_factura_id: pendingId,
    metadata: { flujo: FLUJO_NOTA_ENTREGA_COMPRADOR, paso, ...extra },
    reemplazarMetadata: true,
  });
}

export async function listarProveedoresRecientesComprador(
  supabase: SupabaseClient,
  chatId: string,
  extracted?: Record<string, unknown> | null,
): Promise<ProveedorOpcion[]> {
  const map = new Map<string, ProveedorOpcion>();
  const meter = (nombre: string, rif: string | null) => {
    const n = nombre.trim();
    if (n.length < 2) return;
    const key = proveedorKeyIngresoManual(n);
    const prev = map.get(key);
    if (prev) {
      if (!prev.rif && rif) map.set(key, { ...prev, rif });
      return;
    }
    map.set(key, { key, nombre: n, rif: rif?.trim() || null });
  };

  const actual = texto(extracted?.supplier_name ?? extracted?.proveedor);
  const rifActual = texto(extracted?.supplier_rif) || null;
  if (actual) meter(actual, rifActual);

  const { data } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select('extracted, created_at')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(80);

  for (const row of data ?? []) {
    const ex = (row.extracted ?? {}) as Record<string, unknown>;
    meter(texto(ex.supplier_name ?? ex.proveedor), texto(ex.supplier_rif) || null);
    if (map.size >= MAX_PROVEEDORES) break;
  }

  return Array.from(map.values());
}

async function rifDesdeMemoriaPorNombre(
  supabase: SupabaseClient,
  nombre: string,
): Promise<string | null> {
  const target = normalizarNombreEmpresa(nombre);
  if (!target) return null;

  const { data: perfiles } = await supabase
    .from('ci_proveedor_perfil')
    .select('rif_etiqueta, rif_normalizado, nombre_canonico')
    .limit(250);
  const perfil = (perfiles ?? []).find(
    (p) => normalizarNombreEmpresa(String(p.nombre_canonico ?? '')) === target,
  );
  const rifPerfil = texto(perfil?.rif_etiqueta || perfil?.rif_normalizado);
  if (rifPerfil) return normalizarRifVenezolano(rifPerfil) || rifPerfil;

  const { data: empresas } = await supabase.from('empresas').select('nombre, rif').limit(250);
  const emp = (empresas ?? []).find((e) => normalizarNombreEmpresa(String(e.nombre ?? '')) === target);
  const rifEmp = texto(emp?.rif);
  return rifEmp ? normalizarRifVenezolano(rifEmp) || rifEmp : null;
}

export function entidadEsDeNotaEntrega(nombre: string): boolean {
  const n = sinAcentosLower(nombre);
  return CLAVES_ENTIDAD.some((k) => n.includes(k));
}

export async function listarEntidadesNotaEntrega(
  supabase: SupabaseClient,
): Promise<EntidadOpcion[]> {
  const { data, error } = await supabase.from('ci_entidades').select(SELECT_NOMBRE_ENTIDAD);
  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);

  const todas = (data ?? []).map((e) => ({
    id: String((e as { id: unknown }).id),
    nombre: nombreEntidad(e as EntidadConNombre, 'Sin nombre'),
  }));
  const filtradas = todas.filter((e) => entidadEsDeNotaEntrega(e.nombre));
  const lista = filtradas.length ? filtradas : todas;
  return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function listarObrasActivasEntidad(
  supabase: SupabaseClient,
  entidadId: string,
): Promise<ObraOpcion[]> {
  const { data, error } = await supabase
    .from('ci_proyectos')
    .select('id, nombre, tipo_proyecto, obra_estado_legacy, entidad_id')
    .eq('entidad_id', entidadId)
    .order('nombre', { ascending: true })
    .limit(250);
  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((p) => {
      const tipo = String(p.tipo_proyecto ?? 'integral').toLowerCase();
      if (tipo === 'talento') return false;
      const estado = String(p.obra_estado_legacy ?? '').toLowerCase();
      if (estado === 'cerrada') return false;
      return Boolean(texto(p.id) && texto(p.nombre));
    })
    .map((p) => ({ id: String(p.id), nombre: texto(p.nombre) || 'Obra' }));
}

async function enviarPickerProveedor(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
  extracted: Record<string, unknown>,
  page = 0,
): Promise<void> {
  const proveedores = await listarProveedoresRecientesComprador(supabase, chatId, extracted);
  if (!proveedores.length) {
    await setPaso(supabase, chatId, pendingId, 'proveedor_escribir');
    await sendTelegramMessage(chatId, '📄 Nota de entrega.\nEscribe el proveedor.', {
      parse_mode: 'HTML',
    });
    return;
  }

  const totalPages = Math.max(1, Math.ceil(proveedores.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = proveedores.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  await setPaso(supabase, chatId, pendingId, 'proveedor', { proveedores });

  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((p) => {
    const idx = proveedores.findIndex((x) => x.key === p.key);
    return [{ text: truncar(p.nombre), callback_data: `${PREFIX_NOTA_ENTREGA_COMPRADOR}p:${idx}` }];
  });
  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX_NOTA_ENTREGA_COMPRADOR}pp:${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX_NOTA_ENTREGA_COMPRADOR}pp:${safePage}` });
    if (safePage < totalPages - 1) {
      nav.push({ text: '▶', callback_data: `${PREFIX_NOTA_ENTREGA_COMPRADOR}pp:${safePage + 1}` });
    }
    buttons.push(nav);
  }
  buttons.push([{ text: '✏️ Escribir', callback_data: `${PREFIX_NOTA_ENTREGA_COMPRADOR}pw` }]);

  await sendTelegramMessage(chatId, '📄 Nota de entrega.\nProveedor:', {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons },
  });
}

async function pedirRif(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
  proveedor: string,
  rifSugerido: string | null,
): Promise<void> {
  if (rifSugerido) {
    await setPaso(supabase, chatId, pendingId, 'rif', { rif_sugerido: rifSugerido });
    await sendTelegramMessage(
      chatId,
      `RIF de <b>${escHtml(proveedor)}</b>:\n<code>${escHtml(rifSugerido)}</code>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Usar este', callback_data: `${PREFIX_NOTA_ENTREGA_COMPRADOR}rok` },
              { text: '✏️ Escribir', callback_data: `${PREFIX_NOTA_ENTREGA_COMPRADOR}rw` },
            ],
          ],
        },
      },
    );
    return;
  }
  await setPaso(supabase, chatId, pendingId, 'rif_escribir');
  await sendTelegramMessage(chatId, `Escribe el RIF de <b>${escHtml(proveedor)}</b>.`, {
    parse_mode: 'HTML',
  });
}

async function enviarPickerEntidad(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
): Promise<void> {
  const entidades = await listarEntidadesNotaEntrega(supabase);
  await setPaso(supabase, chatId, pendingId, 'entidad');
  if (!entidades.length) {
    await sendTelegramMessage(chatId, 'No hay entidades. Avisa a Luis.', { parse_mode: 'HTML' });
    return;
  }
  const buttons = entidades.map((e) => [
    { text: truncar(e.nombre), callback_data: `${PREFIX_NOTA_ENTREGA_COMPRADOR}e:${e.id}` },
  ]);
  await sendTelegramMessage(chatId, 'Entidad:', {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons },
  });
}

async function enviarPickerObra(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
  entidadId: string,
  entidadNombre: string,
  page = 0,
): Promise<void> {
  const obras = await listarObrasActivasEntidad(supabase, entidadId);
  await setPaso(supabase, chatId, pendingId, 'obra', { entidad_id: entidadId, entidad_nombre: entidadNombre });
  if (!obras.length) {
    await sendTelegramMessage(
      chatId,
      `Entidad <b>${escHtml(entidadNombre)}</b> no tiene obras activas.`,
      { parse_mode: 'HTML' },
    );
    return;
  }
  const totalPages = Math.max(1, Math.ceil(obras.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = obras.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((o) => [
    { text: truncar(o.nombre), callback_data: `${PREFIX_NOTA_ENTREGA_COMPRADOR}o:${o.id}` },
  ]);
  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX_NOTA_ENTREGA_COMPRADOR}op:${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX_NOTA_ENTREGA_COMPRADOR}op:${safePage}` });
    if (safePage < totalPages - 1) {
      nav.push({ text: '▶', callback_data: `${PREFIX_NOTA_ENTREGA_COMPRADOR}op:${safePage + 1}` });
    }
    buttons.push(nav);
  }
  await sendTelegramMessage(chatId, `Obra (${escHtml(entidadNombre)}):`, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons },
  });
}

async function cerrarFlujoCompleto(supabase: SupabaseClient, chatId: string): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'menu',
    pending_factura_id: null,
    metadata: {},
    reemplazarMetadata: true,
  });
  await sendTelegramMessage(chatId, 'Listo. Luis cargará los precios.', { parse_mode: 'HTML' });
}

async function aplicarProveedorYSeguir(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
  nombre: string,
  rifOpcion: string | null,
): Promise<void> {
  const row = await leerPendiente(supabase, pendingId);
  if (!row) {
    await sendTelegramMessage(chatId, 'No encontré la nota.', { parse_mode: 'HTML' });
    return;
  }
  const extracted = { ...row.extracted, supplier_name: nombre };
  const rifMemoria = rifOpcion || (await rifDesdeMemoriaPorNombre(supabase, nombre));
  await guardarPendiente(supabase, pendingId, { extracted });
  await sendTelegramMessage(chatId, `✅ ${escHtml(nombre)}`, { parse_mode: 'HTML' });
  await pedirRif(supabase, chatId, pendingId, nombre, rifMemoria);
}

async function aplicarRifYSeguir(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
  rif: string,
): Promise<void> {
  const row = await leerPendiente(supabase, pendingId);
  if (!row) {
    await sendTelegramMessage(chatId, 'No encontré la nota.', { parse_mode: 'HTML' });
    return;
  }
  await guardarPendiente(supabase, pendingId, {
    extracted: { ...row.extracted, supplier_rif: rif },
  });
  await sendTelegramMessage(chatId, `✅ RIF ${escHtml(rif)}`, { parse_mode: 'HTML' });
  await enviarPickerEntidad(supabase, chatId, pendingId);
}

/**
 * Pide al comprador el siguiente dato que falte (proveedor → RIF → entidad → obra).
 * Si ya está completo, avisa que Luis cargará los precios.
 */
export async function avanzarFlujoNotaEntregaCompradorTelegram(
  supabase: SupabaseClient,
  chatId: string,
  pendingId: string,
): Promise<PasoNotaEntregaComprador> {
  const row = await leerPendiente(supabase, pendingId);
  if (!row) {
    await sendTelegramMessage(chatId, 'No encontré la nota.', { parse_mode: 'HTML' });
    return 'completo';
  }
  const paso = siguientePasoNotaEntregaComprador(row.extracted, row);
  switch (paso) {
    case 'proveedor':
      await enviarPickerProveedor(supabase, chatId, pendingId, row.extracted);
      break;
    case 'rif':
      await pedirRif(
        supabase,
        chatId,
        pendingId,
        texto(row.extracted.supplier_name ?? row.extracted.proveedor) || 'proveedor',
        texto(row.extracted.supplier_rif) || (await rifDesdeMemoriaPorNombre(
          supabase,
          texto(row.extracted.supplier_name ?? row.extracted.proveedor),
        )),
      );
      break;
    case 'entidad':
      await enviarPickerEntidad(supabase, chatId, pendingId);
      break;
    case 'obra': {
      const { data: ent } = await supabase
        .from('ci_entidades')
        .select(SELECT_NOMBRE_ENTIDAD)
        .eq('id', row.entidad_id)
        .maybeSingle();
      await enviarPickerObra(
        supabase,
        chatId,
        pendingId,
        String(row.entidad_id),
        nombreEntidad(ent as EntidadConNombre | null, 'Entidad'),
      );
      break;
    }
    case 'completo':
      await cerrarFlujoCompleto(supabase, chatId);
      break;
  }
  return paso;
}

export async function manejarCallbackNotaEntregaComprador(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!esCallbackNotaEntregaComprador(params.data)) return false;

  const estado = await getTelegramEstado(supabase, params.chatId);
  const pendingId = estado.pending_factura_id;
  if (!pendingId) {
    await answerCallbackQuery(params.callbackId, 'Sin nota pendiente', true);
    return true;
  }

  const data = params.data.slice(PREFIX_NOTA_ENTREGA_COMPRADOR.length);
  const meta = metaDe(estado);

  if (data.startsWith('pp:')) {
    const page = Number(data.slice(3));
    await answerCallbackQuery(params.callbackId);
    const row = await leerPendiente(supabase, pendingId);
    if (row) await enviarPickerProveedor(supabase, params.chatId, pendingId, row.extracted, page);
    return true;
  }

  if (data === 'pw') {
    await answerCallbackQuery(params.callbackId);
    await setPaso(supabase, params.chatId, pendingId, 'proveedor_escribir', {
      proveedores: meta.proveedores,
    });
    await sendTelegramMessage(params.chatId, 'Escribe el proveedor.', { parse_mode: 'HTML' });
    return true;
  }

  if (data.startsWith('p:')) {
    const idx = Number(data.slice(2));
    const opcion = meta.proveedores?.[idx];
    if (!opcion) {
      await answerCallbackQuery(params.callbackId, 'Elige de nuevo', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, opcion.nombre.slice(0, 180));
    await aplicarProveedorYSeguir(supabase, params.chatId, pendingId, opcion.nombre, opcion.rif);
    return true;
  }

  if (data === 'rok') {
    const rif = texto(meta.rif_sugerido);
    if (!rif) {
      await answerCallbackQuery(params.callbackId, 'Escribe el RIF', true);
      await setPaso(supabase, params.chatId, pendingId, 'rif_escribir');
      await sendTelegramMessage(params.chatId, 'Escribe el RIF.', { parse_mode: 'HTML' });
      return true;
    }
    await answerCallbackQuery(params.callbackId, rif.slice(0, 180));
    await aplicarRifYSeguir(supabase, params.chatId, pendingId, rif);
    return true;
  }

  if (data === 'rw') {
    await answerCallbackQuery(params.callbackId);
    await setPaso(supabase, params.chatId, pendingId, 'rif_escribir', {
      rif_sugerido: meta.rif_sugerido,
    });
    await sendTelegramMessage(params.chatId, 'Escribe el RIF.', { parse_mode: 'HTML' });
    return true;
  }

  if (data.startsWith('e:')) {
    const entidadId = data.slice(2).trim();
    const entidades = await listarEntidadesNotaEntrega(supabase);
    const hit = entidades.find((e) => e.id === entidadId);
    if (!hit) {
      await answerCallbackQuery(params.callbackId, 'Entidad no encontrada', true);
      return true;
    }
    await guardarPendiente(supabase, pendingId, { entidad_id: entidadId, proyecto_id: null });
    await answerCallbackQuery(params.callbackId, hit.nombre.slice(0, 180));
    await sendTelegramMessage(params.chatId, `✅ ${escHtml(hit.nombre)}`, { parse_mode: 'HTML' });
    await enviarPickerObra(supabase, params.chatId, pendingId, hit.id, hit.nombre);
    return true;
  }

  if (data.startsWith('op:')) {
    const page = Number(data.slice(3));
    await answerCallbackQuery(params.callbackId);
    const row = await leerPendiente(supabase, pendingId);
    if (!row?.entidad_id) return true;
    const { data: ent } = await supabase
      .from('ci_entidades')
      .select(SELECT_NOMBRE_ENTIDAD)
      .eq('id', row.entidad_id)
      .maybeSingle();
    await enviarPickerObra(
      supabase,
      params.chatId,
      pendingId,
      row.entidad_id,
      nombreEntidad(ent as EntidadConNombre | null, 'Entidad'),
      page,
    );
    return true;
  }

  if (data.startsWith('o:')) {
    const proyectoId = data.slice(2).trim();
    const { data: obra } = await supabase
      .from('ci_proyectos')
      .select('id, nombre, entidad_id')
      .eq('id', proyectoId)
      .maybeSingle();
    if (!obra) {
      await answerCallbackQuery(params.callbackId, 'Obra no encontrada', true);
      return true;
    }
    const patchObra: { proyecto_id: string; entidad_id?: string } = {
      proyecto_id: String(obra.id),
    };
    if (obra.entidad_id) patchObra.entidad_id = String(obra.entidad_id);
    await guardarPendiente(supabase, pendingId, patchObra);
    await answerCallbackQuery(params.callbackId, String(obra.nombre ?? 'Obra').slice(0, 180));
    await sendTelegramMessage(params.chatId, `✅ ${escHtml(String(obra.nombre ?? 'Obra'))}`, {
      parse_mode: 'HTML',
    });
    await cerrarFlujoCompleto(supabase, params.chatId);
    return true;
  }

  return false;
}

export async function manejarTextoNotaEntregaComprador(
  supabase: SupabaseClient,
  chatId: string,
  textoIn: string,
): Promise<boolean> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esperandoTextoNotaEntregaComprador(estado)) return false;
  const pendingId = estado.pending_factura_id;
  if (!pendingId) return false;

  const paso = String(estado.metadata?.paso ?? '');
  const valor = textoIn.trim();

  if (paso === 'proveedor_escribir') {
    if (valor.length < 2) {
      await sendTelegramMessage(chatId, 'Escribe el proveedor (mín. 2 letras).', {
        parse_mode: 'HTML',
      });
      return true;
    }
    await aplicarProveedorYSeguir(supabase, chatId, pendingId, valor, null);
    return true;
  }

  if (paso === 'rif_escribir') {
    const rif = parsearRifNotaEntrega(valor);
    if (!rif) {
      await sendTelegramMessage(chatId, 'RIF inválido. Ej. <code>J-12345678-9</code>.', {
        parse_mode: 'HTML',
      });
      return true;
    }
    await aplicarRifYSeguir(supabase, chatId, pendingId, rif);
    return true;
  }

  return false;
}
