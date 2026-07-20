import 'dotenv/config';

function required(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

function optional(name, fallback = '') {
  return process.env[name]?.trim() || fallback;
}

/** Valores tipo "tu_token_aqui" no cuentan como configurados. */
export function isRealSecret(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  if (/^(tu_|your_|xxx|placeholder|example|change.?me|dummy)/i.test(s)) return false;
  if (/_aqui\b|_here\b|reemplazar|replace.?me/i.test(s)) return false;
  return true;
}

export const env = {
  telegramToken: () => required('TELEGRAM_BOT_TOKEN'),

  /**
   * auto | groq | gemini
   * auto: usa Groq si hay GROQ_API_KEY; si no, Gemini.
   */
  aiProvider: () => optional('AI_PROVIDER', 'auto').toLowerCase(),

  geminiApiKey: () => optional('GEMINI_API_KEY'),
  /** Preferir modelos con cuota free más estable. */
  geminiModel: () => optional('GEMINI_MODEL', 'gemini-flash-latest'),
  geminiFallbackModels: () => {
    const primary = optional('GEMINI_MODEL', 'gemini-flash-latest');
    const extra = optional(
      'GEMINI_FALLBACK_MODELS',
      'gemini-flash-latest,gemini-2.0-flash,gemini-2.5-flash-lite,gemini-2.5-flash',
    )
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return [...new Set([primary, ...extra])];
  },

  /** Groq (gratis): https://console.groq.com/keys */
  groqApiKey: () => optional('GROQ_API_KEY'),
  groqModel: () => optional('GROQ_MODEL', 'llama-3.3-70b-versatile'),
  groqWhisperModel: () => optional('GROQ_WHISPER_MODEL', 'whisper-large-v3'),
  groqVisionModel: () => optional('GROQ_VISION_MODEL', 'meta-llama/llama-4-scout-17b-16e-instruct'),

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

  // Casa Inteligente (Supabase) — lectura de obras / compras
  supabaseUrl: () =>
    optional('NEXT_PUBLIC_SUPABASE_URL') || optional('SUPABASE_URL'),
  supabaseServiceKey: () => optional('SUPABASE_SERVICE_ROLE_KEY'),

  webhookDomain: () => optional('WEBHOOK_DOMAIN'),
  webhookPath: () => optional('WEBHOOK_PATH', '/telegram'),
  port: () => Number(optional('PORT', '3001')) || 3001,
};
