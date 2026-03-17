
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)

const supabaseUrl = urlMatch ? urlMatch[1].trim() : null
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : null

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testFetch() {
    console.log('Fetching budgets...')
    const { data, error } = await supabase.from('budgets').select('*').order('created_at', { ascending: false }).limit(5)

    if (error) {
        console.error('Error fetching budgets:', error.message)
    } else {
        console.log('Successfully fetched budgets:', data.length)
        if (data.length > 0) {
            data.forEach(b => {
                console.log(`- ID: ${b.id}, Customer: ${b.customer_name}, Created: ${b.created_at}`)
            })
        }
    }
}

testFetch()
