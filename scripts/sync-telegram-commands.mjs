/**
 * Actualiza solo el menú de comandos del bot (setMyCommands), sin tocar el webhook.
 * Uso: npm run telegram:commands
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  TELEGRAM_ALLOWED_UPDATES,
  TELEGRAM_BOT_COMMANDS,
} from './telegram-bot-commands.shared.mjs';

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

function loadEnvLocal() {
  if (!fs.existsSync(envPath)) return {};
  return parseEnvFile(fs.readFileSync(envPath, 'utf8'));
}

async function main() {
  const env = loadEnvLocal();
  const token = (process.env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) {
    console.error('❌ Falta TELEGRAM_BOT_TOKEN.');
    console.error('   Añádelo en .env.local y guarda el archivo (Ctrl+S), por ejemplo:');
    console.error('   TELEGRAM_BOT_TOKEN=123456789:AA...');
    if (fs.existsSync(envPath) && !('TELEGRAM_BOT_TOKEN' in env)) {
      console.error('\n   El .env.local existe pero no contiene esa variable en disco.');
    }
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

  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const infoJson = await infoRes.json();
  const webhookUrl = infoJson.result?.url?.trim();
  if (webhookUrl) {
    const wh = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: [...TELEGRAM_ALLOWED_UPDATES],
      }),
    });
    const whJson = await wh.json();
    console.log('setWebhook (allowed_updates):', JSON.stringify(whJson, null, 2));
  } else {
    console.warn('\n⚠️ Sin webhook registrado. Ejecuta: npm run telegram:webhook');
  }

  console.log('\n✅ Menú actualizado. En Telegram: /agua → obra → foto camión → foto prueba');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
