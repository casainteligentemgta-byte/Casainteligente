import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugTriggers() {
  console.log('Fetching information about triggers on table employees...')
  
  // We can't query pg_trigger directly via PostgREST, but we can try to guess or use a system function if exposed.
  // Let's try to insert a dummy record and catch the full error details.
  
  const payload = {
    nombres: 'Test',
    apellidos: 'User',
    cedula: 'TEST-' + Date.now(),
    organization_id: '5607a881-e65e-493b-ab06-d129d50fe9e2'
  }

  console.log('Attempting test insert with organization_id...')
  const { data, error } = await supabase.from('employees').insert([payload])
  
  if (error) {
    console.error('Insert failed with error:')
    console.error(JSON.stringify(error, null, 2))
  } else {
    console.log('Insert succeeded! (Wait, then it should work for the user too if they are linked)')
    // Clean up
    await supabase.from('employees').delete().eq('cedula', payload.cedula)
  }
}

debugTriggers()
