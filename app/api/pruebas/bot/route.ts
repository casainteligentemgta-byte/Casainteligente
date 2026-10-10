import { NextResponse } from 'next/server';
import { BotDeEnsayo, ErrorDeEnsayo, leerGuion, type PasoGuion } from '@/lib/telegram/simulacion/botDeEnsayo';
import { ESCENARIOS, buscarEscenario, type Comprobacion } from '@/lib/telegram/simulacion/escenarios';
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
  const escenario = escenarioId ? buscarEscenario(escenarioId) : undefined;
  if (escenarioId && !escenario) {
    return NextResponse.json({ ok: false, error: `No existe el recorrido «${escenarioId}».` }, { status: 404 });
  }

  try {
    const obra = await cargarObraDeEnsayo(supabase);
    const reiniciar = Boolean(escenario) || q.get('reiniciar') === '1';
    const limpieza = reiniciar ? await reiniciarObraDeEnsayo(supabase, obra) : [];
    const fallosLimpieza = limpieza.filter((l) => !l.ok);

    const bot = new BotDeEnsayo(supabase, obra, async (update) => {
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
    });

    const comprobaciones: Comprobacion[] = [];
    let detenido: string | null = null;
    const comprobar = (que: string, ok: boolean, detalle?: string) => {
      comprobaciones.push(ok ? { que, ok } : { que, ok, detalle: detalle?.slice(0, 600) });
    };
    const exigir = (que: string, ok: boolean, detalle?: string) => {
      comprobar(que, ok, detalle);
      if (!ok) throw new ErrorDeEnsayo(`No se cumplió: ${que}`);
    };

    try {
      if (escenario) await escenario.correr({ bot, supabase, obra, comprobar, exigir });
      else if (guion) await bot.ejecutarGuion(guion);
    } catch (e) {
      detenido = e instanceof Error ? e.message : String(e);
      if (!(e instanceof ErrorDeEnsayo)) console.error('[pruebas/bot]', e);
    }

    const paso = !detenido && comprobaciones.every((c) => c.ok) && fallosLimpieza.length === 0;
    return NextResponse.json({
      ok: true,
      recorrido: escenario ? { id: escenario.id, titulo: escenario.titulo } : null,
      paso,
      detenido,
      comprobaciones,
      fallosLimpieza,
      stock: {
        almacen: {
          material1: await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_1.id),
          material2: await stockDeEnsayo(supabase, ALMACEN_ENSAYO.id, MATERIAL_ENSAYO_2.id),
        },
        obra1: { material1: await stockDeEnsayo(supabase, obra.ubicacionObra1, MATERIAL_ENSAYO_1.id) },
        obra2: { material1: await stockDeEnsayo(supabase, obra.ubicacionObra2, MATERIAL_ENSAYO_1.id) },
      },
      pasos: bot.pasos,
      duracionMs: Date.now() - inicio,
    });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Error en el ensayo.';
    return NextResponse.json({ ok: false, error: mensaje, duracionMs: Date.now() - inicio }, { status: 500 });
  }
}
