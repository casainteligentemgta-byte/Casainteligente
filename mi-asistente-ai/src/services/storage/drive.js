import { Readable } from 'stream';
import { google } from 'googleapis';
import { env } from '../../config/env.js';

function getOAuthClient() {
  const clientId = env.googleClientId();
  const clientSecret = env.googleClientSecret();
  const redirectUri = env.googleRedirectUri();
  const refreshToken = env.googleRefreshToken();

  if (!clientId || !clientSecret || !redirectUri || !refreshToken) {
    throw new Error(
      'Google Drive no configurado (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, GOOGLE_REFRESH_TOKEN)',
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getOAuthClient() });
}

export function isDriveConfigured() {
  return Boolean(
    env.googleClientId() &&
      env.googleClientSecret() &&
      env.googleRedirectUri() &&
      env.googleRefreshToken(),
  );
}

/**
 * @param {string} fileName
 * @returns {Promise<Array<{ id?: string, name?: string, webViewLink?: string, mimeType?: string }>>}
 */
export async function searchGoogleDrive(fileName) {
  if (!fileName?.trim()) return [];
  if (!isDriveConfigured()) {
    console.error('Error en Google Drive: no configurado');
    return [];
  }

  try {
    const drive = getDrive();
    const safe = fileName.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const response = await drive.files.list({
      q: `name contains '${safe}' and trashed = false`,
      fields: 'files(id, name, webViewLink, mimeType)',
      pageSize: 5,
    });
    return response.data.files || [];
  } catch (error) {
    console.error('Error en Google Drive:', error);
    return [];
  }
}

/**
 * @param {{ fileName: string, buffer: Buffer, mimeType: string }} file
 */
export async function uploadToDrive(file) {
  const drive = getDrive();
  const folderId = env.googleFolderId();

  /** @type {Record<string, unknown>} */
  const requestBody = { name: file.fileName };
  if (folderId) requestBody.parents = [folderId];

  const res = await drive.files.create({
    requestBody,
    media: {
      mimeType: file.mimeType,
      body: Readable.from(file.buffer),
    },
    fields: 'id, name, webViewLink',
  });

  return {
    provider: 'drive',
    id: res.data.id,
    name: res.data.name,
    url: res.data.webViewLink || null,
  };
}
