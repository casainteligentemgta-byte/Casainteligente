// Las llaves se leen del entorno (p. ej. `node --env-file=.env.local <este archivo>`); nunca van escritas en el repositorio.
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
fetch('https://mibxmhiruhrbbwcjdvks.supabase.co/rest/v1/employees', {
  method: 'POST',
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    nombres: 'Test',
    apellidos: 'Bypass',
    cedula: 'V-8888888',
    organization_id: '13ecba84-8ac7-48a4-a98b-3ec923b27669'
  })
}).then(res => res.json()).then(console.log);
