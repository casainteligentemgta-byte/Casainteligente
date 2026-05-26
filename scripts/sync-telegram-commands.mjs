/**
 * Actualiza solo el menú de comandos del bot (setMyCommands), sin tocar el webhook.
 * Uso: npm run telegram:commands
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TELEGRAM_BOT_COMMANDS } from './telegram-bot-commands.shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');

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
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN no está en .env.local');
    process.exit(1);
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands: TELEGRAM_BOT_COMMANDS }),
  });
  const json = await res.json();
  console.log('setMyCommands:', JSON.stringify(json, null, 2));
  if (!json.ok) process.exit(1);
  console.log('\n✅ Menú actualizado. En Telegram: escribe / y busca /agua');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
