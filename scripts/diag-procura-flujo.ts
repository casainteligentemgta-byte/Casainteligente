/**
 * Supervisión flujo /procura: schema, stock obra, mensajes demo Telegram, webhook /procura.
 * Uso: npx tsx scripts/diag-procura-flujo.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { evaluarStockRegistroProcura } from '../lib/procuras/procuraRegistroStock';
import { consultarDisponibilidadMaterialProcura } from '../lib/procuras/disponibilidadMaterialProcura';
import {
  construirMensajeAdminViabilidadProcura,
  construirMensajePmDecisionProcura,
  construirMensajeSolicitanteProcuraStockSuficiente,
  construirMensajeSolicitanteProcuraCompra,
  mensajesAlertaProcuraDemo,
} from '../lib/procuras/mensajeAlertaProcuraTelegram';
import { mensajeOrdenCompraComprador } from '../lib/procuras/emitirOrdenCompraProcura';
import { tecladoViabilidadAdmin } from '../lib/procuras/viabilidadAdminProcuraTelegram';
import { tecladoAprobacionDepartamento } from '../lib/compras/aprobacionDepartamentoTelegram';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEMO_ID = '00000000-0000-4000-8000-000000000099';

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

async function sendTelegram(
  token: string,
  chatId: string,
  text: string,
  replyMarkup?: object,
): Promise<boolean> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text.slice(0, 4090),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });
  const json = (await res.json()) as { ok?: boolean; description?: string };
  if (!json.ok) {
    console.warn('  ⚠️ Telegram:', json.description);
    return false;
  }
  return true;
}

async function main(): Promise<void> {
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) throw new Error('Falta .env.local');
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));

  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId =
    env.TELEGRAM_PRUEBAS_REDIRECT_CHAT_ID?.trim() ||
    env.TELEGRAM_CHAT_ID?.trim() ||
    '267515133';
  const baseUrl = env.NEXT_PUBLIC_BASE_URL?.trim() || 'https://casainteligente.company';

  if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');

  const sb = createClient(url, key, { auth: { persistSession: false } });

  console.log('\n=== 1. Schema migración 243 ===');
  const { data: colTest, error: colErr } = await sb
    .from('ci_procuras')
    .select('id,estado,viabilidad_presupuestaria,pendiente_pm:estado')
    .eq('estado', 'pendiente_pm')
    .limit(1);

  if (colErr?.message?.includes('viabilidad_presupuestaria')) {
    console.log('❌ Columna viabilidad_presupuestaria AUSENTE — ejecute migración 243');
  } else if (colErr?.message?.includes('pendiente_pm') || colErr?.message?.includes('check')) {
    console.log('❌ Estado pendiente_pm no válido — ejecute migración 243');
  } else if (colErr) {
    console.log('⚠️ Consulta procuras:', colErr.message);
  } else {
    console.log(`✅ Schema OK (pendiente_pm consultable; filas actuales: ${colTest?.length ?? 0})`);
  }

  console.log('\n=== 2. Usuarios Telegram procura ===');
  const { data: usuarios } = await sb
    .from('ci_usuarios_sistema_telegram')
    .select('nombre,rol,telegram_id,proyecto_id,activo')
    .eq('activo', true);
  for (const u of usuarios ?? []) {
    console.log(`  · ${u.nombre} — ${u.rol} — tg:${u.telegram_id} — proyecto:${u.proyecto_id ?? '—'}`);
  }

  console.log('\n=== 3. Proyecto + material con stock en obra ===');
  const { data: proyectos } = await sb
    .from('ci_proyectos')
    .select('id,nombre')
    .order('nombre')
    .limit(5);

  let proyectoStock: { id: string; nombre: string } | null = null;
  let materialStock: { id: string; name: string; qty: number } | null = null;

  for (const p of proyectos ?? []) {
    const { data: stockRows } = await sb.rpc('get_stock_real_obra', {
      p_proyecto_id: p.id,
      p_ubicacion_id: null,
      p_material_id: null,
      p_solo_con_stock: true,
    });
    const rows = (stockRows ?? []) as Array<{
      material_id: string;
      material_name: string;
      cantidad_disponible: number;
      ubicacion_tipo?: string;
    }>;
    const almacen = rows.filter(
      (r) =>
        Number(r.cantidad_disponible) > 0 &&
        (!r.ubicacion_tipo ||
          r.ubicacion_tipo === 'almacen_central' ||
          r.ubicacion_tipo === 'almacen_movil' ||
          r.ubicacion_tipo === 'cuarentena'),
    );
    if (almacen.length) {
      const best = almacen.sort(
        (a, b) => Number(b.cantidad_disponible) - Number(a.cantidad_disponible),
      )[0];
      proyectoStock = { id: p.id, nombre: p.nombre };
      materialStock = {
        id: best.material_id,
        name: best.material_name ?? 'Material',
        qty: Number(best.cantidad_disponible),
      };
      break;
    }
  }

  if (proyectoStock && materialStock) {
    console.log(
      `✅ Obra «${proyectoStock.nombre}» — ${materialStock.name}: ${materialStock.qty} en almacén`,
    );
    const eval50 = await evaluarStockRegistroProcura(sb, {
      proyecto_id: proyectoStock.id,
      material_id: materialStock.id,
      cantidad: Math.min(50, materialStock.qty),
    });
    console.log(
      `   Eval registro (50 u): stock=${eval50.stockDisponible} despacho=${eval50.cantidadDespacho} compra=${eval50.cantidadCompra} suficiente=${eval50.stockSuficiente}`,
    );
    const evalExceso = await evaluarStockRegistroProcura(sb, {
      proyecto_id: proyectoStock.id,
      material_id: materialStock.id,
      cantidad: materialStock.qty + 100,
    });
    console.log(
      `   Eval registro (exceso): compra=${evalExceso.cantidadCompra} suficiente=${evalExceso.stockSuficiente}`,
    );
    const prev = await consultarDisponibilidadMaterialProcura(sb, {
      materialId: materialStock.id,
      proyectoId: proyectoStock.id,
      unidadFallback: 'UND',
    });
    console.log(
      `   Paso 6 preview: hayStock=${prev.hayStock} qty=${prev.cantidad} almacén=${prev.almacenNombre ?? '—'}`,
    );
  } else {
    console.log('⚠️ No se encontró stock en almacén obra en los primeros 5 proyectos');
  }

  console.log('\n=== 4. Procuras recientes (7 días) ===');
  const desde = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: recientes } = await sb
    .from('ci_procuras')
    .select('ticket,estado,via_rapida,stock_almacen_detectado,cantidad_compra,created_at')
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(10);
  if (!recientes?.length) {
    console.log('  (ninguna en los últimos 7 días)');
  } else {
    for (const r of recientes) {
      console.log(
        `  · ${r.ticket} — ${r.estado} — vr:${r.via_rapida} — stock:${r.stock_almacen_detectado ?? '?'} — compra:${r.cantidad_compra ?? '?'}`,
      );
    }
  }

  if (!token) {
    console.log('\n⚠️ Sin TELEGRAM_BOT_TOKEN — omitiendo envíos Telegram y webhook');
    return;
  }

  console.log('\n=== 5. Mensajes demo al chat de pruebas ===');
  const demos = mensajesAlertaProcuraDemo('Alta');
  const msgs: Array<{ label: string; text: string; markup?: object }> = [
    { label: 'IR stock suficiente', text: construirMensajeSolicitanteProcuraStockSuficiente({
      ticket: 'PR-TEST-STOCK',
      materialTxt: 'CEMENTO GRIS',
      cantidad: 30,
      unidad: 'SACO',
      almacenNombre: 'Almacén obra',
    }) },
    { label: 'IR vía larga', text: construirMensajeSolicitanteProcuraCompra({
      ticket: 'PR-TEST-LARGA',
      materialTxt: 'VARILLA #3',
      cantidad: 100,
      unidad: 'UND',
      stockDisponible: 0,
      cantidadCompra: 100,
      viaRapida: false,
    }) },
    { label: 'Administrador', text: demos.dmAdministrador, markup: tecladoViabilidadAdmin(DEMO_ID) },
    { label: 'PM', text: demos.dmProjectManager, markup: tecladoAprobacionDepartamento(DEMO_ID) },
    {
      label: 'Comprador',
      text: mensajeOrdenCompraComprador(
        {
          id: DEMO_ID,
          ticket: 'PR-TEST-COMPRA',
          estado: 'aprobada_directa',
          material_txt: 'CEMENTO GRIS',
          cantidad: 50,
          unidad: 'SACO',
          solicitante_nombre: 'Ing. Residente (prueba)',
          solicitante_telegram_chat_id: null,
          prioridad: 'Alta',
          monto_estimado_usd: 42.5,
          observaciones: null,
          ci_compras_capitulos_maestro: { codigo: '03', nombre: 'Estructura' },
        },
        { autorNombre: 'Vía rápida', motivo: 'Prueba supervisión flujo', cantidadCompra: 20 },
      ),
    },
  ];

  for (const m of msgs) {
    const ok = await sendTelegram(token, chatId, `🧪 <b>[Prueba ${m.label}]</b>\n\n${m.text}`, m.markup);
    console.log(ok ? `  ✅ Enviado: ${m.label}` : `  ❌ Falló: ${m.label}`);
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log('\n=== 6. Webhook producción — /procura ===');
  const qaChat = Number(chatId);
  const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/webhooks/telegram`;
  const update = {
    update_id: Math.floor(Date.now() / 1000),
    message: {
      message_id: Math.floor(Date.now() % 1000000),
      from: { id: qaChat, is_bot: false, first_name: 'QA', username: 'qa_procura' },
      chat: { id: qaChat, type: 'private' },
      date: Math.floor(Date.now() / 1000),
      text: '/procura',
    },
  };
  try {
    const wh = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    const whText = await wh.text();
    console.log(`  HTTP ${wh.status} — ${whText.slice(0, 200)}`);
    if (wh.ok) {
      await new Promise((r) => setTimeout(r, 2000));
      const { data: estado } = await sb
        .from('ci_telegram_estados')
        .select('contexto,proyecto_id,metadata,updated_at')
        .eq('chat_id', String(qaChat))
        .maybeSingle();
      console.log(
        `  Estado Telegram tras /procura: contexto=${estado?.contexto ?? '—'} paso=${(estado?.metadata as { paso?: string })?.paso ?? '—'}`,
      );
    }
  } catch (e) {
    console.log('  ❌ Webhook:', e instanceof Error ? e.message : e);
  }

  console.log('\n✅ Supervisión terminada. Revisa Telegram chat', chatId, 'para mensajes demo + menú /procura.\n');
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
