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
  ('Siemon', 'LVS24-LCPVRAB1A', 'Siemon LVS24-LCPVRAB1A Cassette para Empalme (Fusión) LightVerse de fibra óptica de 24...', 'Network', 375.00, 'Cassette para Empalme (Fusión) LightVerse de fibra óptica de 24 puertos LC OM4, Adaptodres color...', 'DISPONIBLE'),
  ('Siemon', 'TRAY-3', 'Siemon TRAY-3 Bandeja de Empalme para Fibra Óptica, Para 24 Empalmes por Fusión Con', 'Network', 31.00, 'Bandeja de Empalme para Fibra Óptica, Para 24 Empalmes por Fusión Con Manga Protectora', 'DISPONIBLE'),
  ('Siemon', 'RIC-F-BLNK-01', 'Siemon RIC-F-BLNK-01 Placa adaptadora Quick-Pack, Ciega, Plana, RIC, Housing Color Negro', 'Network', 3.00, 'Placa adaptadora Quick-Pack, Ciega, Plana, RIC, Housing Color Negro', 'DISPONIBLE'),
  ('Siemon', 'RIC-F-LCQ12-01C', 'Siemon RIC-F-LCQ12-01C Placa acopladora de Fibra Óptica Quick-Pack, Con 6 Conectores LC...', 'Network', 41.00, 'Placa acopladora de Fibra Óptica Quick-Pack, Con 6 Conectores LC Duplex (12 Fibras), RIC, Para Fi...', 'DISPONIBLE'),
  ('Siemon', 'RIC-F-LCU12-01C', 'Siemon RIC-F-LCU12-01C Placa acopladora de Fibra Óptica Quick-Pack, Con 6 Conectores LC...', 'Network', 52.50, 'Placa acopladora de Fibra Óptica Quick-Pack, Con 6 Conectores LC/UPC Duplex (12 Fibras), RIC, Par...', 'DISPONIBLE');

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
