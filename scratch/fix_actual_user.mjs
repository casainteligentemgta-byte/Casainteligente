import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixUser() {
  const email = 'casainteligentemgta@gmail.com'
  const orgId = '5607a881-e65e-493b-ab06-d129d50fe9e2' // Mi Casa Inteligente

  console.log(`Fixing user: ${email}`)

  // 1. Get User ID
  const { data: users, error: userError } = await supabase.auth.admin.listUsers()
  if (userError) return console.error('Error listing users:', userError)

  const user = users.users.find(u => u.email === email)
  if (!user) return console.error(`User ${email} not found in Auth!`)

  const userId = user.id
  console.log(`Found User ID: ${userId}`)

  // 2. Add to user_organizations
  const { error: mapError } = await supabase
    .from('user_organizations')
    .upsert({ user_id: userId, organization_id: orgId }, { onConflict: 'user_id' })

  if (mapError) {
    console.error('Error adding mapping:', mapError)
  } else {
    console.log('Mapping added successfully to user_organizations.')
  }

  // 3. Update app_metadata
  const { error: metaError } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { organization_id: orgId, role: 'admin' }
  })

  if (metaError) {
    console.error('Error updating metadata:', metaError)
  } else {
    console.log('User app_metadata updated successfully.')
  }
}

fixUser()
