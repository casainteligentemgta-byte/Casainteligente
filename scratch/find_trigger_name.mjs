import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function findTriggerName() {
  console.log('Searching for triggers on employees table...')
  const { data, error } = await supabase.from('information_schema.triggers')
    .select('trigger_name, event_manipulation, event_object_table, action_statement')
    .eq('event_object_table', 'employees')
  
  if (error) {
    console.error('Error accessing information_schema.triggers:', error.message)
    // Try another approach: information_schema.routines
    const { data: routines, error: routErr } = await supabase.from('information_schema.routines')
        .select('routine_name, routine_definition')
        .ilike('routine_definition', '%organización%')
    
    if (routErr) {
        console.log('Could not access routines either.')
    } else {
        console.log('Found potential routines:', routines)
    }
  } else {
    console.log('Triggers found:', data)
  }
}

findTriggerName()
