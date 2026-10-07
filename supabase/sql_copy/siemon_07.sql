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
  ('Siemon', 'CTE-MXA-01-02', 'Siemon CTE-MXA-01-02 Adaptador para Placa de Pared CT, TERA-MAX, para ser montados en', 'Network', 1.00, 'Adaptador para Placa de Pared CT, TERA-MAX, para ser montados en conjunto con la placa de pared,...', 'DISPONIBLE'),
  ('Siemon', 'CTE-MXA-02-02', 'Siemon CTE-MXA-02-02 Adaptador para Placa de Pared CT, TERA-MAX, para ser montados en', 'Network', 1.50, 'Adaptador para Placa de Pared CT, TERA-MAX, para ser montados en conjunto con la placa de pared,...', 'DISPONIBLE'),
  ('Siemon', 'Z-BL-01', 'Siemon Z-BL-01 Panel Blank, Ciego, Z-PNL, Negro, Bolsa de 10 piezas', 'Network', 7.50, 'Panel Blank, Ciego, Z-PNL, Negro, Bolsa de 10 piezas', 'DISPONIBLE'),
  ('Siemon', 'MX-BL-02', 'Siemon MX-BL-02 Inserto Ciego Para Placas de Pared MAX y 10G MAX, Color Blanco, MAX', 'Network', 4.50, 'Inserto Ciego Para Placas de Pared MAX y 10G MAX, Color Blanco, MAX, Blanco, Bolsa de 10 piezas', 'DISPONIBLE'),
  ('Siemon', 'DIN-PNL-04-01', 'Siemon DIN-PNL-04-01 Cobre, Patch Panel, Ruggedized (Resistentes), UTP, 4 Salidas, Riel...', 'Network', 23.00, 'Cobre, Patch Panel, Ruggedized (Resistentes), UTP, 4 Salidas, Riel DIN, Negro, Salidas discretas', 'DISPONIBLE'),
  ('Siemon', 'DIN-PNLS-04-01', 'Siemon DIN-PNLS-04-01 Cobre, Panel de parcheo, Reforzado, Vacío, Apantallado, 4 aberturas', 'Network', 65.00, 'Cobre, Panel de parcheo, Reforzado, Vacío, Apantallado, 4 aberturas, Riel DIN, Negro, Aberturas d...', 'DISPONIBLE'),
  ('Siemon', 'MX-MMO-20', 'Siemon MX-MMO-20 Bandeja de gestión de fibra opcional permite el aislamiento y el', 'Network', 33.00, 'Bandeja de gestión de fibra opcional permite el aislamiento y el enrutamiento adecuado del cablea...', 'DISPONIBLE'),
  ('Siemon', 'RS1-07-S', 'Siemon RS1-07-S Rack de marco abierto de 2 postes. Incluye hardware de montaje del', 'Network', 330.00, 'Rack de marco abierto de 2 postes. Incluye hardware de montaje del bastidor, (30) tornillos n.° 1...', 'DISPONIBLE'),
  ('Siemon', 'RSQ1-07-S', 'Siemon RSQ1-07-S Tornillo ajustable n° 12-24', 'Network', 925.00, 'Tornillo ajustable n° 12-24', 'DISPONIBLE'),
  ('Siemon', 'RSQ1-07C-S', 'Siemon RSQ1-07C-S Tuerca de jaula ajustable', 'Network', 925.00, 'Tuerca de jaula ajustable', 'DISPONIBLE'),
  ('Siemon', 'V82A-2AB111-45F', 'Siemon V82A-2AB111-45F Gabinete V800 45 unidades de rack de altura. Ancho: 800mm (31.5 in)', 'Network', 2750.00, 'Gabinete V800 45 unidades de rack de altura. Ancho: 800mm (31.5 in). Profundidad: 1200mm (47.2 in...', 'DISPONIBLE'),
  ('Siemon', 'VCM1A-04D-1-45', 'Siemon VCM1A-04D-1-45 Organizador de Cable Vertical Serie Value para Alta Densidad, Dob...', 'Network', 395.00, 'Organizador de Cable Vertical Serie Value para Alta Densidad, Doble de 2 lados, dedos de 6" (152....', 'DISPONIBLE'),
  ('Siemon', 'VCM1A-06D-1-45', 'Siemon VCM1A-06D-1-45 Organizador de Cable Vertical Serie Value para Alta Densidad, Dob...', 'Network', 450.00, 'Organizador de Cable Vertical Serie Value para Alta Densidad, Doble de 2 lados, dedos de 6" (152....', 'DISPONIBLE'),
  ('Siemon', 'VCM1A-10D-1-45', 'Siemon VCM1A-10D-1-45 Organizador de Cable Vertical Serie Value para Alta Densidad, Dob...', 'Network', 620.00, 'Organizador de Cable Vertical Serie Value para Alta Densidad, Doble de 2 lados, dedos de 6" (152....', 'DISPONIBLE'),
  ('Siemon', 'VCM1A-04S-1-45', 'Siemon VCM1A-04S-1-45 Organizador de Cable Vertical Serie Value para Alta Densidad, Sen...', 'Network', 290.00, 'Organizador de Cable Vertical Serie Value para Alta Densidad, Sencillo de un solo lado, dedos de...', 'DISPONIBLE'),
  ('Siemon', 'VCM1A-06S-1-45', 'Siemon VCM1A-06S-1-45 Organizador de Cable Vertical Serie Value para Alta Densidad, Sen...', 'Network', 305.00, 'Organizador de Cable Vertical Serie Value para Alta Densidad, Sencillo de un solo lado, dedos de...', 'DISPONIBLE');

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
