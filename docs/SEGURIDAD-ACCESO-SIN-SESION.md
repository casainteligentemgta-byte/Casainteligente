# Qué se puede hacer sin iniciar sesión

La «llave pública» del sitio viaja en el navegador: cualquiera la puede leer. Por eso lo
que esa llave permite sin sesión debe ser lo mínimo.

## Base de datos

| Migración | Qué cerró |
| --- | --- |
| 342 | Inventario, compras, procuras, fondos y abonos de clientes, nómina de obra. |
| 345 | Contabilidad de obra (CCO) y gastos, presupuestos y partidas, catálogos, productos, ventas, archivos y equipos de proyecto. Además 12 **vistas** (`ci_compras` y `vista_cuadro_procuras` dejaban leer compras y procuras pese a la 342) y 6 funciones que asignan roles o cargan gastos. |
| 346 | Reclutamiento y RRHH: obras, vacantes, contratos de trabajo, configuración de nómina y exámenes. El expediente del candidato queda accesible solo con su enlace. |

Regla de las tres: lo que podía hacer «cualquiera» pasa a poder hacerlo solo quien tiene
sesión. El personal con sesión y el servidor (bot, rutas API con `service_role`) conservan
lo que tenían.

### Reclutamiento y RRHH (migración 346)

| Quién | Qué puede hacer |
| --- | --- |
| Personal con sesión y servidor | Lo mismo que antes. |
| Candidato sin sesión, con su enlace | Ver y completar **solo su expediente** (`ci_empleados`) y guardar su hoja de vida (`ci_hojas_vida`). El token del enlace viaja en la cabecera `x-invite-token`. |
| Cualquier otra persona sin sesión | Nada. |

- Cerradas del todo: `ci_proyectos`, `recruitment_needs`, `ci_contratos_empleado_obra`,
  `ci_config_nomina`, `ci_obra_empleados`, `ci_materiales_obra`, `labor_requests`,
  `project_assignments`, `obreros_expediente_tarea`, `ci_examenes`, `ci_preguntas`,
  `ci_psique_*`, y la función `firmar_contrato_y_asignar` (solo el servidor).
- Los formularios públicos ya no leen vacantes, obras ni contratos desde el navegador. Se
  los entrega el servidor, solo con los campos necesarios
  (`lib/reclutamiento/datosPublicos.ts`):
  - `GET /api/reclutamiento/vacante?need=<id>` (o `?proyecto=<id>`): cargo, nivel, tipo y
    nombre de la obra.
  - `GET /api/reclutamiento/firma-resumen?token=`: resumen del contrato a firmar.
  - `GET /api/reclutamiento/patrono?token=`: datos del patrono para la planilla.
- **Campos reservados** (disparador `a_ci_empleados_campos_reservados`): escribiendo sin
  sesión no se pueden fijar ni cambiar los permisos del bot (`telegram_chat_id`,
  `alertas_almacen_global`), la evaluación (semáforo, estado, puntajes), el cargo, la obra,
  la firma electrónica ni el token. El formulario los manda y la base los ignora.
- Las rutas de personal de `app/api/talento` que usaban un cliente anónimo ahora
  comprueban la sesión (`lib/auth/sesionPersonalRuta.ts`). El examen público guarda con el
  cliente del servidor después de validar la invitación.

### Rutas del servidor (`/api/*`)

Muchas rutas trabajan con `service_role`: no pasan por las políticas de la base, así que
cerrar tablas no las cubre. Varias respondían a cualquiera (contratos exprés, vacantes,
enlaces de examen, tablero de reclutamiento, configuración de alertas y de nómina, nómina
y usuarios del bot de cada obra, análisis de presupuestos…).

Regla actual (`lib/supabase/rutasAcceso.ts`): **toda ruta `/api/*` pide sesión** y sin
ella el middleware responde 401. Una ruta nueva nace cerrada. Solo quedan abiertas las
listadas, porque no pueden traer sesión, y cada una tiene su propio control:

| Lista | Rutas | Control propio |
| --- | --- | --- |
| `APIS_SIN_SESION` | `webhooks/*`, `webhook-logs`, `telegram/registrar-webhook` | Clave de Telegram; dirección protegida por Vercel |
| | `cron/*` | `CRON_SECRET` |
| | `alerts/telegram-exception`, `proyectos/tours/worker-callback` | Clave o token del trabajo |
| | `auth/*` | Comprueban la sesión ellas mismas |
| | `health/*`, `pruebas/*` | Diagnóstico; el bot de ensayo no existe en producción |
| | `expediente/*`, `netvision/compartido/*` | Token del enlace |
| `APIS_SIN_SESION_EXACTAS` | `telegram`, `legal/solicitudes`, `finanzas/bcv-tasa` | Webhook con clave; formulario público; dato público |
| `APIS_DEL_CANDIDATO` | postulación, entrevista, planilla, firma y examen | Token de invitación, identificador de vacante o sesión, o expediente + cédula |

Para abrir una ruta hay que añadirla a una de esas listas **y** a la lista revisada de
`lib/supabase/rutasAcceso.test.ts`, que recorre las rutas reales del proyecto y falla si
aparece una abierta sin revisar.

`talento/hoja-legal/generar` tiene dos usos: con `token` (candidato) y con `empleadoId`
(personal); el segundo comprueba la sesión dentro de la propia ruta.

Cuando el middleware rechaza una llamada deja en el registro del servidor
`[api] sin sesión, rechazada: <método> <dirección>`: sirve para detectar una ruta que
debía estar abierta.

### Tareas programadas

Las seis tareas de `vercel.json` exigen `CRON_SECRET` (Vercel la envía sola cuando la
variable existe). Sin ella rechazan toda llamada y no se ejecutan.

| Tarea | Cuándo (Caracas) | Qué hace | A quién escribe |
| --- | --- | --- | --- |
| Fotos diarias del CCO | 00:00 | Guarda una foto de la contabilidad de cada obra | A nadie |
| Auditor del CCO | 07:30 | Revisa descuadres, duplicados y contratos | Canal de administración, solo si hay hallazgos |
| Vencimientos de permisología | 08:00 | Permisos que vencen en 30 días o menos | Legal; si no hay chat propio, administración |
| Informe semanal de talento | Lunes 08:00 | Vacantes, candidatos y contratos de la semana | Administración |
| Recordatorios de agenda | 09:00 | Fechas de mañana y de hoy | A quien anotó cada fecha |
| Avance diario de campo | Lun–Vie 17:00 | Pide el avance del día | Ingeniero residente de cada obra |

«Administración» se resuelve en `lib/telegram/chatAdministracion.ts`: `TELEGRAM_CHAT_ID` →
canal de administración de Configuración → Alertas → chat personal del administrador.

### Lo que sigue pendiente

- `webhooks/vercel-deploy` acepta avisos sin clave mientras no exista
  `VERCEL_DEPLOY_NOTIFY_SECRET` (solo envía un aviso de despliegue por Telegram).
- `webhooks/whatsapp` no comprueba la firma de Meta en los mensajes entrantes. Hoy no hay
  credenciales de WhatsApp configuradas.
- Las páginas `/nexus` y `/nexus/vision` no piden sesión (sus datos sí, por las rutas).

### Cómo comprobar

```sql
begin; set local role anon;
select count(*) from ci_compras;        -- debe dar «permission denied»
rollback;

begin; set local role anon;
select count(*) from ci_proyectos;      -- debe dar «permission denied»
rollback;

begin; set local role anon;
select count(*) from ci_empleados;      -- debe dar 0: sin enlace no se ve ningún expediente
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
