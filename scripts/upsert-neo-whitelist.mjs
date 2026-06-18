import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

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

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await sb
  .from('ci_telegram_whitelist')
  .upsert(
    {
      chat_id: 8684897057,
      nombre: 'Neo Cardenas',
      proyecto_id: '171694ed-0ecb-4ec5-82f5-82b980cb261f',
      notas: 'Comprador Flamboyant',
      origen: 'manual',
      activo: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'chat_id' },
  )
  .select('id,nombre,chat_id,activo')
  .single();

if (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
console.log('Whitelist OK:', data);
