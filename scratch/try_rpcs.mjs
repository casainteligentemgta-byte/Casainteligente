
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function tryCommonRPCs() {
    const table = 'employees';
    const names = ['get_table_triggers', 'exec_sql', 'execute_sql', 'run_sql', 'inspect_table'];
    
    for (const name of names) {
        console.log(`Trying RPC: ${name}...`);
        const { data, error } = await supabase.rpc(name, { 
            t_name: table, 
            sql: "SELECT * FROM pg_trigger",
            sql_query: "SELECT * FROM pg_trigger",
            query: "SELECT * FROM pg_trigger" 
        });
        if (!error) {
            console.log(`RPC ${name} SUCCEEDED!`);
            console.log(JSON.stringify(data, null, 2));
            return;
        } else {
            console.log(`RPC ${name} failed: ${error.message}`);
        }
    }
}

tryCommonRPCs();
