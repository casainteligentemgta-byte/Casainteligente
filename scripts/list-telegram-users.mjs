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

const env = parseEnvFile(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const [wl, us, alertas] = await Promise.all([
  sb.from('ci_telegram_whitelist').select('chat_id,nombre,cargo,activo').order('nombre'),
  sb.from('ci_usuarios_sistema_telegram').select('telegram_id,nombre,rol,activo,proyecto_id').order('nombre'),
  sb.from('ci_alertas_config').select('config,updated_at').maybeSingle(),
]);

console.log('WHITELIST:', wl.error?.message ?? wl.data);
console.log('USUARIOS_COMPRAS:', us.error?.message ?? us.data);
console.log('ALERTAS_CONFIG:', alertas.error?.message ?? alertas.data);
