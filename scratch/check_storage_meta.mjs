// Las llaves se leen del entorno (p. ej. `node --env-file=.env.local <este archivo>`); nunca van escritas en el repositorio.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnostic() {
  console.log('--- Checking Storage Files Metadata ---');
  const { data: files, error } = await supabase
    .storage
    .from('contratos_obreros')
    .list('express', { limit: 20 });

  if (error) {
    console.error('Storage Error:', error);
  } else {
    files.forEach(f => {
      console.log(`File: ${f.name}, Created At: ${f.created_at}, ID: ${f.id}`);
    });
  }
}

diagnostic();
