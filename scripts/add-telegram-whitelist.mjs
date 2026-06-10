/**
 * Alta en ci_telegram_whitelist (misma lógica que POST /api/telegram/whitelist).
 * Uso: node scripts/add-telegram-whitelist.mjs --nombre "Neomar Cárdenas" --chat-id 8684897057
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

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

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--nombre') out.nombre = argv[++i];
    else if (a === '--chat-id') out.chatId = argv[++i];
    else if (a === '--notas') out.notas = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv);
const nombre = args.nombre?.trim();
const chatId = Number(args.chatId);
if (!nombre || !Number.isFinite(chatId)) {
  console.error('Uso: node scripts/add-telegram-whitelist.mjs --nombre "..." --chat-id 123456789');
  process.exit(1);
}

const env = parseEnvFile(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const row = {
  chat_id: Math.trunc(chatId),
  nombre: nombre.slice(0, 200),
  notas: args.notas?.trim() || null,
  origen: 'manual',
  activo: true,
  updated_at: new Date().toISOString(),
};

const { data, error } = await sb
  .from('ci_telegram_whitelist')
  .upsert(row, { onConflict: 'chat_id' })
  .select('id, chat_id, nombre, activo, origen, notas')
  .single();

if (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

console.log('OK whitelist:', JSON.stringify(data, null, 2));

const { data: all } = await sb
  .from('ci_telegram_whitelist')
  .select('chat_id, nombre, activo')
  .eq('activo', true)
  .order('nombre');
console.log(`\nTotal activos en whitelist: ${all?.length ?? 0}`);
for (const u of all ?? []) console.log(`  • ${u.nombre} (${u.chat_id})`);
