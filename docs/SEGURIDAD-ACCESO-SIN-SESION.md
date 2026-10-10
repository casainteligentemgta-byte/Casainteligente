# Qué se puede hacer sin iniciar sesión

La «llave pública» del sitio viaja en el navegador: cualquiera la puede leer. Por eso lo
que esa llave permite sin sesión debe ser lo mínimo.

## Base de datos

| Migración | Qué cerró |
| --- | --- |
| 342 | Inventario, compras, procuras, fondos y abonos de clientes, nómina de obra. |
| 345 | Contabilidad de obra (CCO) y gastos, presupuestos y partidas, catálogos, productos, ventas, archivos y equipos de proyecto. Además 12 **vistas** (`ci_compras` y `vista_cuadro_procuras` dejaban leer compras y procuras pese a la 342) y 6 funciones que asignan roles o cargan gastos. |

Regla de ambas: lo que podía hacer «cualquiera» pasa a poder hacerlo solo quien tiene
sesión. El personal con sesión y el servidor (bot, rutas API con `service_role`) conservan
lo que tenían.

### Lo que sigue abierto (pendiente)

Las tablas que usan los **formularios públicos** de reclutamiento y registro de
trabajadores: `ci_empleados`, `ci_contratos_empleado_obra`, `ci_examenes`, `ci_hojas_vida`,
`ci_preguntas`, `ci_psique_*`, `recruitment_needs`, `ci_obra_empleados`, `ci_config_nomina`,
`ci_proyectos` (solo lectura), `ci_materiales_obra`, `labor_requests`,
`project_assignments`, `obreros_expediente_tarea`, y la función `firmar_contrato_y_asignar`.

Esos formularios (`/registro`, `/reclutamiento`, `/onboarding`, `/talento/examen`) leen y
escriben la base directamente desde el navegador, y siete rutas de `app/api/talento` usan
un cliente anónimo (`lib/talento/supabase-route.ts`). Cerrarlas hoy los rompería. Para
cerrarlas hay que pasar esos formularios a rutas del servidor que validen el enlace o
token del candidato.

### Cómo comprobar

```sql
begin; set local role anon;
select count(*) from ci_compras;        -- debe dar «permission denied»
rollback;
```

## Páginas y rutas

`lib/supabase/rutasAcceso.ts` decide qué pide sesión. Sin ella, las páginas protegidas
mandan a `/login` y las API listadas responden 401. La lista de chats autorizados del bot
(`/api/telegram/whitelist`) pide sesión; el webhook de Telegram no (lo protege su clave).

## Clave del webhook de Telegram

Telegram envía en cada aviso una clave que solo conocen él y el servidor. Sin ella,
cualquiera que conociera la dirección podía hacerse pasar por Telegram: escribir o pulsar
botones a nombre de otra persona y, en el bot de registro, actuar como supervisor.

- La clave se **calcula** a partir del token de cada bot (`lib/telegram/claveWebhook.ts`):
  no hay un secreto nuevo que guardar ni copiar.
- `GET /api/telegram/registrar-webhook` la registra en Telegram para los dos bots, sin
  cambiar la dirección ni descartar avisos. Solo responde en la dirección `*.vercel.app`
  de producción (protegida por Vercel). Con `?solo=estado` únicamente consulta.
- `TELEGRAM_WEBHOOK_CLAVE_OBLIGATORIA=1` hace que se rechacen los avisos sin clave. Se
  activa **después** de registrar la clave; al revés el bot dejaría de responder.
- Los scripts `scripts/set-telegram-webhook.mjs`, `sync-telegram-commands.mjs`,
  `replay-telegram-local.mjs` y `set-log-bot-webhook.mjs` conservan la clave. Registrar un
  webhook a mano sin ella deja el bot sin responder mientras la clave sea obligatoria.
