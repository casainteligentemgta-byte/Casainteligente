# Asistente AI — Casa Inteligente

Bot de Telegram **separado** del operativo (`@Casainteligenteoficialbot`).  
Conversación con Gemini + guardado de archivos en Drive / OneDrive / iCloud / Supabase.

## Estructura

```
lib/mi-asistente-ai/
├── config/env.ts
├── services/
│   ├── ai.ts
│   ├── telegram.ts
│   └── storage/
│       ├── drive.ts
│       ├── onedrive.ts
│       ├── icloud.ts
│       ├── supabase.ts
│       └── index.ts
├── webhook.ts
└── index.ts

app/api/webhooks/mi-asistente-ai/route.ts
```

## Setup rápido

1. Crear bot en [@BotFather](https://t.me/BotFather) → copiar token.
2. En `.env.local` y Vercel:

```env
MI_ASISTENTE_AI_BOT_TOKEN=
MI_ASISTENTE_AI_BOT_USERNAME=
MI_ASISTENTE_AI_WEBHOOK_SECRET=   # openssl rand -hex 32
# MI_ASISTENTE_AI_ALLOWED_CHAT_IDS=123,456
# MI_ASISTENTE_AI_STORAGE_PROVIDER=supabase
# MI_ASISTENTE_AI_SUPABASE_BUCKET=ci-asistente-ai
GEMINI_API_KEY=                   # ya usada en Casa Inteligente
```

3. Crear bucket Supabase `ci-asistente-ai` (o el nombre de `MI_ASISTENTE_AI_SUPABASE_BUCKET`).
4. Desplegar y registrar webhook:

```bash
npm run asistente:webhook
```

Webhook: `https://casainteligente.company/api/webhooks/mi-asistente-ai`

## Comandos Telegram

| Comando | Efecto |
|---------|--------|
| `/start` | Bienvenida |
| `/ayuda` | Ayuda |
| `/reset` | Borra historial de chat |
| `/storage` | Elige proveedor de archivos |

## Almacenamiento (opcional)

| Proveedor | Variables |
|-----------|-----------|
| **Supabase** (default) | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Google Drive** | `GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY`, `GOOGLE_DRIVE_FOLDER_ID` |
| **OneDrive** | `ONEDRIVE_TENANT_ID`, `ONEDRIVE_CLIENT_ID`, `ONEDRIVE_CLIENT_SECRET`, `ONEDRIVE_DRIVE_ID` |
| **iCloud** | `ICLOUD_WEBDAV_URL`, `ICLOUD_APP_PASSWORD`, `ICLOUD_WEBDAV_USER` |

Si el proveedor elegido no está configurado y Supabase sí, se usa Supabase como respaldo.

## Nota

Este bot **no** reemplaza compras/almacén/procura. Esas operaciones siguen en el bot operativo.
