-- Clientes: aislamiento por entidad + historial de contactos (WhatsApp / ficha).
-- Aplicar en producción (SQL Editor) y luego: notify pgrst, 'reload schema';
--
-- entidad_id
--   Backfill desde la obra más reciente del cliente (ci_proyectos.entidad_id).
--   Clientes sin obra, o con obras sin entidad, quedan en NULL: solo el admin
--   global (super_admin) los ve. Documentado a propósito para no inventar
--   una entidad. Se asigna al crear un cliente (entidad activa del usuario)
--   o al vincular una obra.
--
-- RLS
--   Sustituye customers_auth_* de 385 (using true). Permisos clientes.ver /
--   clientes.editar / clientes.borrar vía ci_tiene_permiso_en_entidad (380),
--   mismo modelo que ci_empleados. super_admin ve todo, incluidas filas NULL.
--   get_auth_user_context (374) cubre el caso NULL para admin global.
--
-- Telegram / RPCs SECURITY DEFINER
--   NO se activa FORCE ROW LEVEL SECURITY. service_role (bot de Telegram) y
--   funciones SECURITY DEFINER siguen sin pasar por estas políticas.
--
-- Privileges
--   Se quita TRUNCATE y el DELETE abierto (using true). DELETE queda acotado
--   a clientes.borrar. La app archiva (UPDATE status), no borra filas.

-- ── 1) Columna y backfill ───────────────────────────────────────────────────
alter table public.customers
  add column if not exists entidad_id uuid references public.ci_entidades (id) on delete set null;

comment on column public.customers.entidad_id is
  'Entidad (patrono) dueña del cliente. Backfill desde ci_proyectos.entidad_id. NULL = sin obra o obra sin entidad; solo super_admin los ve hasta asignar entidad.';

create index if not exists idx_customers_entidad_id
  on public.customers (entidad_id);

update public.customers c
set entidad_id = src.entidad_id
from (
  select distinct on (p.customer_id)
    p.customer_id,
    p.entidad_id
  from public.ci_proyectos p
  where p.customer_id is not null
    and p.entidad_id is not null
  order by p.customer_id, p.created_at desc nulls last
) src
where c.id = src.customer_id
  and c.entidad_id is null;

-- ── 2) RLS customers ────────────────────────────────────────────────────────
alter table public.customers enable row level security;
-- Relforcerowsecurity = false: Telegram (service_role) y SECURITY DEFINER siguen.

drop policy if exists "Permitir leer customers" on public.customers;
drop policy if exists "Permitir insertar customers" on public.customers;
drop policy if exists "Permitir actualizar customers" on public.customers;
drop policy if exists "Permitir borrar customers" on public.customers;
drop policy if exists customers_auth_select on public.customers;
drop policy if exists customers_auth_insert on public.customers;
drop policy if exists customers_auth_update on public.customers;
drop policy if exists customers_auth_delete on public.customers;
drop policy if exists customers_select_entidad on public.customers;
drop policy if exists customers_insert_entidad on public.customers;
drop policy if exists customers_update_entidad on public.customers;
drop policy if exists customers_delete_entidad on public.customers;

create policy customers_select_entidad
  on public.customers for select to authenticated
  using (
    public.ci_tiene_permiso_en_entidad('clientes.ver', entidad_id)
    or (
      entidad_id is null
      and exists (
        select 1
        from public.get_auth_user_context() uc(out_rol, out_entidad_id)
        where uc.out_rol = 'super_admin'::public.ci_rol_sistema
      )
    )
  );

create policy customers_insert_entidad
  on public.customers for insert to authenticated
  with check (
    public.ci_tiene_permiso_en_entidad('clientes.editar', entidad_id)
    or (
      entidad_id is null
      and exists (
        select 1
        from public.get_auth_user_context() uc(out_rol, out_entidad_id)
        where uc.out_rol = 'super_admin'::public.ci_rol_sistema
      )
    )
  );

create policy customers_update_entidad
  on public.customers for update to authenticated
  using (
    public.ci_tiene_permiso_en_entidad('clientes.editar', entidad_id)
    or (
      entidad_id is null
      and exists (
        select 1
        from public.get_auth_user_context() uc(out_rol, out_entidad_id)
        where uc.out_rol = 'super_admin'::public.ci_rol_sistema
      )
    )
  )
  with check (
    public.ci_tiene_permiso_en_entidad('clientes.editar', entidad_id)
    or (
      entidad_id is null
      and exists (
        select 1
        from public.get_auth_user_context() uc(out_rol, out_entidad_id)
        where uc.out_rol = 'super_admin'::public.ci_rol_sistema
      )
    )
  );

create policy customers_delete_entidad
  on public.customers for delete to authenticated
  using (
    public.ci_tiene_permiso_en_entidad('clientes.borrar', entidad_id)
    or (
      entidad_id is null
      and exists (
        select 1
        from public.get_auth_user_context() uc(out_rol, out_entidad_id)
        where uc.out_rol = 'super_admin'::public.ci_rol_sistema
      )
    )
  );

revoke all on table public.customers from anon;
revoke truncate on table public.customers from public, anon, authenticated;
grant select, insert, update, delete on table public.customers to authenticated;

-- Matriz (si 376/385 ya corrieron): no duplica.
do $$
begin
  if to_regclass('public.ci_rol_permisos') is null then
    return;
  end if;
  insert into public.ci_rol_permisos (rol, permiso)
  values
    ('super_admin', 'clientes.ver'),
    ('super_admin', 'clientes.editar'),
    ('super_admin', 'clientes.borrar'),
    ('entidad_admin', 'clientes.ver'),
    ('entidad_admin', 'clientes.editar'),
    ('entidad_admin', 'clientes.borrar'),
    ('director', 'clientes.ver'),
    ('director', 'clientes.editar'),
    ('director', 'clientes.borrar'),
    ('pm_obra', 'clientes.ver'),
    ('pm_obra', 'clientes.editar'),
    ('pm_obra', 'clientes.borrar')
  on conflict do nothing;
end $$;

-- ── 3) Historial de contactos (WhatsApp / llamada / nota) ───────────────────
create table if not exists public.ci_cliente_contactos (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  fecha timestamptz not null default now(),
  canal text not null default 'whatsapp'
    check (canal in ('whatsapp', 'llamada', 'telegram', 'email', 'otro')),
  nota text,
  usuario_id uuid,
  usuario_nombre text,
  created_at timestamptz not null default now()
);

comment on table public.ci_cliente_contactos is
  'Contactos con el cliente desde la ficha (WhatsApp automático o nota manual). Aislado por la entidad del customer.';

comment on column public.ci_cliente_contactos.canal is
  'whatsapp | llamada | telegram | email | otro.';

create index if not exists idx_ci_cliente_contactos_customer
  on public.ci_cliente_contactos (customer_id, fecha desc, created_at desc);

alter table public.ci_cliente_contactos enable row level security;

drop policy if exists ci_cliente_contactos_select on public.ci_cliente_contactos;
drop policy if exists ci_cliente_contactos_insert on public.ci_cliente_contactos;
drop policy if exists ci_cliente_contactos_update on public.ci_cliente_contactos;
drop policy if exists ci_cliente_contactos_delete on public.ci_cliente_contactos;

create policy ci_cliente_contactos_select
  on public.ci_cliente_contactos for select to authenticated
  using (
    public.ci_tiene_permiso_en_entidad(
      'clientes.ver',
      (select c.entidad_id from public.customers c where c.id = customer_id)
    )
    or exists (
      select 1
      from public.customers c
      where c.id = customer_id
        and c.entidad_id is null
        and exists (
          select 1
          from public.get_auth_user_context() uc(out_rol, out_entidad_id)
          where uc.out_rol = 'super_admin'::public.ci_rol_sistema
        )
    )
  );

create policy ci_cliente_contactos_insert
  on public.ci_cliente_contactos for insert to authenticated
  with check (
    (usuario_id is null or usuario_id = auth.uid())
    and (
      public.ci_tiene_permiso_en_entidad(
        'clientes.ver',
        (select c.entidad_id from public.customers c where c.id = customer_id)
      )
      or exists (
        select 1
        from public.customers c
        where c.id = customer_id
          and c.entidad_id is null
          and exists (
            select 1
            from public.get_auth_user_context() uc(out_rol, out_entidad_id)
            where uc.out_rol = 'super_admin'::public.ci_rol_sistema
          )
      )
    )
  );

create policy ci_cliente_contactos_update
  on public.ci_cliente_contactos for update to authenticated
  using (
    public.ci_tiene_permiso_en_entidad(
      'clientes.editar',
      (select c.entidad_id from public.customers c where c.id = customer_id)
    )
  )
  with check (
    public.ci_tiene_permiso_en_entidad(
      'clientes.editar',
      (select c.entidad_id from public.customers c where c.id = customer_id)
    )
  );

create policy ci_cliente_contactos_delete
  on public.ci_cliente_contactos for delete to authenticated
  using (
    public.ci_tiene_permiso_en_entidad(
      'clientes.editar',
      (select c.entidad_id from public.customers c where c.id = customer_id)
    )
  );

revoke all on table public.ci_cliente_contactos from anon;
revoke truncate on table public.ci_cliente_contactos from public, anon, authenticated;
grant select, insert, update, delete on table public.ci_cliente_contactos to authenticated;
grant select, insert, update, delete on table public.ci_cliente_contactos to service_role;

notify pgrst, 'reload schema';
