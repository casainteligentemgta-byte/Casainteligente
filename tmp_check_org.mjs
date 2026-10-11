// Las llaves se leen del entorno (p. ej. `node --env-file=.env.local <este archivo>`); nunca van escritas en el repositorio.
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
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
