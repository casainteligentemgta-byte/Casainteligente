import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function findUser() {
  const email = 'casainteligentemgta@gmail.com'
  console.log(`Searching for user: ${email}`)

  const { data: users, error } = await supabase.auth.admin.listUsers()
  if (error) return console.error('Error:', error)

  const user = users.users.find(u => u.email === email)
  if (user) {
    console.log('User found:', user)
  } else {
    console.log('User NOT found in listUsers.')
    console.log('Full list of emails found:', users.users.map(u => u.email))
  }
}

findUser()
