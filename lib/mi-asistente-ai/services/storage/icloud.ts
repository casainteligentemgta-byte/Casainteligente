import type { StorageAdapter, UploadInput, UploadResult } from './types';

/**
 * iCloud no ofrece API pública comparable a Drive/OneDrive.
 * Este adaptador queda como placeholder hasta integrar un puente (p. ej. WebDAV de iCloud+).
 */
export const icloudAdapter: StorageAdapter = {
  id: 'icloud',
  label: 'iCloud',
  isConfigured() {
    return Boolean(process.env.ICLOUD_WEBDAV_URL?.trim() && process.env.ICLOUD_APP_PASSWORD?.trim());
  },
  async upload(_input: UploadInput): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new Error(
        'iCloud aún no está disponible. Use /storage y elija Google Drive, OneDrive o Supabase. ' +
          'Para habilitarlo: ICLOUD_WEBDAV_URL + ICLOUD_APP_PASSWORD (cuenta Apple con app password).',
      );
    }

    const base = process.env.ICLOUD_WEBDAV_URL!.trim().replace(/\/$/, '');
    const user = process.env.ICLOUD_WEBDAV_USER?.trim() || process.env.ICLOUD_APPLE_ID?.trim();
    const pass = process.env.ICLOUD_APP_PASSWORD!.trim();
    if (!user) {
      throw new Error('Defina ICLOUD_WEBDAV_USER o ICLOUD_APPLE_ID para WebDAV.');
    }

    const safeName = _input.fileName.replace(/[\\/]/g, '_');
    const dest = `${base}/${_input.chatId}/${safeName}`;
    const auth = Buffer.from(`${user}:${pass}`).toString('base64');

    const res = await fetch(dest, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': _input.contentType,
      },
      body: new Uint8Array(_input.buffer),
    });

    if (!res.ok) {
      throw new Error(`iCloud WebDAV falló (${res.status})`);
    }

    return {
      provider: 'icloud',
      path: dest,
      url: null,
      message: `Archivo guardado en iCloud (WebDAV): <b>${escapeHtml(safeName)}</b>`,
    };
  },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
