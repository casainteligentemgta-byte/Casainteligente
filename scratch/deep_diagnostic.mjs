
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDA1MDAsImV4cCI6MjA4NzAxNjUwMH0.SZGCik5AzKhtFpmm5EkOe4ShMb7Fu6QaOPI8eQi5W7k';

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
