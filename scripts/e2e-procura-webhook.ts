/**
 * Prueba E2E /procura vía webhook producción (simula Telegram).
 * Escenario A: stock suficiente en obra → depositario
 * Escenario B: sin stock → Admin viabilidad → PM aprueba
 *
 * Uso: npx tsx scripts/e2e-procura-webhook.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CB_CMP_VIAB_SI } from '../lib/procuras/viabilidadAdminProcuraTelegram';
import { CB_CMP_APROBAR } from '../lib/compras/aprobacionDepartamentoTelegram';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const QA_SOLICITANTE = 267515133;
const QA_ADMIN = 8515849887;
const QA_PM = 7971122319;

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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let updateSeq = 0;

async function postWebhook(
  webhookUrl: string,
  body: object,
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = await res.text();
  }
  return { status: res.status, json };
}

function messageUpdate(chatId: number, userId: number, text: string) {
  updateSeq += 1;
  const mid = 900000 + updateSeq;
  return {
    update_id: 1_000_000_000 + updateSeq,
    message: {
      message_id: mid,
      from: { id: userId, is_bot: false, first_name: 'E2E', username: 'e2e_qa' },
      chat: { id: chatId, type: 'private' },
      date: Math.floor(Date.now() / 1000),
      text,
    },
  };
}

function callbackUpdate(chatId: number, userId: number, data: string, messageId = 900001) {
  updateSeq += 1;
  return {
    update_id: 2_000_000_000 + updateSeq,
    callback_query: {
      id: `e2e_cb_${updateSeq}`,
      from: { id: userId, is_bot: false, first_name: 'E2E', username: 'e2e_qa' },
      message: {
        message_id: messageId,
        chat: { id: chatId, type: 'private' },
        date: Math.floor(Date.now() / 1000),
      },
      data,
    },
  };
}

async function resetSesion(sb: SupabaseClient, chatId: string): Promise<void> {
  await sb
    .from('ci_telegram_estados')
    .upsert(
      {
        chat_id: chatId,
        contexto: 'menu',
        metadata: {},
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'chat_id' },
    );
}

async function upsertQaSolicitante(
  sb: SupabaseClient,
  proyectoId: string,
): Promise<void> {
  const row = {
    telegram_id: QA_SOLICITANTE,
    nombre: 'E2E Solicitante QA',
    rol: 'Solicitante',
    proyecto_id: proyectoId,
    activo: true,
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb
    .from('ci_usuarios_sistema_telegram')
    .upsert(row as never, { onConflict: 'telegram_id' });
  if (error) throw new Error(`upsert solicitante: ${error.message}`);
}

async function ultimaProcuraSolicitante(
  sb: SupabaseClient,
  chatId: number,
): Promise<{
  id: string;
  ticket: string;
  estado: string;
  stock_almacen_detectado: number | null;
  cantidad_compra: number | null;
} | null> {
  const { data } = await sb
    .from('ci_procuras')
    .select('id,ticket,estado,stock_almacen_detectado,cantidad_compra,created_at')
    .eq('solicitante_telegram_chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as typeof data;
}

async function flujoRegistrarProcura(params: {
  webhookUrl: string;
  sb: SupabaseClient;
  capituloId: string;
  materialId: string | null;
  materialBusqueda: string;
  cantidad: string;
  unidadCallback: string;
  label: string;
}): Promise<{ ok: boolean; procuraId?: string; ticket?: string; estado?: string; error?: string }> {
  const chat = QA_SOLICITANTE;
  const user = QA_SOLICITANTE;

  console.log(`\n--- ${params.label}: iniciar /procura ---`);
  await resetSesion(params.sb, String(chat));
  await sleep(400);

  let r = await postWebhook(params.webhookUrl, messageUpdate(chat, user, '/procura'));
  console.log('  /procura →', r.status, JSON.stringify(r.json));
  await sleep(1200);

  r = await postWebhook(
    params.webhookUrl,
    callbackUpdate(chat, user, `cmp:cap:${params.capituloId}`),
  );
  console.log('  capítulo →', r.status);
  await sleep(800);

  r = await postWebhook(
    params.webhookUrl,
    messageUpdate(chat, user, params.materialBusqueda),
  );
  console.log('  material texto →', r.status);
  await sleep(1500);

  if (params.materialId) {
    r = await postWebhook(
      params.webhookUrl,
      callbackUpdate(chat, user, `cmp:mat_id:${params.materialId}`),
    );
    console.log('  material catálogo →', r.status);
    await sleep(800);
  } else {
    r = await postWebhook(params.webhookUrl, callbackUpdate(chat, user, 'cmp:mat:txt'));
    console.log('  material texto libre →', r.status);
    await sleep(800);
  }

  r = await postWebhook(params.webhookUrl, messageUpdate(chat, user, params.cantidad));
  console.log('  cantidad →', r.status);
  await sleep(600);

  r = await postWebhook(
    params.webhookUrl,
    callbackUpdate(chat, user, `cmp:uni:${params.unidadCallback}`),
  );
  console.log('  unidad →', r.status);
  await sleep(600);

  r = await postWebhook(params.webhookUrl, callbackUpdate(chat, user, 'cmp:pri:Media'));
  console.log('  prioridad →', r.status);
  await sleep(1200);

  const estadoPre = await params.sb
    .from('ci_telegram_estados')
    .select('metadata')
    .eq('chat_id', String(chat))
    .maybeSingle();
  const paso = (estadoPre.data?.metadata as { paso?: string } | null)?.paso;
  console.log('  paso antes confirmar:', paso ?? '—');

  r = await postWebhook(params.webhookUrl, callbackUpdate(chat, user, 'cmp:ok'));
  console.log('  confirmar →', r.status, JSON.stringify(r.json));
  await sleep(2500);

  const procura = await ultimaProcuraSolicitante(params.sb, chat);
  if (!procura) {
    return { ok: false, error: 'No se creó procura en BD' };
  }
  console.log(
    `  BD: ${procura.ticket} estado=${procura.estado} stock=${procura.stock_almacen_detectado} compra=${procura.cantidad_compra}`,
  );
  return {
    ok: true,
    procuraId: procura.id,
    ticket: procura.ticket,
    estado: procura.estado,
  };
}

async function main(): Promise<void> {
  const env = parseEnvFile(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const baseUrl = env.NEXT_PUBLIC_BASE_URL?.trim() || 'https://casainteligente.company';
  const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/webhooks/telegram`;

  if (!url || !key) throw new Error('Faltan credenciales Supabase en .env.local');

  const sb = createClient(url, key, { auth: { persistSession: false } });

  console.log('=== E2E Procura — webhook', webhookUrl, '===\n');

  const { data: proyecto } = await sb
    .from('ci_proyectos')
    .select('id,nombre')
    .ilike('nombre', '%FLAMBOYANT%')
    .limit(1)
    .maybeSingle();

  if (!proyecto?.id) throw new Error('No se encontró proyecto RANCHO FLAMBOYANT');
  const proyectoId = String(proyecto.id);
  console.log('Proyecto:', proyecto.nombre, proyectoId);

  await upsertQaSolicitante(sb, proyectoId);

  const { data: capitulos } = await sb
    .from('ci_compras_capitulos_maestro')
    .select('id,codigo,nombre')
    .eq('activo', true)
    .order('codigo')
    .limit(1);
  const cap = capitulos?.[0];
  if (!cap?.id) throw new Error('Sin capítulos maestro');

  const { data: stockRows } = await sb.rpc('get_stock_real_obra', {
    p_proyecto_id: proyectoId,
    p_ubicacion_id: null,
    p_material_id: null,
    p_solo_con_stock: true,
  });
  const almacen = ((stockRows ?? []) as Array<{
    material_id: string;
    material_name: string;
    cantidad_disponible: number;
    ubicacion_tipo?: string;
  }>).filter(
    (r) =>
      Number(r.cantidad_disponible) > 0 &&
      (!r.ubicacion_tipo ||
        r.ubicacion_tipo === 'almacen_central' ||
        r.ubicacion_tipo === 'almacen_movil' ||
        r.ubicacion_tipo === 'cuarentena'),
  );
  const matStock = almacen.sort(
    (a, b) => Number(b.cantidad_disponible) - Number(a.cantidad_disponible),
  )[0];

  const resultados: string[] = [];

  // —— Escenario A: stock suficiente ——
  if (matStock) {
    const a = await flujoRegistrarProcura({
      webhookUrl,
      sb,
      capituloId: String(cap.id),
      materialId: matStock.material_id,
      materialBusqueda: matStock.material_name.slice(0, 20),
      cantidad: '1',
      unidadCallback: 'UND',
      label: 'A · Stock suficiente',
    });
    const okA =
      a.ok && (a.estado === 'aprobada' || a.estado === 'recibida' || a.estado === 'solicitada');
    resultados.push(
      okA
        ? `✅ A Stock: ${a.ticket} → ${a.estado}`
        : `❌ A Stock: ${a.error ?? `estado inesperado ${a.estado}`}`,
    );
  } else {
    resultados.push('⚠️ A omitido: sin stock en obra para prueba');
  }

  await sleep(2000);

  // —— Escenario B: vía larga (material texto libre, sin stock) ——
  const b = await flujoRegistrarProcura({
    webhookUrl,
    sb,
    capituloId: String(cap.id),
    materialId: null,
    materialBusqueda: 'MATERIAL PRUEBA E2E SIN STOCK',
    cantidad: '50',
    unidadCallback: 'UND',
    label: 'B · Vía larga sin stock',
  });

  if (!b.ok || !b.procuraId) {
    resultados.push(`❌ B Registro: ${b.error ?? 'falló'}`);
  } else if (b.estado !== 'solicitada') {
    resultados.push(`⚠️ B Registro: ${b.ticket} estado=${b.estado} (esperaba solicitada)`);
  } else {
    console.log('\n--- B: Admin informa viabilidad ---');
    const rAdmin = await postWebhook(
      webhookUrl,
      callbackUpdate(QA_ADMIN, QA_ADMIN, `${CB_CMP_VIAB_SI}${b.procuraId}`),
    );
    console.log('  Admin viabilidad →', rAdmin.status, JSON.stringify(rAdmin.json));
    await sleep(2000);

    const { data: trasAdmin } = await sb
      .from('ci_procuras')
      .select('estado,viabilidad_presupuestaria')
      .eq('id', b.procuraId)
      .maybeSingle();

    console.log('  BD tras Admin:', trasAdmin);

    if (String(trasAdmin?.estado) !== 'pendiente_pm') {
      resultados.push(`❌ B Admin: estado=${trasAdmin?.estado} (esperaba pendiente_pm)`);
    } else {
      console.log('\n--- B: PM aprueba ---');
      const rPm = await postWebhook(
        webhookUrl,
        callbackUpdate(QA_PM, QA_PM, `${CB_CMP_APROBAR}${b.procuraId}`),
      );
      console.log('  PM aprobar →', rPm.status, JSON.stringify(rPm.json));
      await sleep(2500);

      const { data: trasPm } = await sb
        .from('ci_procuras')
        .select('estado,cantidad_compra')
        .eq('id', b.procuraId)
        .maybeSingle();

      console.log('  BD tras PM:', trasPm);
      const estPm = String(trasPm?.estado ?? '');
      const okPm = ['aprobada', 'en_compra', 'recibida', 'recibida_parcial'].includes(estPm);
      resultados.push(
        okPm
          ? `✅ B Vía larga: ${b.ticket} Admin→PM → ${estPm}`
          : `❌ B PM: estado=${estPm}`,
      );
    }
  }

  console.log('\n=== RESUMEN E2E ===');
  for (const line of resultados) console.log(line);
  console.log('\nRevisa Telegram: solicitante', QA_SOLICITANTE, '| PM', QA_PM);
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
