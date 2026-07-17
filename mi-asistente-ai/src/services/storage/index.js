import { env } from '../../config/env.js';
import { isDriveConfigured, searchGoogleDrive, uploadToDrive } from './drive.js';
import { isIcloudConfigured, searchIcloud, uploadToIcloud } from './icloud.js';
import { isOneDriveConfigured, searchOneDrive, uploadToOneDrive } from './onedrive.js';

/** @type {Map<string, 'drive' | 'onedrive' | 'icloud'>} */
const providerByChat = new Map();

export function getProvider(chatId) {
  return providerByChat.get(String(chatId)) || env.storageProvider();
}

export function setProvider(chatId, provider) {
  if (!['drive', 'onedrive', 'icloud'].includes(provider)) {
    throw new Error('Proveedor inválido');
  }
  providerByChat.set(String(chatId), provider);
}

export function providerStatus() {
  return [
    { id: 'drive', label: 'Google Drive', ok: isDriveConfigured() },
    { id: 'onedrive', label: 'OneDrive', ok: isOneDriveConfigured() },
    { id: 'icloud', label: 'iCloud', ok: isIcloudConfigured() },
  ];
}

/**
 * @param {string} query
 * @param {string} [provider]
 */
export async function buscarArchivos(query, provider) {
  const p = (provider || '').trim().toLowerCase();

  if (p === 'drive') {
    return (await searchGoogleDrive(query)).map((f) => ({ ...f, provider: 'drive' }));
  }
  if (p === 'onedrive') return searchOneDrive(query);
  if (p === 'icloud') return searchIcloud(query);

  const [drive, onedrive, icloud] = await Promise.all([
    isDriveConfigured()
      ? searchGoogleDrive(query).then((files) =>
          files.map((f) => ({ ...f, provider: 'drive' })),
        )
      : Promise.resolve([]),
    isOneDriveConfigured() ? searchOneDrive(query) : Promise.resolve([]),
    isIcloudConfigured() ? searchIcloud(query) : Promise.resolve([]),
  ]);

  return [...drive, ...onedrive, ...icloud].slice(0, 10);
}

/**
 * @param {{ chatId: string|number, fileName: string, buffer: Buffer, mimeType: string }} file
 */
export async function uploadFile(file) {
  const chatId = String(file.chatId);
  const provider = getProvider(chatId);
  const payload = {
    chatId,
    fileName: file.fileName,
    buffer: file.buffer,
    mimeType: file.mimeType,
  };

  if (provider === 'drive') return uploadToDrive(payload);
  if (provider === 'onedrive') return uploadToOneDrive(payload);
  if (provider === 'icloud') return uploadToIcloud(payload);
  throw new Error(`Proveedor desconocido: ${provider}`);
}
