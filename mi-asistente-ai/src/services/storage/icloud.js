import fs from 'fs/promises';
import path from 'path';
import { env } from '../../config/env.js';

export function isIcloudConfigured() {
  return Boolean(env.icloudContainerPath());
}

/**
 * Copia el archivo a la carpeta local de iCloud Drive (sincronización del SO).
 * @param {{ chatId: string, fileName: string, buffer: Buffer, mimeType: string }} file
 */
export async function uploadToIcloud(file) {
  const base = env.icloudContainerPath();
  if (!base) {
    throw new Error('iCloud no configurado (ICLOUD_CONTAINER_PATH)');
  }

  const safeName = file.fileName.replace(/[\\/]/g, '_');
  const dir = path.join(base, String(file.chatId));
  const dest = path.join(dir, safeName);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(dest, file.buffer);

  return {
    provider: 'icloud',
    id: dest,
    name: safeName,
    url: null,
  };
}

/**
 * Busca por nombre en la carpeta local de iCloud.
 * @param {string} query
 * @returns {Promise<Array<{ id: string, name: string, webViewLink: null, mimeType: null, provider: string }>>}
 */
export async function searchIcloud(query) {
  const base = env.icloudContainerPath();
  if (!query?.trim() || !base) return [];

  const needle = query.trim().toLowerCase();
  /** @type {Array<{ id: string, name: string, webViewLink: null, mimeType: null, provider: string }>} */
  const hits = [];

  async function walk(dir) {
    if (hits.length >= 5) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (hits.length >= 5) break;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (entry.name.toLowerCase().includes(needle)) {
        hits.push({
          id: full,
          name: entry.name,
          webViewLink: null,
          mimeType: null,
          provider: 'icloud',
        });
      }
    }
  }

  try {
    await walk(base);
  } catch (error) {
    console.error('Error en iCloud:', error);
    return [];
  }
  return hits;
}
