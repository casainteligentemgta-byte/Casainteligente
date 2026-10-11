// Las llaves se leen del entorno (p. ej. `node --env-file=.env.local <este archivo>`); nunca van escritas en el repositorio.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnostic() {
  console.log('--- 1. Checking Table: ci_contratos_express ---');
  const { data: rows, error: rowErr } = await supabase
    .from('ci_contratos_express')
    .select('*');
  
  if (rowErr) {
    console.error('Table Error:', rowErr);
  } else {
    console.log(`Found ${rows?.length || 0} rows in ci_contratos_express.`);
    if (rows?.length > 0) {
      console.log('Sample row:', rows[0]);
    }
  }

  console.log('\n--- 2. Checking Bucket: contratos_obreros ---');
  const { data: files, error: stErr } = await supabase
    .storage
    .from('contratos_obreros')
    .list('express', { limit: 10 });

  if (stErr) {
    console.error('Storage Error (contratos_obreros/express):', stErr);
  } else {
    console.log(`Found ${files?.length || 0} items in express/ folder of contratos_obreros.`);
    files?.forEach(f => console.log(' -', f.name));
  }

  console.log('\n--- 3. Checking Bucket: contratos-express (User mentioned this) ---');
  const { data: filesExp, error: stErrExp } = await supabase
    .storage
    .from('contratos-express')
    .list('', { limit: 10 });

  if (stErrExp) {
    console.error('Storage Error (contratos-express):', stErrExp);
  } else {
    console.log(`Found ${filesExp?.length || 0} items in contratos-express.`);
    filesExp?.forEach(f => console.log(' -', f.name));
  }
}

diagnostic();
