import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDA1MDAsImV4cCI6MjA4NzAxNjUwMH0.SZGCik5AzKhtFpmm5EkOe4ShMb7Fu6QaOPI8eQi5W7k';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkRLS() {
  const { data: proy } = await supabase.from('ci_proyectos').select('id').limit(1).single();
  const { data: nom } = await supabase.from('ci_config_nomina').select('id').limit(1).single();

  const id = crypto.randomUUID();
  const payload = {
    id,
    proyecto_id: proy?.id || crypto.randomUUID(),
    config_nomina_id: nom?.id || crypto.randomUUID(),
    obrero_nombre: 'RLS TEST 3',
    obrero_cedula: 'V-000000',
    pdf_storage_path: 'test.pdf'
  };

  console.log('Inserting ID:', id);
  const { data, error } = await supabase.from('ci_contratos_express').insert(payload).select();

  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Insert succeeded, returned data:', data);
    
    // Now try to select it immediately
    const { data: selected } = await supabase.from('ci_contratos_express').select('*').eq('id', id);
    console.log('Immediate select:', selected);
  }
}

checkRLS();
