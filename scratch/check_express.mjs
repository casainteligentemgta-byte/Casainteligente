
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDA1MDAsImV4cCI6MjA4NzAxNjUwMH0.SZGCik5AzKhtFpmm5EkOe4ShMb7Fu6QaOPI8eQi5W7k';

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
