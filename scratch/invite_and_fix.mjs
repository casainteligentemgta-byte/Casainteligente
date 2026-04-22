import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function inviteUser() {
  const email = 'casainteligentemgta@gmail.com'
  console.log(`Inviting user: ${email}`)

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email)
  if (error) {
    console.error('Invite failed:', error.message)
    if (error.message.includes('already exists')) {
        console.log('The user ALREADY exists but was not shown in listUsers? (Unlikely)')
    }
  } else {
    console.log('Invite sent successfully! User created/invited.')
    console.log('User ID:', data.user.id)
    
    // Now link them to the organization
    const orgId = '5607a881-e65e-493b-ab06-d129d50fe9e2'
    const { error: linkErr } = await supabase.from('user_organizations').upsert({
      user_id: data.user.id,
      organization_id: orgId
    })
    
    if (linkErr) {
        console.error('Linking error:', linkErr.message)
    } else {
        console.log('User linked to organization in user_organizations.')
        
        // Also update app_metadata
        const { error: metaErr } = await supabase.auth.admin.updateUserById(data.user.id, {
            app_metadata: { organization_id: orgId }
        })
        if (metaErr) console.error('Metadata error:', metaErr.message)
        else console.log('App metadata updated.')
    }
  }
}

inviteUser()
