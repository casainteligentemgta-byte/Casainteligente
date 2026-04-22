import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkColumns() {
  const tables = ['employees', 'empleados']
  for (const table of tables) {
    console.log(`\n--- Columns for ${table} ---`)
    const { data, error } = await supabase.from(table).select('*').limit(1)
    if (error) {
        console.error(`Error fetching ${table}:`, error.message)
    } else {
        console.log(Object.keys(data[0] || {}))
    }
  }
}

checkColumns()
