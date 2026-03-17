
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)

const supabaseUrl = urlMatch ? urlMatch[1].trim() : null
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : null

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testFetch() {
    console.log('Fetching customers...')
    const { data, error } = await supabase.from('customers').select('*').limit(1)

    if (error) {
        console.error('Error fetching customers:', error.message)
    } else {
        console.log('Successfully fetched customers:', data.length)
        console.log('Record:', data[0])
    }
}

testFetch()
