import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkColumns() {
  const { data, error } = await supabase.from('employees').select('*').limit(1)
  if (data && data.length > 0) {
    console.log('Columns found in employees:', Object.keys(data[0]))
  } else {
    // If table is empty, we can try to get column info via RPC if available, 
    // or just try to insert a dummy and see the error if it fails on missing columns.
    console.log('Table is empty. Attempting to insert dummy to see columns...')
    const { error: insErr } = await supabase.from('employees').insert([{ nombres: 'Test' }])
    console.log('Insert error (might help find columns):', insErr?.message)
  }
}

checkColumns()
