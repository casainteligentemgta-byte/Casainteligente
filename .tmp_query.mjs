import postgres from 'postgres';
async function main() {
  const sql = postgres('postgres://postgres:postgres@127.0.0.1:54322/postgres');
  try {
    const res = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'ci_nomina%';`;
    console.log("Tablas encontradas:", res.map(r => r.table_name));
    
    const resCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'ci_nomina_periodos';`;
    console.log("Columnas en ci_nomina_periodos:", resCols.map(r => r.column_name));
  } catch (e) {
    console.error("Error BD:", e.message);
  } finally {
    await sql.end();
  }
}
main();