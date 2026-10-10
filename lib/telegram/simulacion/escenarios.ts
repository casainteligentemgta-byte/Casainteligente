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
];

export function buscarEscenario(id: string): Escenario | undefined {
  return ESCENARIOS.find((e) => e.id === id);
}

export { ErrorDeEnsayo };
