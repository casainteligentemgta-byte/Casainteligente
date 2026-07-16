/**
 * Envía al chat de pruebas la alerta que recibe el Administrador (vista previa).
 * Uso: npx tsx scripts/enviar-alerta-procura-admin-prueba.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mensajeAlertaProcuraAdminDemo } from '../lib/procuras/mensajeAlertaProcuraTelegram.ts';
import { tecladoAprobacionDepartamento } from '../lib/compras/aprobacionDepartamentoTelegram.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
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

async function main(): Promise<void> {
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('Falta .env.local');
  }
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId =
    env.TELEGRAM_PRUEBAS_REDIRECT_CHAT_ID?.trim() ||
    env.TELEGRAM_CHAT_ID?.trim() ||
    '267515133';
  if (!token || !chatId) {
    throw new Error('Configura TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en .env.local');
  }

  const demoId = '00000000-0000-4000-8000-000000000099';
  const text =
    '🧪 <b>Prueba — mensaje Administrador</b>\n\n' + mensajeAlertaProcuraAdminDemo();

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: tecladoAprobacionDepartamento(demoId),
    }),
  });

  const json = (await res.json()) as { ok?: boolean; description?: string };
  if (!json.ok) {
    throw new Error(json.description ?? 'Telegram API error');
  }
  console.log(`✅ Alerta demo enviada al chat ${chatId}`);
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
