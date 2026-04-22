import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_table_schema', { table_name: 'employees' })
  
  if (error) {
    console.log('RPC failed, trying raw query via information_schema')
    const { data: cols, error: err2 } = await supabase
      .from('employees')
      .select('*')
      .limit(0)
    
    if (err2) {
      console.error('Error fetching employees columns:', err2)
    } else {
      console.log('Successfully queried employees (empty)')
    }
    
    // Let's try to get columns via information_schema if possible (often blocked by RLS but we are using service role)
    // Actually, Supabase doesn't let you query information_schema easily via PostgREST unless exposed.
    // I will use the 'find_org.mjs' approach to just try an insert with NULL organization_id and see what happens.
  } else {
    console.log('Schema:', data)
  }
}

async function testInsert() {
    console.log('Testing insert without organization_id...')
    const { data, error } = await supabase
        .from('employees')
        .insert([{
            nombres: 'Test',
            apellidos: 'Bypass',
            cedula: 'TEST-' + Date.now(),
            organization_id: null
        }])
    
    if (error) {
        console.error('Insert error:', error)
    } else {
        console.log('Insert success!', data)
    }
}

testInsert()
