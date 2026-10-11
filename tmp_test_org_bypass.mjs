// Las llaves se leen del entorno (p. ej. `node --env-file=.env.local <este archivo>`); nunca van escritas en el repositorio.
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testInsertWithOrg() {
  // 1. Insert a test organization
  const { data: org, error: orgError } = await supabase.from('organizations').insert([{ name: 'Test Org' }]).select().single();
  if (orgError) {
    console.error("Org insert error:", orgError);
    return;
  }
  console.log("Created Org:", org);

  // 2. Insert employee with organization_id
  const payload = {
    nombres: "Test",
    apellidos: "User",
    cedula: "V-123456789", // must be unique
    organization_id: org.id
  };
  const { data, error } = await supabase.from('employees').insert([payload]);
  console.log("Employee insert error:", error);
  console.log("Employee insert data:", data);
}

testInsertWithOrg();
