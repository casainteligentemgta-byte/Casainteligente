/**
 * Comprueba que .env.local existe y que se puede contactar con Supabase (HTTPS).
 * Uso: npm run verify:supabase
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

async function main() {
  console.log('Casa Inteligente — verificación de Supabase\n');

  if (!fs.existsSync(envPath)) {
    console.error('❌ No existe .env.local en la raíz del proyecto.');
    console.error('   Copia .env.example → .env.local y rellena NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.\n');
    process.exit(1);
  }

  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  let url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local\n');
    process.exit(1);
  }

  if (url.endsWith('/')) url = url.slice(0, -1);
  if (!url.startsWith('https://')) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL debe empezar por https://\n');
    process.exit(1);
  }

  const testUrl = `${url}/rest/v1/`;
  console.log('URL:', url);
  console.log('Probando GET', testUrl, '...\n');

  try {
    const res = await fetch(testUrl, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });

    console.log('Código HTTP:', res.status, res.statusText);
    if (res.ok || res.status === 404) {
      // 404 en raíz REST a veces; lo importante es que haya respuesta TLS
      console.log('\n✅ Conexión HTTPS con Supabase correcta desde este PC.');
      console.log('   Si el dashboard aún falla, reinicia: npm run dev\n');
      process.exit(0);
    }
    const body = await res.text().catch(() => '');
    console.error('\n⚠️ Respuesta inesperada. Cuerpo (recorte):', body.slice(0, 200));
    process.exit(1);
  } catch (e) {
    console.error('\n❌ fetch falló:', e.message || e);
    console.error('\nSuele ser red, firewall, VPN o DNS.');
    console.error('Lee: docs/ERROR-FETCH-FAILED-SUPABASE.md\n');
    process.exit(1);
  }
}

main();
