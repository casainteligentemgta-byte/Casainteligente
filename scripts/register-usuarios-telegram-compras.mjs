/**
 * Registra usuarios en ci_usuarios_sistema_telegram (misma lógica que POST /api/compras/usuarios-telegram).
 * Usa service role; no requiere sesión web.
 *
 * Uso:
 *   node scripts/register-usuarios-telegram-compras.mjs
 *   node scripts/register-usuarios-telegram-compras.mjs --nombre "Juan" --telegram-id 123456 --rol Solicitante
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROLES = ['Solicitante', 'Aprobador', 'Comprador', 'Administrador'];

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
    else if (a === '--telegram-id') out.telegramId = argv[++i];
    else if (a === '--rol') out.rol = argv[++i];
    else if (a === '--from-whitelist') out.fromWhitelist = true;
  }
  return out;
}

async function upsertUsuario(supabase, row) {
  const { data, error } = await supabase
    .from('ci_usuarios_sistema_telegram')
    .upsert(row, { onConflict: 'telegram_id' })
    .select('id, nombre, telegram_id, rol, activo')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function main() {
  const env = parseEnvFile(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const args = parseArgs(process.argv);
  const toRegister = [];

  if (args.nombre && args.telegramId && args.rol) {
    const tid = Number(args.telegramId);
    if (!Number.isFinite(tid)) {
      console.error('telegram-id inválido');
      process.exit(1);
    }
    if (!ROLES.includes(args.rol)) {
      console.error('rol inválido. Use:', ROLES.join(', '));
      process.exit(1);
    }
    toRegister.push({
      nombre: args.nombre.trim().slice(0, 150),
      telegram_id: Math.trunc(tid),
      rol: args.rol,
      activo: true,
      updated_at: new Date().toISOString(),
    });
  } else {
    const { data: whitelist, error: wlErr } = await supabase
      .from('ci_telegram_whitelist')
      .select('chat_id, nombre, proyecto_id, activo')
      .eq('activo', true)
      .order('updated_at', { ascending: false });

    if (wlErr) {
      console.error('No se pudo leer whitelist:', wlErr.message);
      process.exit(1);
    }

    if (!whitelist?.length) {
      console.error(
        'Sin usuarios en whitelist. Pase --nombre, --telegram-id y --rol, o agregue chats en ci_telegram_whitelist.',
      );
      process.exit(1);
    }

    whitelist.forEach((w, idx) => {
      const tid = Number(w.chat_id);
      if (!Number.isFinite(tid)) return;
      const rol = idx === 0 ? 'Administrador' : 'Solicitante';
      toRegister.push({
        nombre: String(w.nombre ?? `Usuario ${tid}`).trim().slice(0, 150),
        telegram_id: Math.trunc(tid),
        rol,
        proyecto_id: w.proyecto_id ? String(w.proyecto_id) : null,
        activo: true,
        updated_at: new Date().toISOString(),
      });
    });
  }

  console.log(`Registrando ${toRegister.length} usuario(s)…\n`);
  for (const row of toRegister) {
    const data = await upsertUsuario(supabase, row);
    console.log(`✅ ${data.nombre} | telegram_id=${data.telegram_id} | rol=${data.rol}`);
  }

  const { data: all } = await supabase
    .from('ci_usuarios_sistema_telegram')
    .select('nombre, telegram_id, rol, activo')
    .eq('activo', true)
    .order('nombre');

  console.log(`\nTotal activos: ${all?.length ?? 0}`);
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
