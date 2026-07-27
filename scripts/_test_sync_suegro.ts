import postgres from 'postgres';

const localDbUrl = 'postgresql://postgres:Tlpvac_5801@[2600:1f18:2e13:9d52:d18b:576c:e5ba:5e06]:5432/postgres';
const sql = postgres(localDbUrl, { ssl: 'require' });

async function testSync() {
  try {
    console.log('Testing sync function...');
    
    // Ejecutar la función con el ID del proyecto de Flamboyant
    const result = await sql`
      SELECT public.ci_sincronizar_desde_suegro('171694ed-0ecb-4ec5-82f5-82b980cb261f'::uuid) as res;
    `;
    
    console.log(result[0].res);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.end();
  }
}

testSync();
