# Facturas por Telegram y WhatsApp

## Aplicar migraciones (local)

```bash
npm run db:apply-lulo-telegram
```

Incluye: `146`, `149`, `151`, `152`, `160` (requiere `DATABASE_URL` en `.env.local`).

## Variables de entorno

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ALLOWED_CHAT_IDS=123456789,-987654321
GEMINI_API_KEY=...
NEXT_PUBLIC_BASE_URL=https://casainteligente.company
```

Si `TELEGRAM_ALLOWED_CHAT_IDS` está vacío, se aceptan todos los chats (solo para pruebas).

## Configurar webhook

En producción use **`/api/webhooks/telegram`** (el path `/api/telegram` puede dar 404 hasta el próximo deploy):

```bash
npm run telegram:webhook
```

Por defecto registra: `https://casainteligente.company/api/webhooks/telegram`

Requiere en **Vercel → Environment Variables**: `TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### Desarrollo local (mensajes atascados)

```bash
npm run telegram:replay-local
```

Reprocesa la cola de Telegram contra `http://127.0.0.1:3000/api/telegram`.

### Reprocesar facturas en error (tras fix Gemini)

```bash
# Con npm run dev activo:
curl -X POST http://127.0.0.1:3000/api/facturas-canal/reprocess
```

## Si la web no muestra facturas (lista vacía)

1. **RLS:** la pantalla `/contabilidad/compras/canal` debe leer `ci_facturas_canal_pendientes`. Si solo existen políticas `anon` y entras con sesión Supabase Auth, la lista sale vacía. Aplica migración **`161_ci_facturas_canal_rls_authenticated.sql`** (incluida en `npm run db:apply-lulo-telegram`) o usa el código actualizado que consulta con **service role** en `/api/facturas-canal/pendientes`.
2. En el bot, envía **`/factura`** antes de la foto (si no, el contexto queda en menú y no procesa la imagen).
3. Vista **Por factura** (no solo «Por línea»): las facturas en `pendiente` / `procesando` aún no tienen líneas hasta que Gemini termine (`extraido`).

## Uso (multi-contexto)

Webhook: `POST /api/telegram` (alias: `/api/webhooks/telegram`).

Comandos en el bot:

- `/menu` — menú principal
- `/factura` — foto/PDF de compra → `procurement-documents` + Gemini OCR
- `/obra <uuid>` — fotos de evidencia → bucket `ci-proyectos-media`
- `/gasto` — comprobante de gasto → `gastos_obra` + Gemini (requiere `/obra` antes)
- `/estado` — contexto activo en `ci_telegram_estados`
- `/cancelar` — volver al menú

Texto libre: Gemini 2.5 Flash puede interpretar la intención y cambiar el contexto.

1. El usuario envía foto o PDF de factura al bot (modo `/factura`).
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
