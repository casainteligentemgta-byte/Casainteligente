import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupUserOrg() {
  // Get all users
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    console.error("Error listing users:", usersError);
    return;
  }
  
  console.log("Found", users.length, "users.");
  if (users.length === 0) {
    console.log("No users found.");
    return;
  }

  // Get or create an organization
  let { data: org, error: orgError } = await supabase.from('organizations').select('*').limit(1).single();
  if (!org) {
    console.log("No organization found, creating 'Casa Inteligente'");
    const res = await supabase.from('organizations').insert([{ name: 'Casa Inteligente' }]).select().single();
    if (res.error) {
       console.error("Error creating org:", res.error);
       return;
    }
    org = res.data;
  }
  console.log("Using Organization:", org.name, org.id);

  // Assign all users to the organization if not already
  for (const user of users) {
    const { data: existingMap, error: mapErr } = await supabase.from('user_organizations')
      .select('*').eq('user_id', user.id).eq('organization_id', org.id).single();
      
    if (!existingMap) {
      console.log("Assigning user", user.email, "to org", org.name);
      const res = await supabase.from('user_organizations').insert([{
        user_id: user.id,
        organization_id: org.id,
        role: 'admin' // or whatever default role
      }]);
      if (res.error) {
        console.error("Error mapping user:", res.error);
      } else {
        console.log("Mapped successfully.");
      }
    } else {
      console.log("User", user.email, "is already assigned to org", org.name);
    }
  }
}

setupUserOrg();
