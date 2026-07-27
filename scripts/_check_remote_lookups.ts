import postgres from 'postgres';

const localDbUrl = 'postgresql://postgres:Tlpvac_5801@[2600:1f18:2e13:9d52:d18b:576c:e5ba:5e06]:5432/postgres';
const sql = postgres(localDbUrl, { ssl: 'require' });

async function checkRemoteSchemas() {
  try {
    console.log('Importing lookup tables to suegro_db schema...');
    
    // Importar las tablas adicionales que necesitamos para los JOINs
    await sql`
      IMPORT FOREIGN SCHEMA public 
      LIMIT TO (proveedores, tipos_gasto, estructura_costos, formas_pago, proyectos)
      FROM SERVER suegro_server 
      INTO suegro_db;
    `.catch(e => console.log('Already imported or error:', e.message));

    const tables = ['proveedores', 'tipos_gasto', 'estructura_costos', 'formas_pago', 'proyectos'];
    
    for (const table of tables) {
      console.log(`\n--- Columns for ${table} ---`);
      const columns = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'suegro_db' AND table_name = ${table}
        ORDER BY ordinal_position;
      `;
      console.table(columns);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.end();
  }
}

checkRemoteSchemas();
