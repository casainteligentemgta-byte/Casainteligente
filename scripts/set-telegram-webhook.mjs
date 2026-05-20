/**
 * Registra el webhook del bot de facturas en Telegram.
 * Uso: npm run telegram:webhook
 * Requiere: TELEGRAM_BOT_TOKEN, NEXT_PUBLIC_BASE_URL en .env.local
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
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

async function main() {
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const base = (
    env.NEXT_PUBLIC_BASE_URL ||
    env.NEXT_PUBLIC_APP_URL ||
    'https://casainteligente.company'
  )
    .trim()
    .replace(/\/$/, '');

  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN no está en .env.local');
    process.exit(1);
  }

  const webhookUrl = `${base}/api/webhooks/telegram`;
  const api = `https://api.telegram.org/bot${token}/setWebhook`;

  const res = await fetch(api, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    }),
  });

  const json = await res.json();
  console.log('Webhook URL:', webhookUrl);
  console.log(JSON.stringify(json, null, 2));

  if (!json.ok) {
    process.exit(1);
  }

  const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  console.log('\nEstado:', JSON.stringify(await info.json(), null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
