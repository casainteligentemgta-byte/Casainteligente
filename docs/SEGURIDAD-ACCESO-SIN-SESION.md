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

### Lo que sigue pendiente

Varias rutas del servidor de RRHH (`/api/talento/*`, `/api/recruitment/*`, `/api/rrhh/*`,
`/api/admin/*`) trabajan con `service_role` y no comprueban sesión: no dependen de las
políticas de la base, así que cerrar tablas no las cubre. Hay que revisarlas una por una
(algunas las usan páginas con enlace del candidato) y exigir sesión en las de personal,
como se hizo con almacén y compras en `APIS_CON_SESION`.

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
