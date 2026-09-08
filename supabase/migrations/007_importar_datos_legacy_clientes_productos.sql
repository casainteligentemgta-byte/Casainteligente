-- Importa datos de tablas antiguas (tb_clientes, products)
-- hacia el modelo actual (empresas, personas, productos).
--
-- En preview fresco esas tablas legacy no existen: se omite el import.
-- Requisitos previos cuando sí hay datos:
-- - empresas (004 o 008)
-- - 003_productos.sql
-- - 005_personas.sql

-- 1) Clientes tipo Empresa -> empresas
do $$
begin
  if to_regclass('public.tb_clientes') is null or to_regclass('public.empresas') is null then
    raise notice '007: sin tb_clientes/empresas; se omite import de empresas';
    return;
  end if;

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
end $$;

-- 2) Otros clientes (no Empresa) -> personas
do $$
begin
  if to_regclass('public.tb_clientes') is null or to_regclass('public.personas') is null then
    raise notice '007: sin tb_clientes/personas; se omite import de personas';
    return;
  end if;

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
        and coalesce(lower(trim(p.email)), '') = coalesce(lower(trim(p.email)), '')
    );
end $$;

-- 3) products -> productos
do $$
begin
  if to_regclass('public.products') is null or to_regclass('public.productos') is null then
    raise notice '007: sin products/productos; se omite import de productos';
    return;
  end if;

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
end $$;
