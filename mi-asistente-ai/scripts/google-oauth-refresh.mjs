/**
 * Una sola vez: genera GOOGLE_REFRESH_TOKEN.
 *
 * Uso:
 *   1) Pon GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env
 *   2) En Google Cloud → Credenciales OAuth → URI de redirección:
 *      http://127.0.0.1:53682/oauth2callback
 *   3) npm run oauth:drive
 *   4) Autoriza en el navegador; el refresh_token se imprime y se puede pegar en .env
 */
import 'dotenv/config';
import http from 'http';
import { google } from 'googleapis';
import { URL } from 'url';

const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}/oauth2callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
];

const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

if (!clientId || !clientSecret || clientId.startsWith('tu_')) {
  console.error('Falta GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET reales en .env');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT);
const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
});

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
    if (u.pathname !== '/oauth2callback') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const code = u.searchParams.get('code');
    if (!code) {
      res.writeHead(400);
      res.end('Sin code');
      return;
    }
    const { tokens } = await oauth2.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(
      '<h1>Listo</h1><p>Ya puedes cerrar esta ventana y volver a la terminal.</p>',
    );
    console.log('\n=== Pega esto en mi-asistente-ai/.env ===\n');
    console.log(`GOOGLE_REDIRECT_URI=${REDIRECT}`);
    if (tokens.refresh_token) {
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    } else {
      console.log(
        '# No vino refresh_token. Revoca el acceso en https://myaccount.google.com/permissions y vuelve a intentar.',
      );
    }
    console.log('\n========================================\n');
    server.close();
    process.exit(0);
  } catch (e) {
    console.error(e);
    res.writeHead(500);
    res.end(String(e));
    process.exit(1);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Abre esta URL en el navegador y autoriza Drive:\n');
  console.log(authUrl);
  console.log(`\nEsperando callback en ${REDIRECT} …`);
});
