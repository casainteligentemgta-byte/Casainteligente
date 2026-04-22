import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkAllUsers() {
  const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()
  console.log('Total Users:', users.length)
  users.forEach(u => console.log(`- ${u.email} (${u.id})`))

  const { data: mappings } = await supabase.from('user_organizations').select('*')
  console.log('Total Mappings:', mappings?.length)
  mappings?.forEach(m => console.log(`- User: ${m.user_id}, Org: ${m.organization_id}`))
}

checkAllUsers()
