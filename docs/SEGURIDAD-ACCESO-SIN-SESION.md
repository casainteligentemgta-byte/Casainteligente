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

### Rutas del servidor de RRHH

Las rutas de `/api/rrhh`, `/api/talento`, `/api/recruitment`, `/api/reclutamiento`,
`/api/registro` y `/api/admin` trabajan con `service_role`: no pasan por las políticas de
la base, así que cerrar tablas no las cubre. Varias respondían a cualquiera: listar y
borrar contratos exprés, crear vacantes, generar enlaces de examen (con su token), leer el
tablero de reclutamiento, cambiar la configuración de alertas y aplicar la de nómina.

Ahora **todo lo que cuelga de esos prefijos pide sesión** (`APIS_CON_SESION`), salvo las
rutas del candidato listadas en `APIS_DEL_CANDIDATO`, que validan su enlace:

| Para qué | Rutas | Qué valida |
| --- | --- | --- |
| Postulación | `reclutamiento/vacante`, `captacion-meta`, `captacion-completar`, `registro/finalizar`, `registro/subir-firma` | Identificador de la vacante, token de captación, o expediente + cédula |
| Entrevista guiada | `recruitment/session`, `session-cv`, `turn`, `events` | Identificador de la sesión de entrevista |
| Planilla y firma | `reclutamiento/patrono`, `firma-resumen`, `talento/contratos/firmar`, `talento/hoja-legal/generar`, `registro/contrato-laboral/*` | Token del expediente o del contrato |
| Examen | `talento/examen/*` | Token de la invitación |

Una ruta nueva bajo esos prefijos nace cerrada. Para abrir una al candidato hay que
añadirla a `APIS_DEL_CANDIDATO` **y** a la lista revisada de
`lib/supabase/rutasAcceso.test.ts`, que recorre las rutas reales del proyecto y falla si
aparece una abierta sin revisar.

`talento/hoja-legal/generar` tiene dos usos: con `token` (candidato) y con `empleadoId`
(personal); el segundo comprueba la sesión dentro de la propia ruta.

### Lo que sigue pendiente

- Las tareas programadas (`/api/cron/*`) exigen la clave `CRON_SECRET`, que **no está
  configurada** en producción: rechazan toda llamada, también la de Vercel. Están cerradas,
  pero no se ejecutan (informe semanal, avance diario, fotos y auditor del CCO,
  recordatorios de agenda y vencimientos de permisología). Activarlas es crear esa variable
  en Vercel y volver a desplegar.
- Otras rutas con `service_role` fuera de RRHH (`/api/proyectos`, `/api/contabilidad`,
  `/api/nexus`, `/api/legal`, …) no se han revisado una por una.
- `/nexus/builder` es una pantalla de personal bajo un prefijo público.

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
