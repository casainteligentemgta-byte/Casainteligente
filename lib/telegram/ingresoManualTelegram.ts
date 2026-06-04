import type { SupabaseClient } from '@supabase/supabase-js';
import {
  asegurarUbicacionObra,
  etiquetaUbicacionSelector,
  listarUbicacionesParaSelector,
} from '@/lib/almacen/ubicacionesInventario';
import { listarMaterialesObraRecepcion } from '@/lib/almacen/listarMaterialesObraRecepcion';
import { normalizarCodigoUnidad, UNIDADES_MEDIDA_DEFAULT } from '@/lib/almacen/unidadesMedidaDefault';
import {
  crearMaterialParaLineaCompra,
  resolverMaterialParaLineaCompra,
} from '@/lib/almacen/resolverMaterialParaCompra';
import { PROCUREMENT_DOCUMENTS_BUCKET } from '@/lib/almacen/procurementDocumentStorage';
import type { LineaRecepcionCampoInput } from '@/lib/almacen/recepcionCampoTypes';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import type { TelegramEstado } from '@/lib/telegram/estados';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';
import { enviarPickerProyectosTelegram, nombreProyectoTelegram } from '@/lib/telegram/proyectoPicker';

export const FLUJO_INGRESO_MANUAL = 'ingreso_manual';

export type PasoIngresoManual =
  | 'almacen'
  | 'proveedor'
  | 'num_doc'
  | 'material'
  | 'material_nuevo'
  | 'material_nuevo_unidad'
  | 'cantidad'
  | 'mas_lineas'
  | 'foto'
  | 'observacion'
  | 'confirmar';

export type LineaIngresoManualDraft = {
  material_id: string;
  material_nombre: string;
  unidad: string;
  cantidad: number;
};

export type MetadataIngresoManual = {
  flujo?: string;
  paso?: PasoIngresoManual;
  ubicacion_id?: string;
  ubicacion_nombre?: string;
  proveedor_nombre?: string;
  num_doc?: string;
  lineas?: LineaIngresoManualDraft[];
  draft_material_id?: string;
  draft_material_nombre?: string;
  draft_unidad?: string;
  draft_cantidad?: number;
  /** Nombre tecleado antes de elegir unidad (material nuevo). */
  draft_nombre_nuevo?: string;
  soporte_storage_path?: string;
  soporte_file_name?: string;
  soporte_mime_type?: string;
  observaciones?: string;
  telegram_user_id?: string;
  telegram_username?: string | null;
};

const PREFIX = 'im:';
const PAGE_SIZE = 6;
const MIN_PROVEEDOR = 2;

function truncar(s: string, max = 54): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function meta(estado: TelegramEstado): MetadataIngresoManual {
  return (estado.metadata ?? {}) as MetadataIngresoManual;
}

export function esFlujoIngresoManual(estado: TelegramEstado): boolean {
  return meta(estado).flujo === FLUJO_INGRESO_MANUAL && estado.contexto === 'entrada_obra';
}

export function esCallbackIngresoManual(data: string): boolean {
  return data.startsWith(PREFIX);
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
  patch: Partial<MetadataIngresoManual>,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    metadata: { ...meta(estado), ...patch },
  });
}

const MENSAJE_INICIO =
  '📥 <b>Ingreso manual a almacén</b>\n\n' +
  '1️⃣ Elige la obra.\n' +
  '2️⃣ Elige el almacén de ingreso.\n' +
  '3️⃣ Escribe el <b>proveedor</b>.\n' +
  '4️⃣ Nº de nota o referencia.\n' +
  '5️⃣ Material (elige del catálogo o <b>agrega uno nuevo</b>), cantidad y agregar más si hace falta.\n' +
  '6️⃣ Soporte fotográfico (opcional).\n' +
  '7️⃣ Observaciones y confirmar.\n\n' +
  '<code>/cancelar</code> para abortar.';

export async function manejarComandoIngresoManualTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  await setTelegramContexto(supabase, chatId, {
    contexto: 'entrada_obra',
    proyecto_id: null,
    pending_factura_id: null,
    metadata: { flujo: FLUJO_INGRESO_MANUAL, paso: 'almacen', lineas: [] },
  });
  await sendTelegramMessage(chatId, MENSAJE_INICIO, { parse_mode: 'HTML' });
  await enviarPickerProyectosTelegram(supabase, chatId, 'ingreso_manual');
}

export async function prepararIngresoManualTrasObra(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
): Promise<void> {
  const nombre = (await nombreProyectoTelegram(supabase, proyectoId)) ?? 'Obra';
  await asegurarUbicacionObra(supabase, proyectoId, nombre);
  await setTelegramContexto(supabase, chatId, {
    contexto: 'entrada_obra',
    proyecto_id: proyectoId,
    pending_factura_id: null,
    metadata: { flujo: FLUJO_INGRESO_MANUAL, paso: 'almacen', lineas: [] },
  });
  await enviarPickerAlmacenIngresoManual(supabase, chatId, proyectoId, nombre);
}

async function enviarPickerAlmacenIngresoManual(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
  nombreObra: string,
  page = 0,
): Promise<void> {
  const ubicaciones = await listarUbicacionesParaSelector(supabase, {
    proyectoId,
    soloAlmacenes: true,
  });

  if (!ubicaciones.length) {
    await sendTelegramMessage(
      chatId,
      '⚠️ No hay almacenes configurados para esta obra. Créalos en la app web.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const totalPages = Math.max(1, Math.ceil(ubicaciones.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = ubicaciones.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const byId = new Map(ubicaciones.map((u) => [u.id, u]));

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
        callback_data: `${PREFIX}ub:${u.id}`,
      },
    ];
  });

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX}ubp:${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX}ubp:${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX}ubp:${safePage + 1}` });
    buttons.push(nav);
  }

  await sendTelegramMessage(
    chatId,
    `🏭 <b>Elige el almacén de ingreso</b>\nObra: <b>${nombreObra}</b>`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

async function resolverDepositIdDesdeUbicacion(
  supabase: SupabaseClient,
  ubicacionId: string | undefined,
): Promise<string | null> {
  const ubId = ubicacionId?.trim();
  if (!ubId) return null;
  const { data } = await supabase
    .from('inv_ubicaciones')
    .select('deposit_id')
    .eq('id', ubId)
    .maybeSingle();
  return data?.deposit_id ? String(data.deposit_id) : null;
}

async function usarMaterialEnDraft(
  supabase: SupabaseClient,
  chatId: string,
  params: {
    materialId: string;
    nombre: string;
    unidad: string;
    creado?: boolean;
  },
): Promise<void> {
  await patchMeta(supabase, chatId, await getTelegramEstado(supabase, chatId), {
    paso: 'cantidad',
    draft_material_id: params.materialId,
    draft_material_nombre: params.nombre,
    draft_unidad: params.unidad,
    draft_nombre_nuevo: undefined,
  });

  const linkEdit = `${baseUrlApp()}/almacen/editar/${params.materialId}`;
  const extra = params.creado
    ? `\n\nℹ️ Quedó en el catálogo de la obra. Si el nombre tiene un error, corrígelo en la app:\n<a href="${linkEdit}">Editar material</a>`
    : '';

  await sendTelegramMessage(
    chatId,
    `🔢 Indique la <b>cantidad</b> de «${params.nombre}» (${params.unidad}):${extra}`,
    { parse_mode: 'HTML' },
  );
}

async function crearOResolverMaterialObra(
  supabase: SupabaseClient,
  params: {
    proyectoId: string;
    nombre: string;
    unidad: string;
    ubicacionId?: string;
  },
): Promise<{ id: string; nombre: string; unidad: string; creado: boolean }> {
  const nombre = params.nombre.trim();
  const unidad = normalizarCodigoUnidad(params.unidad);

  const existente = await resolverMaterialParaLineaCompra(supabase, {
    description: nombre,
    proyectoId: params.proyectoId,
  });
  if (existente) {
    const { data: row } = await supabase
      .from('global_inventory')
      .select('unit')
      .eq('id', existente.id)
      .maybeSingle();
    return {
      id: existente.id,
      nombre: existente.name,
      unidad: String(row?.unit ?? unidad).trim() || unidad,
      creado: false,
    };
  }

  const depositId = await resolverDepositIdDesdeUbicacion(supabase, params.ubicacionId);
  const hoy = new Date().toISOString().slice(0, 10);
  const id = await crearMaterialParaLineaCompra(supabase, {
    descripcion: nombre,
    unidad,
    precio_unitario: 0,
    fecha: hoy,
    proyectoId: params.proyectoId,
    depositId,
  });

  return { id, nombre, unidad, creado: true };
}

function botonAgregarMaterialNuevo(): { text: string; callback_data: string } {
  return { text: '➕ Agregar material nuevo', callback_data: `${PREFIX}mat:nuevo` };
}

async function enviarPickerUnidadMaterialNuevo(
  supabase: SupabaseClient,
  chatId: string,
  nombreMaterial: string,
): Promise<void> {
  await patchMeta(
    supabase,
    chatId,
    await getTelegramEstado(supabase, chatId),
    { paso: 'material_nuevo_unidad', draft_nombre_nuevo: nombreMaterial },
  );

  const comunes = UNIDADES_MEDIDA_DEFAULT.slice(0, 8);
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let i = 0; i < comunes.length; i += 2) {
    const par = comunes.slice(i, i + 2).map((u) => ({
      text: `${u.code} · ${u.name}`,
      callback_data: `${PREFIX}uni:${u.code}`,
    }));
    rows.push(par);
  }
  rows.push([{ text: '✏️ Otra unidad (escribir)', callback_data: `${PREFIX}uni:custom` }]);

  await sendTelegramMessage(
    chatId,
    `🧱 Material: <b>${nombreMaterial}</b>\n\nElige la <b>unidad de medida</b>:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } },
  );
}

async function enviarPickerMaterialIngresoManual(
  supabase: SupabaseClient,
  chatId: string,
  proyectoId: string,
  page = 0,
): Promise<void> {
  const materiales = await listarMaterialesObraRecepcion(supabase, proyectoId);

  if (!materiales.length) {
    await patchMeta(supabase, chatId, await getTelegramEstado(supabase, chatId), { paso: 'material' });
    await sendTelegramMessage(
      chatId,
      '🧱 <b>Sin materiales en el catálogo</b>\n\n' +
        'Puedes <b>agregar uno nuevo</b> desde aquí (nombre + unidad) ' +
        'y corregir el texto después en la app web.',
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[botonAgregarMaterialNuevo()]] } },
    );
    return;
  }

  const totalPages = Math.max(1, Math.ceil(materiales.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = materiales.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const buttons: Array<Array<{ text: string; callback_data: string }>> = slice.map((m) => [
    {
      text: truncar(m.sap_code ? `${m.name} (${m.sap_code})` : m.name),
      callback_data: `${PREFIX}mat:${m.id}`,
    },
  ]);

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) nav.push({ text: '◀', callback_data: `${PREFIX}matp:${safePage - 1}` });
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${PREFIX}matp:${safePage}` });
    if (safePage < totalPages - 1) nav.push({ text: '▶', callback_data: `${PREFIX}matp:${safePage + 1}` });
    buttons.push(nav);
  }

  buttons.push([botonAgregarMaterialNuevo()]);

  await sendTelegramMessage(
    chatId,
    '🧱 <b>Elige el material</b> de la construcción:',
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

async function preguntarMasLineas(supabase: SupabaseClient, chatId: string, nLineas: number): Promise<void> {
  await patchMeta(
    supabase,
    chatId,
    await getTelegramEstado(supabase, chatId),
    { paso: 'mas_lineas' },
  );
  await sendTelegramMessage(
    chatId,
    `✅ Material agregado (${nLineas} línea(s) en total).\n\n¿Agregar <b>otro material</b>?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '➕ Agregar otro material', callback_data: `${PREFIX}mas:si` },
            { text: '✔ Continuar', callback_data: `${PREFIX}mas:no` },
          ],
        ],
      },
    },
  );
}

async function preguntarFotoOpcional(supabase: SupabaseClient, chatId: string): Promise<void> {
  await patchMeta(
    supabase,
    chatId,
    await getTelegramEstado(supabase, chatId),
    { paso: 'foto' },
  );
  await sendTelegramMessage(
    chatId,
    '📷 <b>Soporte fotográfico</b> (opcional)\nEnvía la foto de la nota o comprobante.',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '⏭ Omitir foto', callback_data: `${PREFIX}foto:skip` }]],
      },
    },
  );
}

function resumenLineas(lineas: LineaIngresoManualDraft[]): string {
  return lineas
    .map((l, i) => `${i + 1}. ${l.material_nombre} × ${l.cantidad} ${l.unidad}`)
    .join('\n');
}

async function enviarConfirmacion(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const m = meta(estado);
  const lineas = m.lineas ?? [];
  await patchMeta(supabase, chatId, estado, { paso: 'confirmar' });

  const texto =
    '📋 <b>Confirmar ingreso manual</b>\n\n' +
    `🏭 Almacén: ${m.ubicacion_nombre ?? '—'}\n` +
    `🏢 Proveedor: ${m.proveedor_nombre ?? '—'}\n` +
    `📄 Nota/ref.: ${m.num_doc ?? 'S/N'}\n\n` +
    resumenLineas(lineas) +
    (m.observaciones?.trim() ? `\n\n📝 ${m.observaciones.trim()}` : '') +
    (m.soporte_storage_path ? '\n\n📷 Con soporte fotográfico' : '');

  await sendTelegramMessage(chatId, texto, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{ text: '✅ Registrar ingreso', callback_data: `${PREFIX}conf:ok` }]],
    },
  });
}

async function finalizarLineaDraft(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const m = meta(estado);
  if (!m.draft_material_id || !m.draft_cantidad || !m.draft_material_nombre) {
    await sendTelegramMessage(chatId, '❌ Línea incompleta.', { parse_mode: 'HTML' });
    return;
  }

  const linea: LineaIngresoManualDraft = {
    material_id: m.draft_material_id,
    material_nombre: m.draft_material_nombre,
    unidad: m.draft_unidad ?? 'UND',
    cantidad: m.draft_cantidad,
  };

  const lineas = [...(m.lineas ?? []), linea];
  await patchMeta(supabase, chatId, estado, {
    paso: 'mas_lineas',
    lineas,
    draft_material_id: undefined,
    draft_material_nombre: undefined,
    draft_unidad: undefined,
    draft_cantidad: undefined,
  });
  await preguntarMasLineas(supabase, chatId, lineas.length);
}

async function registrarIngresoManual(
  supabase: SupabaseClient,
  params: {
    proyectoId: string;
    ubicacionId: string;
    proveedorNombre: string;
    numDoc: string;
    lineas: LineaIngresoManualDraft[];
    observaciones?: string;
    soporteStoragePath?: string;
    soporteFileName?: string;
    soporteMimeType?: string;
    telegramUserId?: string;
  },
): Promise<{ ok: true; recepcionId: string } | { ok: false; error: string }> {
  const lineasRpc: LineaRecepcionCampoInput[] = params.lineas.map((l) => ({
    material_id: l.material_id,
    cantidad: l.cantidad,
    unidad: l.unidad,
    descripcion: l.material_nombre,
    observaciones: 'Origen: ingreso manual (Telegram)',
  }));

  const { data: recepcionId, error: rpcErr } = await supabase.rpc('ci_registrar_ingreso_manual_campo', {
    p_proyecto_id: params.proyectoId,
    p_ubicacion_id: params.ubicacionId,
    p_proveedor_id: null,
    p_tipo: 'nota_entrega',
    p_num_doc: params.numDoc.trim() || 'S/N',
    p_lineas: lineasRpc,
    p_usuario_id: null,
  } as never);

  if (rpcErr) {
    return { ok: false, error: rpcErr.message ?? 'Error al registrar ingreso' };
  }

  const id = String(recepcionId ?? '');
  if (!id) {
    return { ok: false, error: 'No se obtuvo ID de recepción.' };
  }

  const obsParts = ['Origen: ingreso manual (Telegram)'];
  if (params.observaciones?.trim()) obsParts.push(params.observaciones.trim());
  if (params.telegramUserId) obsParts.push(`Telegram user: ${params.telegramUserId}`);

  const patch: Record<string, unknown> = {
    proveedor_nombre: params.proveedorNombre.trim(),
    observaciones: obsParts.join('\n'),
  };
  if (params.soporteStoragePath?.trim()) {
    patch.soporte_storage_path = params.soporteStoragePath.trim();
    patch.soporte_file_name = params.soporteFileName?.trim() || null;
    patch.soporte_mime_type = params.soporteMimeType?.trim() || null;
  }

  await supabase.from('ci_recepciones_campo').update(patch as never).eq('id', id);

  return { ok: true, recepcionId: id };
}

export async function manejarCallbackIngresoManual(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string },
): Promise<boolean> {
  if (!params.data.startsWith(PREFIX)) return false;

  const estado = await getTelegramEstado(supabase, params.chatId);
  if (!esFlujoIngresoManual(estado)) return false;

  const proyectoId = estado.proyecto_id;
  if (!proyectoId) {
    await answerCallbackQuery(params.callbackId, 'Elige la obra primero', true);
    return true;
  }

  const m = meta(estado);
  const data = params.data.slice(PREFIX.length);
  const nombreObra = (await nombreProyectoTelegram(supabase, proyectoId)) ?? 'Obra';

  if (data.startsWith('ubp:')) {
    const page = Number(data.slice(4));
    await answerCallbackQuery(params.callbackId);
    await enviarPickerAlmacenIngresoManual(supabase, params.chatId, proyectoId, nombreObra, page);
    return true;
  }

  if (data.startsWith('ub:')) {
    const ubicacionId = data.slice(3);
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
    await patchMeta(supabase, params.chatId, estado, {
      paso: 'proveedor',
      ubicacion_id: ubicacionId,
      ubicacion_nombre: String(ubi.nombre),
    });
    await sendTelegramMessage(
      params.chatId,
      `✅ Almacén: <b>${ubi.nombre}</b>\n\n✏️ Escribe el <b>nombre del proveedor</b>:`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (data.startsWith('matp:')) {
    const page = Number(data.slice(5));
    await answerCallbackQuery(params.callbackId);
    await enviarPickerMaterialIngresoManual(supabase, params.chatId, proyectoId, page);
    return true;
  }

  if (data === 'mat:nuevo') {
    await answerCallbackQuery(params.callbackId);
    await patchMeta(supabase, params.chatId, estado, { paso: 'material_nuevo' });
    await sendTelegramMessage(
      params.chatId,
      '✏️ Escribe el <b>nombre del material</b> (mín. 2 caracteres).\n' +
        '<i>Podrás corregirlo después en Almacén → editar material en la app.</i>',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (data.startsWith('uni:')) {
    const codigoUnidad = data.slice(4);
    if (codigoUnidad === 'custom') {
      await answerCallbackQuery(params.callbackId);
      await patchMeta(supabase, params.chatId, estado, { paso: 'material_nuevo_unidad' });
      await sendTelegramMessage(
        params.chatId,
        '✏️ Escribe la unidad (ej. <code>UND</code>, <code>M2</code>, <code>SAC</code>):',
        { parse_mode: 'HTML' },
      );
      return true;
    }

    const nombreNuevo = m.draft_nombre_nuevo?.trim();
    if (!nombreNuevo) {
      await answerCallbackQuery(params.callbackId, 'Escribe el material primero', true);
      return true;
    }

    await answerCallbackQuery(params.callbackId, codigoUnidad);
    try {
      const material = await crearOResolverMaterialObra(supabase, {
        proyectoId,
        nombre: nombreNuevo,
        unidad: codigoUnidad,
        ubicacionId: m.ubicacion_id,
      });
      await usarMaterialEnDraft(supabase, params.chatId, {
        materialId: material.id,
        nombre: material.nombre,
        unidad: material.unidad,
        creado: material.creado,
      });
    } catch (err) {
      await sendTelegramMessage(
        params.chatId,
        `❌ ${err instanceof Error ? err.message : 'No se pudo crear el material'}`,
        { parse_mode: 'HTML' },
      );
    }
    return true;
  }

  if (data.startsWith('mat:')) {
    const materialId = data.slice(4);
    const materiales = await listarMaterialesObraRecepcion(supabase, proyectoId);
    const hit = materiales.find((x) => x.id === materialId);
    if (!hit) {
      await answerCallbackQuery(params.callbackId, 'Material no encontrado', true);
      return true;
    }
    await answerCallbackQuery(params.callbackId, truncar(hit.name, 40));
    await patchMeta(supabase, params.chatId, estado, {
      paso: 'cantidad',
      draft_material_id: hit.id,
      draft_material_nombre: hit.name,
      draft_unidad: hit.unit,
    });
    await sendTelegramMessage(
      params.chatId,
      `🔢 Indique la <b>cantidad</b> de «${hit.name}» (${hit.unit}):`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (data === 'mas:si') {
    await answerCallbackQuery(params.callbackId);
    await patchMeta(supabase, params.chatId, estado, { paso: 'material' });
    await enviarPickerMaterialIngresoManual(supabase, params.chatId, proyectoId);
    return true;
  }

  if (data === 'mas:no') {
    await answerCallbackQuery(params.callbackId);
    const lineas = m.lineas ?? [];
    if (!lineas.length) {
      await sendTelegramMessage(
        params.chatId,
        '⚠️ Agregue al menos un material antes de continuar.',
        { parse_mode: 'HTML' },
      );
      return true;
    }
    await preguntarFotoOpcional(supabase, params.chatId);
    return true;
  }

  if (data === 'foto:skip') {
    await answerCallbackQuery(params.callbackId);
    await patchMeta(supabase, params.chatId, estado, { paso: 'observacion' });
    await sendTelegramMessage(
      params.chatId,
      '📝 Escriba <b>observaciones</b> (opcional; envíe <code>-</code> para omitir):',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (data === 'conf:ok') {
    await answerCallbackQuery(params.callbackId, 'Procesando…');
    const fresh = await getTelegramEstado(supabase, params.chatId);
    const fm = meta(fresh);
    const lineas = fm.lineas ?? [];
    if (!lineas.length || !fm.ubicacion_id || !fm.proveedor_nombre) {
      await sendTelegramMessage(params.chatId, '❌ Ingreso incompleto.', { parse_mode: 'HTML' });
      return true;
    }

    const resultado = await registrarIngresoManual(supabase, {
      proyectoId,
      ubicacionId: fm.ubicacion_id,
      proveedorNombre: fm.proveedor_nombre,
      numDoc: fm.num_doc ?? 'S/N',
      lineas,
      observaciones: fm.observaciones,
      soporteStoragePath: fm.soporte_storage_path,
      soporteFileName: fm.soporte_file_name,
      soporteMimeType: fm.soporte_mime_type,
      telegramUserId: fm.telegram_user_id,
    });

    await setTelegramContexto(supabase, params.chatId, {
      contexto: 'menu',
      pending_factura_id: null,
      metadata: {},
    });

    if (!resultado.ok) {
      await sendTelegramMessage(params.chatId, `❌ ${resultado.error}`, { parse_mode: 'HTML' });
      return true;
    }

    const link = `${baseUrlApp()}/almacen/movimientos?vista=ingresos`;
    await sendTelegramMessage(
      params.chatId,
      `✅ <b>Ingreso manual registrado</b>\n\n` +
        `🏭 ${fm.ubicacion_nombre ?? 'Almacén'}\n` +
        `🏢 ${fm.proveedor_nombre}\n` +
        `📄 ${fm.num_doc ?? 'S/N'}\n` +
        `📦 ${lineas.length} material(es)\n\n` +
        `<a href="${link}">Ver movimientos</a>`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  return false;
}

export async function manejarTextoIngresoManual(
  supabase: SupabaseClient,
  chatId: string,
  texto: string,
  userId?: string,
  username?: string | null,
): Promise<boolean> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esFlujoIngresoManual(estado)) return false;

  const paso = meta(estado).paso;
  const trimmed = texto.trim();

  if (paso === 'proveedor') {
    if (trimmed.length < MIN_PROVEEDOR) {
      await sendTelegramMessage(
        chatId,
        `✏️ El proveedor es obligatorio (mín. ${MIN_PROVEEDOR} caracteres).`,
        { parse_mode: 'HTML' },
      );
      return true;
    }
    await patchMeta(supabase, chatId, estado, {
      paso: 'num_doc',
      proveedor_nombre: trimmed,
      telegram_user_id: userId,
      telegram_username: username ?? null,
    });
    await sendTelegramMessage(
      chatId,
      `🏢 Proveedor: <b>${trimmed}</b>\n\n📄 Escriba el <b>Nº de nota</b> o referencia (use <code>S/N</code> si no aplica):`,
      { parse_mode: 'HTML' },
    );
    return true;
  }

  if (paso === 'num_doc') {
    const numDoc = trimmed || 'S/N';
    await patchMeta(supabase, chatId, estado, { paso: 'material', num_doc: numDoc });
    await sendTelegramMessage(
      chatId,
      `📄 Referencia: <b>${numDoc}</b>\n\nElige el primer material:`,
      { parse_mode: 'HTML' },
    );
    if (estado.proyecto_id) {
      await enviarPickerMaterialIngresoManual(supabase, chatId, estado.proyecto_id);
    }
    return true;
  }

  if (paso === 'material_nuevo') {
    if (trimmed.length < 2) {
      await sendTelegramMessage(
        chatId,
        'Nombre muy corto. Escribe al menos 2 caracteres (ej. <code>Cemento gris</code>).',
        { parse_mode: 'HTML' },
      );
      return true;
    }
    if (!estado.proyecto_id) return true;
    await enviarPickerUnidadMaterialNuevo(supabase, chatId, trimmed);
    return true;
  }

  if (paso === 'material_nuevo_unidad') {
    const unidad = normalizarCodigoUnidad(trimmed);
    const nombreNuevo = meta(estado).draft_nombre_nuevo?.trim();
    if (!nombreNuevo || !estado.proyecto_id) {
      await sendTelegramMessage(chatId, '❌ Reinicia el material. Elige de nuevo «Agregar material nuevo».', {
        parse_mode: 'HTML',
      });
      return true;
    }
    try {
      const material = await crearOResolverMaterialObra(supabase, {
        proyectoId: estado.proyecto_id,
        nombre: nombreNuevo,
        unidad,
        ubicacionId: meta(estado).ubicacion_id,
      });
      await usarMaterialEnDraft(supabase, chatId, {
        materialId: material.id,
        nombre: material.nombre,
        unidad: material.unidad,
        creado: material.creado,
      });
    } catch (err) {
      await sendTelegramMessage(
        chatId,
        `❌ ${err instanceof Error ? err.message : 'No se pudo crear el material'}`,
        { parse_mode: 'HTML' },
      );
    }
    return true;
  }

  if (paso === 'cantidad') {
    const qty = Number(trimmed.replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) {
      await sendTelegramMessage(chatId, 'Cantidad inválida. Escriba un número mayor a cero.', {
        parse_mode: 'HTML',
      });
      return true;
    }
    await patchMeta(supabase, chatId, estado, { draft_cantidad: qty });
    await finalizarLineaDraft(supabase, chatId, await getTelegramEstado(supabase, chatId));
    return true;
  }

  if (paso === 'observacion') {
    const obs = trimmed === '-' ? '' : trimmed;
    await patchMeta(supabase, chatId, estado, {
      paso: 'confirmar',
      observaciones: obs,
      telegram_user_id: userId ?? meta(estado).telegram_user_id,
      telegram_username: username ?? meta(estado).telegram_username,
    });
    await enviarConfirmacion(supabase, chatId, await getTelegramEstado(supabase, chatId));
    return true;
  }

  if (paso === 'foto') {
    await sendTelegramMessage(
      chatId,
      'Envíe la foto o pulse <b>Omitir foto</b> en el mensaje anterior.',
      { parse_mode: 'HTML' },
    );
    return true;
  }

  return false;
}

export async function manejarFotoIngresoManual(params: {
  supabase: SupabaseClient;
  chatId: string;
  userId: string;
  username?: string | null;
  buffer: Buffer;
  mimeType: string;
  ext: string;
  fileName?: string;
  caption?: string;
}): Promise<boolean> {
  const estado = await getTelegramEstado(params.supabase, params.chatId);
  if (!esFlujoIngresoManual(estado)) return false;

  const paso = meta(estado).paso;
  if (paso !== 'foto' && paso !== 'observacion') return false;
  if (!estado.proyecto_id) return false;

  const storagePath = `recepciones-campo/telegram-${params.chatId}/${Date.now()}.${params.ext}`;
  const { error } = await params.supabase.storage
    .from(PROCUREMENT_DOCUMENTS_BUCKET)
    .upload(storagePath, params.buffer, { contentType: params.mimeType, upsert: false });

  if (error) {
    await sendTelegramMessage(params.chatId, '❌ No se pudo guardar la foto.', { parse_mode: 'HTML' });
    return true;
  }

  await patchMeta(params.supabase, params.chatId, estado, {
    soporte_storage_path: storagePath,
    soporte_file_name: params.fileName ?? `telegram-soporte.${params.ext}`,
    soporte_mime_type: params.mimeType,
    telegram_user_id: params.userId,
    telegram_username: params.username ?? null,
    paso: 'observacion',
    observaciones: params.caption?.trim() || meta(estado).observaciones,
  });

  await sendTelegramMessage(
    params.chatId,
    '✅ Soporte fotográfico guardado.\n\n📝 Escriba <b>observaciones</b> (opcional; <code>-</code> para omitir):',
    { parse_mode: 'HTML' },
  );
  return true;
}

export function esComandoIngresoManual(texto: string): boolean {
  const t = texto.trim().toLowerCase().split(/\s+/)[0]?.split('@')[0] ?? '';
  return t === '/ingresomanual' || t === '/entrada';
}
