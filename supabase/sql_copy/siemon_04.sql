begin;

drop table if exists cat_siemon_2026;
create temporary table cat_siemon_2026 (
  marca text not null,
  modelo text not null,
  nombre text not null,
  categoria text not null,
  costo numeric(14,2) not null,
  descripcion text,
  estatus text not null,
  primary key (marca, modelo)
);

insert into cat_siemon_2026 (marca, modelo, nombre, categoria, costo, descripcion, estatus)
values
  ('Siemon', 'PC6-001M-A02LS', 'Siemon PC6-001M-A02LS 3.2 Pies, 1 Metro', 'Network', 4.50, '3.2 Pies, 1 Metro', 'DISPONIBLE'),
  ('Siemon', 'PC6-002M-A02LS', 'Siemon PC6-002M-A02LS 6.5 Pies, 2 Metros', 'Network', 5.50, '6.5 Pies, 2 Metros', 'DISPONIBLE'),
  ('Siemon', 'PC6-003M-A02LS', 'Siemon PC6-003M-A02LS 9.8 Pies, 3 Metros', 'Network', 6.00, '9.8 Pies, 3 Metros', 'DISPONIBLE'),
  ('Siemon', 'PC6-001M-A06LS', 'Siemon PC6-001M-A06LS 3.2 Pies, 1 Metro', 'Network', 4.00, '3.2 Pies, 1 Metro', 'DISPONIBLE'),
  ('Siemon', 'PC6-002M-A06LS', 'Siemon PC6-002M-A06LS 6.5 Pies, 2 Metros', 'Network', 5.00, '6.5 Pies, 2 Metros', 'DISPONIBLE'),
  ('Siemon', 'PC6-003M-A06LS', 'Siemon PC6-003M-A06LS 9.8 Pies, 3 Metros', 'Network', 6.00, '9.8 Pies, 3 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC6-02-06-28B', 'Siemon MC6-02-06-28B 02 Pies, 0.61 Metros', 'Network', 5.00, '02 Pies, 0.61 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC6-03-06-28B', 'Siemon MC6-03-06-28B 03 Pies, 0.91 Metros', 'Network', 5.50, '03 Pies, 0.91 Metros', 'DISPONIBLE'),
  ('Siemon', 'LKM1-002M-06DS', 'Siemon LKM1-002M-06DS Lkm1 - 002m - 06ds 2 metros', 'Network', 8.50, 'Lkm1 - 002m - 06ds 2 metros', 'DISPONIBLE'),
  ('Siemon', 'LKM1-003M-06DS', 'Siemon LKM1-003M-06DS Lkm1 - 003m - 06ds 3 metros', 'Network', 9.50, 'Lkm1 - 003m - 06ds 3 metros', 'DISPONIBLE'),
  ('Siemon', 'LKM1-005M-06DS', 'Siemon LKM1-005M-06DS 5 Metros', 'Network', 11.50, '5 Metros', 'DISPONIBLE'),
  ('Siemon', 'LKM1-7.5M-06DS', 'Siemon LKM1-7.5M-06DS 7.5 Metros', 'Network', 14.00, '7.5 Metros', 'DISPONIBLE'),
  ('Siemon', 'LK-KEY-CLR', 'Siemon LK-KEY-CLR Llave para Patchcords Lockit de Siemon La llave LockIT está diseñada', 'Network', 8.00, 'Llave para Patchcords Lockit de Siemon La llave LockIT está diseñada exclusivamente para desbloqu...', 'DISPONIBLE'),
  ('Siemon', 'LL-LC-05', 'Siemon LL-LC-05 Cerradura LockIT LC para Jack Outlet, bolsa de 10, incluye 1 LockIT', 'Network', 9.00, 'Cerradura LockIT LC para Jack Outlet, bolsa de 10, incluye 1 LockIT Adapter Key. La cerradura Loc...', 'DISPONIBLE'),
  ('Siemon', 'UP6-F1-24K-RS', 'Siemon UP6-F1-24K-RS 24 Puertos, Plano, 1U', 'Network', 160.00, '24 Puertos, Plano, 1U', 'DISPONIBLE'),
  ('Siemon', 'UP6-F2-48K-RS', 'Siemon UP6-F2-48K-RS 48 Puertos, Plano, 2U', 'Network', 280.00, '48 Puertos, Plano, 2U', 'DISPONIBLE'),
  ('Siemon', 'UP6-F2-48L-RS', 'Siemon UP6-F2-48L-RS 48 Puertos, Plano, 2U', 'Network', 250.00, '48 Puertos, Plano, 2U', 'DISPONIBLE'),
  ('Siemon', 'U6-H01NB', 'Siemon U6-H01NB Cobre, Jack, Outlet, MAX, UTP, Categoria 6, RJ45, Estilo 110, Montaje', 'Network', 5.50, 'Cobre, Jack, Outlet, MAX, UTP, Categoria 6, RJ45, Estilo 110, Montaje Plano, Negro, Punch down, T...', 'DISPONIBLE'),
  ('Siemon', 'U6-H02NB', 'Siemon U6-H02NB Cobre, Jack, Outlet, MAX, UTP, Categoria 6, RJ45, Estilo 110, Montaje', 'Network', 5.50, 'Cobre, Jack, Outlet, MAX, UTP, Categoria 6, RJ45, Estilo 110, Montaje Plano, Azul, Punch down, T5...', 'DISPONIBLE'),
  ('Siemon', 'U6-H03NB', 'Siemon U6-H03NB Cobre, Jack, Outlet, MAX, UTP, Categoria 6, RJ45, Estilo 110, Montaje', 'Network', 5.50, 'Cobre, Jack, Outlet, MAX, UTP, Categoria 6, RJ45, Estilo 110, Montaje Plano, Rojo, Punch down, T5...', 'DISPONIBLE'),
  ('Siemon', 'U6-H06NB', 'Siemon U6-H06NB Cobre, Jack, Outlet, MAX, UTP, Categoria 6, RJ45, Estilo 110, Montaje', 'Network', 5.50, 'Cobre, Jack, Outlet, MAX, UTP, Categoria 6, RJ45, Estilo 110, Montaje Plano, Azul, Punch down, T5...', 'DISPONIBLE'),
  ('Siemon', 'U6-K01NB', 'Siemon U6-K01NB Cobre, Jack, Outlet, KEYSTONE, UTP, Categoria 6, RJ45, Estilo 110', 'Network', 5.50, 'Cobre, Jack, Outlet, KEYSTONE, UTP, Categoria 6, RJ45, Estilo 110, Montaje Plano, Negro, Punch do...', 'DISPONIBLE');

update public.products p
set
  nombre = e.nombre,
  categoria = e.categoria,
  marca = e.marca,
  descripcion = e.descripcion,
  descripcion2 = 'Lista distribuidor 2026 · ' || e.estatus,
  costo = e.costo,
  precio = e.costo,
  utilidad = 0
from cat_siemon_2026 e
where lower(btrim(p.modelo)) = lower(btrim(e.modelo))
  and (
    p.marca is null
    or btrim(p.marca) = ''
    or lower(btrim(p.marca)) = lower(btrim(e.marca))
  );

insert into public.products (
  nombre, categoria, marca, modelo, descripcion, descripcion2,
  costo, precio, utilidad, cantidad
)
select
  e.nombre, e.categoria, e.marca, e.modelo, e.descripcion,
  'Lista distribuidor 2026 · ' || e.estatus,
  e.costo, e.costo, 0, 0
from cat_siemon_2026 e
where not exists (
  select 1
  from public.products p
  where lower(btrim(p.modelo)) = lower(btrim(e.modelo))
    and (
      p.marca is null
      or btrim(p.marca) = ''
      or lower(btrim(p.marca)) = lower(btrim(e.marca))
    )
);

commit;
