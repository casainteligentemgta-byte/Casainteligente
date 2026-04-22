
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testInsert() {
    console.log('Attempting insert with service role key...');
    const { data, error } = await supabase.from('employees').insert([
        {
            nombres: 'Test',
            apellidos: 'User',
            cedula: 'TEST-' + Date.now(),
            organization_id: '5607a881-e65e-493b-ab06-d129d50fe9e2'
        }
    ]).select();

    if (error) {
        console.error('Insert failed:', error.message);
        console.error('Full error:', JSON.stringify(error, null, 2));
    } else {
        console.log('Insert successful:', data);
    }
}

testInsert();
