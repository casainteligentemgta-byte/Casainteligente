-- 321 · Seguridad: contabilidad, entidades (patronos) y contratos express
--
-- Antes: cualquier visitante sin sesión podía leer, crear, modificar o borrar facturas de compra,
-- los datos legales de las empresas y los contratos express de obreros. ci_contratos_express además
-- tenía una política ALL para el rol "public" (anon + authenticated) sin condición.
--
-- Después: solo el personal con sesión (authenticated) y el servidor (service_role: bot de Telegram,
-- rutas /api y tareas programadas). Las políticas de authenticated ya existentes no cambian.

begin;

-- Contabilidad de compras
drop policy if exists "Permitir leer contabilidad_compras anon"       on public.contabilidad_compras;
drop policy if exists "Permitir insertar contabilidad_compras anon"   on public.contabilidad_compras;
drop policy if exists "Permitir actualizar contabilidad_compras anon" on public.contabilidad_compras;
drop policy if exists "Permitir borrar contabilidad_compras anon"     on public.contabilidad_compras;
drop policy if exists "Permitir leer contabilidad_compra_lineas anon"     on public.contabilidad_compra_lineas;
drop policy if exists "Permitir insertar contabilidad_compra_lineas anon" on public.contabilidad_compra_lineas;
drop policy if exists "Permitir borrar contabilidad_compra_lineas anon"   on public.contabilidad_compra_lineas;

-- Entidades (patronos): RIF, registro mercantil, representante legal, permisología
drop policy if exists ci_entidades_select_anon on public.ci_entidades;
drop policy if exists ci_entidades_insert_anon on public.ci_entidades;
drop policy if exists ci_entidades_update_anon on public.ci_entidades;
drop policy if exists ci_entidades_delete_anon on public.ci_entidades;

-- Contratos express de obreros
drop policy if exists ci_ctr_express_all_access    on public.ci_contratos_express;
drop policy if exists ci_ctr_express_insert_anon   on public.ci_contratos_express;
drop policy if exists ci_ctr_express_update_anon   on public.ci_contratos_express;
drop policy if exists ci_ctr_express_delete_anon   on public.ci_contratos_express;

-- Storage ci-talento-media (sin uso en el código): sin acceso anónimo
drop policy if exists ci_talento_media_select_anon on storage.objects;
drop policy if exists ci_talento_media_insert_anon on storage.objects;
drop policy if exists ci_talento_media_update_anon on storage.objects;
drop policy if exists ci_talento_media_delete_anon on storage.objects;

commit;
