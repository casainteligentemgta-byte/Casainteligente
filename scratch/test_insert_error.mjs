
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testInsert() {
    console.log('Testing insertion into employees...');
    
    const payload = {
        nombres: 'Test',
        apellidos: 'User',
        cedula: 'V-' + Math.floor(Math.random() * 10000000),
        organization_id: '5607a881-e65e-493b-ab06-d129d50fe9e2' // Casa Inteligente ID
    };

    const { data, error } = await supabase.from('employees').insert([payload]).select();

    if (error) {
        console.error('Insertion failed!');
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        console.error('Error Details:', error.details);
        console.error('Error Hint:', error.hint);
    } else {
        console.log('Insertion successful:', data);
    }
}

testInsert();
