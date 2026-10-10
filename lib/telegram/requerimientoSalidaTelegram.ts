import type { SupabaseClient } from '@supabase/supabase-js';
import { listarStockUbicacionEgreso } from '@/lib/almacen/registrarEgresoCampo';
import {
  ETIQUETA_TIPO_REQUERIMIENTO,
  TIPOS_REQUERIMIENTO_SALIDA,
  crearRequerimientoSalida,
  despacharRequerimientoSalida,
  esTipoRequerimientoSalida,
  obtenerRequerimientoSalida,
  rechazarRequerimientoSalida,
  requerimientoEsperandoFoto,
  requerimientosSalidaDisponibles,
  soltarRequerimientoSalida,
  tomarRequerimientoSalida,
  type RequerimientoSalida,
  type TipoRequerimientoSalida,
} from '@/lib/almacen/requerimientoSalida';
import {
  chatIdsDesdeDestinatarios,
  resolverDestinatariosCuarentenaTelegram,
} from '@/lib/almacen/resolverDestinatariosCuarentenaTelegram';
import { listarUbicacionesParaSelector } from '@/lib/almacen/ubicacionesInventario';
import { esUuidProcura } from '@/lib/compras/telegramMetadata';
import { depositariosNomina, personasNominaConRol } from '@/lib/almacen/depositariosNomina';
import { resolverNombreMostrarTelegram } from '@/lib/procuras/resolverNombreTelegramObra';
import { answerCallbackQuery, sendTelegramMessage } from '@/lib/telegram/botApi';
import type { TelegramEstado } from '@/lib/telegram/estados';
import { getTelegramEstado, setTelegramContexto } from '@/lib/telegram/estados';

/**
 * Requerimiento de salida de almacén, lado Telegram.
 *
 * Quien necesita material (/salida → «Pedir material al almacén»):
 *   obra → almacén → material con stock → cantidad → motivo de salida → para qué → enviar.
 * El almacén de esa obra recibe la solicitud con «Despachar» y «Rechazar».
 *   Despachar → queda a su nombre → envía la foto del material → se mueve el stock.
 *
 * La foto la toma quien entrega; quien pide no puede despachar su propia solicitud.
 */

export const FLUJO_REQUERIMIENTO_SALIDA = 'requerimiento_salida';

const PREFIX = 'rq:';
const CB_OBRA = `${PREFIX}o:`;
const CB_ALMACEN = `${PREFIX}a:`;
const CB_MATERIAL = `${PREFIX}m:`;
const CB_MATERIAL_PAGINA = `${PREFIX}mp:`;
const CB_TIPO = `${PREFIX}t:`;
const CB_DESTINO = `${PREFIX}d:`;
const CB_ENVIAR = `${PREFIX}ok`;
const CB_CANCELAR = `${PREFIX}x`;
const CB_DESPACHAR = `${PREFIX}dk:`;
const CB_SOLTAR = `${PREFIX}sl:`;
const CB_RECHAZAR = `${PREFIX}rj:`;
const CB_RECHAZO_MOTIVO = `${PREFIX}rm:`;

const MATERIALES_POR_PAGINA = 6;
const MAX_BOTONES_LISTA = 20;
const BUCKET_FOTOS = 'ci-proyectos-media';

/** Motivos de rechazo que ofrece el bot (el índice viaja en el botón). */
export const MOTIVOS_RECHAZO_REQUERIMIENTO = [
  'No hay esa cantidad en el almacén',
  'El material está dañado o apartado',
  'Falta autorización para esta salida',
  'Solicitud duplicada o equivocada',
] as const;

type Paso =
  | 'rq_obra'
  | 'rq_almacen'
  | 'rq_material'
  | 'rq_cantidad'
  | 'rq_tipo'
  | 'rq_destino'
  | 'rq_motivo'
  | 'rq_confirmar';

type Metadata = {
  flujo?: string;
  paso?: Paso;
  obra_nombre?: string;
  origen_id?: string;
  origen_nombre?: string;
  material_id?: string;
  material_nombre?: string;
  unidad?: string;
  cantidad?: number;
  tipo?: TipoRequerimientoSalida;
  destino_id?: string;
  destino_nombre?: string;
  motivo?: string;
};

type Boton = { text: string; callback_data: string };

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncar(s: string, max = 56): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function cantidadTexto(n: number): string {
  return n.toLocaleString('es-VE', { maximumFractionDigits: 4 });
}

function meta(estado: TelegramEstado): Metadata {
  return (estado.metadata ?? {}) as Metadata;
}

export function esFlujoRequerimientoSalida(estado: TelegramEstado): boolean {
  return estado.contexto === 'salida_obra' && meta(estado).flujo === FLUJO_REQUERIMIENTO_SALIDA;
}

export function esCallbackRequerimientoSalida(data: string): boolean {
  return data.startsWith(PREFIX);
}

async function patchMeta(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  patch: Partial<Metadata>,
): Promise<TelegramEstado> {
  return setTelegramContexto(supabase, chatId, { metadata: { ...meta(estado), ...patch } });
}

async function cerrarSesion(supabase: SupabaseClient, chatId: string): Promise<void> {
  await setTelegramContexto(supabase, chatId, { contexto: 'menu', proyecto_id: null, metadata: {} });
}

const PIE_CANCELAR = '\n\n<code>/cancelar</code> para abortar.';

// ── Quien pide ──────────────────────────────────────────────────────────────────

type ObraConInventario = { proyectoId: string; nombre: string; ubicacionId: string };

/** Obras que tienen ubicación de inventario activa (a ellas se les puede cargar material). */
async function listarObrasConInventario(supabase: SupabaseClient): Promise<ObraConInventario[]> {
  const { data, error } = await supabase
    .from('inv_ubicaciones')
    .select('id, nombre, ci_proyecto_id')
    .eq('tipo', 'obra')
    .eq('activo', true)
    .order('nombre', { ascending: true });
  if (error) throw new Error(error.message);

  const porProyecto = new Map<string, ObraConInventario>();
  for (const fila of (data ?? []) as Array<Record<string, unknown>>) {
    const proyectoId = fila.ci_proyecto_id ? String(fila.ci_proyecto_id) : '';
    if (!proyectoId || porProyecto.has(proyectoId)) continue;
    porProyecto.set(proyectoId, {
      proyectoId,
      nombre: String(fila.nombre ?? 'Obra').trim() || 'Obra',
      ubicacionId: String(fila.id),
    });
  }
  return Array.from(porProyecto.values());
}

/** Punto de entrada: /salida → «Pedir material al almacén». */
export async function iniciarRequerimientoSalidaTelegram(
  supabase: SupabaseClient,
  chatId: string,
): Promise<void> {
  if (!(await requerimientosSalidaDisponibles(supabase))) {
    await sendTelegramMessage(
      chatId,
      '⚠️ Pedir material al almacén todavía no está activado en la base de datos. Avise al administrador.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const obras = await listarObrasConInventario(supabase);
  if (!obras.length) {
    await sendTelegramMessage(chatId, '❌ No hay obras con inventario configurado.', {
      parse_mode: 'HTML',
    });
    return;
  }

  await setTelegramContexto(supabase, chatId, {
    contexto: 'salida_obra',
    proyecto_id: null,
    metadata: { flujo: FLUJO_REQUERIMIENTO_SALIDA, paso: 'rq_obra' },
    reemplazarMetadata: true,
  });
  await sendTelegramMessage(
    chatId,
    '📝 <b>Pedir material al almacén</b>\n\n' +
      'Usted indica qué necesita y para qué; el almacén lo despacha y toma la foto.\n\n' +
      '1️⃣ ¿Para qué <b>obra</b> es el material?' +
      PIE_CANCELAR,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: obras.slice(0, MAX_BOTONES_LISTA).map((o) => [
          { text: truncar(`🏗 ${o.nombre}`), callback_data: `${CB_OBRA}${o.proyectoId}` },
        ]),
      },
    },
  );
}

async function enviarPickerAlmacen(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  proyectoId: string,
): Promise<void> {
  const ubicaciones = await listarUbicacionesParaSelector(supabase, { proyectoId, soloActivas: true });
  const almacenes = ubicaciones.filter((u) => u.tipo === 'almacen_central' || u.tipo === 'almacen_movil');

  if (!almacenes.length) {
    await cerrarSesion(supabase, chatId);
    await sendTelegramMessage(chatId, '❌ Esta obra no tiene almacenes de donde pedir material.', {
      parse_mode: 'HTML',
    });
    return;
  }
  if (almacenes.length === 1) {
    const unico = almacenes[0];
    const conAlmacen = await patchMeta(supabase, chatId, estado, {
      origen_id: unico.id,
      origen_nombre: unico.nombre,
    });
    await enviarPickerMaterial(supabase, chatId, conAlmacen, 0);
    return;
  }

  await patchMeta(supabase, chatId, estado, { paso: 'rq_almacen' });
  await sendTelegramMessage(chatId, '2️⃣ ¿De qué <b>almacén</b> lo necesita?', {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: almacenes.slice(0, MAX_BOTONES_LISTA).map((u) => [
        { text: truncar(`🏭 ${u.nombre}`), callback_data: `${CB_ALMACEN}${u.id}` },
      ]),
    },
  });
}

async function enviarPickerMaterial(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  pagina: number,
): Promise<void> {
  const origenId = meta(estado).origen_id;
  if (!origenId) return;
  const stock = await listarStockUbicacionEgreso(supabase, origenId);
  if (!stock.length) {
    await cerrarSesion(supabase, chatId);
    await sendTelegramMessage(
      chatId,
      `❌ <b>${escHtml(meta(estado).origen_nombre ?? 'El almacén')}</b> no tiene material disponible.`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  const totalPaginas = Math.max(1, Math.ceil(stock.length / MATERIALES_POR_PAGINA));
  const p = Math.min(Math.max(0, pagina), totalPaginas - 1);
  const filas: Boton[][] = stock
    .slice(p * MATERIALES_POR_PAGINA, (p + 1) * MATERIALES_POR_PAGINA)
    .map((s) => [
      {
        text: truncar(`📦 ${s.nombre} (${cantidadTexto(s.cantidad_disponible)} ${s.unidad})`),
        callback_data: `${CB_MATERIAL}${s.material_id}`,
      },
    ]);
  if (totalPaginas > 1) {
    const nav: Boton[] = [];
    if (p > 0) nav.push({ text: '◀', callback_data: `${CB_MATERIAL_PAGINA}${p - 1}` });
    nav.push({ text: `${p + 1}/${totalPaginas}`, callback_data: `${CB_MATERIAL_PAGINA}${p}` });
    if (p < totalPaginas - 1) nav.push({ text: '▶', callback_data: `${CB_MATERIAL_PAGINA}${p + 1}` });
    filas.push(nav);
  }

  await patchMeta(supabase, chatId, estado, { paso: 'rq_material' });
  await sendTelegramMessage(
    chatId,
    `3️⃣ ¿Qué <b>material</b> necesita de ${escHtml(meta(estado).origen_nombre ?? 'el almacén')}?`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: filas } },
  );
}

async function enviarPickerTipo(supabase: SupabaseClient, chatId: string, estado: TelegramEstado): Promise<void> {
  await patchMeta(supabase, chatId, estado, { paso: 'rq_tipo' });
  await sendTelegramMessage(chatId, '5️⃣ ¿Cuál es el <b>motivo de la salida</b>?', {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: TIPOS_REQUERIMIENTO_SALIDA.map((t) => [
        { text: ETIQUETA_TIPO_REQUERIMIENTO[t], callback_data: `${CB_TIPO}${t}` },
      ]),
    },
  });
}

function preguntaMotivo(tipo: TipoRequerimientoSalida): string {
  switch (tipo) {
    case 'uso':
    case 'colocacion':
      return '6️⃣ Escriba <b>dónde o en qué trabajo</b> se va a usar (ej. «vaciado de losa nivel 2»):';
    case 'traspaso':
      return '6️⃣ Escriba <b>por qué se traspasa</b> y quién lo recibe en la otra obra:';
    case 'devolucion':
      return '6️⃣ Escriba <b>por qué se devuelve</b> al proveedor:';
    case 'deterioro':
      return '6️⃣ Describa <b>qué le pasó</b> al material (dañado, vencido, perdido…):';
  }
}

async function enviarPickerDestino(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const obras = (await listarObrasConInventario(supabase)).filter(
    (o) => o.proyectoId !== estado.proyecto_id,
  );
  if (!obras.length) {
    await sendTelegramMessage(
      chatId,
      '❌ No hay otra obra con inventario a la cual traspasar. Elija otro motivo de salida.',
      { parse_mode: 'HTML' },
    );
    await enviarPickerTipo(supabase, chatId, estado);
    return;
  }
  await patchMeta(supabase, chatId, estado, { paso: 'rq_destino', tipo: 'traspaso' });
  await sendTelegramMessage(chatId, '¿A qué <b>obra</b> se traspasa?', {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: obras.slice(0, MAX_BOTONES_LISTA).map((o) => [
        { text: truncar(`🏗 ${o.nombre}`), callback_data: `${CB_DESTINO}${o.ubicacionId}` },
      ]),
    },
  });
}

/** Resumen del pedido: material, cantidad, motivo, origen y destino. */
export function detallePedido(d: {
  material_nombre: string;
  cantidad: number;
  unidad: string;
  tipo: TipoRequerimientoSalida;
  obra: string | null;
  origen: string | null;
  destino?: string | null;
  motivo: string | null;
}): string {
  return [
    `📦 <b>${escHtml(cantidadTexto(d.cantidad))} ${escHtml(d.unidad)}</b> · ${escHtml(d.material_nombre)}`,
    `🏷 Motivo: <b>${ETIQUETA_TIPO_REQUERIMIENTO[d.tipo]}</b>`,
    d.obra ? `🏗 Obra: ${escHtml(d.obra)}` : null,
    d.origen ? `🏭 Sale de: ${escHtml(d.origen)}` : null,
    d.tipo === 'traspaso' && d.destino ? `➡️ Va a: ${escHtml(d.destino)}` : null,
    d.motivo ? `📝 ${escHtml(d.motivo)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

async function enviarConfirmacion(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
): Promise<void> {
  const m = meta(estado);
  if (!m.material_nombre || !m.cantidad || !m.tipo) return;
  await patchMeta(supabase, chatId, estado, { paso: 'rq_confirmar' });
  await sendTelegramMessage(
    chatId,
    '📋 <b>Revise su pedido</b>\n\n' +
      detallePedido({
        material_nombre: m.material_nombre,
        cantidad: m.cantidad,
        unidad: m.unidad ?? 'UND',
        tipo: m.tipo,
        obra: m.obra_nombre ?? null,
        origen: m.origen_nombre ?? null,
        destino: m.destino_nombre ?? null,
        motivo: m.motivo ?? null,
      }) +
      '\n\n<i>El stock se descuenta cuando el almacén lo despache.</i>',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📨 Enviar al almacén', callback_data: CB_ENVIAR },
            { text: '❌ Cancelar', callback_data: CB_CANCELAR },
          ],
        ],
      },
    },
  );
}

async function nombrePersona(
  supabase: SupabaseClient,
  chatId: string,
  nombreTelegram: string | null | undefined,
  proyectoId: string | null | undefined,
  fallback: string,
): Promise<string> {
  const base = nombreTelegram?.trim() || fallback;
  const id = Number(chatId);
  if (!Number.isFinite(id)) return base;
  try {
    return (await resolverNombreMostrarTelegram(supabase, id, base, proyectoId)) || base;
  } catch {
    return base;
  }
}

/** Si la obra no tiene a nadie de almacén, el pedido no se pierde: lo recibe quien la administra. */
const ROLES_NOMINA_RESPALDO = new Set(['admin', 'administrador']);

/**
 * Quién recibe un pedido de material: el depositario / grupo de almacén de la obra,
 * más quien tenga rol de almacén en la nómina de la obra. Si no hay nadie, los
 * administradores de la obra. Nunca quien hizo el pedido.
 */
async function chatsAlmacen(
  supabase: SupabaseClient,
  proyectoId: string,
  origenUbicacionId: string,
  excluir: string | number | null,
): Promise<string[]> {
  const noEsSolicitante = (c: string) => excluir == null || c !== String(excluir);
  const almacen = await resolverDestinatariosCuarentenaTelegram(supabase, {
    proyectoId,
    ubicacionDestinoId: origenUbicacionId,
  });
  const chats = new Set(chatIdsDesdeDestinatarios(almacen.destinatarios).filter(noEsSolicitante));

  for (const p of await depositariosNomina(supabase, proyectoId)) {
    if (noEsSolicitante(p.chatId)) chats.add(p.chatId);
  }
  if (!chats.size) {
    for (const p of await personasNominaConRol(supabase, proyectoId, ROLES_NOMINA_RESPALDO)) {
      if (noEsSolicitante(p.chatId)) chats.add(p.chatId);
    }
  }
  return Array.from(chats);
}

type ContextoRequerimiento = { obra: string | null; origen: string | null; destino: string | null };

async function cargarContexto(
  supabase: SupabaseClient,
  r: RequerimientoSalida,
): Promise<ContextoRequerimiento> {
  const [obra, origen, destino] = await Promise.all([
    supabase.from('ci_proyectos').select('nombre').eq('id', r.proyecto_id).maybeSingle(),
    supabase.from('inv_ubicaciones').select('nombre').eq('id', r.origen_ubicacion_id).maybeSingle(),
    r.destino_ubicacion_id
      ? supabase.from('inv_ubicaciones').select('nombre').eq('id', r.destino_ubicacion_id).maybeSingle()
      : null,
  ]);
  const txt = (v: unknown) => (v == null ? '' : String(v).trim()) || null;
  return {
    obra: txt(obra.data?.nombre),
    origen: txt(origen.data?.nombre),
    destino: txt(destino?.data?.nombre),
  };
}

function detalleRequerimiento(r: RequerimientoSalida, ctx: ContextoRequerimiento): string {
  return (
    `🎫 <b>${escHtml(r.codigo)}</b>\n` +
    detallePedido({
      material_nombre: r.material_nombre,
      cantidad: r.cantidad,
      unidad: r.unidad,
      tipo: r.tipo,
      obra: ctx.obra,
      origen: ctx.origen,
      destino: ctx.destino,
      motivo: r.motivo,
    }) +
    `\n👷 Pide: <b>${escHtml(r.solicitante_nombre ?? 'Solicitante')}</b>`
  );
}

function tecladoAlmacen(id: string): { inline_keyboard: Boton[][] } {
  return {
    inline_keyboard: [
      [
        { text: '✅ Despachar', callback_data: `${CB_DESPACHAR}${id}` },
        { text: '❌ Rechazar', callback_data: `${CB_RECHAZAR}${id}` },
      ],
    ],
  };
}

async function avisarAlAlmacen(
  supabase: SupabaseClient,
  r: RequerimientoSalida,
  chats: string[],
  cabecera: string,
): Promise<number> {
  const ctx = await cargarContexto(supabase, r);
  let enviados = 0;
  for (const chat of chats) {
    try {
      await sendTelegramMessage(
        chat,
        `${cabecera}\n\n${detalleRequerimiento(r, ctx)}\n\n` +
          'Si lo entrega usted, pulse <b>Despachar</b> y envíe la foto del material.',
        {
          parse_mode: 'HTML',
          reply_markup: tecladoAlmacen(r.id),
          rolDestinatario: 'Depositario',
          contextoLogEspejo: '[Almacén · requerimiento de salida]',
        },
      );
      enviados += 1;
    } catch (e) {
      console.warn('[requerimientoSalida] aviso almacén', chat, e);
    }
  }
  return enviados;
}

async function enviarPedido(
  supabase: SupabaseClient,
  chatId: string,
  estado: TelegramEstado,
  nombreTelegram: string | null | undefined,
): Promise<void> {
  const m = meta(estado);
  const proyectoId = estado.proyecto_id;
  if (!proyectoId || !m.origen_id || !m.material_id || !m.material_nombre || !m.cantidad || !m.tipo) {
    await cerrarSesion(supabase, chatId);
    await sendTelegramMessage(chatId, '❌ Pedido incompleto. Empiece de nuevo con /salida.', {
      parse_mode: 'HTML',
    });
    return;
  }

  // Sin nadie que despache, el pedido quedaría colgado: mejor avisarlo antes de crearlo.
  const chats = await chatsAlmacen(supabase, proyectoId, m.origen_id, chatId);
  if (!chats.length) {
    await cerrarSesion(supabase, chatId);
    await sendTelegramMessage(
      chatId,
      '❌ No se envió: esta obra no tiene a nadie más con Telegram para despachar.\n' +
        'En la web, entre a la obra → Nómina y asigne a alguien el rol <b>Depositario</b>.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const creado = await crearRequerimientoSalida(supabase, {
    proyectoId,
    origenUbicacionId: m.origen_id,
    destinoUbicacionId: m.destino_id,
    tipo: m.tipo,
    materialId: m.material_id,
    materialNombre: m.material_nombre,
    unidad: m.unidad ?? 'UND',
    cantidad: m.cantidad,
    motivo: m.motivo,
    solicitanteChatId: chatId,
    solicitanteNombre: await nombrePersona(supabase, chatId, nombreTelegram, proyectoId, 'Solicitante'),
  });
  await cerrarSesion(supabase, chatId);

  if (!creado.ok) {
    await sendTelegramMessage(
      chatId,
      creado.motivo === 'sin_migracion'
        ? '⚠️ Pedir material al almacén todavía no está activado en la base de datos.'
        : `❌ No se pudo registrar el pedido. ${escHtml(creado.error ?? '')}`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  const enviados = await avisarAlAlmacen(
    supabase,
    creado.requerimiento,
    chats,
    '📝 <b>Requerimiento de salida</b>',
  );
  await sendTelegramMessage(
    chatId,
    `✅ <b>Pedido enviado al almacén</b>\n\n🎫 <b>${escHtml(creado.requerimiento.codigo)}</b>\n` +
      (enviados > 0
        ? 'Le avisaré cuando lo despachen o si lo rechazan.'
        : '⚠️ No pude avisar a nadie del almacén por Telegram. Avíseles usted.'),
    { parse_mode: 'HTML' },
  );
}

async function manejarCallbackSolicitante(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string; nombre?: string | null },
): Promise<void> {
  const { chatId, callbackId, data } = params;
  const estado = await getTelegramEstado(supabase, chatId);

  if (data === CB_CANCELAR) {
    await answerCallbackQuery(callbackId);
    if (esFlujoRequerimientoSalida(estado)) await cerrarSesion(supabase, chatId);
    await sendTelegramMessage(chatId, '❌ Pedido cancelado.', { parse_mode: 'HTML' });
    return;
  }

  if (!esFlujoRequerimientoSalida(estado)) {
    await answerCallbackQuery(callbackId, 'Este pedido ya no está abierto. Use /salida.', true);
    return;
  }
  const m = meta(estado);

  if (data.startsWith(CB_OBRA)) {
    const proyectoId = data.slice(CB_OBRA.length);
    const obra = (await listarObrasConInventario(supabase)).find((o) => o.proyectoId === proyectoId);
    if (!obra) {
      await answerCallbackQuery(callbackId, 'Obra no encontrada', true);
      return;
    }
    await answerCallbackQuery(callbackId, obra.nombre.slice(0, 60));
    const conObra = await setTelegramContexto(supabase, chatId, {
      proyecto_id: proyectoId,
      metadata: { ...m, obra_nombre: obra.nombre },
    });
    await enviarPickerAlmacen(supabase, chatId, conObra, proyectoId);
    return;
  }

  if (data.startsWith(CB_ALMACEN)) {
    const origenId = data.slice(CB_ALMACEN.length);
    const { data: ub } = await supabase.from('inv_ubicaciones').select('nombre').eq('id', origenId).maybeSingle();
    const nombre = String(ub?.nombre ?? 'Almacén').trim() || 'Almacén';
    await answerCallbackQuery(callbackId, nombre.slice(0, 60));
    const conAlmacen = await patchMeta(supabase, chatId, estado, { origen_id: origenId, origen_nombre: nombre });
    await enviarPickerMaterial(supabase, chatId, conAlmacen, 0);
    return;
  }

  if (data.startsWith(CB_MATERIAL_PAGINA)) {
    await answerCallbackQuery(callbackId);
    const pagina = Number(data.slice(CB_MATERIAL_PAGINA.length));
    await enviarPickerMaterial(supabase, chatId, estado, Number.isFinite(pagina) ? pagina : 0);
    return;
  }

  if (data.startsWith(CB_MATERIAL)) {
    const materialId = data.slice(CB_MATERIAL.length);
    const stock = m.origen_id ? await listarStockUbicacionEgreso(supabase, m.origen_id) : [];
    const hit = stock.find((s) => s.material_id === materialId);
    if (!hit) {
      await answerCallbackQuery(callbackId, 'Ese material ya no tiene stock', true);
      return;
    }
    await answerCallbackQuery(callbackId, hit.nombre.slice(0, 60));
    await patchMeta(supabase, chatId, estado, {
      paso: 'rq_cantidad',
      material_id: hit.material_id,
      material_nombre: hit.nombre,
      unidad: hit.unidad,
    });
    await sendTelegramMessage(
      chatId,
      `📦 <b>${escHtml(hit.nombre)}</b>\n` +
        `Disponible: <b>${cantidadTexto(hit.cantidad_disponible)} ${escHtml(hit.unidad)}</b>\n\n` +
        '4️⃣ Escriba la <b>cantidad</b> que necesita:',
      { parse_mode: 'HTML' },
    );
    return;
  }

  if (data.startsWith(CB_TIPO)) {
    const tipo = data.slice(CB_TIPO.length);
    if (!esTipoRequerimientoSalida(tipo)) {
      await answerCallbackQuery(callbackId, 'Motivo no válido', true);
      return;
    }
    await answerCallbackQuery(callbackId, ETIQUETA_TIPO_REQUERIMIENTO[tipo]);
    if (tipo === 'traspaso') {
      await enviarPickerDestino(supabase, chatId, estado);
      return;
    }
    await patchMeta(supabase, chatId, estado, {
      paso: 'rq_motivo',
      tipo,
      destino_id: undefined,
      destino_nombre: undefined,
    });
    await sendTelegramMessage(chatId, preguntaMotivo(tipo), { parse_mode: 'HTML' });
    return;
  }

  if (data.startsWith(CB_DESTINO)) {
    const destinoId = data.slice(CB_DESTINO.length);
    const { data: ub } = await supabase.from('inv_ubicaciones').select('nombre').eq('id', destinoId).maybeSingle();
    const nombre = String(ub?.nombre ?? 'Obra').trim() || 'Obra';
    await answerCallbackQuery(callbackId, nombre.slice(0, 60));
    await patchMeta(supabase, chatId, estado, {
      paso: 'rq_motivo',
      tipo: 'traspaso',
      destino_id: destinoId,
      destino_nombre: nombre,
    });
    await sendTelegramMessage(chatId, preguntaMotivo('traspaso'), { parse_mode: 'HTML' });
    return;
  }

  if (data === CB_ENVIAR) {
    await answerCallbackQuery(callbackId, 'Enviando…');
    await enviarPedido(supabase, chatId, estado, params.nombre);
    return;
  }

  await answerCallbackQuery(callbackId);
}

/** Texto escrito por quien pide: la cantidad y el para qué. */
export async function manejarTextoRequerimientoSalida(
  supabase: SupabaseClient,
  chatId: string,
  texto: string,
): Promise<boolean> {
  const estado = await getTelegramEstado(supabase, chatId);
  if (!esFlujoRequerimientoSalida(estado)) return false;
  const m = meta(estado);
  const t = texto.trim();

  if (m.paso === 'rq_cantidad') {
    const cantidad = Number(t.replace(',', '.'));
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      await sendTelegramMessage(chatId, '⚠️ Escriba un número mayor a cero (ej. <code>12</code> o <code>2,5</code>).', {
        parse_mode: 'HTML',
      });
      return true;
    }
    const stock = m.origen_id ? await listarStockUbicacionEgreso(supabase, m.origen_id) : [];
    const disponible = stock.find((s) => s.material_id === m.material_id)?.cantidad_disponible ?? 0;
    if (cantidad > disponible + 0.0001) {
      await sendTelegramMessage(
        chatId,
        `⚠️ En el almacén hay <b>${cantidadTexto(disponible)} ${escHtml(m.unidad ?? '')}</b>. Escriba una cantidad menor o igual:`,
        { parse_mode: 'HTML' },
      );
      return true;
    }
    const conCantidad = await patchMeta(supabase, chatId, estado, { cantidad });
    await enviarPickerTipo(supabase, chatId, conCantidad);
    return true;
  }

  if (m.paso === 'rq_motivo') {
    if (t.length < 3) {
      await sendTelegramMessage(chatId, '⚠️ Escriba al menos unas palabras; el almacén y la obra las van a leer.', {
        parse_mode: 'HTML',
      });
      return true;
    }
    const conMotivo = await patchMeta(supabase, chatId, estado, { motivo: t.slice(0, 500) });
    await enviarConfirmacion(supabase, chatId, conMotivo);
    return true;
  }

  await sendTelegramMessage(chatId, 'Use los botones del mensaje anterior o <code>/cancelar</code>.', {
    parse_mode: 'HTML',
  });
  return true;
}

// ── Quien despacha ──────────────────────────────────────────────────────────────

function tecladoTrasTomar(id: string): { inline_keyboard: Boton[][] } {
  return {
    inline_keyboard: [
      [
        { text: '↩️ No lo despacho yo', callback_data: `${CB_SOLTAR}${id}` },
        { text: '❌ Rechazar', callback_data: `${CB_RECHAZAR}${id}` },
      ],
    ],
  };
}

async function avisarAlSolicitante(r: RequerimientoSalida, textoHtml: string): Promise<void> {
  if (r.solicitante_chat_id == null) return;
  try {
    await sendTelegramMessage(String(r.solicitante_chat_id), textoHtml, { parse_mode: 'HTML' });
  } catch (e) {
    console.warn('[requerimientoSalida] aviso solicitante', e);
  }
}

function motivoNoDisponible(actual: RequerimientoSalida | null): string {
  if (!actual) return 'Requerimiento no encontrado.';
  switch (actual.estado) {
    case 'en_despacho':
      return `Ya lo está despachando ${actual.despachador_nombre ?? 'otra persona'}.`;
    case 'despachado':
      return 'Este requerimiento ya fue despachado.';
    case 'rechazado':
      return 'Este requerimiento ya fue rechazado.';
    case 'cancelado':
      return 'Este requerimiento fue cancelado.';
    default:
      return 'Este requerimiento ya no está disponible.';
  }
}

async function manejarCallbackAlmacen(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string; nombre?: string | null },
): Promise<void> {
  const { chatId, callbackId, data } = params;

  if (data.startsWith(CB_RECHAZO_MOTIVO)) {
    const [id, indice] = data.slice(CB_RECHAZO_MOTIVO.length).split(':');
    const motivo = MOTIVOS_RECHAZO_REQUERIMIENTO[Number(indice)];
    if (!esUuidProcura(id ?? '') || !motivo) {
      await answerCallbackQuery(callbackId, 'Opción no válida', true);
      return;
    }
    const previo = await obtenerRequerimientoSalida(supabase, id);
    const nombre = await nombrePersona(supabase, chatId, params.nombre, previo?.proyecto_id, 'Almacén');
    const rechazado = await rechazarRequerimientoSalida(supabase, { id, chatId, nombre, motivo });
    if (!rechazado) {
      await answerCallbackQuery(callbackId, motivoNoDisponible(await obtenerRequerimientoSalida(supabase, id)), true);
      return;
    }
    await answerCallbackQuery(callbackId, 'Rechazado');
    await sendTelegramMessage(
      chatId,
      `❌ Requerimiento <b>${escHtml(rechazado.codigo)}</b> rechazado. Se avisó a quien lo pidió.`,
      { parse_mode: 'HTML' },
    );
    await avisarAlSolicitante(
      rechazado,
      `❌ <b>El almacén rechazó su pedido ${escHtml(rechazado.codigo)}</b>\n\n` +
        `📦 ${escHtml(cantidadTexto(rechazado.cantidad))} ${escHtml(rechazado.unidad)} · ${escHtml(rechazado.material_nombre)}\n` +
        `Motivo: <b>${escHtml(motivo)}</b>\n👤 ${escHtml(nombre)}`,
    );
    return;
  }

  const prefijo = [CB_DESPACHAR, CB_SOLTAR, CB_RECHAZAR].find((p) => data.startsWith(p));
  const id = prefijo ? data.slice(prefijo.length).trim() : '';
  if (!prefijo || !esUuidProcura(id)) {
    await answerCallbackQuery(callbackId, 'Requerimiento no válido', true);
    return;
  }

  if (prefijo === CB_RECHAZAR) {
    await answerCallbackQuery(callbackId);
    await sendTelegramMessage(chatId, '¿Por qué se rechaza?', {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: MOTIVOS_RECHAZO_REQUERIMIENTO.map((texto, i) => [
          { text: texto, callback_data: `${CB_RECHAZO_MOTIVO}${id}:${i}` },
        ]),
      },
    });
    return;
  }

  if (prefijo === CB_SOLTAR) {
    const suelto = await soltarRequerimientoSalida(supabase, { id, chatId });
    if (!suelto) {
      await answerCallbackQuery(callbackId, 'Este requerimiento ya no está a su nombre.', true);
      return;
    }
    await answerCallbackQuery(callbackId, 'Liberado');
    await sendTelegramMessage(chatId, '↩️ Liberado. Se avisó de nuevo al almacén.', { parse_mode: 'HTML' });
    const chats = await chatsAlmacen(supabase, suelto.proyecto_id, suelto.origen_ubicacion_id, suelto.solicitante_chat_id);
    await avisarAlAlmacen(supabase, suelto, chats, '📝 <b>Requerimiento de salida disponible de nuevo</b>');
    return;
  }

  // Despachar
  const previo = await obtenerRequerimientoSalida(supabase, id);
  if (previo && previo.solicitante_chat_id != null && String(previo.solicitante_chat_id) === chatId) {
    await answerCallbackQuery(
      callbackId,
      'Su propio pedido debe despacharlo otra persona. Si usted es el depositario, registre la salida con /salida.',
      true,
    );
    return;
  }
  const nombre = await nombrePersona(supabase, chatId, params.nombre, previo?.proyecto_id, 'Almacén');
  const tomado = await tomarRequerimientoSalida(supabase, { id, chatId, nombre });
  if (!tomado) {
    await answerCallbackQuery(callbackId, motivoNoDisponible(await obtenerRequerimientoSalida(supabase, id)), true);
    return;
  }

  await answerCallbackQuery(callbackId, 'A su nombre');
  const [ctx, estado] = await Promise.all([
    cargarContexto(supabase, tomado),
    getTelegramEstado(supabase, chatId),
  ]);
  // La foto solo se toma con el chat en el menú, para no confundirla con la de otro registro.
  const avisoOtroFlujo =
    estado.contexto === 'menu'
      ? ''
      : '\n\n⚠️ Tiene otro registro abierto en el bot. Termínelo o use <code>/cancelar</code> antes de enviar la foto.';
  await sendTelegramMessage(
    chatId,
    `✅ <b>Despacho a su nombre</b>\n\n${detalleRequerimiento(tomado, ctx)}\n\n` +
      '📷 Al entregarlo, envíe aquí la <b>foto del material</b> (obligatoria). Con la foto se descuenta el stock.' +
      avisoOtroFlujo,
    { parse_mode: 'HTML', reply_markup: tecladoTrasTomar(tomado.id) },
  );
  await avisarAlSolicitante(
    tomado,
    `🏭 <b>${escHtml(nombre)}</b> está despachando su pedido <b>${escHtml(tomado.codigo)}</b>.`,
  );
}

export async function manejarCallbackRequerimientoSalida(
  supabase: SupabaseClient,
  params: { chatId: string; callbackId: string; data: string; nombre?: string | null },
): Promise<boolean> {
  if (!esCallbackRequerimientoSalida(params.data)) return false;
  const esDeAlmacen = [CB_DESPACHAR, CB_SOLTAR, CB_RECHAZAR, CB_RECHAZO_MOTIVO].some((p) =>
    params.data.startsWith(p),
  );
  if (esDeAlmacen) await manejarCallbackAlmacen(supabase, params);
  else await manejarCallbackSolicitante(supabase, params);
  return true;
}

/**
 * Foto del material al despachar. Solo la toma si este chat tiene un requerimiento a su
 * nombre esperando foto; si no, devuelve false y el webhook sigue con los demás flujos.
 */
export async function manejarFotoRequerimientoSalida(params: {
  supabase: SupabaseClient;
  chatId: string;
  buffer: Buffer;
  mimeType: string;
  ext: string;
}): Promise<boolean> {
  const { supabase, chatId } = params;
  const r = await requerimientoEsperandoFoto(supabase, chatId);
  if (!r) return false;

  const storagePath = `telegram-movimientos/${r.proyecto_id}/requerimientos/${r.id}-${Date.now()}.${params.ext}`;
  const { error } = await supabase.storage
    .from(BUCKET_FOTOS)
    .upload(storagePath, params.buffer, { contentType: params.mimeType, upsert: false });
  if (error) {
    await sendTelegramMessage(chatId, '❌ No se pudo guardar la foto. Envíela de nuevo.', {
      parse_mode: 'HTML',
    });
    return true;
  }
  const { data: publica } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(storagePath);

  const ctx = await cargarContexto(supabase, r);
  const despacho = await despacharRequerimientoSalida(supabase, {
    requerimiento: r,
    foto: { storage_path: storagePath, url: publica.publicUrl ?? '' },
    nombreObra: ctx.obra ?? 'Obra',
  });

  if (!despacho.ok) {
    await sendTelegramMessage(
      chatId,
      `❌ <b>No se pudo despachar ${escHtml(r.codigo)}</b>\n${escHtml(despacho.error)}\n\n` +
        'El stock no se movió. Puede reenviar la foto, liberarlo o rechazarlo.',
      { parse_mode: 'HTML', reply_markup: tecladoTrasTomar(r.id) },
    );
    return true;
  }

  const detalle = detalleRequerimiento(despacho.requerimiento, ctx);
  await sendTelegramMessage(
    chatId,
    `✅ <b>Despachado</b>\n\n${detalle}\n\n🔖 Movimiento: <code>${escHtml(despacho.codigoTransferencia)}</code>\nEl stock ya se descontó.`,
    { parse_mode: 'HTML' },
  );
  await avisarAlSolicitante(
    despacho.requerimiento,
    `✅ <b>Su pedido ${escHtml(r.codigo)} fue despachado</b>\n\n` +
      `📦 ${escHtml(cantidadTexto(r.cantidad))} ${escHtml(r.unidad)} · ${escHtml(r.material_nombre)}\n` +
      `🏭 Entregó: <b>${escHtml(r.despachador_nombre ?? 'Almacén')}</b> (con foto)`,
  );
  return true;
}
