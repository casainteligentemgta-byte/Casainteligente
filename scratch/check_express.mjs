// Las llaves se leen del entorno (p. ej. `node --env-file=.env.local <este archivo>`); nunca van escritas en el repositorio.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  console.log('--- Checking Storage ---');
  // List files in bucket 'contratos-express'
  const { data: files, error: filesError } = await supabase
    .storage
    .from('contratos-express')
    .list();

  if (filesError) {
    console.error('Storage Error:', filesError);
  } else {
    console.log('Files in contratos-express:', files?.length || 0);
    files?.forEach(f => console.log(' -', f.name));
  }

  console.log('\n--- Checking Projects ---');
  const { data: projs, error: projsError } = await supabase
    .from('ci_proyectos')
    .select('id, nombre')
    .limit(5);

  if (projsError) {
    console.error('Projects Error:', projsError);
  } else {
    console.log('Sample Projects:', projs);
  }
}

check();
