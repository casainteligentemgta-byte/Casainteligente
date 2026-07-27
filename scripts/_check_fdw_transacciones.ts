import postgres from 'postgres';

// Usar la IP IPv6 directamente para evitar problemas de DNS de node
const localDbUrl = 'postgresql://postgres:Tlpvac_5801@db.mibxmhiruhrbbwcjdvks.supabase.co:5432/postgres';

const sql = postgres(localDbUrl, { ssl: 'require' });

async function checkFdw() {
  try {
    console.log('Checking FDW transacciones schema...');
    
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'suegro_db' AND table_name = 'transacciones'
      ORDER BY ordinal_position;
    `;
    console.table(columns);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.end();
  }
}

checkFdw();
