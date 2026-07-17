# mi-asistente-ai

Bot Telegram independiente de Casa Inteligente (Telegraf + Gemini + Drive/OneDrive/iCloud).

## Variables de entorno

Copia `.env.example` → `.env`. Esquema principal:

```env
TELEGRAM_BOT_TOKEN=
GEMINI_API_KEY=

# Google Drive (OAuth)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GOOGLE_REFRESH_TOKEN=

# OneDrive (Microsoft Graph)
MS_CLIENT_ID=
MS_TENANT_ID=
MS_CLIENT_SECRET=
# MS_USER_ID=  (usuario destino; necesario con client credentials)

# iCloud (carpeta local sincronizada)
ICLOUD_CONTAINER_PATH=
```

## Arranque

```bash
cd mi-asistente-ai
cp .env.example .env
npm install --strict-ssl=false   # si hay error de certificado SSL
npm run dev
```

Por defecto usa **polling**. Para webhook, define `WEBHOOK_DOMAIN` (+ `PORT` / `WEBHOOK_PATH`).

## Estructura

```
src/
  config/env.js
  services/
    ai.js
    telegram.js
    storage/
      drive.js
      onedrive.js
      icloud.js
      index.js
  index.js
```

## Comandos

| Comando | Efecto |
|---------|--------|
| `/start` | Bienvenida |
| `/ayuda` | Ayuda |
| `/reset` | Borra historial |
| `/storage` | Elige Drive / OneDrive / iCloud |

## Nota

Este proceso es **aparte** del bot operativo en Next.js (`/api/webhooks/telegram`). Usa un token de @BotFather distinto.
