/**
 * Anuncia deploy en el bot de logs de Telegram.
 * Uso: node scripts/notificar-deploy-log.mjs [--url https://casainteligente.company]
 * Requiere TELEGRAM_LOG_BOT_TOKEN y TELEGRAM_LOG_CHAT_ID en .env.local
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

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

function git(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

async function main() {
  const env = fs.existsSync(envPath) ? parseEnvFile(fs.readFileSync(envPath, 'utf8')) : {};
  const token = (process.env.TELEGRAM_LOG_BOT_TOKEN || env.TELEGRAM_LOG_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_LOG_CHAT_ID || env.TELEGRAM_LOG_CHAT_ID || '').trim();

  if (!token || !chatId) {
    console.warn('[notificar-deploy-log] TELEGRAM_LOG_BOT_TOKEN o TELEGRAM_LOG_CHAT_ID ausentes');
    process.exit(0);
  }

  const urlArg = process.argv.find((a) => a.startsWith('--url='))?.slice(6)?.trim();
  const url = urlArg || 'https://casainteligente.company';
  const rama = git('git rev-parse --abbrev-ref HEAD');
  const commit = git('git rev-parse --short HEAD');
  const mensaje = git('git log -1 --format=%s');

  const texto = [
    '✅ Deploy en producción',
    'Origen: CLI · npx vercel --prod',
    rama ? `Rama: ${rama}` : null,
    commit ? `Commit: ${commit}` : null,
    mensaje ? `Detalle: ${mensaje.slice(0, 200)}` : null,
    `URL: ${url}`,
  ]
    .filter(Boolean)
    .join('\n');

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: `<b>[Deploy · Casa Inteligente]</b>\n${texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}`,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  const json = await res.json();
  if (!json.ok) {
    console.error('[notificar-deploy-log]', json.description ?? 'sendMessage falló');
    process.exit(1);
  }
  console.log('[notificar-deploy-log] enviado al chat de logs');
}

main().catch((e) => {
  console.error('[notificar-deploy-log]', e);
  process.exit(1);
});
