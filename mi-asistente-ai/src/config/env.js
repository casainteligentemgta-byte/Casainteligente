import 'dotenv/config';

function required(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

function optional(name, fallback = '') {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  telegramToken: () => required('TELEGRAM_BOT_TOKEN'),
  geminiApiKey: () => required('GEMINI_API_KEY'),
  geminiModel: () => optional('GEMINI_MODEL', 'gemini-2.5-flash'),

  /** drive | onedrive | icloud */
  storageProvider: () => optional('STORAGE_PROVIDER', 'drive').toLowerCase(),

  allowedChatIds() {
    const raw = optional('TELEGRAM_ALLOWED_CHAT_IDS');
    if (!raw) return null;
    return new Set(
      raw
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    );
  },

  // Google Drive (OAuth usuario)
  googleClientId: () => optional('GOOGLE_CLIENT_ID'),
  googleClientSecret: () => optional('GOOGLE_CLIENT_SECRET'),
  googleRedirectUri: () => optional('GOOGLE_REDIRECT_URI'),
  googleRefreshToken: () => optional('GOOGLE_REFRESH_TOKEN'),
  googleFolderId: () => optional('GOOGLE_FOLDER_ID'),

  // OneDrive (Microsoft Graph)
  msClientId: () => optional('MS_CLIENT_ID'),
  msTenantId: () => optional('MS_TENANT_ID'),
  msClientSecret: () => optional('MS_CLIENT_SECRET'),
  /** Usuario o drive destino (client credentials no tiene /me) */
  msUserId: () => optional('MS_USER_ID'),
  msFolderPath: () => optional('MS_FOLDER_PATH', '/CasaInteligente/Asistente'),

  // iCloud: carpeta local sincronizada (iCloud Drive montado)
  icloudContainerPath: () => optional('ICLOUD_CONTAINER_PATH'),

  webhookDomain: () => optional('WEBHOOK_DOMAIN'),
  webhookPath: () => optional('WEBHOOK_PATH', '/telegram'),
  port: () => Number(optional('PORT', '3001')) || 3001,
};
