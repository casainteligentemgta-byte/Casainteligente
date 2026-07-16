/**
 * Aviso de deploy al bot de logs Telegram.
 * Uso: node scripts/notify-log-bot-deploy.mjs [mensaje opcional]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

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

let commit = '—';
let branch = '—';
try {
  commit = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
  branch = execSync('git branch --show-current', { cwd: root, encoding: 'utf8' }).trim();
} catch {
  /* ignore */
}

const custom = process.argv.slice(2).join(' ').trim();
const cuerpo =
  custom ||
  `Deploy OK — Casa Inteligente\n` +
    `Commit: ${commit}\n` +
    `Rama: ${branch}\n` +
    `URL: https://casainteligente.company`;

const text = `*\\[${escMd('Deploy')}\\]*\n${escMd(cuerpo)}`;

const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  }),
});

const json = await res.json();
if (!json.ok) {
  console.error('Error Telegram:', json.description);
  process.exit(1);
}

console.log('✓ Aviso de deploy enviado a chat', chatId);
