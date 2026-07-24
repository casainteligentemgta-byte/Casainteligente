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

if (!token || !chatId) {
  console.error('Faltan TELEGRAM_LOG_BOT_TOKEN o TELEGRAM_LOG_CHAT_ID en .env.local');
  process.exit(1);
}

function escMd(s) {
  return s.replace(/([_*[`\\])/g, '\\$1');
}

const fakeId = '00000000-0000-0000-0000-000000000001';
const text =
  `*\\[${escMd('Test manual')}\\]*\n` +
  escMd(
    'Alerta de prueba — bot de logs operativo.\n' +
      'Usuario: LVM79 (267515133)\n' +
      'El botón es demo; no hay factura real con ese ID.',
  );

const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔓 Destrabar Factura', callback_data: `liberar_factura:${fakeId}` }],
      ],
    },
  }),
});

const json = await res.json();
if (!json.ok) {
  console.error('Error Telegram:', json.description);
  process.exit(1);
}

console.log('✓ Alerta de prueba enviada a chat', chatId);
