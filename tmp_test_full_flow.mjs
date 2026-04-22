import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDA1MDAsImV4cCI6MjA4NzAxNjUwMH0.SZGCik5AzKhtFpmm5EkOe4ShMb7Fu6QaOPI8eQi5W7k';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const email = `testuser${Date.now()}@gmail.com`;
  const password = "Password123!";

  console.log("1. Signing up user...", email);
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password
  });
  
  if (authErr) {
    console.error("Signup error:", authErr);
    return;
  }
  
  const user = authData.user;
  console.log("User created:", user.id);

  console.log("2. Creating an organization via admin client...");
  const { data: org, error: orgErr } = await supabaseAdmin.from('organizations').insert([{ name: 'Mi Casa Inteligente' }]).select().single();
  if (orgErr) {
    console.error("Org error:", orgErr);
    return;
  }
  console.log("Org created:", org.id);

  console.log("3. Mapping user to organization via admin client...");
  const { error: mapErr } = await supabaseAdmin.from('user_organizations').insert([{
    user_id: user.id,
    organization_id: org.id,
    role: 'admin'
  }]);
  if (mapErr) {
    console.error("Map error:", mapErr);
    return;
  }
  console.log("User mapped to org successfully.");

  console.log("4. Attempting to insert employee as the authenticated user...");
  const payload = {
    nombres: "Luis",
    apellidos: "Mata",
    cedula: "V-" + Date.now(), // unique
    organization_id: org.id
  };
  
  const { data: emp, error: empErr } = await supabase.from('employees').insert([payload]).select();
  if (empErr) {
    console.error("Employee insert error:", empErr);
  } else {
    console.log("Employee inserted successfully:", emp);
  }
}

run();
