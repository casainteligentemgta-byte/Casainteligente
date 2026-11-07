-- 403: memoria de proveedor para facturas de compra (perfil + correcciones).
-- Aditivo. Idempotente. El perfil se actualiza al confirmar; las vistas reflejan el histórico.

create table if not exists public.ci_proveedor_perfil (
  rif_normalizado text primary key,
  rif_etiqueta text,
  nombre_canonico text,
  moneda_habitual text,
  dias_credito_habitual integer,
  condicion_pago_habitual text,
  entidad_id_habitual uuid,
  proyecto_id_habitual uuid,
  ubicacion_destino_id_habitual uuid,
  imputacion_habitual text,
  clasificacion_gasto_habitual text,
  n_facturas integer not null default 0,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.ci_proveedor_correcciones (
  id uuid primary key default gen_random_uuid(),
  rif_normalizado text not null,
  campo text not null,
  valor_original text not null,
  valor_corregido text not null,
  n_veces integer not null default 1,
  origen text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rif_normalizado, campo, valor_original)
);

create index if not exists ci_proveedor_correcciones_rif_idx
  on public.ci_proveedor_correcciones (rif_normalizado, campo);

alter table public.ci_proveedor_perfil enable row level security;
alter table public.ci_proveedor_correcciones enable row level security;

drop policy if exists ci_proveedor_perfil_authenticated on public.ci_proveedor_perfil;
create policy ci_proveedor_perfil_authenticated on public.ci_proveedor_perfil
  for all to authenticated using (true) with check (true);

drop policy if exists ci_proveedor_correcciones_authenticated on public.ci_proveedor_correcciones;
create policy ci_proveedor_correcciones_authenticated on public.ci_proveedor_correcciones
  for all to authenticated using (true) with check (true);

revoke all on table public.ci_proveedor_perfil from anon;
revoke all on table public.ci_proveedor_correcciones from anon;
grant select, insert, update, delete on table public.ci_proveedor_perfil to authenticated;
grant select, insert, update, delete on table public.ci_proveedor_correcciones to authenticated;

create or replace view public.ci_proveedor_perfil_agregado
  with (security_invoker = true)
as
select
  upper(regexp_replace(coalesce(pi.supplier_rif, ''), '[^A-Za-z0-9]', '', 'g')) as rif_normalizado,
  mode() within group (order by pi.supplier_name) as nombre_canonico,
  mode() within group (order by coalesce(pi.moneda_original, pi.moneda)) as moneda_habitual,
  mode() within group (order by pi.dias_credito) as dias_credito_habitual,
  mode() within group (order by pi.condicion_pago) as condicion_pago_habitual,
  mode() within group (order by pi.entidad_id) as entidad_id_habitual,
  mode() within group (order by pi.proyecto_id) as proyecto_id_habitual,
  mode() within group (order by pi.ubicacion_destino_id) as ubicacion_destino_id_habitual,
  count(*)::integer as n_facturas
from public.purchase_invoices pi
where coalesce(pi.supplier_rif, '') <> ''
group by 1
having char_length(upper(regexp_replace(coalesce(pi.supplier_rif, ''), '[^A-Za-z0-9]', '', 'g'))) >= 6;

create or replace view public.ci_proveedor_item_precios
  with (security_invoker = true)
as
select
  upper(regexp_replace(coalesce(pi.supplier_rif, ''), '[^A-Za-z0-9]', '', 'g')) as rif_normalizado,
  lower(btrim(coalesce(cl.descripcion, ''))) as nombre_norm,
  mode() within group (order by cl.descripcion) as nombre_habitual,
  percentile_cont(0.5) within group (order by cl.precio_unitario::numeric) as precio_mediana,
  count(*)::integer as n
from public.contabilidad_compra_lineas cl
join public.contabilidad_compras cc on cc.id = cl.compra_id
join public.purchase_invoices pi on pi.id = cc.purchase_invoice_id
where coalesce(cl.descripcion, '') <> ''
  and cl.precio_unitario is not null
  and coalesce(pi.supplier_rif, '') <> ''
group by 1, 2
having count(*) >= 1;

revoke all on table public.ci_proveedor_perfil_agregado from anon;
revoke all on table public.ci_proveedor_item_precios from anon;
grant select on table public.ci_proveedor_perfil_agregado to authenticated;
grant select on table public.ci_proveedor_item_precios to authenticated;

notify pgrst, 'reload schema';
