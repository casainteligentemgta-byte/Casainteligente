import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      let val = l.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return [l.slice(0, i).trim(), val];
    }),
);

const token = env.TELEGRAM_LOG_BOT_TOKEN?.trim();
const chatId = env.TELEGRAM_LOG_CHAT_ID?.trim();

if (!token) {
  console.error('TELEGRAM_LOG_BOT_TOKEN vacío en .env.local');
  process.exit(1);
}

const webhookUrl = 'https://casainteligente.company/api/webhook-logs';
const setRes = await fetch(
  `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`,
);
const setJson = await setRes.json();
if (!setJson.ok) {
  console.error('setWebhook falló:', setJson.description);
  process.exit(1);
}
console.log('setWebhook: OK');

const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
const info = (await infoRes.json()).result ?? {};
console.log('url:', info.url);
console.log('pending_updates:', info.pending_update_count ?? 0);

if (chatId) {
  console.log('TELEGRAM_LOG_CHAT_ID configurado');
} else {
  console.warn('TELEGRAM_LOG_CHAT_ID vacío en .env.local');
}

const updatesRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
const updates = (await updatesRes.json()).result ?? [];
const chatIds = [
  ...new Set(
    updates
      .map((u) => u.message?.chat?.id ?? u.callback_query?.message?.chat?.id)
      .filter((id) => id != null),
  ),
];
if (chatIds.length) {
  console.log('chat_ids en getUpdates:', chatIds.join(', '));
} else {
  console.log('Sin mensajes al bot de logs aún — envía un mensaje al bot y vuelve a ejecutar este script.');
}
