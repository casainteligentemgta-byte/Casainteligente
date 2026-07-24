/**
 * Reprocesa mensajes de Telegram contra el servidor local (npm run dev).
 * 1) Quita webhook temporalmente  2) getUpdates  3) POST a /api/telegram
 *
 * Uso: node scripts/replay-telegram-local.mjs
 * Requiere: TELEGRAM_BOT_TOKEN, dev en http://127.0.0.1:3000
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env.local');
const LOCAL_WEBHOOK = 'http://127.0.0.1:3000/api/telegram';

function parseEnvFile(content) {
  const out = {};
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

async function tg(token, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function main() {
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN en .env.local');
    process.exit(1);
  }

  const health = await fetch('http://127.0.0.1:3000/api/telegram');
  if (!health.ok) {
    console.error('❌ Arranca npm run dev primero (GET /api/telegram falló)');
    process.exit(1);
  }
  const healthJson = await health.json();
  console.log('Local API:', healthJson);

  const infoBefore = await tg(token, 'getWebhookInfo');
  console.log('\nWebhook antes:', infoBefore.result?.url, 'pendientes:', infoBefore.result?.pending_update_count);

  console.log('\n▶ deleteWebhook (conservar cola)…');
  const del = await tg(token, 'deleteWebhook', { drop_pending_updates: false });
  if (!del.ok) {
    console.error(del);
    process.exit(1);
  }

  let offset = 0;
  let total = 0;
  for (let round = 0; round < 20; round++) {
    const updates = await tg(token, `getUpdates?timeout=2&limit=100&offset=${offset}`);
    if (!updates.ok || !updates.result?.length) break;

    for (const u of updates.result) {
      offset = u.update_id + 1;
      const m = u.message;
      const label = m?.text || m?.caption || (m?.photo ? '[foto]' : m?.document ? '[doc]' : '[msg]');
      console.log(`\n→ update ${u.update_id} chat ${m?.chat?.id} ${label}`);

      const res = await fetch(LOCAL_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(u),
      });
      const text = await res.text();
      console.log(`  HTTP ${res.status}`, text.slice(0, 120));
      total++;
    }
  }

  console.log(`\n✅ Reprocesados ${total} updates en local.`);

  const base = (env.NEXT_PUBLIC_BASE_URL || 'https://casainteligente.company').replace(/\/$/, '');
  const prodPath = '/api/webhooks/telegram';
  const webhookUrl = `${base}${prodPath}`;
  console.log(`\n▶ Restaurar webhook producción: ${webhookUrl}`);
  const set = await tg(token, 'setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  });
  console.log(JSON.stringify(set, null, 2));

  console.log('\nVerifica: http://127.0.0.1:3000/contabilidad/compras/canal');
  console.log('Y: node scripts/diag-facturas-canal.mjs');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
