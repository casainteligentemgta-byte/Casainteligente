import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testInsert() {
  const testId = crypto.randomUUID();
  const payload = {
    id: testId,
    proyecto_id: '86eeb7d3-da76-4dcb-a225-26edc8f6978f', // Just a placeholder UUID or a real one if I can find it
    config_nomina_id: '86eeb7d3-da76-4dcb-a225-26edc8f6978f',
    obrero_nombre: 'TEST INSERT',
    obrero_cedula: 'V-12345678',
    pdf_storage_path: 'test/path.pdf'
  };

  console.log('Attempting test insert with payload:', payload);
  
  // First, let's try to find a valid proyecto_id and config_nomina_id
  const { data: proy } = await supabase.from('ci_proyectos').select('id').limit(1).single();
  const { data: nom } = await supabase.from('ci_config_nomina').select('id').limit(1).single();

  if (proy) payload.proyecto_id = proy.id;
  if (nom) payload.config_nomina_id = nom.id;

  console.log('Using real IDs:', { proyecto_id: payload.proyecto_id, config_nomina_id: payload.config_nomina_id });

  const { data, error } = await supabase
    .from('ci_contratos_express')
    .insert(payload)
    .select();

  if (error) {
    console.error('Insert failed:', error);
    console.error('Error Code:', error.code);
    console.error('Error Detail:', error.details);
    console.error('Error Hint:', error.hint);
  } else {
    console.log('Insert succeeded:', data);
  }
}

testInsert();
