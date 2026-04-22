
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findTriggers() {
    console.log('Searching for triggers on employees table...');
    
    // We can't query pg_trigger directly via PostgREST unless exposed.
    // But we can try to use a common RPC if it exists, or just try to guess.
    
    // Let's try to see if we can get the table definition which might include triggers in some environments
    // But usually not in Supabase API.
    
    // Let's try to run a dummy update and see if it also fails.
    console.log('Testing update...');
    const { error: updateErr } = await supabase.from('employees').update({ nombres: 'Test' }).eq('id', '00000000-0000-0000-0000-000000000000');
    if (updateErr) {
        console.log('Update also failed/errored:', updateErr.message);
    }

    // Since we know the error message "El usuario no tiene organización asignada",
    // We can try to DROP a trigger if we can guess its name, or better, 
    // try to find any RPC that allows SQL execution.
    
    console.log('Trying to find any RPC that might execute SQL...');
    const { data: rpcs, error: rpcsErr } = await supabase.rpc('get_my_rpcs'); // Guessing
    if (rpcsErr) {
        console.log('get_my_rpcs failed.');
    } else {
        console.log('Found RPCs:', rpcs);
    }
}

findTriggers();
