import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function listTriggers() {
  console.log('Listando triggers de la tabla employees...')
  
  const { data, error } = await supabase.rpc('get_table_triggers', { t_name: 'employees' })
  
  if (error) {
    // Si el RPC no existe, intentamos consulta directa
    console.log('RPC falló, intentando consulta directa...')
    const { data: data2, error: error2 } = await supabase.from('pg_trigger').select('tgname').limit(10)
    
    // Probablemente no tengamos acceso a pg_trigger directamente vía PostgREST.
    // Intentemos una consulta SQL vía rpc si hay alguno genérico
    const { data: data3, error: error3 } = await supabase.rpc('exec_sql', { 
        sql_query: "SELECT tgname FROM pg_trigger JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid WHERE pg_class.relname = 'employees'"
    })
    
    if (error3) {
        console.error('No se pudieron listar los triggers:', error3.message)
    } else {
        console.log('Triggers encontrados:', data3)
    }
  } else {
    console.log('Triggers encontrados:', data)
  }
}

listTriggers()
