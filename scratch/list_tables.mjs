import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function listTables() {
  const { data, error } = await supabase.from('pg_tables').select('tablename').eq('schemaname', 'public')
  if (error) {
    console.error('Error fetching tables:', error)
    // Fallback: try to guess by listing common tables
    const commonTables = ['employees', 'empleados', 'tb_empleados', 'organizations', 'user_organizations']
    for (const table of commonTables) {
        const { error: tableError } = await supabase.from(table).select('id').limit(1)
        if (!tableError) console.log(`Table exists: ${table}`)
        else console.log(`Table ${table} check failed:`, tableError.message)
    }
  } else {
    console.log('Tables in public schema:', data.map(t => t.tablename))
  }
}

listTables()
