import postgres from 'postgres';

const sql = postgres('postgresql://postgres:ingresocdmP.72@db.nttecjqlursiqjjmbyuo.supabase.co:5432/postgres', {
  ssl: 'require'
});

async function explore() {
  try {
    console.log('Testing connection to remote DB...');
    const result = await sql`SELECT 1 as connected`;
    console.log('Connected:', result[0].connected === 1);

    console.log('\n--- Listing Tables in public schema ---');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    console.log(tables.map(t => t.table_name).join('\n'));

    if (tables.some(t => t.table_name === 'registros_gastos')) {
      console.log('\n--- Schema for registros_gastos ---');
      const columns = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'registros_gastos'
        ORDER BY ordinal_position;
      `;
      console.table(columns);
    }
    
    if (tables.some(t => t.table_name === 'cco_proyecto_config')) {
      console.log('\n--- Schema for cco_proyecto_config ---');
      const columns = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'cco_proyecto_config'
        ORDER BY ordinal_position;
      `;
      console.table(columns);
    }

  } catch (err) {
    console.error('Error connecting to remote DB:', err);
  } finally {
    await sql.end();
  }
}

explore();
