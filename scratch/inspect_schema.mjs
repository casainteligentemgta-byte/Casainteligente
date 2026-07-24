import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectTable() {
  console.log('--- Inspecting Columns for ci_contratos_express ---');
  const { data: columns, error: colError } = await supabase
    .rpc('get_table_columns', { table_name_input: 'ci_contratos_express' });
  
  if (colError) {
    // If RPC doesn't exist, try querying information_schema via SQL if possible, 
    // but usually we can't do that via JS client easily unless we have a specific RPC.
    // Let's try a direct query to information_schema if the user has enabled it, or just use a generic query.
    console.log('RPC get_table_columns failed, trying direct select from information_schema...');
    const { data: infoCols, error: infoError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'ci_contratos_express');
      
    if (infoError) {
      console.error('Error fetching columns:', infoError.message);
    } else {
      console.table(infoCols);
    }
  } else {
    console.table(columns);
  }

  console.log('\n--- Inspecting RLS Policies ---');
  const { data: policies, error: polError } = await supabase
    .from('pg_policies')
    .select('*')
    .eq('tablename', 'ci_contratos_express');
  
  if (polError) {
    console.error('Error fetching policies (maybe pg_policies not accessible):', polError.message);
  } else {
    console.table(policies);
  }

  console.log('\n--- Inspecting Triggers ---');
  // pg_trigger is usually not accessible via public API unless specific views exist
  const { data: triggers, error: trigError } = await supabase
    .from('pg_trigger')
    .select('tgname')
    .eq('tgrelid', 'ci_contratos_express'::regclass);
  
  if (trigError) {
    console.error('Error fetching triggers:', trigError.message);
  } else {
    console.table(triggers);
  }
}

inspectTable();
