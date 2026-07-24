import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mibxmhirtuhrbbwcjdvks.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.argv[2];

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Usage: node list-express.mjs <SERVICE_ROLE_KEY>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Checking ci_contratos_express table...');
  const { data, error } = await supabase
    .from('ci_contratos_express')
    .select('*')
    .limit(10);

  if (error) {
    console.error('Error fetching contracts:', error);
    return;
  }

  console.log(`Found ${data.length} contracts.`);
  console.table(data);
}

run();
