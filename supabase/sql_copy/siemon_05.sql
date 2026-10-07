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
  ('Siemon', 'P6U-8-8', 'Siemon P6U-8-8 50 piezas Cobre, RJ45, Categoría 6, Negro, 8 Posiciones, Para Cable UTP', 'Network', 39.00, '50 piezas Cobre, RJ45, Categoría 6, Negro, 8 Posiciones, Para Cable UTP Calibre 23 a 26 AWG, Chapado en Oro de 50 micras, 8 Conductores, No incluye bota, Policarbonato, UL 94 V0, Certificación RoHS, Normas normas TIA- 968-A y IEC 60603-7, sin plomo, sin halógenos y sin PVC, Bolsa con 50 piezas', 'DISPONIBLE'),
  ('Siemon', 'MC5-03-0202B', 'Siemon MC5-03-0202B 03 Pies, 0.91 Metros', 'Network', 3.00, '03 Pies, 0.91 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC5-05-0202B', 'Siemon MC5-05-0202B 05 Pies, 1.52 Metros', 'Network', 3.50, '05 Pies, 1.52 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC5-07-0202B', 'Siemon MC5-07-0202B 07 Pies, 2.13 Metros', 'Network', 4.00, '07 Pies, 2.13 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC5-10-0202B', 'Siemon MC5-10-0202B 10 Pies, 3.05 Metros', 'Network', 4.50, '10 Pies, 3.05 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC5-03-0404B', 'Siemon MC5-03-0404B 03 Pies, 0.91 Metros', 'Network', 3.00, '03 Pies, 0.91 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC5-05-0404B', 'Siemon MC5-05-0404B 05 Pies, 1.52 Metros', 'Network', 3.50, '05 Pies, 1.52 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC5-07-0404B', 'Siemon MC5-07-0404B 07 Pies, 2.13 Metros', 'Network', 4.00, '07 Pies, 2.13 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC5-10-0404B', 'Siemon MC5-10-0404B 10 Pies, 3.05 Metros', 'Network', 4.50, '10 Pies, 3.05 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC5-03-0606B', 'Siemon MC5-03-0606B 03 Pies, 0.91 Metros', 'Network', 3.00, '03 Pies, 0.91 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC5-05-0606B', 'Siemon MC5-05-0606B 05 Pies, 1.52 Metros', 'Network', 3.50, '05 Pies, 1.52 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC5-07-0606B', 'Siemon MC5-07-0606B 07 Pies, 2.13 Metros', 'Network', 4.00, '07 Pies, 2.13 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC5-10-0606B', 'Siemon MC5-10-0606B 10 Pies, 3.05 Metros', 'Network', 4.50, '10 Pies, 3.05 Metros', 'DISPONIBLE'),
  ('Siemon', 'UP5-F1-24L-RS', 'Siemon UP5-F1-24L-RS 24 Puertos, Plano, 1U Patch Panel UltraMAX. UTP (Sin blindaje)', 'Network', 85.00, '24 Puertos, Plano, 1U Patch Panel UltraMAX. UTP (Sin blindaje), Precargado con Jacks Cat5e/Clase EA. Viene con los Jacks en la caja, para facilitar la terminación donde sea necesario. Cumple con: ANSI/TIA-568.2-D, ANSI/TIA 1096-A, ISO/IEC 11801-1 Ed. 1.0, IEC 60603-7-41, ETL Prueba de Canal, UL 1863. Incluye organizador de cables trasero para ayudar a liberar tensión del cable y se pueden desmontar si es necesario. La construcción de los paneles es de acero de alta calidad con un revestimiento r', 'DISPONIBLE'),
  ('Siemon', 'HD5-24B', 'Siemon HD5-24B Cobre, Patch Panel, HD, Precargado, UTP, Categoria 5e, 24 Puertos', 'Network', 85.00, 'Cobre, Patch Panel, HD, Precargado, UTP, Categoria 5e, 24 Puertos, Plano, 1U, Negro, sin Administrador de Cable, Paquete Granel', 'DISPONIBLE'),
  ('Siemon', 'P-8-8', 'Siemon P-8-8 1 pieza Cobre, RJ45, Categoría 5e, Negro, 8 Posiciones, Para Cable UTP', 'Network', 0.35, '1 pieza Cobre, RJ45, Categoría 5e, Negro, 8 Posiciones, Para Cable UTP Calibre 22 a 26 AWG, Chapado en Oro de 50 micras, 8 Conductores, No incluye bota, Policarbonato, UL 94 V0, Certificación RoHS, Normas normas TIA-968-A y IEC 60603-7, sin plomo, sin halógenos y sin PVC', 'DISPONIBLE'),
  ('Siemon', 'CLIP-03', 'Siemon CLIP-03 25 piezas Clip de identificación para Patch Cord Siemon MC / ZM, Color', 'Network', 4.00, '25 piezas Clip de identificación para Patch Cord Siemon MC / ZM, Color Rojo, Bolsa con 25 piezas', 'DISPONIBLE'),
  ('Siemon', 'CLIP-05', 'Siemon CLIP-05 25 piezas Clip de identificación para Patch Cord Siemon MC / ZM, Color', 'Network', 4.00, '25 piezas Clip de identificación para Patch Cord Siemon MC / ZM, Color Amarillo, Bolsa con 25 piezas', 'DISPONIBLE'),
  ('Siemon', 'CLIP-06', 'Siemon CLIP-06 25 piezas Clip de identificación para Patch Cord Siemon MC / ZM, Color', 'Network', 4.00, '25 piezas Clip de identificación para Patch Cord Siemon MC / ZM, Color Azul, Bolsa con 25 piezas', 'DISPONIBLE'),
  ('Siemon', 'CLIP-07', 'Siemon CLIP-07 25 piezas Clip de identificación para Patch Cord Siemon MC / ZM, Color', 'Network', 4.00, '25 piezas Clip de identificación para Patch Cord Siemon MC / ZM, Color Verde, Bolsa con 25 piezas', 'DISPONIBLE'),
  ('Siemon', 'CLIP-08', 'Siemon CLIP-08 25 piezas Clip de identificación para Patch Cord Siemon MC / ZM, Color', 'Network', 4.00, '25 piezas Clip de identificación para Patch Cord Siemon MC / ZM, Color Violeta, Bolsa con 25 piezas', 'DISPONIBLE'),
  ('Siemon', 'Z-ICON-01B', 'Siemon Z-ICON-01B 100 piezas Icono ID UltraMax para identificación de Jacks Color : Negro', 'Network', 42.00, '100 piezas Icono ID UltraMax para identificación de Jacks Color : Negro Iconos rojos y azules con símbolos de voz y datos 1 icono blanco en blanco para designación de campo Paquete de 100 unidades', 'DISPONIBLE'),
  ('Siemon', 'Z-ICON-02B', 'Siemon Z-ICON-02B 100 piezas Icono ID UltraMax para identificación de Jacks Color :', 'Network', 42.00, '100 piezas Icono ID UltraMax para identificación de Jacks Color : Blanco Iconos rojos y azules con símbolos de voz y datos 1 icono blanco en blanco para designación de campo Paquete de 100 unidades', 'DISPONIBLE'),
  ('Siemon', 'Z-ICON-06B', 'Siemon Z-ICON-06B 100 piezas Icono ID UltraMax para identificación de Jacks Color : Azul', 'Network', 42.00, '100 piezas Icono ID UltraMax para identificación de Jacks Color : Azul Iconos rojos y azules con símbolos de voz y datos. 1 icono blanco en blanco para designación de campo Paquete de 100 unidades', 'DISPONIBLE'),
  ('Siemon', 'CT4-BOX-02', 'Siemon CT4-BOX-02 Caja de Montaje Superficial, Para Placas de Pared (Face Plates)', 'Network', 3.50, 'Caja de Montaje Superficial, Para Placas de Pared (Face Plates) Universales, Color Blanco. Altura: 119.3mm (4.70 in.) Ancho: 74.8mm (2.95 in.) Profundidad: 40.6mm (1.60 in.', 'DISPONIBLE');

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
