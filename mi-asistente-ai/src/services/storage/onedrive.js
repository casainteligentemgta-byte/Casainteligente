import { Client } from '@microsoft/microsoft-graph-client';
import { env, isRealSecret } from '../../config/env.js';

export function isOneDriveConfigured() {
  return (
    isRealSecret(env.msClientId()) &&
    isRealSecret(env.msTenantId()) &&
    isRealSecret(env.msClientSecret()) &&
    isRealSecret(env.msUserId())
  );
}

async function getAccessToken() {
  const tenant = env.msTenantId();
  const clientId = env.msClientId();
  const clientSecret = env.msClientSecret();
  if (!tenant || !clientId || !clientSecret) {
    throw new Error('OneDrive no configurado (MS_CLIENT_ID, MS_TENANT_ID, MS_CLIENT_SECRET)');
  }

  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  const json = await res.json();
  if (!json.access_token) {
    throw new Error(json.error_description || 'No se obtuvo access_token de Microsoft');
  }
  return json.access_token;
}

function getClient() {
  return Client.init({
    authProvider: (done) => {
      getAccessToken()
        .then((token) => done(null, token))
        .catch((err) => done(err, null));
    },
  });
}

/**
 * @param {{ chatId: string, fileName: string, buffer: Buffer, mimeType: string }} file
 */
export async function uploadToOneDrive(file) {
  if (!isOneDriveConfigured()) {
    throw new Error('OneDrive no configurado (MS_CLIENT_ID, MS_TENANT_ID, MS_CLIENT_SECRET)');
  }

  const userId = env.msUserId();
  if (!userId) {
    throw new Error(
      'OneDrive con client credentials requiere MS_USER_ID (UPN o id del usuario destino en Entra ID).',
    );
  }

  const folder = env.msFolderPath().replace(/\/$/, '');
  const safeName = file.fileName.replace(/[\\/]/g, '_');
  const path = `${folder}/${file.chatId}/${safeName}`;
  const encoded = path
    .split('/')
    .filter(Boolean)
    .map((p) => encodeURIComponent(p))
    .join('/');

  const client = getClient();
  const uploaded = await client
    .api(`/users/${encodeURIComponent(userId)}/drive/root:/${encoded}:/content`)
    .header('Content-Type', file.mimeType)
    .put(file.buffer);

  return {
    provider: 'onedrive',
    id: uploaded.id,
    name: uploaded.name || safeName,
    url: uploaded.webUrl || null,
  };
}

/**
 * @param {string} query
 * @returns {Promise<Array<{ id?: string, name?: string, webViewLink?: string, mimeType?: string, provider: string }>>}
 */
export async function searchOneDrive(query) {
  if (!query?.trim() || !isOneDriveConfigured()) return [];
  const userId = env.msUserId();
  if (!userId) {
    console.error('Error en OneDrive: falta MS_USER_ID');
    return [];
  }

  try {
    const client = getClient();
    const q = encodeURIComponent(query.trim());
    const res = await client
      .api(`/users/${encodeURIComponent(userId)}/drive/root/search(q='${q}')`)
      .top(5)
      .select('id,name,webUrl,file')
      .get();

    const items = res.value || [];
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      webViewLink: item.webUrl || null,
      mimeType: item.file?.mimeType || null,
      provider: 'onedrive',
    }));
  } catch (error) {
    console.error('Error en OneDrive:', error);
    return [];
  }
}
