/**
 * Recorridos completos que el bot de ensayo sabe hacer solo.
 *
 * Cada uno conversa con el bot paso a paso y al final comprueba lo que quedó en la
 * base de datos (stock, registros, fotos). Si un paso no sale como se espera, el
 * recorrido se detiene y el reporte dice exactamente en cuál.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ErrorDeEnsayo, sinFormato, type BotDeEnsayo } from '@/lib/telegram/simulacion/botDeEnsayo';
import {
  ALMACEN_ENSAYO,
  MATERIAL_ENSAYO_1,
  OBRA_ENSAYO,
  OBRA_ENSAYO_2,
  stockDeEnsayo,
  type ClavePersonaEnsayo,
  type ObraDeEnsayoLista,
} from '@/lib/telegram/simulacion/obraDeEnsayo';

export type Comprobacion = { que: string; ok: boolean; detalle?: string };

export type ContextoEscenario = {
  bot: BotDeEnsayo;
  supabase: SupabaseClient;
  obra: ObraDeEnsayoLista;
  /** Anota una comprobación; el recorrido sigue aunque falle. */
  comprobar: (que: string, ok: boolean, detalle?: string) => void;
  /** Como `comprobar`, pero si falla detiene el recorrido: lo que sigue no tendría sentido. */
  exigir: (que: string, ok: boolean, detalle?: string) => void;
};

export type Escenario = {
  id: string;
  titulo: string;
  correr: (ctx: ContextoEscenario) => Promise<void>;
};

const ALMACEN = 'Almacén de pruebas';

/** Hasta elegir quién recibe: /salida → a un obrero → obra → almacén. */
async function abrirSalidaAObrero(ctx: ContextoEscenario): Promise<void> {
  const { bot } = ctx;
  await bot.escribir('depo', '/salida');
  await bot.pulsar('depo', 'obrero');
  await bot.pulsar('depo', OBRA_ENSAYO.nombre);
  await bot.pulsar('depo', ALMACEN);
  ctx.exigir(
    'tras elegir el almacén pregunta quién recibe el material',
    /qui[eé]n recibe/i.test(bot.textoUltimoPaso()),
    bot.textoUltimoPaso(),
  );
}

async function comprobarEgreso(ctx: ContextoEscenario, cantidad: number, observacion: string): Promise<void> {
  const { bot, supabase, obra } = ctx;
  ctx.comprobar('el bot confirma «Egreso registrado»', /egreso registrado/i.test(bot.textoUltimoPaso()), bot.textoUltimoPaso());

  const enAlmacen = await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id);
  ctx.comprobar(
    `el stock del almacén baja ${cantidad} (de ${MATERIAL_ENSAYO_1.stockInicial} a ${MATERIAL_ENSAYO_1.stockInicial - cantidad})`,
    enAlmacen === MATERIAL_ENSAYO_1.stockInicial - cantidad,
    `quedó en ${enAlmacen}`,
  );
  const enObra = await stockDeEnsayo(supabase, obra.ubicacionObra1, MATERIAL_ENSAYO_1.id);

  const { data, error } = await supabase
    .from('inv_egresos_campo')
    .select('obrero_nombre,obrero_oficio,observaciones,foto_storage_path,stock_aplicado,destino_ubicacion_id')
    .eq('proyecto_id', OBRA_ENSAYO.id);
  const egresos = (data ?? []) as Array<Record<string, unknown>>;
  ctx.comprobar('queda un solo egreso registrado', !error && egresos.length === 1, error?.message ?? `hay ${egresos.length}`);
  const e = egresos[0];
  if (e) {
    ctx.comprobar('el egreso guarda quién recibió', e.obrero_nombre === 'Pedro Ensayo', String(e.obrero_nombre));
    ctx.comprobar('el egreso guarda la foto', Boolean(String(e.foto_storage_path ?? '').trim()), String(e.foto_storage_path));
    ctx.comprobar('el egreso quedó con stock aplicado', e.stock_aplicado === true, String(e.stock_aplicado));
    ctx.comprobar(
      `la observación guardada es «${observacion}»`,
      String(e.observaciones ?? '') === observacion,
      `«${String(e.observaciones ?? '')}»`,
    );
  }
  ctx.comprobar('la sesión del bot vuelve al menú', bot.pasos.at(-1)?.sesion?.contexto === 'menu', JSON.stringify(bot.pasos.at(-1)?.sesion));
  ctx.comprobar('(dato) stock del material en la ubicación de la obra', true, String(enObra));
}

const PROVEEDOR_ENSAYO = 'ZZ PROVEEDOR DE PRUEBA';
const FACTURA_ENSAYO = 'F-ENSAYO-001';
/** Se piden 150 y el almacén tiene 100: salen 100 del almacén y se compran 50. */
const CANTIDAD_PROCURA = 150;
const CANTIDAD_COMPRA = CANTIDAD_PROCURA - MATERIAL_ENSAYO_1.stockInicial;
const PRECIO_COMPRA = 2.5;

type Fila = Record<string, unknown>;

async function procuraDeEnsayo(ctx: ContextoEscenario): Promise<Fila | null> {
  const { data } = await ctx.supabase
    .from('ci_procuras')
    .select('id,ticket,estado,cantidad,cantidad_compra,cantidad_despacho,abastecimiento_codigo_despacho')
    .eq('proyecto_id', OBRA_ENSAYO.id);
  const filas = (data ?? []) as Fila[];
  return filas.length === 1 ? filas[0]! : null;
}

async function retiroDeEnsayo(ctx: ContextoEscenario): Promise<Fila | null> {
  const { data } = await ctx.supabase
    .from('ci_compras_retiros')
    .select('id,estado,fotos,transportista_nombre')
    .eq('proyecto_id', OBRA_ENSAYO.id);
  return ((data ?? []) as Fila[])[0] ?? null;
}

/** Último mensaje que el bot le envió a esta persona, sin formato. */
function textoPara(ctx: ContextoEscenario, clave: ClavePersonaEnsayo): string {
  return sinFormato(ctx.bot.ultimoPara(clave)?.texto ?? '');
}

/** Cuántas órdenes de compra le han llegado al comprador en esta corrida. */
function ordenesDeCompraRecibidas(ctx: ContextoEscenario): number {
  return ctx.bot.mensajesPara('compra').filter((e) => /nueva orden de compra/i.test(sinFormato(e.texto))).length;
}

/** El ingeniero pide el material por /procura; queda esperando al Contador. */
async function registrarProcura(ctx: ContextoEscenario): Promise<Fila> {
  const { bot } = ctx;
  await bot.escribir('ing', '/procura');
  ctx.exigir(
    'la procura se abre en la obra de ensayo',
    bot.textoUltimoPaso().includes(OBRA_ENSAYO.nombre),
    bot.textoUltimoPaso(),
  );
  await bot.pulsar('ing', 'Estructura');
  await bot.escribir('ing', 'ZZ MATERIAL DE PRUEBA');
  await bot.pulsar('ing', `Sí: ${MATERIAL_ENSAYO_1.nombre}`);
  await bot.escribir('ing', String(CANTIDAD_PROCURA));
  await bot.pulsar('ing', 'UND');
  await bot.pulsar('ing', 'Media');
  ctx.exigir(
    'antes de registrar muestra cuánto hay en el almacén de la obra',
    /disponible en obra: 100/i.test(bot.textoUltimoPaso()),
    bot.textoUltimoPaso(),
  );
  await bot.pulsar('ing', 'CONFIRMAR');

  const registrada = await procuraDeEnsayo(ctx);
  ctx.exigir('la procura queda registrada', registrada != null, bot.textoUltimoPaso());
  ctx.comprobar(
    'el ticket es de ensayo (PR-0000-…): no gasta la numeración real',
    /^PR-0000-/.test(String(registrada!.ticket)),
    String(registrada!.ticket),
  );
  const paraContador = textoPara(ctx, 'conta');
  ctx.exigir(
    'la revisión de fondos le llega al Contador',
    bot.botonesVigentes('conta').some((b) => /^✅ hay disponibilidad/i.test(b.texto)),
    bot.textoUltimoPaso(),
  );
  ctx.comprobar(
    `el Contador ve el reparto: ${MATERIAL_ENSAYO_1.stockInicial} del almacén y ${CANTIDAD_COMPRA} a comprar`,
    paraContador.includes(`A comprar: ${CANTIDAD_COMPRA}`) &&
      paraContador.includes(`Despacho almacén: ${MATERIAL_ENSAYO_1.stockInicial}`),
    sinSaltos(paraContador),
  );
  ctx.comprobar(
    'mientras no decide el Contador, ni el PM ni el comprador reciben nada',
    bot.mensajesPara('pm').length === 0 && bot.mensajesPara('compra').length === 0,
  );

  return registrada!;
}

/**
 * Del pedido de compra del ingeniero hasta la aprobación del PM:
 * ingeniero → Contador (¿hay fondos?) → PM (¿aprueba?) → orden al comprador y al almacén.
 */
async function procuraHastaAprobacion(ctx: ContextoEscenario): Promise<Fila> {
  const { bot, supabase } = ctx;
  const registrada = await registrarProcura(ctx);

  await bot.pulsar('conta', '✅ Hay disponibilidad');
  ctx.exigir(
    'con fondos confirmados, la decisión pasa al PM',
    bot.botonesVigentes('pm').some((b) => /aprobar/i.test(b.texto)),
    bot.textoUltimoPaso(),
  );
  ctx.comprobar(
    'el PM ve quién confirmó los fondos',
    /disponibilidad presupuestaria: s[ií]/i.test(textoPara(ctx, 'pm')),
    sinSaltos(textoPara(ctx, 'pm')),
  );
  ctx.comprobar('el comprador todavía no recibe nada', bot.mensajesPara('compra').length === 0);

  await bot.pulsar('pm', 'Aprobar');
  ctx.exigir(
    'al aprobar el PM, la orden de compra le llega al comprador',
    ordenesDeCompraRecibidas(ctx) === 1,
    bot.textoUltimoPaso(),
  );
  ctx.comprobar(
    `la orden de compra es solo por lo que falta (${CANTIDAD_COMPRA} UND)`,
    (textoPara(ctx, 'compra')).includes(`${CANTIDAD_COMPRA} UND`),
    sinSaltos(textoPara(ctx, 'compra')),
  );
  ctx.exigir(
    'la orden de verificar el almacén le llega al depositario de la obra',
    bot.botonesVigentes('depo').some((b) => /confirmar verificaci[oó]n/i.test(b.texto)),
    bot.textoUltimoPaso(),
  );
  ctx.comprobar(
    'el PM lee que la orden sí llegó al comprador',
    /orden de compra enviada al comprador \(1\)/i.test(bot.textoUltimoPaso()) &&
      !/sin comprador/i.test(bot.textoUltimoPaso()),
    sinSaltos(bot.textoUltimoPaso()),
  );
  ctx.comprobar(
    'el almacén no se mueve solo: espera al depositario',
    (await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id)) === MATERIAL_ENSAYO_1.stockInicial,
  );
  return (await procuraDeEnsayo(ctx)) ?? registrada;
}

/** El comprador abre la carga manual de la factura y llena los datos hasta que el bot pide la foto. */
async function cargarFacturaManualHastaFoto(ctx: ContextoEscenario): Promise<void> {
  const { bot } = ctx;
  await bot.pulsar('compra', 'Carga manual');
  await bot.escribir('compra', PROVEEDOR_ENSAYO);
  await bot.escribir('compra', FACTURA_ENSAYO);
  await bot.escribir('compra', '-');
  await bot.escribir('compra', String(CANTIDAD_COMPRA));
  await bot.escribir('compra', String(PRECIO_COMPRA));
  await bot.pulsar('compra', 'Continuar');
  ctx.exigir(
    'tras los datos pide la foto de la factura como obligatoria',
    /foto de la factura/i.test(bot.textoUltimoPaso()) && /obligatoria/i.test(bot.textoUltimoPaso()),
    bot.textoUltimoPaso(),
  );
}

function sinSaltos(texto: string): string {
  return texto.replace(/\s*\n\s*/g, ' · ').slice(0, 400);
}

type TipoPedido = 'uso' | 'colocacion' | 'traspaso' | 'devolucion' | 'deterioro';

const BOTON_TIPO: Record<TipoPedido, string> = {
  uso: 'Uso en obra',
  colocacion: 'Colocación en obra',
  traspaso: 'Traspaso a otra obra',
  devolucion: 'Devolución a proveedor',
  deterioro: 'Deterioro o pérdida',
};

/** El ingeniero arma y envía un pedido de material; devuelve el pedido tal como quedó guardado. */
async function pedirMaterial(
  ctx: ContextoEscenario,
  tipo: TipoPedido,
  cantidad: number,
): Promise<Record<string, unknown>> {
  const { bot, supabase } = ctx;
  await bot.escribir('ing', '/salida');
  await bot.pulsar('ing', 'Pedir material');
  await bot.pulsar('ing', OBRA_ENSAYO.nombre);
  await bot.pulsar('ing', ALMACEN);
  await bot.pulsar('ing', MATERIAL_ENSAYO_1.nombre);
  await bot.escribir('ing', String(cantidad));
  await bot.pulsar('ing', BOTON_TIPO[tipo]);
  if (tipo === 'traspaso') await bot.pulsar('ing', OBRA_ENSAYO_2.nombre);
  await bot.escribir('ing', 'motivo de ensayo');
  ctx.exigir(
    'muestra el pedido para revisarlo antes de enviarlo',
    /revise su pedido/i.test(bot.textoUltimoPaso()) && bot.textoUltimoPaso().includes(BOTON_TIPO[tipo]),
    bot.textoUltimoPaso(),
  );
  await bot.pulsar('ing', 'Enviar al almacén');

  const { data, error } = await supabase
    .from('inv_requerimientos_salida')
    .select('*')
    .eq('proyecto_id', OBRA_ENSAYO.id);
  const pedidos = (data ?? []) as Array<Record<string, unknown>>;
  ctx.exigir('el pedido queda guardado como «solicitado»', !error && pedidos.length === 1 && pedidos[0]!.estado === 'solicitado', error?.message ?? JSON.stringify(pedidos.map((p) => p.estado)));
  ctx.exigir(
    'el aviso con el botón «Despachar» le llega al depositario de la obra',
    bot.botonesVigentes('depo').some((b) => /despachar/i.test(b.texto)),
    bot.textoUltimoPaso(),
  );
  ctx.comprobar(
    'al enviar el pedido todavía no se mueve el stock',
    (await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id)) === MATERIAL_ENSAYO_1.stockInicial,
  );
  return pedidos[0]!;
}

async function pedidoGuardado(ctx: ContextoEscenario): Promise<Record<string, unknown> | null> {
  const { data } = await ctx.supabase
    .from('inv_requerimientos_salida')
    .select('*')
    .eq('proyecto_id', OBRA_ENSAYO.id)
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

async function stockEnUbicacionVirtual(ctx: ContextoEscenario, codigo: string): Promise<number | null> {
  const { data } = await ctx.supabase.from('inv_ubicaciones').select('id').eq('codigo', codigo).maybeSingle();
  const id = (data as { id?: string } | null)?.id;
  return id ? stockDeEnsayo(ctx.supabase, id, MATERIAL_ENSAYO_1.id) : null;
}

/** Pedido completo: el ingeniero pide, el depositario despacha con foto. */
function escenarioPedido(tipo: TipoPedido, cantidad: number, titulo: string): Escenario {
  return {
    id: `pedido_${tipo}`,
    titulo,
    async correr(ctx) {
      const { bot, supabase, obra } = ctx;
      await pedirMaterial(ctx, tipo, cantidad);

      await bot.pulsar('depo', 'Despachar');
      ctx.exigir('al tomarlo, le pide la foto al depositario', /foto/i.test(bot.ultimoPara('depo')?.texto ?? ''), bot.textoUltimoPaso());
      ctx.comprobar('avisa al ingeniero de quién lo está despachando', /Depo Ensayo/.test(bot.ultimoPara('ing')?.texto ?? ''), bot.ultimoPara('ing')?.texto ?? '');
      ctx.comprobar(
        'tomar el pedido no mueve el stock',
        (await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id)) === MATERIAL_ENSAYO_1.stockInicial,
      );

      await bot.foto('depo');
      ctx.comprobar('con la foto confirma «Despachado»', /despachado/i.test(bot.ultimoPara('depo')?.texto ?? ''), bot.textoUltimoPaso());
      ctx.comprobar('avisa al ingeniero de que fue despachado', /fue despachado/i.test(bot.ultimoPara('ing')?.texto ?? ''), bot.ultimoPara('ing')?.texto ?? '');

      const enAlmacen = await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id);
      ctx.comprobar(`el stock del almacén baja ${cantidad}`, enAlmacen === MATERIAL_ENSAYO_1.stockInicial - cantidad, `quedó en ${enAlmacen}`);

      const p = await pedidoGuardado(ctx);
      ctx.comprobar('el pedido queda «despachado»', p?.estado === 'despachado', String(p?.estado));
      ctx.comprobar('el pedido guarda la foto', Array.isArray(p?.fotos) && (p?.fotos as unknown[]).length === 1, JSON.stringify(p?.fotos));
      ctx.comprobar('el pedido guarda quién despachó', p?.despachador_nombre === 'Depo Ensayo', String(p?.despachador_nombre));

      if (tipo === 'traspaso') {
        const enObra2 = await stockDeEnsayo(supabase, obra.ubicacionObra2, MATERIAL_ENSAYO_1.id);
        ctx.comprobar(`el material llega a la otra obra (+${cantidad})`, enObra2 === cantidad, `hay ${enObra2}`);
      } else if (tipo === 'devolucion' || tipo === 'deterioro') {
        const codigo = tipo === 'devolucion' ? 'DEVOLUCIONES' : 'BAJAS';
        const enVirtual = await stockEnUbicacionVirtual(ctx, codigo);
        ctx.comprobar(`el material queda en ${codigo} (+${cantidad})`, enVirtual === cantidad, `hay ${enVirtual}`);
        const enObra = await stockDeEnsayo(supabase, obra.ubicacionObra1, MATERIAL_ENSAYO_1.id);
        ctx.comprobar('no aparece como material disponible en la obra', enObra === 0, `hay ${enObra}`);
      } else {
        const enObra = await stockDeEnsayo(supabase, obra.ubicacionObra1, MATERIAL_ENSAYO_1.id);
        ctx.comprobar('(dato) stock del material en la ubicación de la obra', true, String(enObra));
      }

      // Telegram reintenta si no recibe respuesta: una segunda foto no debe descontar otra vez.
      await bot.foto('depo');
      const trasReintento = await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id);
      ctx.comprobar('una segunda foto no descuenta el stock otra vez', trasReintento === enAlmacen, `quedó en ${trasReintento}`);
    },
  };
}

export const ESCENARIOS: Escenario[] = [
  {
    id: 'salida_obrero',
    titulo: 'Salida a un obrero: nombre escrito, material, cantidad, foto, sin observaciones',
    async correr(ctx) {
      const { bot } = ctx;
      await abrirSalidaAObrero(ctx);
      await bot.escribir('depo', 'Pedro Ensayo, Albañil');
      await bot.pulsar('depo', MATERIAL_ENSAYO_1.nombre);
      await bot.escribir('depo', '3');
      await bot.pulsar('depo', 'sin partida');
      await bot.pulsar('depo', 'No, continuar');
      ctx.exigir('pide la foto como obligatoria', /foto/i.test(bot.textoUltimoPaso()) && /obligatoria/i.test(bot.textoUltimoPaso()), bot.textoUltimoPaso());
      await bot.foto('depo');
      await bot.pulsar('depo', 'Sin observaciones');
      await bot.pulsar('depo', 'Confirmar egreso');
      await comprobarEgreso(ctx, 3, '');
    },
  },
  {
    id: 'salida_obrero_foto_antes',
    titulo: 'Salida a un obrero enviando la foto antes de tiempo, con texto',
    async correr(ctx) {
      const { bot } = ctx;
      await abrirSalidaAObrero(ctx);
      await bot.foto('depo', 'Para la cerca');
      ctx.exigir(
        'acepta la foto adelantada y vuelve a preguntar quién recibe',
        /foto guardada/i.test(bot.textoUltimoPaso()) && /qui[eé]n recibe/i.test(bot.textoUltimoPaso()),
        bot.textoUltimoPaso(),
      );
      await bot.escribir('depo', 'Pedro Ensayo');
      await bot.pulsar('depo', MATERIAL_ENSAYO_1.nombre);
      await bot.escribir('depo', '2');
      await bot.pulsar('depo', 'sin partida');
      await bot.pulsar('depo', 'No, continuar');
      ctx.exigir(
        'no vuelve a pedir la foto: pasa directo a confirmar',
        bot.botonesVigentes('depo').some((b) => /confirmar egreso/i.test(b.texto)),
        bot.textoUltimoPaso(),
      );
      await bot.pulsar('depo', 'Confirmar egreso');
      await comprobarEgreso(ctx, 2, 'Para la cerca');
    },
  },
  {
    id: 'salida_obrero_sin_foto',
    titulo: 'Salida a un obrero: sin foto no se puede registrar',
    async correr(ctx) {
      const { bot, supabase } = ctx;
      await abrirSalidaAObrero(ctx);
      await bot.escribir('depo', 'Pedro Ensayo');
      await bot.pulsar('depo', MATERIAL_ENSAYO_1.nombre);
      await bot.escribir('depo', '4');
      await bot.pulsar('depo', 'sin partida');
      await bot.pulsar('depo', 'No, continuar');
      ctx.comprobar(
        'en el paso de la foto no ofrece ningún botón para omitirla',
        !bot.botonesVigentes('depo').some((b) => /omitir/i.test(b.texto)) || !/foto/i.test(bot.ultimoPara('depo')?.texto ?? ''),
        bot.botonesVigentes('depo').map((b) => b.texto).join(', '),
      );
      await bot.escribir('depo', 'no tengo foto');
      ctx.comprobar('si se escribe en vez de mandar la foto, insiste en que es obligatoria', /obligatoria/i.test(bot.textoUltimoPaso()), bot.textoUltimoPaso());

      const enAlmacen = await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id);
      ctx.comprobar('el stock no se movió', enAlmacen === MATERIAL_ENSAYO_1.stockInicial, `quedó en ${enAlmacen}`);
      const { data } = await supabase.from('inv_egresos_campo').select('id').eq('proyecto_id', OBRA_ENSAYO.id);
      ctx.comprobar('no se registró ningún egreso', (data ?? []).length === 0, `hay ${(data ?? []).length}`);
    },
  },
  escenarioPedido('uso', 4, 'Pedido de material para uso en obra: el ingeniero pide, el depositario despacha con foto'),
  escenarioPedido('colocacion', 2, 'Pedido de material para colocación en obra'),
  escenarioPedido('traspaso', 6, 'Pedido de material para traspasarlo a otra obra'),
  escenarioPedido('devolucion', 5, 'Pedido de material para devolverlo al proveedor'),
  escenarioPedido('deterioro', 1, 'Pedido para dar de baja material deteriorado'),
  {
    id: 'pedido_no_propio',
    titulo: 'Quien pide el material no puede despachar su propio pedido',
    async correr(ctx) {
      const { bot, supabase } = ctx;
      await pedirMaterial(ctx, 'uso', 3);
      const despachar = bot.botonesVigentes('depo').find((b) => /despachar/i.test(b.texto));
      ctx.exigir('existe el botón «Despachar» del depositario', Boolean(despachar?.data));
      // El ingeniero reenvía (o adivina) el botón del depositario.
      await bot.pulsarDato('ing', despachar!.data!, 'Despachar (botón del depositario)');
      ctx.comprobar('el bot se lo impide con una alerta', bot.pasos.at(-1)?.respuestas.some((r) => r.tipo === 'alerta') === true, bot.textoUltimoPaso());
      const p = await pedidoGuardado(ctx);
      ctx.comprobar('el pedido sigue «solicitado»', p?.estado === 'solicitado', String(p?.estado));
      await bot.foto('ing');
      const enAlmacen = await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id);
      ctx.comprobar('una foto del ingeniero no mueve el stock', enAlmacen === MATERIAL_ENSAYO_1.stockInicial, `quedó en ${enAlmacen}`);
    },
  },
  {
    id: 'pedido_rechazado',
    titulo: 'El depositario rechaza un pedido con un motivo de un toque',
    async correr(ctx) {
      const { bot, supabase } = ctx;
      await pedirMaterial(ctx, 'uso', 3);
      await bot.pulsar('depo', 'Rechazar');
      ctx.exigir('ofrece motivos de rechazo como botones', bot.botonesVigentes('depo').some((b) => /no hay esa cantidad/i.test(b.texto)), bot.textoUltimoPaso());
      await bot.pulsar('depo', 'No hay esa cantidad');
      const p = await pedidoGuardado(ctx);
      ctx.comprobar('el pedido queda «rechazado»', p?.estado === 'rechazado', String(p?.estado));
      ctx.comprobar('guarda el motivo del rechazo', /no hay esa cantidad/i.test(String(p?.motivo_rechazo ?? '')), String(p?.motivo_rechazo));
      ctx.comprobar('avisa al ingeniero con el motivo', /no hay esa cantidad/i.test(bot.ultimoPara('ing')?.texto ?? ''), bot.ultimoPara('ing')?.texto ?? '');
      const enAlmacen = await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id);
      ctx.comprobar('el stock no se movió', enAlmacen === MATERIAL_ENSAYO_1.stockInicial, `quedó en ${enAlmacen}`);
    },
  },
  {
    id: 'pedido_soltado',
    titulo: 'El depositario toma un pedido y luego lo suelta: vuelve a quedar disponible',
    async correr(ctx) {
      const { bot } = ctx;
      await pedirMaterial(ctx, 'uso', 3);
      await bot.pulsar('depo', 'Despachar');
      ctx.comprobar('al tomarlo queda «en despacho»', (await pedidoGuardado(ctx))?.estado === 'en_despacho');
      await bot.pulsar('depo', 'No lo despacho yo');
      const p = await pedidoGuardado(ctx);
      ctx.comprobar('al soltarlo vuelve a «solicitado»', p?.estado === 'solicitado', String(p?.estado));
      ctx.comprobar('y queda sin despachador', p?.despachador_chat_id == null, String(p?.despachador_chat_id));
    },
  },
  {
    id: 'pedido_supera_stock',
    titulo: 'No se puede pedir más material del que hay en el almacén',
    async correr(ctx) {
      const { bot } = ctx;
      await bot.escribir('ing', '/salida');
      await bot.pulsar('ing', 'Pedir material');
      await bot.pulsar('ing', OBRA_ENSAYO.nombre);
      await bot.pulsar('ing', ALMACEN);
      await bot.pulsar('ing', MATERIAL_ENSAYO_1.nombre);
      await bot.escribir('ing', String(MATERIAL_ENSAYO_1.stockInicial + 1));
      ctx.comprobar('rechaza la cantidad y sigue pidiéndola', bot.pasos.at(-1)?.sesion?.paso === 'rq_cantidad', `${JSON.stringify(bot.pasos.at(-1)?.sesion)} · ${bot.textoUltimoPaso()}`);
      await bot.escribir('ing', 'muchos');
      ctx.comprobar('tampoco acepta texto que no es un número', bot.pasos.at(-1)?.sesion?.paso === 'rq_cantidad', bot.textoUltimoPaso());
      ctx.comprobar('no se creó ningún pedido', (await pedidoGuardado(ctx)) == null);
    },
  },
  {
    id: 'traspaso',
    titulo: 'Traspaso entre el almacén y la obra, con foto obligatoria y sin nota',
    async correr(ctx) {
      const { bot, supabase, obra } = ctx;
      await bot.escribir('depo', '/salida');
      await bot.pulsar('depo', 'Traspaso');
      await bot.pulsar('depo', ALMACEN_ENSAYO.nombre);
      ctx.exigir('tras el origen pide el destino', /destino/i.test(bot.textoUltimoPaso()), bot.textoUltimoPaso());
      await bot.pulsar('depo', `${OBRA_ENSAYO.nombre} (`);
      await bot.escribir('depo', 'ZZ');
      await bot.pulsar('depo', MATERIAL_ENSAYO_1.nombre);
      await bot.escribir('depo', '5');
      ctx.exigir('ofrece seguir «Sin nota»', bot.botonesVigentes('depo').some((b) => /sin nota/i.test(b.texto)), bot.textoUltimoPaso());
      await bot.pulsar('depo', 'Sin nota');
      ctx.exigir('pide la foto como obligatoria', /obligatoria/i.test(bot.textoUltimoPaso()), bot.textoUltimoPaso());
      await bot.foto('depo');
      await bot.pulsar('depo', 'Confirmar despacho');

      const enAlmacen = await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id);
      ctx.comprobar('el stock del almacén baja 5', enAlmacen === MATERIAL_ENSAYO_1.stockInicial - 5, `quedó en ${enAlmacen} · ${bot.textoUltimoPaso()}`);
      const { data } = await supabase
        .from('transferencias_inventario')
        .select('estado,fotos,tipo_movimiento,destino_ubicacion_id')
        .eq('origen_ubicacion_id', ALMACEN_ENSAYO.id);
      const t = ((data ?? []) as Array<Record<string, unknown>>)[0];
      ctx.comprobar('queda una transferencia registrada', (data ?? []).length === 1, `hay ${(data ?? []).length}`);
      ctx.comprobar('la transferencia guarda la foto', Array.isArray(t?.fotos) && (t?.fotos as unknown[]).length === 1, JSON.stringify(t?.fotos));
      ctx.comprobar('va hacia la ubicación de la obra de ensayo', t?.destino_ubicacion_id === obra.ubicacionObra1, String(t?.destino_ubicacion_id));
      const enObra = await stockDeEnsayo(supabase, obra.ubicacionObra1, MATERIAL_ENSAYO_1.id);
      ctx.comprobar(`(dato) estado de la transferencia y stock en destino`, true, `${String(t?.estado)} · ${enObra}`);
      ctx.comprobar('la sesión del bot vuelve al menú', bot.pasos.at(-1)?.sesion?.contexto === 'menu', JSON.stringify(bot.pasos.at(-1)?.sesion));
    },
  },
  {
    id: 'compra_completa',
    titulo:
      'Cadena de compra completa: ingeniero → Contador → PM → almacén y comprador → factura → retiro → ingreso al almacén',
    async correr(ctx) {
      const { bot, supabase, obra } = ctx;
      const procura = await procuraHastaAprobacion(ctx);

      // El depositario verifica y despacha lo que sí hay: primero la foto de lo que sale.
      await bot.pulsar('depo', 'Confirmar verificación y abastecer');
      ctx.exigir(
        'antes de sacar material pide la foto de lo que sale, como obligatoria',
        /foto del material que sale/i.test(bot.textoUltimoPaso()) && /obligatoria/i.test(bot.textoUltimoPaso()),
        sinSaltos(bot.textoUltimoPaso()),
      );
      ctx.comprobar(
        'sin la foto el almacén no se mueve',
        (await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id)) === MATERIAL_ENSAYO_1.stockInicial,
      );
      await bot.foto('depo');
      ctx.comprobar(
        `con la foto, del almacén salen ${MATERIAL_ENSAYO_1.stockInicial} hacia la obra`,
        (await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id)) === 0 &&
          (await stockDeEnsayo(supabase, obra.ubicacionObra1, MATERIAL_ENSAYO_1.id)) === MATERIAL_ENSAYO_1.stockInicial,
        bot.textoUltimoPaso(),
      );
      ctx.comprobar(
        'al confirmar el almacén NO se le repite la orden de compra al comprador',
        ordenesDeCompraRecibidas(ctx) === 1,
        `le llegaron ${ordenesDeCompraRecibidas(ctx)}`,
      );
      ctx.comprobar(
        'el depositario lee que la orden del saldo ya estaba enviada',
        /ya se hab[ií]a enviado al comprador/i.test(bot.textoUltimoPaso()) && !/sin comprador/i.test(bot.textoUltimoPaso()),
        sinSaltos(bot.textoUltimoPaso()),
      );

      const { data: despachos } = await supabase
        .from('transferencias_inventario')
        .select('fotos,observaciones')
        .eq('origen_ubicacion_id', ALMACEN_ENSAYO.id);
      const despacho = ((despachos ?? []) as Fila[])[0];
      ctx.comprobar(
        'el despacho queda registrado con su foto',
        (despachos ?? []).length === 1 && Array.isArray(despacho?.fotos) && (despacho?.fotos as unknown[]).length === 1,
        JSON.stringify({ n: (despachos ?? []).length, fotos: despacho?.fotos }),
      );
      ctx.comprobar(
        'al ingeniero se le avisa que el almacén despachó su material',
        bot.mensajesPara('ing').some((e) => /el almac[eé]n despach[oó] material de su solicitud/i.test(sinFormato(e.texto))),
        sinSaltos(textoPara(ctx, 'ing')),
      );

      await bot.pulsarDato('depo', `cmp:prc_abas:${String(procura.id)}`, 'Confirmar verificación y abastecer (otra vez)');
      ctx.comprobar(
        'un segundo toque del mismo botón no despacha otra vez',
        /ya estaba confirmado/i.test(bot.textoUltimoPaso()) &&
          (await stockDeEnsayo(supabase, obra.ubicacionObra1, MATERIAL_ENSAYO_1.id)) === MATERIAL_ENSAYO_1.stockInicial &&
          ordenesDeCompraRecibidas(ctx) === 1,
        sinSaltos(bot.textoUltimoPaso()),
      );

      // El comprador carga la factura a mano, con su foto.
      await cargarFacturaManualHastaFoto(ctx);
      await bot.foto('compra');
      ctx.exigir(
        'la foto de la factura se acepta y el bot pregunta la moneda',
        bot.botonesVigentes('compra').some((b) => /d[oó]lares/i.test(b.texto)),
        bot.textoUltimoPaso(),
      );
      await bot.pulsar('compra', 'Dólares (USD)');
      await bot.pulsar('compra', 'Contado');
      ctx.exigir(
        'pregunta a qué almacén va la mercancía y ofrece el de la obra',
        bot.botonesVigentes('compra').some((b) => b.texto.includes(ALMACEN)),
        bot.textoUltimoPaso(),
      );
      await bot.pulsar('compra', ALMACEN);
      ctx.exigir('la compra queda registrada en Contabilidad', /compra registrada en contabilidad/i.test(bot.textoUltimoPaso()), bot.textoUltimoPaso());

      const { data: compras } = await supabase
        .from('contabilidad_compras')
        .select('id,monto_usd,monto_ves,tasa_bcv_ves_por_usd,procura_id,honorarios_usd,document_storage_path,ingresado_almacen_at')
        .eq('proyecto_id', OBRA_ENSAYO.id);
      const compra = ((compras ?? []) as Fila[])[0];
      const totalUsd = CANTIDAD_COMPRA * PRECIO_COMPRA;
      ctx.comprobar('queda una sola compra en Contabilidad', (compras ?? []).length === 1, `hay ${(compras ?? []).length}`);
      ctx.comprobar(`la compra vale ${totalUsd} USD`, Number(compra?.monto_usd) === totalUsd, String(compra?.monto_usd));
      const tasa = Number(compra?.tasa_bcv_ves_por_usd);
      const tasaImplicita = Number(compra?.monto_ves) / Number(compra?.monto_usd);
      ctx.comprobar(
        'el monto en bolívares es dólares × tasa (una sola vez)',
        tasa > 0 && Math.abs(tasaImplicita / tasa - 1) < 0.01,
        `Bs ${String(compra?.monto_ves)} · tasa ${tasa} · tasa implícita ${tasaImplicita.toFixed(2)}`,
      );
      ctx.comprobar('la compra queda ligada a la procura', compra?.procura_id === procura.id, String(compra?.procura_id));
      ctx.comprobar('la compra guarda la foto de la factura', Boolean(String(compra?.document_storage_path ?? '').trim()), String(compra?.document_storage_path));
      ctx.comprobar('(dato) honorarios calculados sobre la compra', true, `${String(compra?.honorarios_usd)} USD`);
      ctx.comprobar(
        'registrar la factura todavía no suma stock: falta recibirla',
        (await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id)) === 0,
      );

      // Logística la retira, con foto.
      ctx.exigir(
        'el aviso de «mercancía por retirar» le llega a Logística de la obra',
        bot.botonesVigentes('logi').some((b) => /la retiro yo/i.test(b.texto)),
        bot.textoUltimoPaso(),
      );
      await bot.pulsar('logi', 'La retiro yo');
      ctx.comprobar('el comprador se entera de quién la retira', /retirar[aá] la factura/i.test(textoPara(ctx, 'compra')), textoPara(ctx, 'compra'));
      await bot.foto('logi');
      ctx.comprobar('el retiro queda registrado con foto', /retiro registrado con foto/i.test(bot.textoUltimoPaso()), sinSaltos(bot.textoUltimoPaso()));
      ctx.comprobar(
        'el depositario de la obra recibe el aviso de que va en camino',
        /mercanc[ií]a en camino al almac[eé]n/i.test(textoPara(ctx, 'depo')),
        sinSaltos(textoPara(ctx, 'depo')),
      );
      ctx.comprobar(
        'a quien retira se le dice que el almacén fue avisado, y es cierto',
        /el almac[eé]n ya fue avisado/i.test(bot.textoUltimoPaso()),
        sinSaltos(bot.textoUltimoPaso()),
      );
      const retiroEnCamino = await retiroDeEnsayo(ctx);
      ctx.comprobar('el retiro queda «en camino» con su foto', retiroEnCamino?.estado === 'en_camino' && Array.isArray(retiroEnCamino?.fotos) && (retiroEnCamino?.fotos as unknown[]).length === 1, JSON.stringify({ estado: retiroEnCamino?.estado, fotos: retiroEnCamino?.fotos }));

      // El depositario la recibe en el almacén, con foto.
      await bot.escribir('depo', '/ingreso');
      ctx.exigir(
        'la factura aparece precargada para el depositario',
        bot.botonesVigentes('depo').some((b) => b.texto.includes(PROVEEDOR_ENSAYO)),
        bot.textoUltimoPaso(),
      );
      const proveedoresVisibles = bot.botonesVigentes('depo').filter((b) => String(b.data ?? '').startsWith('ig:pr:'));
      ctx.comprobar(
        'el depositario solo ve las facturas de su obra, no las de otras',
        proveedoresVisibles.length === 1,
        proveedoresVisibles.map((b) => b.texto).join(' | '),
      );
      await bot.pulsar('depo', PROVEEDOR_ENSAYO);
      ctx.exigir(
        'muestra la factura y pide contar lo recibido',
        bot.textoUltimoPaso().includes(FACTURA_ENSAYO) && /cantidad f[ií]sica recibida/i.test(bot.textoUltimoPaso()),
        bot.textoUltimoPaso(),
      );
      await bot.escribir('depo', String(CANTIDAD_COMPRA));
      ctx.exigir('pide al menos una foto del material recibido', /al menos una foto/i.test(bot.textoUltimoPaso()), bot.textoUltimoPaso());
      await bot.pulsar('depo', 'Listo con fotos');
      ctx.comprobar(
        'sin foto no deja continuar',
        bot.pasos.at(-1)?.sesion?.paso === 'foto',
        `${JSON.stringify(bot.pasos.at(-1)?.sesion)} · ${sinSaltos(bot.textoUltimoPaso())}`,
      );
      await bot.foto('depo');
      await bot.pulsar('depo', 'Listo con fotos');
      await bot.pulsar('depo', 'Registrar ingreso a almacén');
      ctx.comprobar('el bot confirma «Ingreso a almacén registrado»', /ingreso a almac[eé]n registrado/i.test(bot.textoUltimoPaso()), sinSaltos(bot.textoUltimoPaso()));

      const enAlmacen = await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id);
      ctx.comprobar(`el almacén sube a ${CANTIDAD_COMPRA} con lo comprado`, enAlmacen === CANTIDAD_COMPRA, `quedó en ${enAlmacen}`);
      const retiroFinal = await retiroDeEnsayo(ctx);
      ctx.comprobar('el retiro queda «entregado»', retiroFinal?.estado === 'entregado', String(retiroFinal?.estado));
      ctx.comprobar('a quien la trajo se le avisa que el almacén la recibió', /retiro cerrado/i.test(textoPara(ctx, 'logi')), textoPara(ctx, 'logi'));
      const { data: trasIngreso } = await supabase
        .from('contabilidad_compras')
        .select('ingresado_almacen_at')
        .eq('proyecto_id', OBRA_ENSAYO.id);
      ctx.comprobar('Contabilidad marca la compra como ingresada al almacén', Boolean(((trasIngreso ?? []) as Fila[])[0]?.ingresado_almacen_at));
      ctx.comprobar('la sesión del bot vuelve al menú', bot.pasos.at(-1)?.sesion?.contexto === 'menu', JSON.stringify(bot.pasos.at(-1)?.sesion));
      const procuraFinal = await procuraDeEnsayo(ctx);
      ctx.comprobar('la solicitud queda «recibida»', procuraFinal?.estado === 'recibida', String(procuraFinal?.estado));
      ctx.comprobar(
        'al ingeniero se le avisa que su material ya está en el almacén y cómo pedirlo',
        bot
          .mensajesPara('ing')
          .some((e) => /ya est[aá] en el almac[eé]n/i.test(sinFormato(e.texto)) && /pedir material/i.test(sinFormato(e.texto))),
        sinSaltos(textoPara(ctx, 'ing')),
      );
    },
  },
  {
    id: 'compra_despacho_con_foto',
    titulo: 'El almacén no despacha una solicitud sin foto, y el depositario puede soltar el despacho',
    async correr(ctx) {
      const { bot, supabase, obra } = ctx;
      const procura = await procuraHastaAprobacion(ctx);
      const enAlmacen = () => stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id);
      const reserva = async () => {
        const { data } = await supabase
          .from('ci_procuras')
          .select('despacho_chat_id,abastecimiento_codigo_despacho')
          .eq('id', String(procura.id))
          .maybeSingle();
        return (data ?? {}) as Fila;
      };

      await bot.pulsar('depo', 'Confirmar verificación y abastecer');
      ctx.exigir('pide la foto del material que sale', /foto del material que sale/i.test(bot.textoUltimoPaso()), sinSaltos(bot.textoUltimoPaso()));
      ctx.comprobar('el despacho queda a nombre de quien lo tomó', (await reserva()).despacho_chat_id != null);

      await bot.pulsar('depo', 'No lo despacho yo');
      ctx.comprobar('al soltarlo queda libre y sin mover stock', (await reserva()).despacho_chat_id == null && (await enAlmacen()) === MATERIAL_ENSAYO_1.stockInicial, sinSaltos(bot.textoUltimoPaso()));

      await bot.pulsarDato('depo', `cmp:prc_abas:${String(procura.id)}`, 'Confirmar verificación y abastecer');
      ctx.exigir('al tomarlo de nuevo vuelve a pedir la foto', /foto del material que sale/i.test(bot.textoUltimoPaso()), sinSaltos(bot.textoUltimoPaso()));
      await bot.foto('depo');
      ctx.comprobar(
        'con la foto sale el material',
        (await enAlmacen()) === 0 &&
          (await stockDeEnsayo(supabase, obra.ubicacionObra1, MATERIAL_ENSAYO_1.id)) === MATERIAL_ENSAYO_1.stockInicial,
        sinSaltos(bot.textoUltimoPaso()),
      );
      ctx.comprobar('la orden de compra no se repite', ordenesDeCompraRecibidas(ctx) === 1, `le llegaron ${ordenesDeCompraRecibidas(ctx)}`);
    },
  },
  {
    id: 'compra_foto_factura_antes',
    titulo: 'Carga manual de factura: una foto enviada antes de tiempo no rompe la carga',
    async correr(ctx) {
      const { bot } = ctx;
      await procuraHastaAprobacion(ctx);
      await bot.pulsar('compra', 'Carga manual');
      await bot.foto('compra');
      ctx.comprobar(
        'avisa que todavía no toca la foto y no la manda a la lectura automática',
        /todav[ií]a no toca la foto de la factura/i.test(bot.textoUltimoPaso()),
        sinSaltos(bot.textoUltimoPaso()),
      );
      ctx.comprobar(
        'la carga sigue donde estaba (pidiendo el proveedor)',
        bot.pasos.at(-1)?.sesion?.flujo === 'factura_comprador_manual' && bot.pasos.at(-1)?.sesion?.paso === 'proveedor',
        JSON.stringify(bot.pasos.at(-1)?.sesion),
      );
      await bot.escribir('compra', '/cancelar');
      ctx.comprobar('/cancelar cierra la carga', bot.pasos.at(-1)?.sesion?.contexto === 'menu', `${JSON.stringify(bot.pasos.at(-1)?.sesion)} · ${sinSaltos(bot.textoUltimoPaso())}`);
    },
  },
  {
    id: 'compra_a_credito',
    titulo: 'Sin fondos: la solicitud llega igual al PM y, si aprueba, la compra es a crédito',
    async correr(ctx) {
      const { bot, supabase } = ctx;
      await registrarProcura(ctx);
      await bot.pulsar('conta', 'No hay disponibilidad');
      ctx.exigir(
        'sin fondos, la solicitud llega igual al PM con el botón «Aprobar a crédito»',
        bot.botonesVigentes('pm').some((b) => /aprobar a cr[eé]dito/i.test(b.texto)),
        sinSaltos(bot.textoUltimoPaso()),
      );
      ctx.comprobar(
        'al PM se le advierte que no hay fondos y que aprobar es autorizar el crédito',
        /sin fondos disponibles/i.test(textoPara(ctx, 'pm')) && /a cr[eé]dito/i.test(textoPara(ctx, 'pm')),
        sinSaltos(textoPara(ctx, 'pm')),
      );
      ctx.comprobar('mientras el PM no aprueba, el comprador no recibe nada', ordenesDeCompraRecibidas(ctx) === 0);
      ctx.comprobar(
        'el almacén no se mueve',
        (await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id)) === MATERIAL_ENSAYO_1.stockInicial,
      );

      await bot.pulsar('pm', 'Aprobar a crédito');
      ctx.exigir('al aprobar, la orden le llega al comprador', ordenesDeCompraRecibidas(ctx) === 1, sinSaltos(bot.textoUltimoPaso()));
      ctx.comprobar(
        'la orden de compra dice que es a crédito',
        /compra a cr[eé]dito/i.test(textoPara(ctx, 'compra')),
        sinSaltos(textoPara(ctx, 'compra')),
      );
      ctx.comprobar(
        'el ingeniero ve en su ticket que fue aprobada a crédito',
        bot.mensajesPara('ing').some((e) => /aprobada a cr[eé]dito/i.test(sinFormato(e.texto))),
        sinSaltos(textoPara(ctx, 'ing')),
      );
      ctx.comprobar(
        'al PM se le confirma «Aprobada a crédito»',
        /aprobada a cr[eé]dito/i.test(bot.textoUltimoPaso()),
        sinSaltos(bot.textoUltimoPaso()),
      );

      await cargarFacturaManualHastaFoto(ctx);
      await bot.foto('compra');
      await bot.pulsar('compra', 'Dólares (USD)');
      ctx.exigir(
        'al comprador no se le pregunta contado o crédito: pasa directo a los días de crédito',
        /d[ií]as de cr[eé]dito/i.test(bot.textoUltimoPaso()) &&
          !bot.botonesVigentes('compra').some((b) => /^contado$/i.test(b.texto.trim())),
        sinSaltos(bot.textoUltimoPaso()),
      );
      await bot.pulsar('compra', '30 días');
      ctx.exigir(
        'luego pregunta a qué almacén va',
        bot.botonesVigentes('compra').some((b) => b.texto.includes(ALMACEN)),
        sinSaltos(bot.textoUltimoPaso()),
      );
      await bot.pulsar('compra', ALMACEN);
      ctx.exigir('la compra queda registrada en Contabilidad', /compra registrada en contabilidad/i.test(bot.textoUltimoPaso()), sinSaltos(bot.textoUltimoPaso()));

      const { data: pendientes } = await supabase
        .from('ci_facturas_canal_pendientes')
        .select('extracted')
        .eq('proyecto_id', OBRA_ENSAYO.id);
      const extracted = (((pendientes ?? []) as Fila[])[0]?.extracted ?? {}) as Fila;
      ctx.comprobar(
        'la factura queda a crédito a 30 días',
        extracted.condicion_pago === 'credito' && Number(extracted.dias_credito) === 30,
        JSON.stringify({ condicion_pago: extracted.condicion_pago, dias_credito: extracted.dias_credito }),
      );
      const { data: compras } = await supabase
        .from('contabilidad_compras')
        .select('cco_estado,forma_pago_cco,monto_usd')
        .eq('proyecto_id', OBRA_ENSAYO.id);
      ctx.comprobar('(dato) cómo queda la compra en Contabilidad', true, JSON.stringify(((compras ?? []) as Fila[])[0] ?? null));
    },
  },
];

export function buscarEscenario(id: string): Escenario | undefined {
  return ESCENARIOS.find((e) => e.id === id);
}

export { ErrorDeEnsayo };
