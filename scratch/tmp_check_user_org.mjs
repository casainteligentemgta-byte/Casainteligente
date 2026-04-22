import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const lines = env.split('\n')
const getVal = (key) => lines.find(l => l.startsWith(key))?.split('=')[1]?.trim()

const supabaseUrl = getVal('NEXT_PUBLIC_SUPABASE_URL')
const supabaseServiceKey = getVal('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Env vars missing')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkUser() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers()
  if (error) {
    console.error('Error listing users:', error)
    return
  }
  
  console.log('Total users:', users.length)
  users.forEach(u => {
    console.log(`User: ${u.email} (${u.id})`)
    console.log(` - App Metadata:`, u.app_metadata)
    console.log(` - User Metadata:`, u.user_metadata)
  })
}

checkUser()
