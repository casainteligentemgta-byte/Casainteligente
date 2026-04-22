import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkRLS() {
  console.log('Checking RLS policies on employees table...')
  // We can't query pg_policies directly via PostgREST usually, 
  // but we can try to query information_schema.tables to see if RLS is enabled
  const { data, error } = await supabase.from('employees').select('id').limit(1)
  
  // If it's an RLS issue with a function, we need to find the function.
  // Let's try to query pg_policies through a common trick if available
  const { data: policies, error: polErr } = await supabase.from('pg_policies').select('*').eq('tablename', 'employees')
  
  if (polErr) {
    console.log('Could not access pg_policies directly.')
  } else {
    console.log('Policies found:', policies)
  }
}

checkRLS()
