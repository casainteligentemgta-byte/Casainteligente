import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)

const supabaseUrl = urlMatch ? urlMatch[1].trim() : null
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : null

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testColumn() {
    console.log("Testing insert to see if 'areas_conocimiento' exists...");
    
    // We try to select the column explicitly to see if it errors
    const { data, error } = await supabase.from('employees').select('areas_conocimiento').limit(1)
    
    if (error) {
        console.error("Database error:", error.message)
    } else {
        console.log("Success! The 'areas_conocimiento' column exists and is accessible. Data:", data)
    }
}

testColumn()
