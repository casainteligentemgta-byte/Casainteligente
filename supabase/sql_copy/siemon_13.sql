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
  ('Siemon', 'LVE-1U-MD-T01A', 'Siemon LVE-1U-MD-T01A Distribuidor de Fibra Óptica de Alta Densidad LigthVerse *Plus* Para', 'Network', 245.00, 'Distribuidor de Fibra Óptica de Alta Densidad LigthVerse *Plus* Para Rack de 19in, Acepta 4 Placa...', 'DISPONIBLE'),
  ('Siemon', 'LVE-1U-MD-P01A', 'Siemon LVE-1U-MD-P01A Distribuidor de Fibra Óptica de Alta Densidad LigthVerse *Pro* Para', 'Network', 370.00, 'Distribuidor de Fibra Óptica de Alta Densidad LigthVerse *Pro* Para Rack de 19in, Acepta 4 Placas...', 'DISPONIBLE'),
  ('Siemon', 'LVE-2U-MD-P01A', 'Siemon LVE-2U-MD-P01A Distribuidor de Fibra Óptica de Alta Densidad LigthVerse *Pro* Para', 'Network', 525.00, 'Distribuidor de Fibra Óptica de Alta Densidad LigthVerse *Pro* Para Rack de 19 Pulgadas (48.26 cm...', 'DISPONIBLE'),
  ('Siemon', 'LVE-4U-MD-P01A', 'Siemon LVE-4U-MD-P01A Distribuidor de Fibra Óptica de Alta Densidad LigthVerse *Pro* Para', 'Network', 589.00, 'Distribuidor de Fibra Óptica de Alta Densidad LigthVerse *Pro* Para Rack de 48.26 cm (19 Pulgadas...', 'DISPONIBLE'),
  ('Siemon', 'LV-RSM-KIT-A', 'Siemon LV-RSM-KIT-A Kit de carretes de fibra para gestor de cables trasero. Parte del', 'Network', 26.00, 'Kit de carretes de fibra para gestor de cables trasero. Parte del sistema de conectividad para Li...', 'DISPONIBLE'),
  ('Siemon', 'LVPC-1UAS01A', 'Siemon LVPC-1UAS01A Panel de fibra, Combo Lightverse, Montaje en rack, 1U, Acceso fijo', 'Network', 66.00, 'Panel de fibra, Combo Lightverse, Montaje en rack, 1U, Acceso fijo, Vacío, 4 aberturas, Negro, Ap...', 'DISPONIBLE'),
  ('Siemon', 'TRAYHD-1-A', 'Siemon TRAYHD-1-A Charola de empalme LightVerse para Fibra Óptica, 24 empalmes, Diseño', 'Network', 40.00, 'Charola de empalme LightVerse para Fibra Óptica, 24 empalmes, Diseño apilable Material Traslúcido...', 'DISPONIBLE'),
  ('Siemon', 'LVA-BLANK-01A', 'Siemon LVA-BLANK-01A Placa Ciega, Color Negro, Compatible con Distribuidores de Fibra ó...', 'Network', 2.50, 'Placa Ciega, Color Negro, Compatible con Distribuidores de Fibra óptica LightVerse Core, Plus y P...', 'DISPONIBLE'),
  ('Siemon', 'LVA12-LCQ-BC-A', 'Siemon LVA12-LCQ-BC-A Placa Acopladora Lightverse, 6 Conectores Dúplex LC/UPC "Shuttered"', 'Network', 45.00, 'Placa Acopladora Lightverse, 6 Conectores Dúplex LC/UPC "Shuttered", Acepta Hasta 12 Fibras Multi...', 'DISPONIBLE'),
  ('Siemon', 'LVA24-LCQ-BC-A', 'Siemon LVA24-LCQ-BC-A Placa Acopladora Lightverse, 12 Conectores Dúplex LC/UPC "Shuttered"', 'Network', 90.00, 'Placa Acopladora Lightverse, 12 Conectores Dúplex LC/UPC "Shuttered", Acepta Hasta 24 Fibras Mult...', 'DISPONIBLE'),
  ('Siemon', 'LVA24-LCU-BC-A', 'Siemon LVA24-LCU-BC-A Placa Acopladora LightVerse, 12 Conectores Dúplex LC/APC, Acepta...', 'Network', 110.00, 'Placa Acopladora LightVerse, 12 Conectores Dúplex LC/APC, Acepta hasta 24 fibras Monomodo (No Shu...', 'DISPONIBLE'),
  ('Siemon', 'LVCA-06-SA', 'Siemon LVCA-06-SA Placa adaptadora combinada LightVerse Combo, blindada', 'Network', 9.00, 'Placa adaptadora combinada LightVerse Combo, blindada', 'DISPONIBLE'),
  ('Siemon', 'LVCA-BLNK-A', 'Siemon LVCA-BLNK-A Placa adaptadora combinada LightVerse Combo, en blanco', 'Network', 7.50, 'Placa adaptadora combinada LightVerse Combo, en blanco', 'DISPONIBLE'),
  ('Siemon', 'LVM12TMLSV-BSCA', 'Siemon LVM12TMLSV-BSCA Módulo Plug & Play de alta densidad LightVerse. Fibra, LightVerse', 'Network', 205.00, 'Módulo Plug & Play de alta densidad LightVerse. Fibra, LightVerse, Módulo, Pérdida estándar, 12 f...', 'DISPONIBLE'),
  ('Siemon', 'LVM12TMLSU-BSCA', 'Siemon LVM12TMLSU-BSCA Módulo Plug & Play de alta densidad LightVerse. Fibra, LightVerse', 'Network', 215.00, 'Módulo Plug & Play de alta densidad LightVerse. Fibra, LightVerse, Módulo, Pérdida estándar, 12 f...', 'DISPONIBLE');

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
