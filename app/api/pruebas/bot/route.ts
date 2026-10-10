import { NextResponse } from 'next/server';
import { BotDeEnsayo, ErrorDeEnsayo, leerGuion, type PasoGuion } from '@/lib/telegram/simulacion/botDeEnsayo';
import {
  ESCENARIOS,
  buscarEscenario,
  type Comprobacion,
  type Escenario,
} from '@/lib/telegram/simulacion/escenarios';
import {
  ALMACEN_ENSAYO,
  MATERIAL_ENSAYO_1,
  MATERIAL_ENSAYO_2,
  PERSONAS_ENSAYO,
  cargarObraDeEnsayo,
  reiniciarObraDeEnsayo,
  stockDeEnsayo,
} from '@/lib/telegram/simulacion/obraDeEnsayo';
import { telegramSupabaseAdmin } from '@/lib/telegram/supabaseAdmin';
import { handleTelegramWebhookRoutePost } from '@/lib/telegram/webhookRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Los ensayos escriben en la obra ficticia, así que solo existen fuera de producción:
 * en las copias de prueba de Vercel (protegidas por su inicio de sesión) y en desarrollo.
 * En casainteligente.company esta ruta responde 404.
 */
function ensayosHabilitados(): boolean {
  const entorno = process.env.VERCEL_ENV?.trim();
  if (entorno) return entorno === 'preview' || entorno === 'development';
  return process.env.NODE_ENV !== 'production';
}

function decodificarGuion(valor: string): unknown {
  const b64 = valor.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
}

/**
 * GET /api/pruebas/bot
 *   (sin parámetros)        lista de recorridos y personas
 *   ?escenario=<id>         corre un recorrido completo (reinicia la obra de ensayo antes)
 *   ?escenario=todos        corre todos los recorridos y deja la obra de ensayo limpia
 *   &grupo=<prefijo>        con «todos»: solo los recorridos cuyo id empieza así (salida, pedido, traspaso, compra)
 *   &detalle=1              incluye la conversación completa, paso a paso
 *   ?guion=<json en base64> corre pasos sueltos: [{"q":"depo","t":"/salida"},{"q":"depo","b":"obrero"}]
 *   &reiniciar=1            con guion: deja la obra de ensayo como al principio antes de empezar
 */
export async function GET(req: Request) {
  if (!ensayosHabilitados()) {
    return NextResponse.json({ ok: false, error: 'No disponible.' }, { status: 404 });
  }

  const inicio = Date.now();
  const q = new URL(req.url).searchParams;
  const escenarioId = q.get('escenario')?.trim() || null;
  const guionCrudo = q.get('guion')?.trim() || null;

  if (!escenarioId && !guionCrudo) {
    return NextResponse.json({
      ok: true,
      recorridos: ESCENARIOS.map((e) => ({ id: e.id, titulo: e.titulo })),
      personas: Object.values(PERSONAS_ENSAYO).map((p) => ({ clave: p.clave, nombre: p.nombre, rol: p.rol })),
    });
  }

  const admin = telegramSupabaseAdmin();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: 'Servidor sin credenciales de base de datos.' }, { status: 503 });
  }
  const supabase = admin.client;

  let guion: PasoGuion[] | null = null;
  if (guionCrudo) {
    let json: unknown;
    try {
      json = decodificarGuion(guionCrudo);
    } catch {
      return NextResponse.json({ ok: false, error: 'El guion no es JSON válido en base64.' }, { status: 400 });
    }
    const leido = leerGuion(json);
    if (!leido.ok) return NextResponse.json({ ok: false, error: leido.error }, { status: 400 });
    guion = leido.guion;
  }
  const escenario = escenarioId && escenarioId !== 'todos' ? buscarEscenario(escenarioId) : undefined;
  if (escenarioId && escenarioId !== 'todos' && !escenario) {
    return NextResponse.json({ ok: false, error: `No existe el recorrido «${escenarioId}».` }, { status: 404 });
  }

  try {
    const obra = await cargarObraDeEnsayo(supabase);
    const detallado = q.get('detalle') === '1' || Boolean(guion);

    const despachar = async (update: Record<string, unknown>) => {
      const secreto = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
      const res = await handleTelegramWebhookRoutePost(
        new Request('https://ensayo.invalid/api/webhooks/telegram', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(secreto ? { 'x-telegram-bot-api-secret-token': secreto } : {}),
          },
          body: JSON.stringify(update),
        }),
      );
      return res.json().catch(() => null);
    };

    const stockActual = async () => ({
      almacen: {
        material1: await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id),
        material2: await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_2.id),
      },
      obra1: { material1: await stockDeEnsayo(supabase, obra.ubicacionObra1, MATERIAL_ENSAYO_1.id) },
      obra2: { material1: await stockDeEnsayo(supabase, obra.ubicacionObra2, MATERIAL_ENSAYO_1.id) },
    });

    /** Corre un recorrido (o un guion) y arma su reporte. */
    const correr = async (escenarioACorrer: Escenario | null, reiniciar: boolean) => {
      const t0 = Date.now();
      const limpieza = reiniciar ? await reiniciarObraDeEnsayo(supabase, obra) : [];
      const fallosLimpieza = limpieza.filter((l) => !l.ok);
      const bot = new BotDeEnsayo(supabase, obra, despachar);

      const comprobaciones: Comprobacion[] = [];
      let detenido: string | null = null;
      const comprobar = (que: string, ok: boolean, detalle?: string) => {
        comprobaciones.push(ok && !que.startsWith('(dato)') ? { que, ok } : { que, ok, detalle: detalle?.slice(0, 600) });
      };
      const exigir = (que: string, ok: boolean, detalle?: string) => {
        comprobar(que, ok, detalle);
        if (!ok) throw new ErrorDeEnsayo(`No se cumplió: ${que}`);
      };

      try {
        if (escenarioACorrer) await escenarioACorrer.correr({ bot, supabase, obra, comprobar, exigir });
        else if (guion) await bot.ejecutarGuion(guion);
      } catch (e) {
        detenido = e instanceof Error ? e.message : String(e);
        if (!(e instanceof ErrorDeEnsayo)) console.error('[pruebas/bot]', e);
      }

      const paso = !detenido && comprobaciones.every((c) => c.ok) && fallosLimpieza.length === 0;
      // Reporte corto: si todo pasó basta el resumen; si no, los últimos pasos dicen dónde falló.
      const pasos = detallado
        ? bot.pasos
        : paso
          ? undefined
          : bot.pasos.slice(-3);
      return {
        recorrido: escenarioACorrer ? { id: escenarioACorrer.id, titulo: escenarioACorrer.titulo } : null,
        paso,
        detenido,
        comprobaciones: detallado || !paso ? comprobaciones : comprobaciones.filter((c) => c.detalle),
        nComprobaciones: comprobaciones.length,
        nPasos: bot.pasos.length,
        fallosLimpieza,
        stock: await stockActual(),
        pasos,
        duracionMs: Date.now() - t0,
      };
    };

    /** Un recorrido con nombre no deja nada tras de sí: la obra de ensayo vuelve a quedar limpia. */
    const correrYLimpiar = async (e: Escenario) => {
      const resultado = await correr(e, true);
      const sobrantes = (await reiniciarObraDeEnsayo(supabase, obra)).filter((l) => !l.ok);
      return sobrantes.length
        ? { ...resultado, paso: false, fallosLimpieza: [...resultado.fallosLimpieza, ...sobrantes] }
        : resultado;
    };

    if (escenarioId === 'todos') {
      // Correrlos todos de una vez puede pasar de dos minutos: por grupos cada llamada es corta.
      const grupo = q.get('grupo')?.trim().toLowerCase() || '';
      const elegidos = grupo ? ESCENARIOS.filter((e) => e.id.startsWith(grupo)) : ESCENARIOS;
      if (!elegidos.length) {
        return NextResponse.json({ ok: false, error: `Ningún recorrido empieza por «${grupo}».` }, { status: 404 });
      }
      const resultados: Array<Awaited<ReturnType<typeof correr>>> = [];
      for (const e of elegidos) resultados.push(await correrYLimpiar(e));
      return NextResponse.json({
        ok: true,
        pasaron: resultados.filter((r) => r.paso).length,
        total: resultados.length,
        resultados,
        duracionMs: Date.now() - inicio,
      });
    }

    // Un guion libre deja la conversación abierta para poder continuarla en otra llamada.
    const resultado = escenario
      ? await correrYLimpiar(escenario)
      : await correr(null, q.get('reiniciar') === '1');
    return NextResponse.json({ ok: true, ...resultado, duracionMs: Date.now() - inicio });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Error en el ensayo.';
    return NextResponse.json({ ok: false, error: mensaje, duracionMs: Date.now() - inicio }, { status: 500 });
  }
}
