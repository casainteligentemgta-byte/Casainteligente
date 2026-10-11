// Las llaves se leen del entorno (p. ej. `node --env-file=.env.local <este archivo>`); nunca van escritas en el repositorio.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkRLS() {
  const { data: proy } = await supabase.from('ci_proyectos').select('id').limit(1).single();
  const { data: nom } = await supabase.from('ci_config_nomina').select('id').limit(1).single();

  const payload = {
    id: crypto.randomUUID(),
    proyecto_id: proy?.id || crypto.randomUUID(),
    config_nomina_id: nom?.id || crypto.randomUUID(),
    obrero_nombre: 'RLS TEST 2',
    obrero_cedula: 'V-000000',
    pdf_storage_path: 'test.pdf'
  };

  const { error } = await supabase.from('ci_contratos_express').insert(payload);

  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Insert succeeded with anon key!');
  }
}

checkRLS();
