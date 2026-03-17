
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)

const supabaseUrl = urlMatch ? urlMatch[1].trim() : null
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : null

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function getTables() {
    const { data, error } = await supabase.rpc('get_tables_info')
    if (error) {
        // fallback to just trying common names
        console.log("RPC get_tables_info failed, trying common table names...")
        const tables = ['budgets', 'projects', 'customers', 'products', 'presupuestos']
        for (const t of tables) {
            const { error: e } = await supabase.from(t).select('id').limit(1)
            if (!e) console.log(`Table exists: ${t}`)
            else console.log(`Table ${t} error: ${e.message}`)
        }
    } else {
        console.log("Tables:", data)
    }
}

getTables()
