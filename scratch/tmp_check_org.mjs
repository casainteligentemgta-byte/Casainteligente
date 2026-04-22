import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkOrg() {
  const orgId = '5607a881-e65e-493b-ab06-d129d50fe9e2'
  const { data, error } = await supabase.from('organizations').select('*').eq('id', orgId).single()
  
  if (error) {
    console.error('Error checking org:', error.message)
    const { data: all, error: allErr } = await supabase.from('organizations').select('id, name')
    if (allErr) console.error('Error listing all orgs:', allErr.message)
    else console.log('All orgs:', all)
  } else {
    console.log('Org found:', data.name)
  }
}

checkOrg()
