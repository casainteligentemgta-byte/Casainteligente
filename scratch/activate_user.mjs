import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const email = 'casainteligentemgta@gmail.com'
const password = 'Casa2024*'

async function activateUser() {
  console.log(`Buscando usuario: ${email}`)
  
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error('Error listando usuarios:', listError.message)
    return
  }

  const user = users.find(u => u.email === email)
  if (!user) {
    console.error('Usuario no encontrado')
    return
  }

  console.log(`Activando usuario ID: ${user.id}`)

  const { data, error } = await supabase.auth.admin.updateUserById(
    user.id,
    { 
      email_confirm: true,
      password: password,
      app_metadata: { organization_id: '5607a881-e65e-493b-ab06-d129d50fe9e2' }
    }
  )

  if (error) {
    console.error('Error al activar:', error.message)
  } else {
    console.log('✅ Usuario activado con éxito.')
    console.log(`Correo: ${email}`)
    console.log(`Contraseña temporal: ${password}`)
  }
}

activateUser()
