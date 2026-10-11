// Las llaves se leen del entorno (p. ej. `node --env-file=.env.local <este archivo>`); nunca van escritas en el repositorio.
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testInsert() {
  const payload = {
    nombres: "Test",
    apellidos: "User",
    cedula: "V-12345678"
  };
  const { data, error } = await supabase.from('employees').insert([payload]);
  console.log("Error:", error);
  console.log("Data:", data);
}

testInsert();
