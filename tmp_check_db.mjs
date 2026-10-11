// Las llaves se leen del entorno (p. ej. `node --env-file=.env.local <este archivo>`); nunca van escritas en el repositorio.
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

async function check() {
  const req = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`
    }
  });
  const data = await req.json();
  console.log("Employees definition:", JSON.stringify(data.definitions?.employees, null, 2));

  // also let's print all available definitions
  console.log("All tables:", Object.keys(data.definitions || {}));
}

check();

check();
