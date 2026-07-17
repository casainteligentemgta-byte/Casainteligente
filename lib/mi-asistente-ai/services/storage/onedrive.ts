import type { StorageAdapter, UploadInput, UploadResult } from './types';

/**
 * OneDrive / SharePoint vía Microsoft Graph (client credentials).
 * Env: ONEDRIVE_TENANT_ID, ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET, ONEDRIVE_DRIVE_ID
 * Opcional: ONEDRIVE_FOLDER_PATH (default: /CasaInteligente/Asistente)
 */
export const onedriveAdapter: StorageAdapter = {
  id: 'onedrive',
  label: 'OneDrive',
  isConfigured() {
    return Boolean(
      process.env.ONEDRIVE_TENANT_ID?.trim() &&
        process.env.ONEDRIVE_CLIENT_ID?.trim() &&
        process.env.ONEDRIVE_CLIENT_SECRET?.trim() &&
        process.env.ONEDRIVE_DRIVE_ID?.trim(),
    );
  },
  async upload(input: UploadInput): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new Error(
        'OneDrive no configurado. Defina ONEDRIVE_TENANT_ID, ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET y ONEDRIVE_DRIVE_ID.',
      );
    }

    const tenant = process.env.ONEDRIVE_TENANT_ID!.trim();
    const clientId = process.env.ONEDRIVE_CLIENT_ID!.trim();
    const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET!.trim();
    const driveId = process.env.ONEDRIVE_DRIVE_ID!.trim();
    const folder =
      process.env.ONEDRIVE_FOLDER_PATH?.trim() || '/CasaInteligente/Asistente';

    const token = await getGraphToken(tenant, clientId, clientSecret);
    const safeName = input.fileName.replace(/[\\/]/g, '_');
    const path = `${folder.replace(/\/$/, '')}/${input.chatId}/${safeName}`;
    const url = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:${encodePath(path)}:/content`;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': input.contentType,
      },
      body: new Uint8Array(input.buffer),
    });
    const json = (await res.json()) as {
      id?: string;
      webUrl?: string;
      name?: string;
      error?: { message?: string };
    };
    if (!res.ok || !json.id) {
      throw new Error(json.error?.message || `OneDrive upload falló (${res.status})`);
    }

    return {
      provider: 'onedrive',
      path: json.id,
      url: json.webUrl ?? null,
      message: `Archivo guardado en OneDrive: <b>${escapeHtml(json.name || safeName)}</b>`,
    };
  },
};

async function getGraphToken(
  tenant: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
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
  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!json.access_token) {
    throw new Error(json.error_description || 'No se obtuvo access_token de Microsoft');
  }
  return json.access_token;
}

function encodePath(path: string): string {
  const parts = path
    .split('/')
    .filter(Boolean)
    .map((p) => encodeURIComponent(p));
  return `/${parts.join('/')}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
