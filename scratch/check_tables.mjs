// Las llaves se leen del entorno (p. ej. `node --env-file=.env.local <este archivo>`); nunca van escritas en el repositorio.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function findTables() {
  console.log('--- Checking for contract tables ---');
  // We can't list tables directly via anon key easily, but we can try to guess or use RPC if exists.
  // Let's try to select from a few likely names.
  const tables = ['ci_contratos_express', 'ci_contratos_laborales', 'ci_contratos', 'contratos_express'];
  
  for (const t of tables) {
    const { count, error } = await supabase
      .from(t)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`Table ${t}: Error or Not found (${error.message})`);
    } else {
      console.log(`Table ${t}: Exists, Count: ${count}`);
    }
  }
}

findTables();
