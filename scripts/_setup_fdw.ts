import postgres from 'postgres';

const localDbUrl = 'postgresql://postgres:Tlpvac_5801@db.mibxmhiruhrbbwcjdvks.supabase.co:5432/postgres';
const remoteHost = 'db.nttecjqlursiqjjmbyuo.supabase.co';
const remoteUser = 'postgres';
const remotePass = 'ingresocdmP.72';

const sql = postgres(localDbUrl, { ssl: 'require' });

async function setupAndExploreFdw() {
  try {
    console.log('Setting up FDW on local database...');
    
    await sql`CREATE EXTENSION IF NOT EXISTS postgres_fdw;`;
    
    // Drop if exists to recreate
    await sql`DROP SERVER IF EXISTS suegro_server CASCADE;`;
    await sql`DROP SCHEMA IF EXISTS suegro_remote CASCADE;`;
    
    await sql`
      CREATE SERVER suegro_server
      FOREIGN DATA WRAPPER postgres_fdw
      OPTIONS (host ${remoteHost}, port '5432', dbname 'postgres');
    `;
    
    await sql`
      CREATE USER MAPPING FOR current_user
      SERVER suegro_server
      OPTIONS (user ${remoteUser}, password ${remotePass});
    `;
    
    await sql`CREATE SCHEMA suegro_remote;`;
    
    console.log('Importing foreign schema...');
    await sql`
      IMPORT FOREIGN SCHEMA public 
      FROM SERVER suegro_server 
      INTO suegro_remote;
    `;
    
    console.log('\n--- Tables in remote database ---');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'suegro_remote'
      ORDER BY table_name;
    `;
    console.log(tables.map(t => t.table_name).join('\n'));

    if (tables.some(t => t.table_name === 'registros_gastos')) {
      console.log('\n--- Schema for remote registros_gastos ---');
      const columns = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'suegro_remote' AND table_name = 'registros_gastos'
        ORDER BY ordinal_position;
      `;
      console.table(columns);
      
      console.log('\n--- Sample data from remote registros_gastos ---');
      const sample = await sql`SELECT * FROM suegro_remote.registros_gastos LIMIT 1;`;
      console.log(sample);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.end();
  }
}

setupAndExploreFdw();
