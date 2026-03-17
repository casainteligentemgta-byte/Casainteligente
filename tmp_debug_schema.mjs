
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)

const supabaseUrl = urlMatch ? urlMatch[1].trim() : null
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : null

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debugSchema() {
    // Try to get schema from PostgREST information schema
    const { data, error } = await supabase.from('_test').select('*') // Invalid table to trigger schema cache refresh? No.

    // Actually, let's use a query that almost always works if there are tables
    const { data: tables, error: e } = await supabase.from('customers').select('*').limit(1)
    console.log("Customers fetch:", tables ? "Success" : "Error: " + e.message)

    const { data: b, error: eb } = await supabase.from('budgets').select('*').limit(1)
    console.log("Budgets fetch:", b ? "Success" : "Error: " + eb.message)
}

debugSchema()
