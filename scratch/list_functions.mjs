import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function listFunctions() {
  const { data, error } = await supabase.from('pg_proc').select('proname, prosrc').ilike('prosrc', '%organización%')
  if (error) {
    console.log('Error fetching from pg_proc:', error.message)
    // Fallback: try common function names
    const { data: triggerData } = await supabase.from('pg_trigger').select('tgname')
    console.log('Triggers:', triggerData)
  } else {
    data.forEach(f => {
      console.log(`Function: ${f.proname}`)
      console.log('Source:', f.prosrc)
      console.log('---')
    })
  }
}

listFunctions()
