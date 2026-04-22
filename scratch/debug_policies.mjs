
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0MDUwMCwiZXhwIjoyMDg3MDE2NTAwfQ.HVtMM1jL7nnD7QK1m6TrDTqBVTmIWpBpfWmEygf-JOk';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugPolicies() {
    console.log('Checking policies on employees table...');
    
    // Try querying pg_policies directly
    // Note: service_role can usually bypass RLS but still needs permissions to read system views if they are restricted
    const { data: data2, error: error2 } = await supabase
        .from('pg_policies')
        .select('*')
        .eq('tablename', 'employees');

    if (error2) {
        console.error('Direct query on pg_policies failed:', error2.message);
        
        // Try listing all tables to see if pg_policies is accessible
        const { data: tables, error: tablesErr } = await supabase
            .from('pg_catalog.pg_policies')
            .select('*')
            .limit(1);
        
        if (tablesErr) {
            console.error('Querying pg_catalog.pg_policies also failed.');
        }
    } else {
        console.log('Policies found:', JSON.stringify(data2, null, 2));
    }
}

debugPolicies();
