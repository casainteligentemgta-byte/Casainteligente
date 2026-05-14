import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDA1MDAsImV4cCI6MjA4NzAxNjUwMH0.SZGCik5AzKhtFpmm5EkOe4ShMb7Fu6QaOPI8eQi5W7k';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function findTables() {
  console.log('--- Checking for contract tables ---');
  // We can't list tables directly via anon key easily, but we can try to guess or use RPC if exists.
  // Let's try to select from a few likely names.
  const tables = ['ci_contratos_express', 'ci_contratos_laborales', 'ci_contratos', 'contratos_express'];
  
  for (const t of tables) {
    const { count, error } = await supabase
      .from(t)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`Table ${t}: Error or Not found (${error.message})`);
    } else {
      console.log(`Table ${t}: Exists, Count: ${count}`);
    }
  }
}

findTables();
