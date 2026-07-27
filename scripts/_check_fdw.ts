import postgres from 'postgres';

// Usar la IP IPv6 directamente para evitar problemas de DNS de node
const localDbUrl = 'postgresql://postgres:Tlpvac_5801@[2600:1f18:2e13:9d52:d18b:576c:e5ba:5e06]:5432/postgres';

const sql = postgres(localDbUrl, { ssl: 'require' });

async function checkFdw() {
  try {
    console.log('Checking FDW setup...');
    
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'suegro_db'
      ORDER BY table_name;
    `;
    console.log('\nTables in suegro_db schema:');
    console.log(tables.map(t => t.table_name).join('\n'));

    if (tables.length > 0) {
      console.log('\nColumns for registros_gastos:');
      const columns = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'suegro_db' AND table_name = 'registros_gastos'
        ORDER BY ordinal_position;
      `;
      console.table(columns);
    } else {
      console.log('\nNo tables found. Let\'s check if the server exists:');
      const servers = await sql`SELECT srvname FROM pg_foreign_server;`;
      console.log('Foreign servers:', servers.map(s => s.srvname));
      
      const schemas = await sql`SELECT nspname FROM pg_namespace WHERE nspname = 'suegro_db';`;
      console.log('Schema exists:', schemas.length > 0);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.end();
  }
}

checkFdw();
