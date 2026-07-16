import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env.local');

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

const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
const token = env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN missing');
  process.exit(1);
}

const base = (env.NEXT_PUBLIC_BASE_URL || 'https://casainteligente.company').replace(/\/$/, '');

async function tg(method) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`);
  return res.json();
}

const info = await tg('getWebhookInfo');
console.log('=== Webhook ===');
console.log(JSON.stringify(info, null, 2));
const wh = info.result?.url ?? '';
if (wh.endsWith('/api/telegram')) {
  console.log('\n⚠️  El webhook apunta a /api/telegram; en producción suele dar 404.');
  console.log('   Ejecuta: npm run telegram:webhook  (usa /api/webhooks/telegram)');
}
if (info.result?.last_error_message) {
  console.log('\n⚠️  Último error Telegram:', info.result.last_error_message);
}

const updates = await tg('getUpdates?limit=5');
console.log('\n=== Ultimos updates (polling, si webhook falla) ===');
if (updates.ok && updates.result?.length) {
  for (const u of updates.result) {
    const m = u.message;
    if (!m) continue;
    console.log('-', new Date(m.date * 1000).toISOString(), 'chat', m.chat.id, m.text || m.caption || '[media]');
  }
} else {
  console.log('Sin updates pendientes en polling (normal si webhook consume todo)');
}

const paths = ['/api/webhooks/telegram', '/api/telegram'];
for (const pathCheck of paths) {
  try {
    const res = await fetch(`${base}${pathCheck}`, { method: 'GET' });
    const text = await res.text();
    console.log(`\n=== GET ${base}${pathCheck} ===`);
    console.log('status', res.status, text.slice(0, 280));
    try {
      const j = JSON.parse(text);
      if (j.bot === false) {
        console.log('⚠️  Producción sin TELEGRAM_BOT_TOKEN → POST del webhook suele devolver 503.');
      }
      if (j.supabaseServiceRole === false) {
        console.log('⚠️  Producción sin SUPABASE_SERVICE_ROLE_KEY → facturas por foto fallarán.');
      }
    } catch {
      /* no json */
    }
  } catch (e) {
    console.log(`\n=== GET ${base}${pathCheck} FAILED ===`, e.message);
  }
}

try {
  const postRes = await fetch(`${base}/api/webhooks/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ update_id: 0 }),
  });
  const postText = await postRes.text();
  console.log(`\n=== POST ${base}/api/webhooks/telegram (update vacío) ===`);
  console.log('status', postRes.status, postText.slice(0, 280));
  if (postRes.status === 503) {
    console.log(
      '\n❌ Telegram marca el webhook como caído con 503. Solución:\n' +
        '   1) Vercel → Settings → Environment Variables → Production:\n' +
        '      TELEGRAM_BOT_TOKEN, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, GEMINI_API_KEY\n' +
        '   2) Redeploy del proyecto (código nuevo responde 200 aunque falte token)\n' +
        '   3) npm run telegram:webhook',
    );
  } else if (postRes.status === 200) {
    console.log('\n✅ POST responde 200 — Telegram no debería marcar error por código HTTP.');
  }
} catch (e) {
  console.log('\n=== POST webhook FAILED ===', e.message);
}
