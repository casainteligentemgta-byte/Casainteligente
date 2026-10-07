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
  ('Siemon', 'CLIP-07', 'Siemon CLIP-07 25 piezas Clip de identificación para Patch Cord Siemon MC / ZM, Color', 'Network', 4.00, '25 piezas Clip de identificación para Patch Cord Siemon MC / ZM, Color Verde, Bolsa con 25 piezas', 'DISPONIBLE'),
  ('Siemon', 'CLIP-08', 'Siemon CLIP-08 25 piezas Clip de identificación para Patch Cord Siemon MC / ZM, Color', 'Network', 4.00, '25 piezas Clip de identificación para Patch Cord Siemon MC / ZM, Color Violeta, Bolsa con 25 piezas', 'DISPONIBLE'),
  ('Siemon', 'Z-ICON-01B', 'Siemon Z-ICON-01B 100 piezas Icono ID UltraMax para identificación de Jacks Color : Negro', 'Network', 42.00, '100 piezas Icono ID UltraMax para identificación de Jacks Color : Negro Iconos rojos y azules con...', 'DISPONIBLE'),
  ('Siemon', 'Z-ICON-02B', 'Siemon Z-ICON-02B 100 piezas Icono ID UltraMax para identificación de Jacks Color :', 'Network', 42.00, '100 piezas Icono ID UltraMax para identificación de Jacks Color : Blanco Iconos rojos y azules co...', 'DISPONIBLE'),
  ('Siemon', 'Z-ICON-06B', 'Siemon Z-ICON-06B 100 piezas Icono ID UltraMax para identificación de Jacks Color : Azul', 'Network', 42.00, '100 piezas Icono ID UltraMax para identificación de Jacks Color : Azul Iconos rojos y azules con...', 'DISPONIBLE'),
  ('Siemon', 'CT4-BOX-02', 'Siemon CT4-BOX-02 Caja de Montaje Superficial, Para Placas de Pared (Face Plates)', 'Network', 3.50, 'Caja de Montaje Superficial, Para Placas de Pared (Face Plates) Universales, Color Blanco. Altura...', 'DISPONIBLE'),
  ('Siemon', 'KFP-S-01-02-S', 'Siemon KFP-S-01-02-S Faceplate, Placa de pared Keystone de 1 salida, color blanco, para', 'Network', 2.00, 'Faceplate, Placa de pared Keystone de 1 salida, color blanco, para Jacks Keystone. Flexibilidad d...', 'DISPONIBLE'),
  ('Siemon', 'KFP-S-02-02-S', 'Siemon KFP-S-02-02-S Faceplate, Placa de pared Keystone de 2 salidas, color blanco, para', 'Network', 2.00, 'Faceplate, Placa de pared Keystone de 2 salidas, color blanco, para Jacks Keystone. Flexibilidad...', 'DISPONIBLE'),
  ('Siemon', 'KFP-S-04-02-S', 'Siemon KFP-S-04-02-S Faceplate, Placa de pared Keystone de 4 salidas, color blanco, para', 'Network', 2.00, 'Faceplate, Placa de pared Keystone de 4 salidas, color blanco, para Jacks Keystone. Flexibilidad...', 'DISPONIBLE'),
  ('Siemon', 'MX-FP-S-01-02B', 'Siemon MX-FP-S-01-02B Faceplate, US, Placa de pared modular MAX, de 1 salida, color Blanco', 'Network', 2.00, 'Faceplate, US, Placa de pared modular MAX, de 1 salida, color Blanco, Flexibilidad de instalación...', 'DISPONIBLE'),
  ('Siemon', 'MX-FP-S-02-02B', 'Siemon MX-FP-S-02-02B Faceplate, US, Placa de pared modular MAX, de 2 salidas, color Bl...', 'Network', 2.00, 'Faceplate, US, Placa de pared modular MAX, de 2 salidas, color Blanco, Flexibilidad de instalació...', 'DISPONIBLE'),
  ('Siemon', 'MX-FP-S-04-02B', 'Siemon MX-FP-S-04-02B Faceplate, US, Placa de pared modular MAX, de 4 salidas, color Bl...', 'Network', 2.00, 'Faceplate, US, Placa de pared modular MAX, de 4 salidas, color Blanco, Flexibilidad de instalació...', 'DISPONIBLE'),
  ('Siemon', '10GMX-FPS02-02B', 'Siemon 10GMX-FPS02-02B Faceplate, Placa de Pared Modular 10G MAX de 2 Salidas, CMX, Color', 'Network', 2.50, 'Faceplate, Placa de Pared Modular 10G MAX de 2 Salidas, CMX, Color Blanco, Paquete Granel. Opcion...', 'DISPONIBLE'),
  ('Siemon', '10GMX-FPS04-02B', 'Siemon 10GMX-FPS04-02B Faceplate, Placa de Pared Modular 10G MAX de 4 Salidas, CMX, Color', 'Network', 2.50, 'Faceplate, Placa de Pared Modular 10G MAX de 4 Salidas, CMX, Color Blanco, Paquete Granel. Opcion...', 'DISPONIBLE'),
  ('Siemon', 'CT2-FP-02B', 'Siemon CT2-FP-02B Faceplate, CT, US, 1 Acoplador, 1 Salida, CT, Blanco, Etiquetas de', 'Network', 2.00, 'Faceplate, CT, US, 1 Acoplador, 1 Salida, CT, Blanco, Etiquetas de identificación que ocultan los...', 'DISPONIBLE');

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
