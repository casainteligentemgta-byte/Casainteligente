-- Clientes en varias entidades (N:N).
-- Aplicar en producción (SQL Editor) y luego: notify pgrst, 'reload schema';
--
-- Un cliente puede ser de DIMAQUINAS y de Casa Inteligente a la vez.
-- customers.entidad_id se conserva como «entidad de origen» (la del alta o
-- el backfill 389). No se borra: Telegram y altas viejas siguen escribiéndola.
--
-- RLS customers_*_entidad
--   Ver/editar si el cliente está ligado a alguna entidad donde el usuario
--   tenga clientes.ver / clientes.editar (ci_tiene_permiso_en_entidad, 380).
--   super_admin ve todo, incluidos los que aún no tienen fila en la puente.
--   DELETE de la fila customers: solo super_admin. El resto «borra» quitando
--   su fila en ci_cliente_entidades (desvincular).
--
-- Telegram / RPCs SECURITY DEFINER
--   NO se activa FORCE ROW LEVEL SECURITY.

-- ── 1) Tabla puente ─────────────────────────────────────────────────────────
create table if not exists public.ci_cliente_entidades (
  customer_id uuid not null references public.customers (id) on delete cascade,
  entidad_id uuid not null references public.ci_entidades (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  primary key (customer_id, entidad_id)
);

comment on table public.ci_cliente_entidades is
  'Empresas (entidades) de un cliente. Un cliente puede estar en varias. unique (customer_id, entidad_id) vía PK.';

comment on column public.ci_cliente_entidades.created_by is
  'Usuario que vinculó el cliente a esa empresa. auth.uid() al insertar.';

create index if not exists idx_ci_cliente_entidades_entidad
  on public.ci_cliente_entidades (entidad_id);

create index if not exists idx_ci_cliente_entidades_customer
  on public.ci_cliente_entidades (customer_id);

comment on column public.customers.entidad_id is
  'Entidad de origen (alta o backfill 389). La pertenencia actual está en ci_cliente_entidades (N:N). No borrar: compatibilidad.';

-- ── 2) Backfill: origen + obras ─────────────────────────────────────────────
insert into public.ci_cliente_entidades (customer_id, entidad_id)
select c.id, c.entidad_id
from public.customers c
where c.entidad_id is not null
on conflict (customer_id, entidad_id) do nothing;

insert into public.ci_cliente_entidades (customer_id, entidad_id)
select distinct p.customer_id, p.entidad_id
from public.ci_proyectos p
where p.customer_id is not null
  and p.entidad_id is not null
on conflict (customer_id, entidad_id) do nothing;

-- ── 3) Trigger: al poner entidad_id de origen, crear el vínculo ─────────────
create or replace function public.ci_sync_cliente_entidad_origen()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.entidad_id is not null then
    insert into public.ci_cliente_entidades (customer_id, entidad_id, created_by)
    values (new.id, new.entidad_id, auth.uid())
    on conflict (customer_id, entidad_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_customers_sync_entidad_origen on public.customers;
create trigger trg_customers_sync_entidad_origen
  after insert or update of entidad_id on public.customers
  for each row
  execute function public.ci_sync_cliente_entidad_origen();

revoke all on function public.ci_sync_cliente_entidad_origen() from public, anon;
grant execute on function public.ci_sync_cliente_entidad_origen() to authenticated, service_role;

-- ── 4) Helpers RLS ──────────────────────────────────────────────────────────
create or replace function public.ci_es_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.ci_usuarios_roles ur
    where ur.user_id = auth.uid()
      and ur.rol = 'super_admin'::public.ci_rol_sistema
  );
$$;

comment on function public.ci_es_super_admin() is
  'SECURITY DEFINER: el usuario en sesión tiene rol super_admin (admin global).';

revoke all on function public.ci_es_super_admin() from public, anon;
grant execute on function public.ci_es_super_admin() to authenticated, service_role;

create or replace function public.ci_cliente_accesible(p_customer_id uuid, p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.ci_es_super_admin()
    or exists (
      select 1
      from public.ci_cliente_entidades ce
      where ce.customer_id = p_customer_id
        and public.ci_tiene_permiso_en_entidad(p_permiso, ce.entidad_id)
    )
    or exists (
      select 1
      from public.customers c
      where c.id = p_customer_id
        and c.entidad_id is not null
        and public.ci_tiene_permiso_en_entidad(p_permiso, c.entidad_id)
    );
$$;

comment on function public.ci_cliente_accesible(uuid, text) is
  'SECURITY DEFINER: el usuario ve/edita el cliente si está ligado a una entidad con ese permiso, o es super_admin.';

revoke all on function public.ci_cliente_accesible(uuid, text) from public, anon;
grant execute on function public.ci_cliente_accesible(uuid, text) to authenticated, service_role;

-- ── 5) RLS puente ───────────────────────────────────────────────────────────
alter table public.ci_cliente_entidades enable row level security;

drop policy if exists ci_cliente_entidades_select on public.ci_cliente_entidades;
drop policy if exists ci_cliente_entidades_insert on public.ci_cliente_entidades;
drop policy if exists ci_cliente_entidades_update on public.ci_cliente_entidades;
drop policy if exists ci_cliente_entidades_delete on public.ci_cliente_entidades;

create policy ci_cliente_entidades_select
  on public.ci_cliente_entidades for select to authenticated
  using (
    public.ci_tiene_permiso_en_entidad('clientes.ver', entidad_id)
    or public.ci_es_super_admin()
  );

create policy ci_cliente_entidades_insert
  on public.ci_cliente_entidades for insert to authenticated
  with check (
    public.ci_tiene_permiso_en_entidad('clientes.editar', entidad_id)
    or public.ci_es_super_admin()
  );

create policy ci_cliente_entidades_delete
  on public.ci_cliente_entidades for delete to authenticated
  using (
    public.ci_tiene_permiso_en_entidad('clientes.editar', entidad_id)
    or public.ci_es_super_admin()
  );

revoke all on table public.ci_cliente_entidades from anon;
revoke truncate on table public.ci_cliente_entidades from public, anon, authenticated;
grant select, insert, delete on table public.ci_cliente_entidades to authenticated;
grant select, insert, update, delete on table public.ci_cliente_entidades to service_role;

-- ── 6) Reescribir customers_*_entidad ───────────────────────────────────────
alter table public.customers enable row level security;

drop policy if exists customers_select_entidad on public.customers;
drop policy if exists customers_insert_entidad on public.customers;
drop policy if exists customers_update_entidad on public.customers;
drop policy if exists customers_delete_entidad on public.customers;

create policy customers_select_entidad
  on public.customers for select to authenticated
  using (
    public.ci_cliente_accesible(id, 'clientes.ver')
    or (
      entidad_id is null
      and not exists (
        select 1 from public.ci_cliente_entidades ce where ce.customer_id = customers.id
      )
      and public.ci_es_super_admin()
    )
  );

create policy customers_insert_entidad
  on public.customers for insert to authenticated
  with check (
    public.ci_tiene_permiso_en_entidad('clientes.editar', entidad_id)
    or (
      entidad_id is null
      and public.ci_es_super_admin()
    )
  );

create policy customers_update_entidad
  on public.customers for update to authenticated
  using (public.ci_cliente_accesible(id, 'clientes.editar'))
  with check (
    public.ci_cliente_accesible(id, 'clientes.editar')
    or public.ci_tiene_permiso_en_entidad('clientes.editar', entidad_id)
    or (
      entidad_id is null
      and public.ci_es_super_admin()
    )
  );

-- Borrar la fila: solo admin global. El resto desvincula en la puente.
create policy customers_delete_entidad
  on public.customers for delete to authenticated
  using (public.ci_es_super_admin());

-- ── 7) Contactos: misma visibilidad N:N ─────────────────────────────────────
drop policy if exists ci_cliente_contactos_select on public.ci_cliente_contactos;
drop policy if exists ci_cliente_contactos_insert on public.ci_cliente_contactos;
drop policy if exists ci_cliente_contactos_update on public.ci_cliente_contactos;
drop policy if exists ci_cliente_contactos_delete on public.ci_cliente_contactos;

create policy ci_cliente_contactos_select
  on public.ci_cliente_contactos for select to authenticated
  using (public.ci_cliente_accesible(customer_id, 'clientes.ver'));

create policy ci_cliente_contactos_insert
  on public.ci_cliente_contactos for insert to authenticated
  with check (
    (usuario_id is null or usuario_id = auth.uid())
    and public.ci_cliente_accesible(customer_id, 'clientes.ver')
  );

create policy ci_cliente_contactos_update
  on public.ci_cliente_contactos for update to authenticated
  using (public.ci_cliente_accesible(customer_id, 'clientes.editar'))
  with check (public.ci_cliente_accesible(customer_id, 'clientes.editar'));

create policy ci_cliente_contactos_delete
  on public.ci_cliente_contactos for delete to authenticated
  using (public.ci_cliente_accesible(customer_id, 'clientes.editar'));

notify pgrst, 'reload schema';
