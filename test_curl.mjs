// Las llaves se leen del entorno (p. ej. `node --env-file=.env.local <este archivo>`); nunca van escritas en el repositorio.
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
fetch('https://mibxmhiruhrbbwcjdvks.supabase.co/rest/v1/organizations', {
  method: 'POST',
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({ name: 'Test Org' })
}).then(res => res.json()).then(console.log);
