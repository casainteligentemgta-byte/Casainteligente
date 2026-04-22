import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function getTriggerLogic() {
  // Try to find functions containing the error message
  const { data, error } = await supabase.from('pg_proc').select('proname, prosrc')
  
  if (error) {
    // If pg_proc is not accessible, maybe there is an RPC we can use?
    // Let's try to query the information_schema
    const { data: info, error: infoErr } = await supabase.from('information_schema.routines').select('routine_name, routine_definition').ilike('routine_definition', '%organización%')
    
    if (infoErr) {
        console.log('Could not access information_schema.routines either.')
    } else {
        info.forEach(r => {
            console.log(`Routine: ${r.routine_name}`)
            console.log('Definition:', r.routine_definition)
        })
    }
  } else {
    data.forEach(f => {
      if (f.prosrc.includes('organización')) {
        console.log(`Function: ${f.proname}`)
        console.log('Source:', f.prosrc)
      }
    })
  }
}

getTriggerLogic()
