import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDA1MDAsImV4cCI6MjA4NzAxNjUwMH0.SZGCik5AzKhtFpmm5EkOe4ShMb7Fu6QaOPI8eQi5W7k';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnostic() {
  console.log('--- Checking Storage Files Metadata ---');
  const { data: files, error } = await supabase
    .storage
    .from('contratos_obreros')
    .list('express', { limit: 20 });

  if (error) {
    console.error('Storage Error:', error);
  } else {
    files.forEach(f => {
      console.log(`File: ${f.name}, Created At: ${f.created_at}, ID: ${f.id}`);
    });
  }
}

diagnostic();
