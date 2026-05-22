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

for (const pathCheck of ['/api/telegram', '/api/webhooks/telegram']) {
  try {
    const res = await fetch(`${base}${pathCheck}`, { method: 'GET' });
    const text = await res.text();
    console.log(`\n=== GET ${base}${pathCheck} ===`);
    console.log('status', res.status, text.slice(0, 200));
  } catch (e) {
    console.log(`\n=== GET ${base}${pathCheck} FAILED ===`, e.message);
  }
}
