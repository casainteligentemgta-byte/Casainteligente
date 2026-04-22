import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debug() {
  console.log('--- Checking Triggers on employees table ---')
  const { data: triggers, error: tErr } = await supabase.rpc('get_table_triggers', { t_name: 'employees' })
  if (tErr) {
    console.log('get_table_triggers failed, trying manual SQL via rpc if possible...')
    // Many Supabase setups have a custom RPC for SQL execution during setup
    const { data: sqlRes, error: sqlErr } = await supabase.rpc('exec_sql', { 
        sql_query: "SELECT tgname, proname, prosrc FROM pg_trigger JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid WHERE pg_class.relname = 'employees'"
    })
    if (sqlErr) {
        console.error('exec_sql also failed:', sqlErr.message)
    } else {
        console.log('Found triggers/functions:', JSON.stringify(sqlRes, null, 2))
    }
  } else {
    console.log('Triggers found:', JSON.stringify(triggers, null, 2))
  }
}

debug()
