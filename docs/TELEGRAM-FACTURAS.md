# Facturas por Telegram

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

## Migración Supabase

Ejecutar `152_facturas_canal_telegram.sql` en SQL Editor.

## Lulo

- Importar: módulo proyecto o `?tab=finanzas`
- Gestionar tablas: `/proyectos/modulo/[id]/lulo`
- Migración: `151_ci_lulo_import_snapshots.sql`
