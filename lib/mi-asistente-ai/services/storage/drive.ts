import type { StorageAdapter, UploadInput, UploadResult } from './types';

/**
 * Google Drive vía Service Account + carpeta compartida.
 * Env: GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY, GOOGLE_DRIVE_FOLDER_ID
 */
export const driveAdapter: StorageAdapter = {
  id: 'drive',
  label: 'Google Drive',
  isConfigured() {
    return Boolean(
      process.env.GOOGLE_DRIVE_CLIENT_EMAIL?.trim() &&
        process.env.GOOGLE_DRIVE_PRIVATE_KEY?.trim() &&
        process.env.GOOGLE_DRIVE_FOLDER_ID?.trim(),
    );
  },
  async upload(input: UploadInput): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new Error(
        'Google Drive no configurado. Defina GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY y GOOGLE_DRIVE_FOLDER_ID.',
      );
    }

    const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL!.trim();
    const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY!.replace(/\\n/g, '\n');
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!.trim();

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    const metadata = {
      name: input.fileName,
      parents: [folderId],
    };
    const boundary = `ci_boundary_${Date.now()}`;
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
          `--${boundary}\r\nContent-Type: ${input.contentType}\r\n\r\n`,
      ),
      input.buffer,
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    const json = (await res.json()) as {
      id?: string;
      name?: string;
      webViewLink?: string;
      error?: { message?: string };
    };
    if (!res.ok || !json.id) {
      throw new Error(json.error?.message || `Google Drive upload falló (${res.status})`);
    }

    return {
      provider: 'drive',
      path: json.id,
      url: json.webViewLink ?? null,
      message: `Archivo guardado en Google Drive: <b>${escapeHtml(json.name || input.fileName)}</b>`,
    };
  },
};

async function getGoogleAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(
    JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/drive.file',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const signature = await signRs256(unsigned, privateKey);
  const jwt = `${unsigned}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    error_description?: string;
  };
  if (!tokenJson.access_token) {
    throw new Error(tokenJson.error_description || 'No se obtuvo access_token de Google');
  }
  return tokenJson.access_token;
}

function b64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function signRs256(data: string, pem: string): Promise<string> {
  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(data);
  sign.end();
  return b64url(sign.sign(pem));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
