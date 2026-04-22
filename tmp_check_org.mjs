import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkOrg() {
  const { data: orgs } = await supabase.from('organizations').select('*');
  console.log("Orgs:", orgs);

  const { data: userOrgs } = await supabase.from('user_organizations').select('*');
  console.log("User Orgs:", userOrgs);

  const { data: users, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) console.error("Auth error:", authError);
  else console.log("Users:", users.users.map(u => ({ id: u.id, email: u.email })));
}

checkOrg();
