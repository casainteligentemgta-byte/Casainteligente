import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk';
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
