/**
 * Registra el webhook del bot asistente AI.
 * Uso: npm run asistente:webhook
 * Requiere en .env.local: MI_ASISTENTE_AI_BOT_TOKEN, NEXT_PUBLIC_BASE_URL
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

const COMMANDS = [
  { command: 'start', description: 'Iniciar el asistente' },
  { command: 'ayuda', description: 'Cómo usar el bot' },
  { command: 'reset', description: 'Borrar historial de conversación' },
  { command: 'storage', description: 'Elegir dónde guardar archivos' },
];

async function main() {
  if (!fs.existsSync(envPath)) {
    console.error('❌ No existe .env.local');
    process.exit(1);
  }

  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const token = env.MI_ASISTENTE_AI_BOT_TOKEN?.trim();
  const base = (
    env.NEXT_PUBLIC_BASE_URL ||
    env.NEXT_PUBLIC_APP_URL ||
    'https://casainteligente.company'
  )
    .trim()
    .replace(/\/$/, '');

  if (!token) {
    console.error('❌ MI_ASISTENTE_AI_BOT_TOKEN no está en .env.local');
    console.error('   Crea el bot en @BotFather y pega el token.');
    process.exit(1);
  }

  const webhookUrl = `${base}/api/webhooks/mi-asistente-ai`;
  const webhookSecret =
    process.env.MI_ASISTENTE_AI_WEBHOOK_SECRET?.trim() ||
    env.MI_ASISTENTE_AI_WEBHOOK_SECRET?.trim();

  const payload = {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
    ...(webhookSecret ? { secret_token: webhookSecret } : {}),
  };

  if (!webhookSecret) {
    console.warn(
      '⚠️ MI_ASISTENTE_AI_WEBHOOK_SECRET no definido — genere uno (openssl rand -hex 32).',
    );
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  console.log('Webhook URL:', webhookUrl);
  console.log(JSON.stringify(json, null, 2));
  if (!json.ok) process.exit(1);

  const cmds = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands: COMMANDS }),
  });
  console.log('setMyCommands:', JSON.stringify(await cmds.json(), null, 2));

  const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  console.log('\nEstado:', JSON.stringify(await info.json(), null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
