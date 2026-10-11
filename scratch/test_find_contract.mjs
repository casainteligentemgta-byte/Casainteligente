// Las llaves se leen del entorno (p. ej. `node --env-file=.env.local <este archivo>`); nunca van escritas en el repositorio.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

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
