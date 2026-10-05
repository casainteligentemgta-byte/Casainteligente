-- NetVision Pro: enlace para el cliente, plano en la nube y enlaces con productos de Ventas.
-- Idempotente.

-- 1) Enlace para compartir la vista del cliente (código secreto por proyecto).
alter table public.netvision_projects
  add column if not exists share_token text,
  add column if not exists shared_at timestamptz;

create unique index if not exists idx_netvision_projects_share_token
  on public.netvision_projects (share_token)
  where share_token is not null;

comment on column public.netvision_projects.share_token is
  'Código secreto del enlace de solo lectura para el cliente. NULL = no compartido.';

-- 2) Plano del proyecto en Storage (el JSON del proyecto no lo lleva si es grande).
--    Ruta: <user_id>/<project_id>. Privado: el dueño lo lee y escribe; el cliente
--    lo recibe por URL firmada desde el servidor.
insert into storage.buckets (id, name, public, file_size_limit)
values ('netvision-planos', 'netvision-planos', false, 20971520)
on conflict (id) do nothing;

drop policy if exists netvision_planos_select on storage.objects;
create policy netvision_planos_select
  on storage.objects for select to authenticated
  using (bucket_id = 'netvision-planos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists netvision_planos_insert on storage.objects;
create policy netvision_planos_insert
  on storage.objects for insert to authenticated
  with check (bucket_id = 'netvision-planos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists netvision_planos_update on storage.objects;
create policy netvision_planos_update
  on storage.objects for update to authenticated
  using (bucket_id = 'netvision-planos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'netvision-planos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists netvision_planos_delete on storage.objects;
create policy netvision_planos_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'netvision-planos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 3) Enlaces recordados: renglón de la lista de materiales → producto de Ventas.
create table if not exists public.netvision_producto_enlaces (
  sku text primary key,
  product_id integer not null references public.products (id) on delete cascade,
  updated_at timestamptz not null default now()
);

comment on table public.netvision_producto_enlaces is
  'NetVision: qué producto de Ventas corresponde a cada renglón de la lista de materiales.';

alter table public.netvision_producto_enlaces enable row level security;

drop policy if exists netvision_producto_enlaces_select on public.netvision_producto_enlaces;
create policy netvision_producto_enlaces_select
  on public.netvision_producto_enlaces for select to authenticated using (true);

drop policy if exists netvision_producto_enlaces_insert on public.netvision_producto_enlaces;
create policy netvision_producto_enlaces_insert
  on public.netvision_producto_enlaces for insert to authenticated with check (true);

drop policy if exists netvision_producto_enlaces_update on public.netvision_producto_enlaces;
create policy netvision_producto_enlaces_update
  on public.netvision_producto_enlaces for update to authenticated using (true) with check (true);

drop policy if exists netvision_producto_enlaces_delete on public.netvision_producto_enlaces;
create policy netvision_producto_enlaces_delete
  on public.netvision_producto_enlaces for delete to authenticated using (true);

notify pgrst, 'reload schema';
