# Auditoría pre-lanzamiento — Casa Inteligente

**Fecha:** 4 de noviembre de 2026  
**Alcance:** https://casainteligente.company · repo `main` · Supabase prod `mibxmhiruhrbbwcjdvks` (solo lectura) · Vercel `casainteligente`  
**Dueño:** Luis Vicente Mata Ortiz, Casa Inteligente C.A. (Venezuela)  
**Criterio:** la app debe ser simple para personal no técnico; cada usuario ve solo clientes y datos de **sus** entidades (`ci_cliente_entidades`); WhatsApp es el canal principal con el cliente.

Este documento lista hallazgos. El PR «Auditoría pre-lanzamiento» corrige solo lo seguro (código + migraciones idempotentes 399–400, sin reescribir datos). Lo demás queda como recomendación para Luis.

---

## Cómo se auditó

- Código: rutas `/api`, middleware, RLS en migraciones, aislamiento por entidad, WhatsApp/Telegram, tasas BCV, OCR de facturas, copy en español.
- Supabase prod: advisors de seguridad/rendimiento, tablas con/sin RLS, grants a `anon`, políticas, migraciones aplicadas, facturas de octubre, función `ci_tasa_bcv_compra_fallback`.
- Vercel: variables de entorno (nombres, no valores), errores de runtime 7 días.
- Suite local de tests y CI del PR.

**No se aplicaron migraciones ni se cambió dato alguno en producción.**

---

## Resumen ejecutivo

La base tiene RLS encendido en **todas** las tablas de `public`. Las 79 tablas «RLS sin política» no tienen grants a `anon`/`authenticated`: quedan cerradas. El hueco real no es «falta RLS», sino:

1. La **llave de servicio** sigue en el historial de git y Vercel aún usa la llave antigua (`SUPABASE_SERVICE_ROLE_KEY`). Con ella se salta todo permiso.
2. Varias APIs de personal usan `service_role` **solo con sesión**, sin comprobar rol (almacén, gasto estratégico, contratos/salarios).
3. WhatsApp, el canal que Luis quiere para el cliente, **no está configurado en Vercel**.
4. Tres facturas reales de octubre quedaron etiquetadas `USD` con montos en bolívares.
5. No hay fila `GLOBAL` de tasa BCV; la tasa del día vive de agregadores de terceros y de la migración 386b (en prod, no estaba en el repo).

---

## Crítico

### C1 — Llave de servicio expuesta en el historial de git

- **Dónde:** historial público; `docs/CAMBIAR-LLAVE-MAESTRA.md`. Vercel solo tiene `SUPABASE_SERVICE_ROLE_KEY`, no `SUPABASE_SECRET_KEY`.
- **Qué pasa:** quien copie la llave antigua lee, cambia y borra toda la base. Quitarla de archivos no basta.
- **Arreglo (Luis):** seguir `docs/CAMBIAR-LLAVE-MAESTRA.md`: crear `sb_secret_…`, ponerla en Vercel como `SUPABASE_SECRET_KEY`, publicar, y **desactivar las llaves legacy**. Rotar el JWT al final.
- **Este PR:** no toca secretos. El código ya prefiere `SUPABASE_SECRET_KEY` si existe.

### C2 — APIs de almacén ajustan stock con `service_role` y sin permiso

- **Dónde:** `app/api/almacen/inventario/[id]/stock/route.ts`, `app/api/almacen/stock/route.ts`, `app/api/almacen/inventario/[id]/route.ts` (DELETE de material), `app/api/almacen/trazabilidad/*`, GET de `app/api/almacen/movimientos/route.ts`.
- **Qué pasa:** cualquier cuenta con sesión (aunque sea de prueba) puede leer stock de todas las obras y, en PATCH/DELETE, cambiarlo o borrar materiales. El test de permisos no las veía porque usan `supabaseAdminMovimientos` (nombre que no estaba en la lista).
- **Arreglo:** exigir `almacen.ingreso` / `almacen.despacho` / `almacen.cuarentena` / `procura.usar_almacen` según la acción.
- **Este PR:** añade esos gates y amplía el test.

### C3 — Gasto estratégico y bypass de contratos sin rol

- **Dónde:** `app/api/contabilidad/gasto-estrategico/route.ts`; `app/api/talento/contratos/[id]/force-aceptar/route.ts`; GET/PATCH de contratos (`…/contratos/[id]/route.ts` incluye salarios); `firmar-fisica`; cierre de obra; oficio de hoja de empleo.
- **Qué pasa:** `clientePersonalConSesion()` solo pide sesión y luego usa la llave de servidor. Un usuario logueado puede aceptar un contrato a nombre de otro o leer sueldos.
- **Arreglo:** `requireCcoAcceso('editar')` en gasto estratégico; `equipo.gestionar` (y `cco.ver` en el cierre) en las de talento.
- **Este PR:** lo aplica.

### C4 — WhatsApp no está en Vercel (canal principal del cliente)

- **Dónde:** Vercel proyecto `casainteligente`. Faltan `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ALLOWED_PHONES`.
- **Qué pasa:** `GET/POST /api/webhooks/whatsapp` responde 503. El cliente no puede mandar facturas ni mensajes por WhatsApp. El código existe; la cuenta de Meta no está conectada al deploy.
- **Arreglo (Luis):** crear la app de Meta, cargar las cinco variables en Production + Preview, apuntar el webhook a `https://casainteligente.company/api/webhooks/whatsapp`. Lista de teléfonos autorizados en `WHATSAPP_ALLOWED_PHONES`.
- **Este PR:** el webhook ya no cae a la llave anónima si falta `service_role`; GET ya no dice si el token existe.

### C5 — Vista `products_lectura` con `security_invoker = false`

- **Dónde:** advisor de Supabase (ERROR); migración `398_productos_margen_foto_rls_costos.sql`; prod.
- **Qué pasa:** la vista corre como dueño para poder leer `costo` (columna revocada a `authenticated`) y enmascararla con `ci_tiene_permiso('productos.costos')`. Es a propósito, no un olvido. Pero en prod la vista tenía grants de INSERT/UPDATE/DELETE/TRUNCATE a `authenticated`.
- **Arreglo:** no cambiar a `security_invoker = true` (rompería el enmascarado). Sí quitar grants de escritura.
- **Este PR:** migración 400 revoca escritura; deja solo `SELECT` para personal autenticado.

---

## Alto

### A1 — Facturas de octubre con moneda mal etiquetada

En `contabilidad_compras` (octubre 2026), las tres facturas **reales** marcadas `USD` tienen `total_amount = monto_ves` (bolívares) y un `monto_usd` coherente con la tasa BCV (~878–886). La conversión está bien; **la etiqueta de moneda no**.

| Factura | Fecha | Guardado | Debería ser |
| --- | --- | --- | --- |
| 033740 | 14-oct | USD / 153 632,90 | VES (175 USD) |
| 00018 | 22-oct | USD / 182 293,81 | VES (206,04 USD) |
| 202610260001 | 26-oct | USD / 290 682,49 | VES (328 USD) |

Las 00091663 y 066398 (22-oct) ya están en VES. Las `DEMO-FAC-*` usan tasa **36,5** (semilla de demo, no operativa).

Causa probable: `app/api/scan-invoice/route.ts` decía «si la moneda no es clara, asume USD»; el OCR de Telegram/WhatsApp asume VES.

- **Arreglo (Luis decide):** SQL de corrección **después de revisar cada factura** (no se corre en este PR):

```sql
-- Solo revisión; no ejecutar a ciegas.
update public.contabilidad_compras
set moneda = 'VES', moneda_original = 'VES'
where fecha >= '2026-10-01' and fecha < '2026-11-01'
  and moneda = 'USD'
  and invoice_number not ilike 'DEMO-%'
  and monto_ves > 0
  and abs(total_amount - monto_ves) < 0.05;
```

- **Este PR:** el OCR de `scan-invoice` asume VES, igual que el de canal.

### A2 — Tasa BCV diaria no es el BCV oficial y no hay fila GLOBAL

- **Dónde:** `lib/finanzas/bcvTasaPorFecha.ts` (bcv.today → rafnixg.dev → `ci_config_nomina` → env). En prod **no hay** fila `GLOBAL` con tasa. La función de fallback 386b (aplicada en prod, ausente del repo) toma la última compra no-DEMO.
- **Qué pasa:** las etiquetas decían «BCV oficial». Si caen los agregadores, cada FRM con monto > 0 falla o hereda la última factura.
- **Arreglo (Luis):** 1) cargar a mano la tasa del día en Configuración → Nómina (`ci_config_nomina` GLOBAL), o 2) contratar un feed que cite el BCV, o 3) aceptar los agregadores y que el personal vea la fuente.
- **Este PR:** versiona 386b como migración 399; las etiquetas ya no dicen «oficial».

### A3 — Grants `anon` en salarios, nómina, roles e inyecciones

- **Dónde:** prod. `ci_labor_salary_history`, `ci_labor_benefit_configs`, `ci_tabulador_salarial`, `ci_nomina_items`, `ci_nomina_periodos`, `ci_usuarios_roles`, `ci_inyecciones_capital`, etc. tienen GRANT ALL a `anon`.
- **Qué pasa:** las políticas de SELECT son `TO authenticated` (anon no pasa RLS). Es defensa en profundidad rota: un cambio de política o una vista definer reabriría sueldos al público.
- **Arreglo:** `REVOKE ALL … FROM anon` en esas tablas. No tocar `ci_empleados` ni `ci_hojas_vida` (enlace del candidato).
- **Este PR:** migración 400.

### A4 — `ci_nomina_items` y `ci_config_nomina` abiertos a cualquier sesión

- **Dónde:** políticas `using (true)` para `authenticated` en prod.
- **Qué pasa:** un usuario logueado sin rol RRHH puede leer (y en config, editar) tabulador y líneas de nómina desde el cliente de navegador.
- **Arreglo:** mismas reglas que 374 (super_admin / entidad_admin / director / rrhh). **No se aplica aquí:** puede dejar sin tabulador a quien hoy lo edita sin ese rol. Luis debe confirmar quién carga la Gaceta.

### A5 — Pedidos y entidades de almacén sin filtro de entidad

- **Dónde:** `app/api/almacen/pedidos/route.ts` (pide *cualquier* permiso del catálogo y lista todo); `app/api/almacen/entidades/route.ts`.
- **Qué pasa:** personal de una entidad ve pedidos/obras de otra.
- **Arreglo:** filtrar por `entidad_id` del actor (join a `ci_proyectos`). Requiere mapear obras↔entidad en la UI.
- **Este PR:** no. Riesgo de dejar el cuadro de almacén vacío si el usuario no tiene entidad activa.

### A6 — Aislamiento de clientes (N:N) incompleto en APIs cruzadas

- **Dónde:** `394_ci_cliente_entidades.sql` (aplicada en prod). `/api/clientes` respeta entidad; `/api/clientes/duplicados` busca en todo el CRM.
- **Arreglo:** limitar duplicados a entidades del actor, salvo `super_admin`.
- **Este PR:** no (puede ocultar un duplicado real entre entidades).

### A7 — Lista vacía de WhatsApp = todos los números

- **Dónde:** `lib/whatsapp/botApi.ts` `isPhoneAllowed`.
- **Qué pasa:** cuando exista `WHATSAPP_TOKEN` y no `WHATSAPP_ALLOWED_PHONES`, cualquier número de Meta podrá mandar facturas.
- **Arreglo (Luis):** al activar WhatsApp, poner la lista. No se cambia el default aquí: rompería el día 1 si la lista llega después del token.

### A8 — Middleware abierto si faltan las llaves públicas

- **Dónde:** `lib/supabase/middleware.ts` líneas 49–51.
- **Qué pasa:** sin `NEXT_PUBLIC_SUPABASE_URL` / anon, no se pide sesión. En Vercel prod las llaves sí están; el riesgo es un deploy mal copiado.
- **Este PR:** en `NODE_ENV=production` responde 503 / manda a `/login`. En local sigue arrancando vacío (como dice `AGENTS.md`).

---

## Medio

### M1 — Colisiones y huecos de migraciones

| Prefijo | Archivos en el repo |
| --- | --- |
| 327 | `327_flota_storage_sin_insert_anon.sql` y `327_netvision_compartir_presupuesto.sql` |
| 328 | `328_ci_flota_rls.sql` y `328_flota_bucket_solo_autenticados.sql` |
| 361 | `361_catalogo_base_obra_civil.sql` y `361_recruitment_needs_examen_primero.sql` |
| 379 | `379a` + `379b` (orden léxico correcto; el número se repite) |

Huecos: 358 (solo en una rama), 368 (pasó a timestamp), 377 (revertida a propósito), 390–393 libres. En prod las recientes van con timestamp (`20261103…`), no con `386_` / `394_`. Un `supabase db push` en base vacía puede aplicar los `202610…` **antes** del bloque 250–398.

- **Arreglo:** no renumerar lo ya aplicado. Documentar; reservar 390–393. Este PR usa 399–400.

### M2 — Migración 386b aplicada en prod y no versionada

- **Dónde:** `supabase_migrations.schema_migrations` → `20261103141220` / `386b_tasa_bcv_fallback_sin_demo`. Cero archivos `*386b*` en git.
- **Qué hace:** `ci_tasa_bcv_compra_fallback()` usa GLOBAL, si no la última `contabilidad_compras` no-DEMO, si no la última `purchase_invoices` no-DEMO. Ya no hay 36,5.
- **Este PR:** `399_386b_tasa_bcv_fallback_sin_demo.sql` (idempotente, igual que prod).

### M3 — Fallback 36,5 todavía en código

- **Dónde:** `lib/finanzas/fetchDashboardUtilidadRealData.ts`, `lib/proyectos/desviacion/cargarDesviacionProyecto.ts`, `app/admin/config/nomina/page.tsx`.
- **Este PR:** se quita. Si no hay tasa, se falla o se pide configurarla; no se inventa 36,5.

### M4 — OCR Gemini / empareje CCO solo con sesión

- **Dónde:** `scan-invoice`, `contabilidad/compras/extract-tabla`, `emparejar-fotos`, `cco/emparejar-soportes`.
- **Este PR:** `scan-invoice` pide `compra.registrar`. El resto: recomendación (`requireCcoAcceso('editar')`).

### M5 — Cabeceras de seguridad incompletas

- **Dónde:** `next.config.mjs`. Faltaban HSTS y CSP.
- **Este PR:** añade HSTS. CSP se deja: rompe PDF, mapas y el OCR si se aprieta sin inventario de orígenes.

### M6 — Páginas `/nexus` y `/nexus/vision` sin sesión

- **Dónde:** `lib/supabase/rutasAcceso.ts`. Los datos van por API; la cáscara es pública.
- **Arreglo:** decidir si el plano compartido del cliente debe vivir solo en `/nexus/vision/cliente`.

### M7 — Advisor: 75 funciones sin `search_path`

- **Dónde:** advisor de seguridad Supabase.
- **Arreglo:** `SET search_path = public` en cada `CREATE OR REPLACE`. Por lotes, no de un golpe.

### M8 — `ci_es_staff_cobros` demasiado amplio

- **Dónde:** migración 397: service_role **o cualquier fila** en `ci_usuarios_roles`.
- **Arreglo:** limitar a roles de cobro/contador. Recomendación.

### M9 — Cron semanal de talento (ya mitigado en código)

- **Dónde:** Vercel runtime, `/api/cron/weekly-report`: `registro_mercantil.trim is not a function` (el campo es jsonb). El código actual ya trata objeto/string. Confirmar que producción tenga ese commit.

### M10 — Rendimiento (advisor)

Muchos avisos de índices y RLS por fila. No bloquean el lanzamiento. Priorizar índices en `contabilidad_compras(fecha, entidad_id)`, `inventario_stock(ubicacion_id)`, `ci_cliente_entidades(cliente_id, entidad_id)` cuando el cuadro de compras/almacén se sienta lento.

---

## Bajo

### B1 — Copy en inglés

- `app/api/webhook-logs/route.ts`: `unauthorized_webhook` → este PR lo pasa a español.
- Login: algunos errores crudos de Supabase siguen en inglés.

### B2 — 79 tablas RLS sin política

Inventario, backups `*legacy*`, Nexus, etc. Sin grants a roles de API: inaccesibles. No abrir políticas «por si acaso».

### B3 — Extensiones `vector` y `postgres_fdw` en `public`

Moverlas a un esquema no expuesto es trabajo de dueño en el panel de Supabase.

### B4 — Artefactos `tmp_*.mjs` / `test_curl*.mjs` en un repo público

No traen llaves (el test `sinLlavesEnRepo` pasa). Conviene no añadir más.

### B5 — Demo de jornales (383) aplicada en prod

`20261103114107_seed_demo_jornales_desviacion`. Las facturas `DEMO-FAC-*` distorsionan totales si no se filtran. Luis decide si se borran.

---

## Ítems abiertos que pidió Luis

| Ítem | Estado |
| --- | --- |
| Fuente diaria BCV | Agregadores (bcv.today, rafnixg). No hay GLOBAL. 386b usa la última factura real. Ver A2. |
| Facturas de octubre en moneda incorrecta | Tres reales mal etiquetadas USD. Ver A1. **No se reescriben.** |
| Migración 386b sin commitear | Estaba en prod, no en git. Este PR la versiona como 399. |

---

## Qué corrige el PR «Auditoría pre-lanzamiento»

Código:

- Permisos en almacén (stock, material, movimientos GET, trazabilidad), gasto estratégico, contratos/salarios, cierre de obra, oficio, OCR `scan-invoice`.
- Middleware cerrado en producción si faltan llaves.
- Webhooks WhatsApp/canal: sin fallback a anon.
- Etiquetas BCV honestas; se elimina el 36,5 de dashboard, desviación y tabulador.
- HSTS; error del webhook de logs en español.
- Test de rutas: detecta `supabaseAdminMovimientos` y `clientePersonalConSesion`.

Migraciones (idempotentes, **no aplicadas** a prod por este agente):

| Archivo | Efecto |
| --- | --- |
| `399_386b_tasa_bcv_fallback_sin_demo.sql` | Igual que 386b ya corrida en prod. |
| `400_revocar_anon_datos_sensibles.sql` | Quita grants `anon` de salarios/nómina/roles/inyecciones; `products_lectura` solo SELECT. |

---

## Decisiones que necesita Luis

1. **Rotar la llave maestra** (C1). Sin esto el resto de RLS no cierra la puerta grande.
2. **Activar WhatsApp en Vercel** (C4) y cargar `WHATSAPP_ALLOWED_PHONES`.
3. **Corregir las 3 facturas de octubre** (A1): ¿autoriza el `UPDATE` de moneda a VES?
4. **Tasa BCV del día:** ¿fila GLOBAL a mano, feed oficial, o seguir con agregadores + 386b?
5. **¿Borrar filas DEMO** (jornal/facturas 36,5)?
6. **¿Quién edita el tabulador?** Si solo RRHH/admin, se puede cerrar `ci_config_nomina` (A4).
7. **Aplicar 399–400** en el SQL Editor de Supabase (399 es no-op en prod; 400 sí cambia grants). Luego `notify pgrst, 'reload schema';`.
8. **No mezclar** este PR con un deploy a producción hasta revisar 1–4.

---

## Comprobar después de aplicar 400

```sql
begin; set local role anon;
select count(*) from ci_labor_salary_history;  -- permission denied
select count(*) from ci_nomina_items;          -- permission denied
rollback;
```

Candidato con enlace de registro: postulación y hoja de vida siguen iguales (`ci_empleados` / `ci_hojas_vida` no se tocan).
