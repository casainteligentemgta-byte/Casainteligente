
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspect() {
    console.log('--- Inspecting Triggers on employees ---');
    const { data: triggers, error: triggerErr } = await supabase.rpc('exec_sql', {
        sql_query: `
            SELECT tgname, tgfoid::regproc
            FROM pg_trigger
            JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
            WHERE pg_class.relname = 'employees';
        `
    });
    
    if (triggerErr) {
        console.log('Error fetching triggers (maybe exec_sql doesnt exist):', triggerErr.message);
    } else {
        console.log('Triggers:', JSON.stringify(triggers, null, 2));
    }

    console.log('\n--- Inspecting RLS Policies on employees ---');
    const { data: policies, error: policyErr } = await supabase.rpc('exec_sql', {
        sql_query: `
            SELECT polname, polcmd, polqual, polwithcheck
            FROM pg_policy
            JOIN pg_class ON pg_policy.polrelid = pg_class.oid
            WHERE pg_class.relname = 'employees';
        `
    });

    if (policyErr) {
        console.log('Error fetching policies:', policyErr.message);
    } else {
        console.log('Policies:', JSON.stringify(policies, null, 2));
    }

    console.log('\n--- Checking Table Columns ---');
    const { data: columns, error: colErr } = await supabase.rpc('exec_sql', {
        sql_query: `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'employees';
        `
    });

    if (colErr) {
        console.log('Error fetching columns:', colErr.message);
    } else {
        console.log('Columns:', JSON.stringify(columns, null, 2));
    }
}

inspect();
