# Facturas por Telegram y WhatsApp

## Aplicar migraciones (local)

```bash
npm run db:apply-lulo-telegram
```

Incluye: `146`, `149`, `151`, `152` (requiere `DATABASE_URL` en `.env.local`).

## Variables de entorno

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ALLOWED_CHAT_IDS=123456789,-987654321
GEMINI_API_KEY=...
NEXT_PUBLIC_BASE_URL=https://casainteligente.company
```

Si `TELEGRAM_ALLOWED_CHAT_IDS` está vacío, se aceptan todos los chats (solo para pruebas).

## Configurar webhook

En BotFather o con curl:

```text
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://casainteligente.company/api/webhooks/telegram
```

## Uso

1. El usuario envía foto o PDF de factura al bot.
2. El sistema extrae datos con Gemini y guarda en `ci_facturas_canal_pendientes`.
3. Revisar en **Contabilidad → Compras → Telegram** (`/contabilidad/compras/canal`).
4. **Abrir en recepción** completa el formulario de `/almacen/procurement`.

## Registrar webhook Telegram (tras deploy)

```bash
npm run telegram:webhook
```

## WhatsApp (Meta Cloud API)

1. Variables: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`
2. Webhook en Meta: `https://tu-dominio.com/api/webhooks/whatsapp`
3. Verify token = mismo valor que `WHATSAPP_VERIFY_TOKEN`
4. Opcional: `WHATSAPP_ALLOWED_PHONES=58412...,58424...`

## Migración Supabase

Automática con `npm run db:apply-lulo-telegram` o manual: `151` + `152` en SQL Editor.

## Lulo

- Importar: módulo proyecto o `?tab=finanzas`
- Gestionar tablas: `/proyectos/modulo/[id]/lulo`
- Migración: `151_ci_lulo_import_snapshots.sql`
