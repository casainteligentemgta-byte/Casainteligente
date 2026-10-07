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
  ('Siemon', 'LVA24-LCU-BC-A', 'Siemon LVA24-LCU-BC-A Placa Acopladora LightVerse, 12 Conectores Dúplex LC/APC, Acepta hasta', 'Network', 110.00, 'Placa Acopladora LightVerse, 12 Conectores Dúplex LC/APC, Acepta hasta 24 fibras Monomodo (No Shuttered). Las placas adaptadoras LightVerse proporcionan conexiones de fibra de paso de alto rendimiento en un espacio compacto. El pestillo integrado permite una fácil instalación y extracción con una sola mano, lo que permite a los usuarios trabajar de manera eficiente incluso en los entornos más densos. Tipo de conector: LC. Recuento de fibras: 24', 'DISPONIBLE'),
  ('Siemon', 'LVCA-06-SA', 'Siemon LVCA-06-SA Placa adaptadora combinada LightVerse Combo, blindada', 'Network', 9.00, 'Placa adaptadora combinada LightVerse Combo, blindada', 'DISPONIBLE'),
  ('Siemon', 'LVCA-BLNK-A', 'Siemon LVCA-BLNK-A Placa adaptadora combinada LightVerse Combo, en blanco', 'Network', 7.50, 'Placa adaptadora combinada LightVerse Combo, en blanco', 'DISPONIBLE'),
  ('Siemon', 'LVM12TMLSV-BSCA', 'Siemon LVM12TMLSV-BSCA Módulo Plug & Play de alta densidad LightVerse. Fibra, LightVerse', 'Network', 205.00, 'Módulo Plug & Play de alta densidad LightVerse. Fibra, LightVerse, Módulo, Pérdida estándar, 12 fibras, Connector A LC Shutter color Aqua, Conector B MTP macho color Aqua, Carcasa negra, sistema XGLO, Multimodo, Polaridad C, OM4, 8.3/125, Base 12', 'DISPONIBLE'),
  ('Siemon', 'LVM12TMLSU-BSCA', 'Siemon LVM12TMLSU-BSCA Módulo Plug & Play de alta densidad LightVerse. Fibra, LightVerse', 'Network', 215.00, 'Módulo Plug & Play de alta densidad LightVerse. Fibra, LightVerse, Módulo, Pérdida estándar, 12 fibras, Connector A LCU Shutter color Azul, Conector B MTP macho color Negro, Carcasa negra, sistema XGLO, Monomodo, Polaridad C, OS2, 8.3/125, Base 12', 'DISPONIBLE'),
  ('Siemon', 'LVS24-LCPVRAB1A', 'Siemon LVS24-LCPVRAB1A Cassette para Empalme (Fusión) LightVerse de fibra óptica de 24 puertos', 'Network', 375.00, 'Cassette para Empalme (Fusión) LightVerse de fibra óptica de 24 puertos LC OM4, Adaptodres color Aqua, tipo Cassette de empalme, Cable Riser tipo Riser de 900 μm de 1 metro (3.28 Pies), carcasa negra. Capacidad de 96 empalmes por 1U con gabinetes LightVerse. Diseño de dos capas con bandeja de separación extraíble. Chip apilable para fusión masiva e individual. Material translúcido para fácil verificación y pruebas, correa de tracción integrada para una extracción trasera rápida', 'DISPONIBLE'),
  ('Siemon', 'TRAY-3', 'Siemon TRAY-3 Bandeja de Empalme para Fibra Óptica, Para 24 Empalmes por Fusión Con', 'Network', 31.00, 'Bandeja de Empalme para Fibra Óptica, Para 24 Empalmes por Fusión Con Manga Protectora', 'DISPONIBLE'),
  ('Siemon', 'RIC-F-BLNK-01', 'Siemon RIC-F-BLNK-01 Placa adaptadora Quick-Pack, Ciega, Plana, RIC, Housing Color Negro', 'Network', 3.00, 'Placa adaptadora Quick-Pack, Ciega, Plana, RIC, Housing Color Negro', 'DISPONIBLE'),
  ('Siemon', 'RIC-F-LCQ12-01C', 'Siemon RIC-F-LCQ12-01C Placa acopladora de Fibra Óptica Quick-Pack, Con 6 Conectores LC Duplex', 'Network', 41.00, 'Placa acopladora de Fibra Óptica Quick-Pack, Con 6 Conectores LC Duplex (12 Fibras), RIC, Para Fibra Multimodo, Plano, Adaptador Aqua, Housing Negro, Manga Ceramica', 'DISPONIBLE'),
  ('Siemon', 'RIC-F-LCU12-01C', 'Siemon RIC-F-LCU12-01C Placa acopladora de Fibra Óptica Quick-Pack, Con 6 Conectores LC/UPC', 'Network', 52.50, 'Placa acopladora de Fibra Óptica Quick-Pack, Con 6 Conectores LC/UPC Duplex (12 Fibras), RIC, Para Fibra Monomodo, Adaptador Azul, Housing Negro, Manga Ceramica', 'DISPONIBLE');

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
