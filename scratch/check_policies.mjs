import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkPolicies() {
  const { data, error } = await supabase.rpc('get_policies', { table_name: 'user_organizations' })
  
  if (error) {
    console.log('RPC get_policies failed, trying direct query on pg_policies...')
    const { data: policies, error: polError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'user_organizations')
    
    if (polError) {
      console.error('Error fetching policies:', polError)
    } else {
      console.log('Policies for user_organizations:')
      console.table(policies)
    }
  } else {
    console.log('Policies for user_organizations:', data)
  }
}

// Since I can't easily run arbitrary SQL via RPC if not defined, I'll try to just check if I can READ user_organizations with the anon key vs service role.
async function testRead() {
  const { data: serviceData } = await supabase.from('user_organizations').select('*')
  console.log('Read with Service Role:', serviceData?.length, 'records found.')
}

testRead()
checkPolicies()
