-- Importa datos de tablas antiguas (tb_clientes, products)
-- hacia el modelo actual (empresas, personas, productos).
--
-- En Preview/fresh DB las tablas legacy pueden no existir: en ese caso es no-op.
-- Requisitos previos:
-- - empresas (004 stub o 008_empresas.sql)
-- - 003_productos.sql
-- - 005_personas.sql
--
-- Nota: usa inserciones con "where not exists" para evitar
-- duplicados evidentes por nombre + email.

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text,
  telefono text,
  email text,
  rif text,
  notas text,
  creado_en timestamptz default now(),
  actualizado_en timestamptz default now()
);

do $$
begin
  -- 1) Clientes tipo Empresa -> empresas
  if to_regclass('public.tb_clientes') is not null then
    insert into public.empresas (nombre, direccion, telefono, email)
    select distinct
      trim(c.nombre) as nombre,
      nullif(trim(c.direccion), '') as direccion,
      nullif(trim(c.telefono), '') as telefono,
      nullif(trim(c.email), '') as email
    from public.tb_clientes c
    where lower(coalesce(c.tipo, '')) = 'empresa'
      and trim(coalesce(c.nombre, '')) <> ''
      and not exists (
        select 1
        from public.empresas e
        where lower(trim(e.nombre)) = lower(trim(c.nombre))
          and coalesce(lower(trim(e.email)), '') = coalesce(lower(trim(c.email)), '')
      );

    -- 2) Otros clientes (no Empresa) -> personas
    insert into public.personas (nombre, direccion, telefono, email, documento)
    select distinct
      trim(c.nombre) as nombre,
      nullif(trim(c.direccion), '') as direccion,
      nullif(trim(c.telefono), '') as telefono,
      nullif(trim(c.email), '') as email,
      nullif(trim(c.tipo), '') as documento
    from public.tb_clientes c
    where lower(coalesce(c.tipo, '')) <> 'empresa'
      and trim(coalesce(c.nombre, '')) <> ''
      and not exists (
        select 1
        from public.personas p
        where lower(trim(p.nombre)) = lower(trim(c.nombre))
          and coalesce(lower(trim(p.email)), '') = coalesce(lower(trim(c.email)), '')
      );
  else
    raise notice '007: public.tb_clientes no existe; se omite import de clientes.';
  end if;

  -- 3) products -> productos
  if to_regclass('public.products') is not null then
    insert into public.productos (nombre, descripcion, precio, activo)
    select
      trim(p.nombre) as nombre,
      nullif(trim(coalesce(p.descripcion, p.descripcion2, '')), '') as descripcion,
      coalesce(p.precio, 0)::numeric(14,2) as precio,
      true as activo
    from public.products p
    where trim(coalesce(p.nombre, '')) <> ''
      and not exists (
        select 1
        from public.productos np
        where lower(trim(np.nombre)) = lower(trim(p.nombre))
      );
  else
    raise notice '007: public.products no existe; se omite import de productos.';
  end if;
end;
$$;
