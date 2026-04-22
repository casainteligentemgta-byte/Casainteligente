import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk';
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
