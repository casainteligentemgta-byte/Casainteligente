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
  ('Siemon', 'KFP-S-01-02-S', 'Siemon KFP-S-01-02-S Faceplate, Placa de pared Keystone de 1 salida, color blanco, para', 'Network', 2.00, 'Faceplate, Placa de pared Keystone de 1 salida, color blanco, para Jacks Keystone. Flexibilidad de instalación: Pestaña de montaje que permite la instalación del conector por la parte delantera o trasera de la placa. Alta densidad: Se pueden adaptar hasta 6 salidas en una sola placa de pared o 12 con doble placa de pared. Etiquetado: Cuenta con espacio para etiqueta de fácil instalación.', 'DISPONIBLE'),
  ('Siemon', 'KFP-S-02-02-S', 'Siemon KFP-S-02-02-S Faceplate, Placa de pared Keystone de 2 salidas, color blanco, para', 'Network', 2.00, 'Faceplate, Placa de pared Keystone de 2 salidas, color blanco, para Jacks Keystone. Flexibilidad de instalación: Pestaña de montaje que permite la instalación del conector por la parte delantera o trasera de la placa. Alta densidad: Se pueden adaptar hasta 6 salidas en una sola placa de pared o 12 con doble placa de pared. Etiquetado: Cuenta con espacio para etiqueta de fácil instalación.', 'DISPONIBLE'),
  ('Siemon', 'KFP-S-04-02-S', 'Siemon KFP-S-04-02-S Faceplate, Placa de pared Keystone de 4 salidas, color blanco, para', 'Network', 2.00, 'Faceplate, Placa de pared Keystone de 4 salidas, color blanco, para Jacks Keystone. Flexibilidad de instalación: Pestaña de montaje que permite la instalación del conector por la parte delantera o trasera de la placa. Alta densidad: Se pueden adaptar hasta 6 salidas en una sola placa de pared o 12 con doble placa de pared. Etiquetado: Cuenta con espacio para etiqueta de fácil instalación.', 'DISPONIBLE'),
  ('Siemon', 'MX-FP-S-01-02B', 'Siemon MX-FP-S-01-02B Faceplate, US, Placa de pared modular MAX, de 1 salida, color Blanco', 'Network', 2.00, 'Faceplate, US, Placa de pared modular MAX, de 1 salida, color Blanco, Flexibilidad de instalación: Pestaña de montaje que permite la instalación del conector por la parte delantera o trasera de la placa. Etiquetado: Las placas de pared cuenta con espacio para etiqueta de fácil instalación, Paquete Granel', 'DISPONIBLE'),
  ('Siemon', 'MX-FP-S-02-02B', 'Siemon MX-FP-S-02-02B Faceplate, US, Placa de pared modular MAX, de 2 salidas, color Blanco', 'Network', 2.00, 'Faceplate, US, Placa de pared modular MAX, de 2 salidas, color Blanco, Flexibilidad de instalación: Pestaña de montaje que permite la instalación del conector por la parte delantera o trasera de la placa. Etiquetado: Las placas de pared cuenta con espacio para etiqueta de fácil instalación, Paquete Granel', 'DISPONIBLE'),
  ('Siemon', 'MX-FP-S-04-02B', 'Siemon MX-FP-S-04-02B Faceplate, US, Placa de pared modular MAX, de 4 salidas, color Blanco', 'Network', 2.00, 'Faceplate, US, Placa de pared modular MAX, de 4 salidas, color Blanco, Flexibilidad de instalación: Pestaña de montaje que permite la instalación del conector por la parte delantera o trasera de la placa. Etiquetado: Las placas de pared cuenta con espacio para etiqueta de fácil instalación, Paquete Granel', 'DISPONIBLE'),
  ('Siemon', '10GMX-FPS02-02B', 'Siemon 10GMX-FPS02-02B Faceplate, Placa de Pared Modular 10G MAX de 2 Salidas, CMX, Color', 'Network', 2.50, 'Faceplate, Placa de Pared Modular 10G MAX de 2 Salidas, CMX, Color Blanco, Paquete Granel. Opciones de densidad: Placas de pared individuales y dobles disponibles. Durabilidad: Resistente a rayos UV, plástico de alto impacto que evita la degradación del color y proporciona mayor durabilidad. Soporte de Etiquetas: Incluyen etiquetas de identificación de fácil liberación sin necesitad de herramienta', 'DISPONIBLE'),
  ('Siemon', '10GMX-FPS04-02B', 'Siemon 10GMX-FPS04-02B Faceplate, Placa de Pared Modular 10G MAX de 4 Salidas, CMX, Color', 'Network', 2.50, 'Faceplate, Placa de Pared Modular 10G MAX de 4 Salidas, CMX, Color Blanco, Paquete Granel. Opciones de densidad: Placas de pared individuales y dobles disponibles. Durabilidad: Resistente a rayos UV, plástico de alto impacto que evita la degradación del color y proporciona mayor durabilidad. Soporte de Etiquetas: Incluyen etiquetas de identificación de fácil liberación sin necesitad de herramienta', 'DISPONIBLE'),
  ('Siemon', 'CT2-FP-02B', 'Siemon CT2-FP-02B Faceplate, CT, US, 1 Acoplador, 1 Salida, CT, Blanco, Etiquetas de', 'Network', 2.00, 'Faceplate, CT, US, 1 Acoplador, 1 Salida, CT, Blanco, Etiquetas de identificación que ocultan los tornillos del montaje, resistentes a Rayos UV, plástico de alto impacto que evita la degradación del color y proporciona una mayor durabilidad, Paquete Granel', 'DISPONIBLE'),
  ('Siemon', 'CTE-MXA-01-02', 'Siemon CTE-MXA-01-02 Adaptador para Placa de Pared CT, TERA-MAX, para ser montados en', 'Network', 1.00, 'Adaptador para Placa de Pared CT, TERA-MAX, para ser montados en conjunto con la placa de pared, de una salida , Angulado, MX, color Blanco', 'DISPONIBLE'),
  ('Siemon', 'CTE-MXA-02-02', 'Siemon CTE-MXA-02-02 Adaptador para Placa de Pared CT, TERA-MAX, para ser montados en', 'Network', 1.50, 'Adaptador para Placa de Pared CT, TERA-MAX, para ser montados en conjunto con la placa de pared, de dos salidas , Angulado, MX, color Blanco', 'DISPONIBLE'),
  ('Siemon', 'Z-BL-01', 'Siemon Z-BL-01 Panel Blank, Ciego, Z-PNL, Negro, Bolsa de 10 piezas', 'Network', 7.50, 'Panel Blank, Ciego, Z-PNL, Negro, Bolsa de 10 piezas', 'DISPONIBLE'),
  ('Siemon', 'MX-BL-02', 'Siemon MX-BL-02 Inserto Ciego Para Placas de Pared MAX y 10G MAX, Color Blanco, MAX', 'Network', 4.50, 'Inserto Ciego Para Placas de Pared MAX y 10G MAX, Color Blanco, MAX, Blanco, Bolsa de 10 piezas', 'DISPONIBLE'),
  ('Siemon', 'DIN-PNL-04-01', 'Siemon DIN-PNL-04-01 Cobre, Patch Panel, Ruggedized (Resistentes), UTP, 4 Salidas, Riel DIN', 'Network', 23.00, 'Cobre, Patch Panel, Ruggedized (Resistentes), UTP, 4 Salidas, Riel DIN, Negro, Salidas discretas', 'DISPONIBLE'),
  ('Siemon', 'DIN-PNLS-04-01', 'Siemon DIN-PNLS-04-01 Cobre, Panel de parcheo, Reforzado, Vacío, Apantallado, 4 aberturas', 'Network', 65.00, 'Cobre, Panel de parcheo, Reforzado, Vacío, Apantallado, 4 aberturas, Riel DIN, Negro, Aberturas discretas', 'DISPONIBLE');

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
