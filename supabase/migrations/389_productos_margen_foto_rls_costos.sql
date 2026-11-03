-- Productos: margen en catálogo, foto única, RLS de costos, revocar anon.
--
-- No reescribe precios existentes (el dueño aplica el margen a mano con la
-- herramienta del catálogo). Solo deja columnas, vista y permisos.

-- ── 1) Columnas de margen ──────────────────────────────────────────
alter table public.products
  add column if not exists margen_pct numeric(7, 2);

comment on column public.products.margen_pct is
  'Margen comercial sobre el costo (%). Precio de venta = costo × (1 + margen_pct/100). Null = usar el de la categoría o 20.';

alter table public.product_categories
  add column if not exists margen_pct_defecto numeric(7, 2);

comment on column public.product_categories.margen_pct_defecto is
  'Margen por defecto (%) de los productos de esta categoría, si el producto no tiene margen_pct propio.';

-- Columnas que la app ya usa y a veces faltan en bases viejas.
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists subcategoria text;
alter table public.products add column if not exists descripcion2 text;
alter table public.products add column if not exists modificado timestamptz;
alter table public.products add column if not exists proveedor_url text;
alter table public.products add column if not exists manual_instrucciones text;
alter table public.products add column if not exists manual_documento_url text;
alter table public.products add column if not exists disponibilidad_proveedor text;
alter table public.products add column if not exists lista_proveedor_fecha date;

-- ── 2) Unificar foto: `imagen` es canónico; `image_url` se copia, no se inventa ──
-- Hallazgo: el formulario y la importación escriben `imagen`; NetVision y
-- types/product.ts leían `image_url` (columna de un SQL suelto, no de las
-- migraciones). Quien leía el campo vacío veía ~94 % «sin foto».
update public.products
set imagen = image_url
where (imagen is null or btrim(imagen) = '')
  and image_url is not null
  and btrim(image_url) <> '';

update public.products
set image_url = imagen
where (image_url is null or btrim(image_url) = '')
  and imagen is not null
  and btrim(imagen) <> '';

create or replace function public.products_sync_foto()
returns trigger
language plpgsql
as $$
begin
  -- Si solo llegó image_url (código viejo), se copia a imagen.
  if (new.imagen is null or btrim(new.imagen) = '')
     and new.image_url is not null
     and btrim(new.image_url) <> '' then
    new.imagen := btrim(new.image_url);
  end if;
  new.imagen := nullif(btrim(coalesce(new.imagen, '')), '');
  new.image_url := new.imagen;
  return new;
end;
$$;

drop trigger if exists tr_products_sync_foto on public.products;
create trigger tr_products_sync_foto
  before insert or update of imagen, image_url
  on public.products
  for each row
  execute function public.products_sync_foto();

comment on column public.products.imagen is
  'URL pública de la foto (campo canónico). image_url se mantiene igual por compatibilidad.';
comment on column public.products.image_url is
  'Espejo de imagen (trigger). No usar para escribir; leer imagen.';

-- ── 3) Revocar anon y políticas abiertas ───────────────────────────
alter table public.products enable row level security;

drop policy if exists "Permitir leer products" on public.products;
drop policy if exists "Permitir insertar products" on public.products;
drop policy if exists "Permitir actualizar products" on public.products;
drop policy if exists "Permitir borrar products" on public.products;

drop policy if exists "Permitir leer products authenticated" on public.products;
drop policy if exists "Permitir insertar products authenticated" on public.products;
drop policy if exists "Permitir actualizar products authenticated" on public.products;
drop policy if exists "Permitir borrar products authenticated" on public.products;

-- Leftovers de 329 (políticas anónimas renombradas a authenticated).
drop policy if exists "products_borrar_con_sesion" on public.products;
drop policy if exists "products_editar_con_sesion" on public.products;
drop policy if exists "products_insertar_con_sesion" on public.products;
drop policy if exists "Permitir borrar productos a anónimos" on public.products;
drop policy if exists "Permitir editar productos a anónimos" on public.products;
drop policy if exists "Permitir insertar productos a anónimos" on public.products;

create policy "Permitir leer products authenticated"
  on public.products for select to authenticated using (true);
create policy "Permitir insertar products authenticated"
  on public.products for insert to authenticated with check (true);
create policy "Permitir actualizar products authenticated"
  on public.products for update to authenticated using (true) with check (true);
create policy "Permitir borrar products authenticated"
  on public.products for delete to authenticated using (true);

revoke all on table public.products from anon;
revoke all on table public.products from public;
grant select, insert, update, delete on table public.products to authenticated;

-- Lectura de costo / utilidad / margen solo vía la vista (enmascara sin permiso).
revoke select (costo, utilidad, margen_pct) on public.products from authenticated;
revoke select (costo, utilidad, margen_pct) on public.products from anon;
revoke select (costo, utilidad, margen_pct) on public.products from public;

-- ── 4) Vista de lectura: enmascara costos si no hay productos.costos ──
-- security_invoker = false (dueño): puede leer las columnas revocadas y
-- aplicar CASE. Las filas siguen siendo las de products (RLS authenticated
-- usando true, equivalente).
create or replace view public.products_lectura
  with (security_invoker = false) as
select
  p.id,
  p.external_id,
  p.nombre,
  p.categoria,
  p.subcategoria,
  p.marca,
  p.modelo,
  p.descripcion,
  p.descripcion2,
  case when public.ci_tiene_permiso('productos.costos') then p.costo else null end as costo,
  p.precio,
  case when public.ci_tiene_permiso('productos.costos') then p.utilidad else null end as utilidad,
  case when public.ci_tiene_permiso('productos.costos') then p.margen_pct else null end as margen_pct,
  p.cantidad,
  coalesce(nullif(btrim(p.imagen), ''), nullif(btrim(p.image_url), '')) as imagen,
  coalesce(nullif(btrim(p.imagen), ''), nullif(btrim(p.image_url), '')) as image_url,
  p.ubicacion,
  p.created_at,
  p.updated_at,
  p.modificado,
  p.manual_instrucciones,
  p.manual_documento_url,
  p.disponibilidad_proveedor,
  p.lista_proveedor_fecha,
  p.proveedor_url
from public.products p;

revoke all on table public.products_lectura from anon;
revoke all on table public.products_lectura from public;
grant select on table public.products_lectura to authenticated;

comment on view public.products_lectura is
  'Catálogo para la app: costo/utilidad/margen_pct solo si ci_tiene_permiso(''productos.costos'').';

-- ── 5) Matriz de permisos ──────────────────────────────────────────
do $$
begin
  if to_regclass('public.ci_rol_permisos') is null then
    return;
  end if;
  insert into public.ci_rol_permisos (rol, permiso)
  values
    ('super_admin', 'productos.ver'),
    ('super_admin', 'productos.costos'),
    ('entidad_admin', 'productos.ver'),
    ('entidad_admin', 'productos.costos'),
    ('director', 'productos.costos'),
    ('pm_obra', 'productos.costos'),
    ('contador', 'productos.costos'),
    ('comprador', 'productos.costos')
  on conflict do nothing;
end $$;

notify pgrst, 'reload schema';
