import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
// Note: I need the SERVICE ROLE KEY to check policies and internal stuff if possible, 
// but since I don't have it in .env.local, I'll try to see what I can get with the anon key.
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDA1MDAsImV4cCI6MjA4NzAxNjUwMH0.SZGCik5AzKhtFpmm5EkOe4ShMb7Fu6QaOPI8eQi5W7k';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkRLS() {
  console.log('--- Checking RLS on ci_contratos_express ---');
  
  // Try to insert a row with anon key. If it fails with "new row violates row-level security policy", then RLS is on.
  const { error } = await supabase
    .from('ci_contratos_express')
    .insert({ id: crypto.randomUUID(), obrero_nombre: 'RLS TEST' });

  if (error) {
    console.log('Error inserting with anon key:', error.message);
    if (error.message.includes('row-level security')) {
      console.log('RLS is ENABLED and blocking inserts.');
    }
  } else {
    console.log('Insert SUCCEEDED with anon key! (RLS might be OFF or has a public policy)');
  }
}

checkRLS();
