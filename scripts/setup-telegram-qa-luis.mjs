/**
 * Configura Luis para pruebas Telegram: whitelist + canal admin + rol Administrador.
 * Uso: node scripts/setup-telegram-qa-luis.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LUIS_CHAT_ID = 267515133;
const LUIS_NOMBRE = 'LUIS MATA MATA';

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

const env = parseEnvFile(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function upsertWhitelist() {
  const base = {
    chat_id: LUIS_CHAT_ID,
    nombre: LUIS_NOMBRE,
    origen: 'manual',
    activo: true,
    updated_at: new Date().toISOString(),
  };

  const withCargo = { ...base, cargo: 'Administrador' };
  let { data, error } = await sb
    .from('ci_telegram_whitelist')
    .upsert(withCargo, { onConflict: 'chat_id' })
    .select('chat_id,nombre,activo')
    .single();

  if (error?.message?.includes('cargo')) {
    ({ data, error } = await sb
      .from('ci_telegram_whitelist')
      .upsert(base, { onConflict: 'chat_id' })
      .select('chat_id,nombre,activo')
      .single());
  }

  if (error) throw new Error(`whitelist: ${error.message}`);
  console.log('✅ Whitelist:', data);
}

async function upsertUsuarioCompras() {
  const row = {
    telegram_id: LUIS_CHAT_ID,
    nombre: LUIS_NOMBRE,
    rol: 'Administrador',
    activo: true,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb
    .from('ci_usuarios_sistema_telegram')
    .upsert(row, { onConflict: 'telegram_id' })
    .select('telegram_id,nombre,rol,activo')
    .single();
  if (error) throw new Error(`usuarios_sistema: ${error.message}`);
  console.log('✅ Usuario compras/procura:', data);
}

async function setCanalAdminPruebas() {
  const { data: actual, error: readErr } = await sb
    .from('ci_alertas_config')
    .select('config')
    .eq('id', 1)
    .maybeSingle();
  if (readErr) throw new Error(`alertas read: ${readErr.message}`);

  const cfg = (actual?.config && typeof actual.config === 'object' ? actual.config : {}) ?? {};
  const merged = {
    ...cfg,
    telegram: {
      ...(cfg.telegram && typeof cfg.telegram === 'object' ? cfg.telegram : {}),
      canal_admin_id: String(LUIS_CHAT_ID),
    },
  };

  const { error: upErr } = await sb
    .from('ci_alertas_config')
    .upsert({ id: 1, config: merged }, { onConflict: 'id' });
  if (upErr) throw new Error(`alertas upsert: ${upErr.message}`);

  console.log(`✅ Canal admin alertas → DM Luis (${LUIS_CHAT_ID})`);
}

async function resumen() {
  const [wl, us, alertas] = await Promise.all([
    sb.from('ci_telegram_whitelist').select('chat_id,nombre,activo').eq('chat_id', LUIS_CHAT_ID).maybeSingle(),
    sb
      .from('ci_usuarios_sistema_telegram')
      .select('telegram_id,nombre,rol,activo')
      .eq('telegram_id', LUIS_CHAT_ID)
      .maybeSingle(),
    sb.from('ci_alertas_config').select('config').eq('id', 1).maybeSingle(),
  ]);

  console.log('\n--- Estado final ---');
  console.log('Whitelist Luis:', wl.error?.message ?? wl.data);
  console.log('Rol sistema:', us.error?.message ?? us.data);
  console.log(
    'Canal admin efectivo:',
    alertas.data?.config?.telegram?.canal_admin_id ?? '(sin override)',
  );
}

try {
  await upsertWhitelist();
  await upsertUsuarioCompras();
  await setCanalAdminPruebas();
  await resumen();
  console.log('\nListo. Envía /start al bot y prueba /procura.');
} catch (e) {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
}
