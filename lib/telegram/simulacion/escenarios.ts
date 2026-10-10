/**
 * Recorridos completos que el bot de ensayo sabe hacer solo.
 *
 * Cada uno conversa con el bot paso a paso y al final comprueba lo que quedó en la
 * base de datos (stock, registros, fotos). Si un paso no sale como se espera, el
 * recorrido se detiene y el reporte dice exactamente en cuál.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ErrorDeEnsayo, type BotDeEnsayo } from '@/lib/telegram/simulacion/botDeEnsayo';
import {
  ALMACEN_ENSAYO,
  MATERIAL_ENSAYO_1,
  OBRA_ENSAYO,
  OBRA_ENSAYO_2,
  stockDeEnsayo,
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
];

export function buscarEscenario(id: string): Escenario | undefined {
  return ESCENARIOS.find((e) => e.id === id);
}

export { ErrorDeEnsayo };
