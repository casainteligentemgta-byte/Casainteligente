import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkTrigger() {
  const { data, error } = await supabase.rpc('get_trigger_def', { trigger_name: 'set_employee_org' })
  
  if (error) {
    // Try to query pg_trigger directly via SQL-like RPC if available, or just fetch all functions
    console.log('Trying to fetch trigger definition via pg_get_triggerdef...')
    const { data: triggerDef, error: trError } = await supabase
      .from('pg_trigger')
      .select('tgname, tgfoid')
    
    console.log('Triggers found:', triggerDef?.length)
    
    // I'll try to find the function source
    const { data: funcDef, error: fError } = await supabase
      .from('pg_proc')
      .select('proname, prosrc')
      .ilike('proname', '%set_employee_org%')
    
    if (funcDef) {
        funcDef.forEach(f => {
            console.log(`Function ${f.proname}:`)
            console.log(f.prosrc)
        })
    }
  } else {
    console.log('Trigger definition:', data)
  }
}

checkTrigger()
