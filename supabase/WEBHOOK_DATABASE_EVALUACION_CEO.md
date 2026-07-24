# Webhook de base de datos — alerta CEO (Regla de Paradoja)

Cuando `ci_empleados.estatus_evaluacion` pasa a `completado`, Supabase puede llamar a la API de Next.js para evaluar la **Regla de Paradoja** (`semaforo_riesgo = rojo` y `anos_experiencia >= 10`) y, si aplica, enviar Telegram al CEO.

## Variables de entorno (Vercel / servidor)

| Variable | Uso |
|----------|-----|
| `TELEGRAM_BOT_TOKEN` | Token del bot (@BotFather). |
| `TELEGRAM_CHAT_ID` | Chat o grupo donde recibe el CEO (ID numérico). |
| `ALERTS_WEBHOOK_SECRET` | Secreto compartido; la ruta exige `Authorization: Bearer <valor>`. |
| `NEXT_PUBLIC_BASE_URL` | URL pública del ERP (enlace «Acción» en el mensaje). |

## Ruta de la API

`POST https://<tu-dominio>/api/alerts/telegram-exception`

Cuerpo: payload estándar de **Supabase Database Webhooks** (JSON con `type`, `table`, `schema`, `record`, `old_record`).

## Configuración en Supabase (Dashboard)

1. Abre el proyecto en [Supabase Dashboard](https://supabase.com/dashboard).
2. Ve a **Integrations** → **Webhooks** (o **Database** → **Webhooks**, según versión de UI).
3. Crea un webhook nuevo:
   - **Name:** `ceo-paradoja-evaluacion-completada`
   - **Table:** `public.ci_empleados`
   - **Events:** marca solo **Update** (o Insert + Update si también completas en un insert).
4. **HTTP Request:**
   - **URL:** `https://<tu-dominio>/api/alerts/telegram-exception`
   - **Method:** `POST`
   - **Headers:** añade  
     `Authorization` = `Bearer <mismo valor que ALERTS_WEBHOOK_SECRET>`
5. **Filter** (recomendado, reduce llamadas): expresión para filas donde la evaluación acaba de completarse, por ejemplo en la UI de filtros de webhook:
   - Condición sobre el registro nuevo: `estatus_evaluacion` igual a `completado` y distinto del valor anterior si la UI lo permite.

   Si la consola solo permite un predicado simple, usa algo equivalente a:

   `record.estatus_evaluacion == 'completado'`

   (La API igual ignora filas que no estén en `completado`.)

6. Guarda y prueba con **Send test** (payload de ejemplo); deberías recibir `401` sin Bearer correcto y `200` con `skipped` si el ejemplo no cumple la paradoja.

## Notas de producto

- Rellena `semaforo_riesgo` y `motivo_semaforo_riesgo` al guardar la evaluación (p. ej. con `semaforoRiesgoDbDesdeEvaluacion` y `motivoSemaforoRiesgoDesdeEvaluacion` en `lib/talento/semaforoRiesgoEmpleado.ts`).
- `anos_experiencia` debe venir de RRHH / planilla / captación; sin él no hay paradoja aunque el riesgo sea rojo.

## SQL alternativo (triggers + `pg_net`)

En proyectos Enterprise o con extensión `pg_net` / `http` habilitada, se puede disparar HTTP desde un trigger. No está incluido por defecto en todos los planes; el **Database Webhook** del Dashboard es el camino más portable.
