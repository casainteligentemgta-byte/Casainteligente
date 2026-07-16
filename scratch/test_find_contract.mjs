import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDA1MDAsImV4cCI6MjA4NzAxNjUwMH0.SZGCik5AzKhtFpmm5EkOe4ShMb7Fu6QaOPI8eQi5W7k';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('Testing Strategy 1 (with join)...');
  const { data, error } = await supabase
    .from('ci_contratos_express')
    .select('id,created_at,obrero_nombre,obrero_cedula,proyecto_id,ci_proyectos(nombre)')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error Strategy 1:', error);
  } else {
    console.log('Success Strategy 1:', data);
  }

  console.log('\nTesting simple select...');
  const { data: data2, error: error2 } = await supabase
    .from('ci_contratos_express')
    .select('id,obrero_nombre')
    .limit(1);

  if (error2) {
    console.error('Error simple select:', error2);
  } else {
    console.log('Success simple select:', data2);
  }
}

run();
