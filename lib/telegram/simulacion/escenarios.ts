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
  MATERIAL_ENSAYO_2,
  OBRA_ENSAYO,
  OBRA_ENSAYO_2,
  PERSONAS_ENSAYO,
  TELEFONO_ENSAYO_NUEVO,
  stockDeEnsayo,
  type ClavePersonaEnsayo,
  type ObraDeEnsayoLista,
} from '@/lib/telegram/simulacion/obraDeEnsayo';
import { calcularCuellosBotella, enviarAvisosCuellosBotella } from '@/lib/compras/cuellosBotella';

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
    .select('id,ticket,estado,cantidad,cantidad_compra,cantidad_despacho,abastecimiento_codigo_despacho,solo_compra,cotizando_at,cotizando_por')
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

/**
 * Qué elige el ingeniero cuando el almacén tiene parte de lo que pide (150 pedidos, 100 en
 * almacén): pedir los 100 al almacén y comprar solo 50, o comprar los 150 sin tocar el almacén.
 */
type EleccionAlmacen = 'parte' | 'todo_compra';

/** Pedido al almacén que salió del /procura (almacén primero). */
async function pedidoDeEnsayo(ctx: ContextoEscenario): Promise<Fila | null> {
  const { data } = await ctx.supabase
    .from('inv_requerimientos_salida')
    .select('id,codigo,estado,cantidad,material_id,despachador_nombre')
    .eq('proyecto_id', OBRA_ENSAYO.id);
  return ((data ?? []) as Fila[])[0] ?? null;
}

/** El ingeniero pide 150 por /procura; con lo que elige, queda esperando al Contador. */
async function registrarProcura(ctx: ContextoEscenario, eleccion: EleccionAlmacen = 'parte'): Promise<Fila> {
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
  ctx.exigir(
    `ofrece pedir ${MATERIAL_ENSAYO_1.stockInicial} al almacén y comprar solo ${CANTIDAD_COMPRA}`,
    bot.botonesVigentes('ing').some((b) => b.texto.includes(`Pedir ${MATERIAL_ENSAYO_1.stockInicial} y comprar ${CANTIDAD_COMPRA}`)),
    bot.textoUltimoPaso(),
  );

  const cantidadEsperada = eleccion === 'parte' ? CANTIDAD_COMPRA : CANTIDAD_PROCURA;
  if (eleccion === 'parte') {
    await bot.pulsar('ing', `Pedir ${MATERIAL_ENSAYO_1.stockInicial} y comprar`);
    const pedido = await pedidoDeEnsayo(ctx);
    ctx.exigir(
      `queda un pedido al almacén por ${MATERIAL_ENSAYO_1.stockInicial}`,
      pedido != null && Number(pedido.cantidad) === MATERIAL_ENSAYO_1.stockInicial && pedido.estado === 'solicitado',
      JSON.stringify(pedido),
    );
    ctx.comprobar(
      'el pedido le llega a los dos depositarios con «Despachar»',
      bot.botonesVigentes('depo').some((b) => /despachar/i.test(b.texto)) &&
        bot.botonesVigentes('depo2').some((b) => /despachar/i.test(b.texto)),
      sinSaltos(textoPara(ctx, 'depo')),
    );
  } else {
    await bot.pulsar('ing', 'Comprar todo');
    ctx.comprobar('al comprar todo no se pide nada al almacén', (await pedidoDeEnsayo(ctx)) == null);
  }

  const registrada = await procuraDeEnsayo(ctx);
  ctx.exigir('la procura queda registrada', registrada != null, bot.textoUltimoPaso());
  ctx.comprobar(
    'el ticket es de ensayo (PR-0000-…): no gasta la numeración real',
    /^PR-0000-/.test(String(registrada!.ticket)),
    String(registrada!.ticket),
  );
  ctx.comprobar(
    `la procura es solo de compra: ${cantidadEsperada} a comprar y 0 del almacén`,
    Number(registrada!.cantidad) === cantidadEsperada &&
      Number(registrada!.cantidad_compra) === cantidadEsperada &&
      Number(registrada!.cantidad_despacho ?? 0) === 0 &&
      registrada!.solo_compra === true,
    JSON.stringify(registrada),
  );
  const paraContador = textoPara(ctx, 'conta');
  ctx.exigir(
    'la revisión de fondos le llega al Contador',
    bot.botonesVigentes('conta').some((b) => /^✅ hay disponibilidad/i.test(b.texto)),
    bot.textoUltimoPaso(),
  );
  ctx.comprobar(
    `el Contador ve que se compran ${cantidadEsperada} y que el almacén no despacha nada de esta procura`,
    paraContador.includes(`A comprar: ${cantidadEsperada}`) && /Despacho almac[eé]n: 0\b/.test(paraContador),
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
 * ingeniero → Contador (¿hay fondos?) → PM (¿aprueba?) → orden al comprador.
 */
async function procuraHastaAprobacion(ctx: ContextoEscenario, eleccion: EleccionAlmacen = 'parte'): Promise<Fila> {
  const { bot, supabase } = ctx;
  const registrada = await registrarProcura(ctx, eleccion);
  const aComprar = eleccion === 'parte' ? CANTIDAD_COMPRA : CANTIDAD_PROCURA;

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
  ctx.comprobar(
    'el PM ve el gasto del capítulo en la obra',
    /gasto del cap[ií]tulo en esta obra/i.test(textoPara(ctx, 'pm')),
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
    `la orden de compra es por ${aComprar} UND`,
    textoPara(ctx, 'compra').includes(`${aComprar} UND`),
    sinSaltos(textoPara(ctx, 'compra')),
  );
  ctx.comprobar(
    'la orden de compra trae «Estoy cotizando»',
    bot.botonesVigentes('compra').some((b) => /estoy cotizando/i.test(b.texto)),
    bot.botonesVigentes('compra').map((b) => b.texto).join(' | '),
  );
  ctx.comprobar(
    'al aprobar no se le pide al depositario despachar nada de esta procura',
    !bot.botonesVigentes('depo').some((b) => /confirmar verificaci[oó]n/i.test(b.texto)),
    sinSaltos(textoPara(ctx, 'depo')),
  );
  ctx.comprobar(
    'el PM lee que la orden sí llegó al comprador',
    /orden de compra enviada al comprador \(1\)/i.test(bot.textoUltimoPaso()) &&
      !/sin comprador/i.test(bot.textoUltimoPaso()),
    sinSaltos(bot.textoUltimoPaso()),
  );
  ctx.comprobar(
    `el almacén sigue con ${MATERIAL_ENSAYO_1.stockInicial}: aprobar no lo mueve`,
    (await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id)) === MATERIAL_ENSAYO_1.stockInicial,
  );
  return (await procuraDeEnsayo(ctx)) ?? registrada;
}

/** El depositario despacha el pedido al almacén que salió del /procura, con foto. */
async function despacharPedidoAlmacen(ctx: ContextoEscenario): Promise<void> {
  const { bot, supabase, obra } = ctx;
  await bot.pulsar('depo', 'Despachar');
  ctx.exigir('al tomar el pedido le pide la foto', /foto/i.test(textoPara(ctx, 'depo')), bot.textoUltimoPaso());
  await bot.foto('depo');
  ctx.comprobar(
    `con la foto salen ${MATERIAL_ENSAYO_1.stockInicial} del almacén hacia la obra`,
    (await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id)) === 0 &&
      (await stockDeEnsayo(supabase, obra.ubicacionObra1, MATERIAL_ENSAYO_1.id)) === MATERIAL_ENSAYO_1.stockInicial,
    sinSaltos(bot.textoUltimoPaso()),
  );
  const pedido = await pedidoDeEnsayo(ctx);
  ctx.comprobar('el pedido queda «despachado»', pedido?.estado === 'despachado', String(pedido?.estado));
  ctx.comprobar(
    'al ingeniero se le avisa que su pedido fue despachado',
    bot.mensajesPara('ing').some((e) => /fue despachado/i.test(sinFormato(e.texto))),
    sinSaltos(textoPara(ctx, 'ing')),
  );
}

/** El comprador carga la factura a mano y la manda a su almacén. */
async function registrarFacturaManual(ctx: ContextoEscenario, cantidad: number, precio: number): Promise<void> {
  const { bot } = ctx;
  await cargarFacturaManualHastaFoto(ctx, cantidad, precio);
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
}

/** Logística retira la factura con foto y el depositario la recibe por /ingreso contando `recibido`. */
async function retirarYRecibir(ctx: ContextoEscenario, recibido: number): Promise<void> {
  const { bot } = ctx;
  ctx.exigir(
    'el aviso de «mercancía por retirar» le llega a Logística de la obra',
    bot.botonesVigentes('logi').some((b) => /la retiro yo/i.test(b.texto)),
    bot.textoUltimoPaso(),
  );
  await bot.pulsar('logi', 'La retiro yo');
  await bot.foto('logi');
  ctx.comprobar('el retiro queda registrado con foto', /retiro registrado con foto/i.test(bot.textoUltimoPaso()), sinSaltos(bot.textoUltimoPaso()));
  ctx.comprobar(
    'los dos depositarios reciben el aviso de que va en camino',
    /mercanc[ií]a en camino al almac[eé]n/i.test(textoPara(ctx, 'depo')) &&
      /mercanc[ií]a en camino al almac[eé]n/i.test(textoPara(ctx, 'depo2')),
    `${sinSaltos(textoPara(ctx, 'depo'))} || ${sinSaltos(textoPara(ctx, 'depo2'))}`,
  );

  await bot.escribir('depo', '/ingreso');
  ctx.exigir(
    'la factura aparece precargada para el depositario',
    bot.botonesVigentes('depo').some((b) => b.texto.includes(PROVEEDOR_ENSAYO)),
    bot.textoUltimoPaso(),
  );
  await bot.pulsar('depo', PROVEEDOR_ENSAYO);
  ctx.exigir(
    'muestra la factura y pide contar lo recibido',
    bot.textoUltimoPaso().includes(FACTURA_ENSAYO) && /cantidad f[ií]sica recibida/i.test(bot.textoUltimoPaso()),
    bot.textoUltimoPaso(),
  );
  await bot.escribir('depo', String(recibido));
  ctx.exigir('pide al menos una foto del material recibido', /al menos una foto/i.test(bot.textoUltimoPaso()), bot.textoUltimoPaso());
  await bot.foto('depo');
  await bot.pulsar('depo', 'Listo con fotos');
  await bot.pulsar('depo', 'Registrar ingreso a almacén');
  ctx.comprobar('el bot confirma «Ingreso a almacén registrado»', /ingreso a almac[eé]n registrado/i.test(bot.textoUltimoPaso()), sinSaltos(bot.textoUltimoPaso()));
}

/**
 * Kardex cuadrado: en cada ubicación de ensayo, el stock es el inicial más la suma de los
 * movimientos registrados. Si no cuadra, algo movió stock sin dejar rastro (o al revés).
 */
async function comprobarKardex(ctx: ContextoEscenario): Promise<void> {
  const { supabase, obra } = ctx;
  const materiales = [MATERIAL_ENSAYO_1, MATERIAL_ENSAYO_2];
  const { data: movs } = await supabase
    .from('inv_movimientos')
    .select('ubicacion_id,material_id,delta_disponible')
    .in('material_id', materiales.map((m) => m.id));
  const { data: stock } = await supabase
    .from('inventario_stock')
    .select('ubicacion_id,material_id,cantidad_disponible')
    .in('material_id', materiales.map((m) => m.id));
  const suma = new Map<string, number>();
  for (const m of (movs ?? []) as Fila[]) {
    const k = `${String(m.ubicacion_id)}|${String(m.material_id)}`;
    suma.set(k, (suma.get(k) ?? 0) + (Number(m.delta_disponible) || 0));
  }
  const descuadres: string[] = [];
  const claves = new Set<string>([
    ...Array.from(suma.keys()),
    ...((stock ?? []) as Fila[]).map((s) => `${String(s.ubicacion_id)}|${String(s.material_id)}`),
  ]);
  for (const k of Array.from(claves)) {
    const [ub, mat] = k.split('|');
    const fila = ((stock ?? []) as Fila[]).find((s) => s.ubicacion_id === ub && s.material_id === mat);
    const actual = Number(fila?.cantidad_disponible ?? 0);
    const inicial = ub === ALMACEN_ENSAYO.id ? materiales.find((m) => m.id === mat)?.stockInicial ?? 0 : 0;
    const esperado = inicial + (suma.get(k) ?? 0);
    if (Math.abs(actual - esperado) > 1e-6) {
      const nombre = obra.ubicaciones.find((u) => u.id === ub)?.nombre ?? ub;
      descuadres.push(`${nombre}: stock ${actual}, kardex ${esperado}`);
    }
  }
  ctx.comprobar('kardex cuadrado: el stock de cada ubicación coincide con sus movimientos', descuadres.length === 0, descuadres.join(' · '));
}

/** Diferencias que el control de compras guardó para las facturas de la obra de ensayo. */
async function diferenciasDeEnsayo(ctx: ContextoEscenario): Promise<Fila[]> {
  const { data: facturas } = await ctx.supabase.from('purchase_invoices').select('id').eq('proyecto_id', OBRA_ENSAYO.id);
  const ids = ((facturas ?? []) as Fila[]).map((f) => String(f.id));
  if (!ids.length) return [];
  const { data } = await ctx.supabase
    .from('ci_control_compras')
    .select('tipo,cantidad_pedida,cantidad_facturada,cantidad_recibida,precio_unitario,precio_referencia,monto_diferencia,moneda')
    .in('purchase_invoice_id', ids);
  return (data ?? []) as Fila[];
}

/**
 * Historial de precio: una compra anterior del material de ensayo a 2,50 USD, para que la
 * siguiente se compare contra ella. Vive en la obra de ensayo y se borra al reiniciar.
 */
async function sembrarCompraAnterior(ctx: ContextoEscenario, precio: number): Promise<void> {
  const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { data: compra, error } = await ctx.supabase
    .from('contabilidad_compras')
    .insert({
      invoice_number: 'F-ENSAYO-HIST',
      supplier_rif: 'J-000000000',
      supplier_name: PROVEEDOR_ENSAYO,
      fecha: hace30,
      total_amount: precio * 10,
      monto_usd: precio * 10,
      moneda: 'USD',
      proyecto_id: OBRA_ENSAYO.id,
    } as never)
    .select('id')
    .single();
  ctx.exigir('se siembra una compra anterior del material', !error && Boolean(compra), error?.message);
  const { error: eLinea } = await ctx.supabase.from('contabilidad_compra_lineas').insert({
    compra_id: (compra as { id: string }).id,
    descripcion: MATERIAL_ENSAYO_1.nombre,
    unidad: 'UND',
    cantidad: 10,
    precio_unitario: precio,
    subtotal: precio * 10,
    material_id: MATERIAL_ENSAYO_1.id,
  } as never);
  ctx.exigir('con su línea de precio', !eLinea, eLinea?.message);
}

/** El comprador abre la carga manual de la factura y llena los datos hasta que el bot pide la foto. */
async function cargarFacturaManualHastaFoto(
  ctx: ContextoEscenario,
  cantidad: number = CANTIDAD_COMPRA,
  precio: number = PRECIO_COMPRA,
): Promise<void> {
  const { bot } = ctx;
  await bot.pulsar('compra', 'Carga manual');
  await bot.escribir('compra', PROVEEDOR_ENSAYO);
  await bot.escribir('compra', FACTURA_ENSAYO);
  await bot.escribir('compra', '-');
  await bot.escribir('compra', String(cantidad));
  await bot.escribir('compra', String(precio));
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
    id: 'traspaso_foto_antes',
    titulo: 'Traspaso enviando la foto antes de tiempo: se guarda y no se vuelve a pedir',
    async correr(ctx) {
      const { bot, supabase } = ctx;
      await bot.escribir('depo', '/salida');
      await bot.pulsar('depo', 'Traspaso');
      await bot.pulsar('depo', ALMACEN_ENSAYO.nombre);
      await bot.pulsar('depo', `${OBRA_ENSAYO.nombre} (`);
      await bot.foto('depo');
      ctx.exigir(
        'la foto enviada antes de tiempo queda guardada',
        /foto guardada/i.test(bot.textoUltimoPaso()) && /no tendr[aá] que enviarla de nuevo/i.test(bot.textoUltimoPaso()),
        bot.textoUltimoPaso(),
      );
      ctx.comprobar('el traspaso sigue en el paso donde estaba', bot.pasos.at(-1)?.sesion?.paso === 'producto', JSON.stringify(bot.pasos.at(-1)?.sesion));
      await bot.escribir('depo', 'ZZ');
      await bot.pulsar('depo', MATERIAL_ENSAYO_1.nombre);
      await bot.escribir('depo', '5');
      await bot.pulsar('depo', 'Sin nota');
      ctx.exigir(
        'tras la nota va directo a confirmar, sin volver a pedir la foto',
        bot.pasos.at(-1)?.sesion?.paso === 'confirmar' && /foto: adjunta/i.test(bot.textoUltimoPaso()),
        `${JSON.stringify(bot.pasos.at(-1)?.sesion)} · ${bot.textoUltimoPaso()}`,
      );
      await bot.pulsar('depo', 'Confirmar despacho');

      const enAlmacen = await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id);
      ctx.comprobar('el stock del almacén baja 5', enAlmacen === MATERIAL_ENSAYO_1.stockInicial - 5, `quedó en ${enAlmacen} · ${bot.textoUltimoPaso()}`);
      const { data } = await supabase
        .from('transferencias_inventario')
        .select('fotos')
        .eq('origen_ubicacion_id', ALMACEN_ENSAYO.id);
      const t = ((data ?? []) as Array<Record<string, unknown>>)[0];
      ctx.comprobar('la transferencia guarda esa foto', Array.isArray(t?.fotos) && (t?.fotos as unknown[]).length === 1, JSON.stringify(t?.fotos));
    },
  },
  {
    id: 'compra_completa',
    titulo:
      'Cadena completa con almacén primero: ingeniero pide 150 → el almacén despacha 100 → Contador → PM → comprador compra 50 → retiro → ingreso',
    async correr(ctx) {
      const { bot, supabase } = ctx;
      const procura = await procuraHastaAprobacion(ctx, 'parte');
      await despacharPedidoAlmacen(ctx);
      ctx.comprobar('despachar el pedido no repite la orden de compra', ordenesDeCompraRecibidas(ctx) === 1, `le llegaron ${ordenesDeCompraRecibidas(ctx)}`);

      await registrarFacturaManual(ctx, CANTIDAD_COMPRA, PRECIO_COMPRA);
      const { data: compras } = await supabase
        .from('contabilidad_compras')
        .select('id,monto_usd,monto_ves,tasa_bcv_ves_por_usd,procura_id,document_storage_path')
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
        `Bs ${String(compra?.monto_ves)} · tasa ${tasa}`,
      );
      ctx.comprobar('la compra queda ligada a la procura', compra?.procura_id === procura.id, String(compra?.procura_id));
      ctx.comprobar('la compra guarda la foto de la factura', Boolean(String(compra?.document_storage_path ?? '').trim()));
      ctx.comprobar(
        'registrar la factura todavía no suma stock: falta recibirla',
        (await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id)) === 0,
      );
      ctx.comprobar('sin diferencias, el control de compras no guarda nada', (await diferenciasDeEnsayo(ctx)).length === 0, JSON.stringify(await diferenciasDeEnsayo(ctx)));

      await retirarYRecibir(ctx, CANTIDAD_COMPRA);
      const enAlmacen = await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id);
      ctx.comprobar(`el almacén sube a ${CANTIDAD_COMPRA} con lo comprado`, enAlmacen === CANTIDAD_COMPRA, `quedó en ${enAlmacen}`);
      const retiroFinal = await retiroDeEnsayo(ctx);
      ctx.comprobar('el retiro queda «entregado»', retiroFinal?.estado === 'entregado', String(retiroFinal?.estado));
      const procuraFinal = await procuraDeEnsayo(ctx);
      ctx.comprobar('la solicitud queda «recibida»', procuraFinal?.estado === 'recibida', String(procuraFinal?.estado));
      ctx.comprobar(
        'al ingeniero se le avisa que su material ya está en el almacén',
        bot.mensajesPara('ing').some((e) => /ya est[aá] en el almac[eé]n/i.test(sinFormato(e.texto))),
        sinSaltos(textoPara(ctx, 'ing')),
      );
      ctx.comprobar('sin diferencias tampoco al recibir', (await diferenciasDeEnsayo(ctx)).length === 0, JSON.stringify(await diferenciasDeEnsayo(ctx)));
      ctx.comprobar('la sesión del bot vuelve al menú', bot.pasos.at(-1)?.sesion?.contexto === 'menu', JSON.stringify(bot.pasos.at(-1)?.sesion));
      await comprobarKardex(ctx);
    },
  },
  {
    id: 'compra_todo_sin_almacen',
    titulo: 'Hay 100 en almacén pero el ingeniero elige comprar los 150: se compran 150 y el almacén no se toca',
    async correr(ctx) {
      const { bot, supabase } = ctx;
      await procuraHastaAprobacion(ctx, 'todo_compra');
      ctx.comprobar(
        'el almacén queda intacto',
        (await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id)) === MATERIAL_ENSAYO_1.stockInicial,
      );
      ctx.comprobar('ningún depositario recibió un pedido', bot.mensajesPara('depo').length === 0 && bot.mensajesPara('depo2').length === 0);
      await comprobarKardex(ctx);
    },
  },
  {
    id: 'compra_solo_almacen',
    titulo: 'El almacén tiene todo lo pedido: se pide al almacén y no se registra ninguna compra',
    async correr(ctx) {
      const { bot } = ctx;
      await bot.escribir('ing', '/procura');
      await bot.pulsar('ing', 'Estructura');
      await bot.escribir('ing', 'ZZ MATERIAL DE PRUEBA');
      await bot.pulsar('ing', `Sí: ${MATERIAL_ENSAYO_1.nombre}`);
      await bot.escribir('ing', '30');
      await bot.pulsar('ing', 'UND');
      await bot.pulsar('ing', 'Media');
      ctx.exigir(
        'ofrece pedirlo al almacén en vez de comprarlo',
        bot.botonesVigentes('ing').some((b) => /pedirlo al almac[eé]n/i.test(b.texto)),
        bot.textoUltimoPaso(),
      );
      await bot.pulsar('ing', 'Pedirlo al almacén');
      const pedido = await pedidoDeEnsayo(ctx);
      ctx.comprobar('queda un pedido al almacén por 30', Number(pedido?.cantidad) === 30 && pedido?.estado === 'solicitado', JSON.stringify(pedido));
      ctx.comprobar('no se registra ninguna procura', (await procuraDeEnsayo(ctx)) == null);
      ctx.comprobar('el Contador no recibe nada', bot.mensajesPara('conta').length === 0);
      ctx.comprobar('la sesión vuelve al menú', bot.pasos.at(-1)?.sesion?.contexto === 'menu', JSON.stringify(bot.pasos.at(-1)?.sesion));
    },
  },
  {
    id: 'compra_permisos',
    titulo: 'Quién puede pedir por /procura: el PM y el depositario no; el ingeniero sí',
    async correr(ctx) {
      const { bot } = ctx;
      await bot.escribir('pm', '/procura');
      ctx.comprobar('al PM (aprobador) se le dice que no puede solicitar', /no tienes permiso para solicitar/i.test(bot.textoUltimoPaso()), sinSaltos(bot.textoUltimoPaso()));
      ctx.comprobar('el PM no queda dentro del flujo de procura', bot.pasos.at(-1)?.sesion?.contexto !== 'procura_departamento', JSON.stringify(bot.pasos.at(-1)?.sesion));
      await bot.escribir('depo', '/procura');
      ctx.comprobar(
        'al depositario (sin usuario de compras) no se le abre la procura',
        bot.pasos.at(-1)?.sesion?.contexto !== 'procura_departamento' && !bot.textoUltimoPaso().includes('Elige el capítulo'),
        sinSaltos(bot.textoUltimoPaso()),
      );
      ctx.comprobar('(dato) qué le responde al depositario', true, sinSaltos(bot.textoUltimoPaso()));
      await bot.escribir('ing', '/procura');
      ctx.comprobar('al ingeniero sí se le abre', bot.textoUltimoPaso().includes(OBRA_ENSAYO.nombre), sinSaltos(bot.textoUltimoPaso()));
      ctx.comprobar('no quedó registrada ninguna procura', (await procuraDeEnsayo(ctx)) == null);
    },
  },
  {
    id: 'compra_catalogo',
    titulo: 'Catálogo por categorías y búsqueda «cabilla 1/2» que no confunde medidas',
    async correr(ctx) {
      const { bot } = ctx;
      await bot.escribir('ing', '/procura');
      await bot.pulsar('ing', 'Estructura');
      await bot.pulsar('ing', 'Elegir del catálogo');
      const categorias = bot.botonesVigentes('ing').map((b) => b.texto);
      ctx.comprobar(
        'muestra las categorías de obra civil (acero, agregados, bloques, sanitarios, servicios…)',
        ['Acero', 'Arena', 'Bloques', 'Sanitarios', 'Servicios', 'Herramientas', 'Puertas', 'Techos'].every((c) =>
          categorias.some((t) => t.includes(c)),
        ),
        categorias.join(' | '),
      );
      await bot.pulsar('ing', 'Acero y cabillas');
      const items = bot.botonesVigentes('ing').map((b) => b.texto);
      ctx.comprobar('dentro de «Acero y cabillas» aparecen cabillas', items.some((t) => /cabilla/i.test(t)), items.join(' | '));
      ctx.comprobar('la lista larga trae páginas', items.some((t) => t === '▶'), items.join(' | '));
      await bot.pulsar('ing', 'Categorías');
      await bot.pulsar('ing', 'Mejor lo escribo');
      await bot.escribir('ing', 'cabilla 1/2');
      const resultado = bot.botonesVigentes('ing').map((b) => b.texto);
      ctx.comprobar(
        'buscar «cabilla 1/2» trae la de 1/2 y no la de 1/4 ni 3/8',
        resultado.some((t) => /cabilla/i.test(t) && /1\/2/.test(t)) && !resultado.some((t) => /cabilla/i.test(t) && /(1\/4|3\/8)/.test(t)),
        resultado.join(' | '),
      );
      await bot.escribir('ing', '/cancelar');
      ctx.comprobar('no quedó registrada ninguna procura', (await procuraDeEnsayo(ctx)) == null);
    },
  },
  {
    id: 'compra_rechazada',
    titulo: 'El PM rechaza con motivo: el ingeniero se entera, el comprador no recibe nada y el pedido al almacén sigue',
    async correr(ctx) {
      const { bot, supabase } = ctx;
      await registrarProcura(ctx, 'parte');
      await bot.pulsar('conta', '✅ Hay disponibilidad');
      await bot.pulsar('pm', 'Rechazar');
      ctx.exigir('pide el motivo del rechazo', /motivo del rechazo/i.test(bot.textoUltimoPaso()), sinSaltos(bot.textoUltimoPaso()));
      await bot.escribir('pm', 'No es prioridad esta semana');
      const p = await procuraDeEnsayo(ctx);
      ctx.comprobar('la procura queda «rechazada»', p?.estado === 'rechazada', String(p?.estado));
      ctx.comprobar(
        'al ingeniero le llega el rechazo con el motivo',
        bot.mensajesPara('ing').some((e) => /no es prioridad esta semana/i.test(sinFormato(e.texto))),
        sinSaltos(textoPara(ctx, 'ing')),
      );
      ctx.comprobar('el comprador no recibe ninguna orden', ordenesDeCompraRecibidas(ctx) === 0);
      const pedido = await pedidoDeEnsayo(ctx);
      ctx.comprobar('el pedido al almacén sigue vigente (no depende de la compra)', pedido?.estado === 'solicitado', String(pedido?.estado));
      ctx.comprobar(
        'el almacén no se mueve',
        (await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id)) === MATERIAL_ENSAYO_1.stockInicial,
      );
    },
  },
  {
    id: 'compra_con_diferencias',
    titulo:
      'Control de compras: facturan 60 de 50 pedidos, a 4 USD cuando antes costaba 2,50, y llegan 55 de los 60',
    async correr(ctx) {
      const { bot, supabase } = ctx;
      await sembrarCompraAnterior(ctx, PRECIO_COMPRA);
      await procuraHastaAprobacion(ctx, 'parte');
      const conta0 = bot.mensajesPara('conta').length;
      const compra0 = bot.mensajesPara('compra').length;

      await registrarFacturaManual(ctx, 60, 4);
      const tras = await diferenciasDeEnsayo(ctx);
      const tipos = tras.map((d) => String(d.tipo));
      ctx.comprobar('detecta que se facturó más de lo pedido (60 de 50)', tipos.includes('facturado_mayor_pedido'), JSON.stringify(tras));
      ctx.comprobar('detecta el precio alto (4 USD contra 2,50 de referencia)', tipos.includes('precio_alto'), JSON.stringify(tras));
      const alto = tras.find((d) => d.tipo === 'precio_alto');
      ctx.comprobar('la referencia guardada es 2,50 USD', Number(alto?.precio_referencia) === PRECIO_COMPRA, JSON.stringify(alto));
      const avisoConta = bot.mensajesPara('conta').slice(conta0).map((e) => sinFormato(e.texto)).join(' ');
      const avisoCompra = bot.mensajesPara('compra').slice(compra0).map((e) => sinFormato(e.texto)).join(' ');
      ctx.comprobar('el aviso de diferencias le llega al Contador', /diferencia/i.test(avisoConta) && /USD\/u/.test(avisoConta), sinSaltos(avisoConta));
      ctx.comprobar('y al comprador', /diferencia/i.test(avisoCompra), sinSaltos(avisoCompra));

      await retirarYRecibir(ctx, 55);
      const final = await diferenciasDeEnsayo(ctx);
      ctx.comprobar(
        'al recibir detecta que llegaron 55 de 60 facturados',
        final.some((d) => d.tipo === 'recibido_menor_facturado' && Number(d.cantidad_recibida) === 55),
        JSON.stringify(final),
      );
      ctx.comprobar('cada diferencia se guarda una sola vez', final.length === new Set(final.map((d) => String(d.tipo))).size, JSON.stringify(final.map((d) => d.tipo)));
      const enAlmacen = await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id);
      ctx.comprobar(
        `al almacén entra lo contado (55), no lo facturado: queda en ${MATERIAL_ENSAYO_1.stockInicial + 55}`,
        enAlmacen === MATERIAL_ENSAYO_1.stockInicial + 55,
        `quedó en ${enAlmacen}`,
      );
      await comprobarKardex(ctx);
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
      ctx.comprobar('la orden de compra dice que es a crédito', /compra a cr[eé]dito/i.test(textoPara(ctx, 'compra')), sinSaltos(textoPara(ctx, 'compra')));
      ctx.comprobar(
        'el ingeniero ve en su ticket que fue aprobada a crédito',
        bot.mensajesPara('ing').some((e) => /aprobada a cr[eé]dito/i.test(sinFormato(e.texto))),
        sinSaltos(textoPara(ctx, 'ing')),
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
    },
  },
  {
    id: 'pedido_dos_depositarios',
    titulo: 'Dos depositarios: los dos reciben el pedido, solo uno lo despacha y el stock baja una sola vez',
    async correr(ctx) {
      const { bot, supabase } = ctx;
      await pedirMaterial(ctx, 'uso', 5);
      ctx.exigir(
        'el segundo depositario también recibe «Despachar»',
        bot.botonesVigentes('depo2').some((b) => /despachar/i.test(b.texto)),
        sinSaltos(textoPara(ctx, 'depo2')),
      );
      const datoDespachar = bot.botonesVigentes('depo2').find((b) => /despachar/i.test(b.texto))!.data!;
      await bot.pulsar('depo', 'Despachar');
      await bot.pulsarDato('depo2', datoDespachar, 'Despachar (el mismo pedido)');
      ctx.comprobar(
        'al segundo se le dice que ya lo está despachando el primero',
        /ya lo est[aá] despachando depo ensayo/i.test(bot.textoUltimoPaso()),
        sinSaltos(bot.textoUltimoPaso()),
      );
      await bot.foto('depo2');
      ctx.comprobar(
        'una foto del segundo no mueve el stock',
        (await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id)) === MATERIAL_ENSAYO_1.stockInicial,
        sinSaltos(bot.textoUltimoPaso()),
      );
      await bot.foto('depo');
      ctx.comprobar(
        'con la foto de quien lo tomó, el stock baja 5 una sola vez',
        (await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id)) === MATERIAL_ENSAYO_1.stockInicial - 5,
      );
      const p = await pedidoGuardado(ctx);
      ctx.comprobar('el pedido queda a nombre del primero', p?.despachador_nombre === 'Depo Ensayo', String(p?.despachador_nombre));
      await comprobarKardex(ctx);
    },
  },
  {
    id: 'torre_control',
    titulo: 'Torre de Control: procura sin comprar, «Estoy cotizando», pedido sin despachar y stock bajo el mínimo',
    async correr(ctx) {
      const { bot, supabase } = ctx;
      // Mínimo de 60 para el material 2 (hay 50) y una procura aprobada con su pedido al almacén.
      const { error: eMin } = await supabase
        .from('ci_inventario_reorden_obra')
        .upsert({ proyecto_id: OBRA_ENSAYO.id, material_id: MATERIAL_ENSAYO_2.id, reorder_point: 60 }, { onConflict: 'proyecto_id,material_id' });
      ctx.exigir('se fija un mínimo de 60 para el material 2', !eMin, eMin?.message);
      const procura = await procuraHastaAprobacion(ctx, 'parte');

      const enDias = (d: number) => new Date(Date.now() + d * 86_400_000);
      const etapa = async (clave: string, dias: number) =>
        (await calcularCuellosBotella(supabase, { proyectoId: OBRA_ENSAYO.id, ahora: enDias(dias) })).etapas.find((e) => e.clave === clave)!;

      const hoy = await etapa('compra', 0);
      ctx.comprobar('recién aprobada, la procura está en «Aprobada sin comprar» sin estar detenida', hoy.items.length === 1 && !hoy.items[0]!.detenido, JSON.stringify(hoy.items));
      const tresDias = await etapa('compra', 3);
      ctx.comprobar('a los 3 días está detenida (plazo 2 días)', tresDias.items[0]?.detenido === true, JSON.stringify(tresDias.items));
      const stock = await etapa('stock', 0);
      ctx.comprobar(
        'el material 2 aparece bajo el mínimo (50 de 60)',
        stock.items.some((i) => i.referencia === MATERIAL_ENSAYO_2.nombre && /quedan 50/.test(i.detalle) && /m[ií]nimo 60/.test(i.detalle)),
        JSON.stringify(stock.items),
      );
      ctx.comprobar(
        'el material 1 no aparece bajo el mínimo (no tiene mínimo)',
        !stock.items.some((i) => i.referencia === MATERIAL_ENSAYO_1.nombre),
        JSON.stringify(stock.items),
      );
      const pedidos = await etapa('pedidos', 2);
      ctx.comprobar('el pedido al almacén sin despachar aparece detenido a los 2 días', pedidos.items.some((i) => i.detenido), JSON.stringify(pedidos.items));

      // Aviso diario a los 3 días: se captura en vez de enviarlo.
      const capturados: Array<{ chat: string; html: string }> = [];
      const resumen = await calcularCuellosBotella(supabase, { proyectoId: OBRA_ENSAYO.id, ahora: enDias(3) });
      await enviarAvisosCuellosBotella(supabase, {
        resumen,
        enviar: async (chat, html) => {
          capturados.push({ chat, html });
        },
      });
      const para = (clave: ClavePersonaEnsayo) =>
        sinFormato(capturados.filter((c) => c.chat === String(PERSONAS_ENSAYO[clave].chatId)).map((c) => c.html).join('\n'));
      ctx.comprobar(
        'al comprador le llega el aviso de la procura sin comprar y del material bajo el mínimo',
        /aprobada sin comprar/i.test(para('compra')) && /bajo el m[ií]nimo/i.test(para('compra')),
        sinSaltos(para('compra')),
      );
      ctx.comprobar(
        'a los dos depositarios les llega el pedido sin despachar',
        /pedido de material sin despachar/i.test(para('depo')) && /pedido de material sin despachar/i.test(para('depo2')),
        `${sinSaltos(para('depo'))} || ${sinSaltos(para('depo2'))}`,
      );
      ctx.comprobar('el aviso trae el enlace a la Torre de Control', /torre de control/i.test(para('compra')), sinSaltos(para('compra')));
      ctx.comprobar('un solo mensaje por persona', new Set(capturados.map((c) => c.chat)).size === capturados.length, String(capturados.length));

      await bot.pulsar('compra', 'Estoy cotizando');
      const marcada = await procuraDeEnsayo(ctx);
      ctx.comprobar('queda marcada en cotización por el comprador', Boolean(marcada?.cotizando_at) && marcada?.cotizando_por === 'Compra Ensayo', JSON.stringify(marcada));
      const cotizando3 = await etapa('compra', 3);
      ctx.comprobar(
        'en cotización, a los 3 días ya no está detenida y dice quién cotiza',
        cotizando3.items[0]?.detenido === false && /en cotizaci[oó]n por compra ensayo/i.test(cotizando3.items[0]?.detalle ?? ''),
        JSON.stringify(cotizando3.items),
      );
      const cotizando6 = await etapa('compra', 6);
      ctx.comprobar('a los 6 días de cotización vuelve a estar detenida (plazo 5 días)', cotizando6.items[0]?.detenido === true, JSON.stringify(cotizando6.items));
      ctx.comprobar('(dato) procura', true, String(procura.ticket));
    },
  },
  {
    id: 'vinculo_telefono',
    titulo: 'Vincular Telegram compartiendo el número: el propio entra, el ajeno no, y no se pisa un vínculo',
    async correr(ctx) {
      const { bot, supabase } = ctx;
      const filaNuevo = async () => {
        const { data } = await supabase
          .from('ci_proyecto_nomina')
          .select('telegram_chat_id')
          .eq('id', PERSONAS_ENSAYO.nuevo.nominaId)
          .maybeSingle();
        return (data as { telegram_chat_id?: number | null } | null)?.telegram_chat_id ?? null;
      };
      ctx.exigir('la persona nueva está en la nómina sin Telegram', (await filaNuevo()) == null);

      await bot.contacto('nuevo', TELEFONO_ENSAYO_NUEVO, 'ing');
      ctx.comprobar('reenviar el contacto de otra persona no vincula', /solo se acepta el n[uú]mero de este mismo telegram/i.test(bot.textoUltimoPaso()) && (await filaNuevo()) == null, sinSaltos(bot.textoUltimoPaso()));
      await bot.contacto('nuevo', '0412-9990000');
      ctx.comprobar('un número que no está en ninguna nómina no vincula', /no est[aá] en la n[oó]mina/i.test(bot.textoUltimoPaso()) && (await filaNuevo()) == null, sinSaltos(bot.textoUltimoPaso()));

      await bot.contacto('nuevo', '+58 414 999 0707');
      ctx.comprobar(
        'con su propio número (en otro formato) queda vinculado',
        /listo/i.test(bot.textoUltimoPaso()) && Number(await filaNuevo()) === PERSONAS_ENSAYO.nuevo.chatId,
        sinSaltos(bot.textoUltimoPaso()),
      );
      ctx.comprobar('le dice su rol y su obra', /ayudante · zz · pruebas del bot/i.test(bot.textoUltimoPaso()), sinSaltos(bot.textoUltimoPaso()));
      const { data: wl } = await supabase
        .from('ci_telegram_whitelist')
        .select('activo')
        .eq('chat_id', PERSONAS_ENSAYO.nuevo.chatId)
        .maybeSingle();
      ctx.comprobar('queda autorizado en la lista blanca del bot', (wl as { activo?: boolean } | null)?.activo === true, JSON.stringify(wl));

      await bot.contacto('nuevo', TELEFONO_ENSAYO_NUEVO);
      ctx.comprobar('repetirlo dice que ya estaba registrado', /ya estaba registrado/i.test(bot.textoUltimoPaso()), sinSaltos(bot.textoUltimoPaso()));
      await bot.contacto('ing', TELEFONO_ENSAYO_NUEVO);
      ctx.comprobar(
        'otra persona con ese mismo número no le quita el vínculo',
        /ya est[aá] vinculado a otro telegram/i.test(bot.textoUltimoPaso()) && Number(await filaNuevo()) === PERSONAS_ENSAYO.nuevo.chatId,
        sinSaltos(bot.textoUltimoPaso()),
      );
    },
  },
];

export function buscarEscenario(id: string): Escenario | undefined {
  return ESCENARIOS.find((e) => e.id === id);
}

export { ErrorDeEnsayo };
