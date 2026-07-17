import type { StorageProviderId } from '@/lib/mi-asistente-ai/config/env';
import { getDefaultStorageProvider } from '@/lib/mi-asistente-ai/config/env';
import { driveAdapter } from './drive';
import { icloudAdapter } from './icloud';
import { onedriveAdapter } from './onedrive';
import { supabaseAdapter } from './supabase';
import type { StorageAdapter, UploadInput, UploadResult } from './types';

const adapters: Record<StorageProviderId, StorageAdapter> = {
  drive: driveAdapter,
  onedrive: onedriveAdapter,
  icloud: icloudAdapter,
  supabase: supabaseAdapter,
};

/** Preferencia por chat (en memoria del proceso). */
const providerByChat = new Map<string, StorageProviderId>();

export function listStorageAdapters(): StorageAdapter[] {
  return Object.values(adapters);
}

export function getProviderForChat(chatId: string): StorageProviderId {
  return providerByChat.get(chatId) ?? getDefaultStorageProvider();
}

export function setProviderForChat(chatId: string, provider: StorageProviderId): void {
  providerByChat.set(chatId, provider);
}

export function getAdapter(provider: StorageProviderId): StorageAdapter {
  return adapters[provider];
}

export async function uploadWithChatProvider(
  chatId: string,
  input: Omit<UploadInput, 'chatId'>,
): Promise<UploadResult> {
  const provider = getProviderForChat(chatId);
  const adapter = getAdapter(provider);

  if (!adapter.isConfigured()) {
    if (provider !== 'supabase' && supabaseAdapter.isConfigured()) {
      return supabaseAdapter.upload({ ...input, chatId });
    }
    throw new Error(
      `${adapter.label} no está configurado. Use /storage para cambiar de proveedor o configure las variables de entorno.`,
    );
  }

  return adapter.upload({ ...input, chatId });
}

export type { StorageAdapter, UploadInput, UploadResult };
