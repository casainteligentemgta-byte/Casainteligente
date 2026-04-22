import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function getLatestEvaluation() {
  console.log('Consultando la última evaluación creada...')
  const { data, error } = await supabase
    .from('evaluaciones')
    .select('*, employees(nombres, apellidos)')
    .order('created_at', { ascending: false })
    .limit(1)
  
  if (error) {
    console.error('Error al obtener la evaluación:', error.message)
  } else {
    console.log('Última evaluación encontrada:', JSON.stringify(data[0], null, 2))
  }
}

getLatestEvaluation()
