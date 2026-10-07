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
  ('Siemon', 'ZM6A-S01-06B', 'Siemon ZM6A-S01-06B 01 Pies, 0.30 Metros', 'Network', 11.00, '01 Pies, 0.30 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S02-06B', 'Siemon ZM6A-S02-06B 02 Pies, 0.61 Metros', 'Network', 11.50, '02 Pies, 0.61 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S03-06B', 'Siemon ZM6A-S03-06B 03 Pies, 0.91 Metros', 'Network', 12.00, '03 Pies, 0.91 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S05-06B', 'Siemon ZM6A-S05-06B 05 Pies, 1.52 Metros', 'Network', 12.50, '05 Pies, 1.52 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S07-06B', 'Siemon ZM6A-S07-06B 07 Pies, 2.13 Metros', 'Network', 13.50, '07 Pies, 2.13 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S10-06B', 'Siemon ZM6A-S10-06B 10 Pies, 3.05 Metros', 'Network', 15.00, '10 Pies, 3.05 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S01M-06B', 'Siemon ZM6A-S01M-06B 1 Metro', 'Network', 12.00, '1 Metro', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S02M-06B', 'Siemon ZM6A-S02M-06B 2 Metros', 'Network', 13.50, '2 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S10M-06B', 'Siemon ZM6A-S10M-06B 10 Metros', 'Network', 27.00, '10 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S20M-06B', 'Siemon ZM6A-S20M-06B 20 Metros', 'Network', 49.00, '20 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S05-08B', 'Siemon ZM6A-S05-08B 05 Pies, 1.52 Metros', 'Network', 10.00, '05 Pies, 1.52 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S07-08B', 'Siemon ZM6A-S07-08B 07 Pies, 2.13 Metros', 'Network', 10.50, '07 Pies, 2.13 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S10-08B', 'Siemon ZM6A-S10-08B 10 Pies, 3.05 Metros', 'Network', 11.50, '10 Pies, 3.05 Metros', 'DISPONIBLE'),
  ('Siemon', 'PC6A-S001MA02LS', 'Siemon PC6A-S001MA02LS 3.2 Pies, 1 Metro', 'Network', 7.00, '3.2 Pies, 1 Metro', 'DISPONIBLE'),
  ('Siemon', 'PC6A-S003MA02LS', 'Siemon PC6A-S003MA02LS 9.8 Pies, 3 Metros', 'Network', 8.75, '9.8 Pies, 3 Metros', 'DISPONIBLE'),
  ('Siemon', 'PC6A-S001MA04LS', 'Siemon PC6A-S001MA04LS 3.2 Pies, 1 Metro', 'Network', 7.00, '3.2 Pies, 1 Metro', 'DISPONIBLE'),
  ('Siemon', 'PC6A-S003MA04LS', 'Siemon PC6A-S003MA04LS 9.8 Pies, 3 Metros', 'Network', 8.75, '9.8 Pies, 3 Metros', 'DISPONIBLE'),
  ('Siemon', 'PC6A-S001MA06LS', 'Siemon PC6A-S001MA06LS 3.2 Pies, 1 Metro', 'Network', 7.00, '3.2 Pies, 1 Metro', 'DISPONIBLE'),
  ('Siemon', 'PC6A-S002MA06LS', 'Siemon PC6A-S002MA06LS 6.5 Pies, 2 Metros', 'Network', 8.00, '6.5 Pies, 2 Metros', 'DISPONIBLE'),
  ('Siemon', 'PC6A-S005MA06LS', 'Siemon PC6A-S005MA06LS 16.4 Pies, 5 Metros', 'Network', 12.25, '16.4 Pies, 5 Metros', 'DISPONIBLE'),
  ('Siemon', 'PC6A-S007MA06LS', 'Siemon PC6A-S007MA06LS 23 Pies, 7 Metros', 'Network', 14.25, '23 Pies, 7 Metros', 'DISPONIBLE'),
  ('Siemon', 'KPNLS-F1-24-01S', 'Siemon KPNLS-F1-24-01S Patch Panel UTP Keystone de 24 puertos Modular (vacío), Blindado', 'Network', 38.00, 'Patch Panel UTP Keystone de 24 puertos Modular (vacío), Blindado, Plano, 1UR, compatible con Jacks Keystone UTP Z-MAX® y MAX®. Numeración frontal disponible. Material: Acero de peso ligero y acabado en color negro. Palancas de liberación para retirar Jacks', 'DISPONIBLE'),
  ('Siemon', 'KPNLS-A1-24-01S', 'Siemon KPNLS-A1-24-01S Patch Panel UTP Keystone de 24 puertos Modular (vacío), Blindado', 'Network', 55.00, 'Patch Panel UTP Keystone de 24 puertos Modular (vacío), Blindado, Angulado, 1UR, compatible con Jacks Keystone UTP Z-MAX® y MAX®. Numeración frontal disponible. Material: Acero de peso ligero y acabado en color negro. Palancas de liberación para retirar Jacks', 'DISPONIBLE'),
  ('Siemon', 'TM-PNLZ-24-01', 'Siemon TM-PNLZ-24-01 Cobre, Patch Panel, TERA-MAX / Z-MAX, Vacio, Blindado, 24 Puertos', 'Network', 63.00, 'Cobre, Patch Panel, TERA-MAX / Z-MAX, Vacio, Blindado, 24 Puertos, Plano, 1U, Negro, Administrador de cables fijo, Numeración frontal para una fácil identificación, Montable directamente en Rack estándar de 19in, Conexión a tierra integrada', 'DISPONIBLE'),
  ('Siemon', 'TM-PNLZA-24-01', 'Siemon TM-PNLZA-24-01 Cobre, Patch Panel, TERA-MAX / Z-MAX, Vacio, Blindado, 24 Puertos', 'Network', 65.00, 'Cobre, Patch Panel, TERA-MAX / Z-MAX, Vacio, Blindado, 24 Puertos, Angulado, 1U, Negro, Administrador de cables fijo, Numeración frontal para una fácil identificación, Montable directamente en Rack estándar de 19in, Conexión a tierra integrada', 'DISPONIBLE'),
  ('Siemon', 'Z6AS-PF-24', 'Siemon Z6AS-PF-24 Cobre, Patch Panel, Z-MAX, Blindado, 24 Puertos, Plano, 1U, Negro', 'Network', 315.00, 'Cobre, Patch Panel, Z-MAX, Blindado, 24 Puertos, Plano, 1U, Negro, Administrador de cables fijo, Numeración frontal para una fácil identificación, Montable directamente en Rack estándar de 19in, Conexión a tierra integrada, Incluye Jacks, Categoria 6A', 'DISPONIBLE'),
  ('Siemon', 'UP6A-F1-24K-RS', 'Siemon UP6A-F1-24K-RS 24 Puertos, Plano, 1U', 'Network', 240.00, '24 Puertos, Plano, 1U', 'DISPONIBLE'),
  ('Siemon', 'UP6A-F2-48K-RS', 'Siemon UP6A-F2-48K-RS 48 Puertos, Plano, 2U', 'Network', 425.00, '48 Puertos, Plano, 2U', 'DISPONIBLE'),
  ('Siemon', 'Z6A-S01B', 'Siemon Z6A-S01B Cobre, Jack, Outlet, ZMAX, Blindado, Categoria 6A, RJ45, Hybrid', 'Network', 7.00, 'Cobre, Jack, Outlet, ZMAX, Blindado, Categoria 6A, RJ45, Hybrid, Montaje híbrido en Placa de Pared (Plano y Angulado), Negro, Sin Herramientas, T568A/B, Paquete Granel, La solución punta a punta blindada Z-MAX 6A de Siemon combina el mejor (y consistente) desempeño en su clase', 'DISPONIBLE'),
  ('Siemon', 'Z6A-S02B', 'Siemon Z6A-S02B Cobre, Jack, Outlet, ZMAX, Blindado, Categoria 6A, RJ45, Hybrid', 'Network', 7.00, 'Cobre, Jack, Outlet, ZMAX, Blindado, Categoria 6A, RJ45, Hybrid, Montaje híbrido en Placa de Pared (Plano y Angulado), Blanco, Sin Herramientas, T568A/B, Paquete Granel, La solución punta a punta blindada Z-MAX 6A de Siemon combina el mejor (y consistente) desempeño en su clase', 'DISPONIBLE');

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
