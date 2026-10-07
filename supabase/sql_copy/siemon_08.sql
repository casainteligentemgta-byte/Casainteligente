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
  ('Siemon', 'VCM1A-10S-1-45', 'Siemon VCM1A-10S-1-45 Organizador de Cable Vertical Serie Value para Alta Densidad, Sen...', 'Network', 425.00, 'Organizador de Cable Vertical Serie Value para Alta Densidad, Sencillo de un solo lado, dedos de...', 'DISPONIBLE'),
  ('Siemon', 'V8A-VPC4-1-45', 'Siemon V8A-VPC4-1-45 Dedos de 4" (102 mm', 'Network', 178.00, 'Dedos de 4" (102 mm', 'DISPONIBLE'),
  ('Siemon', 'V8A-VPC6-1-45', 'Siemon V8A-VPC6-1-45 Dedos de 6" (152mm', 'Network', 158.00, 'Dedos de 6" (152mm', 'DISPONIBLE'),
  ('Siemon', 'VCM1A-SPD-1-45', 'Siemon VCM1A-SPD-1-45 Organizador de cables, 7 pies, negro, cubierta de final de fila para', 'Network', 300.00, 'Organizador de cables, 7 pies, negro, cubierta de final de fila para doble cara', 'DISPONIBLE'),
  ('Siemon', 'VCM-S', 'Siemon VCM-S Accesorio para organizadores verticales. Kit de panel lateral para', 'Network', 335.00, 'Accesorio para organizadores verticales. Kit de panel lateral para organizadores de cables vertic...', 'DISPONIBLE'),
  ('Siemon', 'VCM-6', 'Siemon VCM-6 Organizador de Cable Vertical RouteIT, Sencillo de un solo lado, 45RU', 'Network', 610.00, 'Organizador de Cable Vertical RouteIT, Sencillo de un solo lado, 45RU, Fabricado en Acero Laminad...', 'DISPONIBLE'),
  ('Siemon', 'VCM-10', 'Siemon VCM-10 Organizador de Cable Vertical RouteIT, Sencillo de un solo lado, 45RU', 'Network', 740.00, 'Organizador de Cable Vertical RouteIT, Sencillo de un solo lado, 45RU, Fabricado en Acero Laminad...', 'DISPONIBLE'),
  ('Siemon', 'V-TRAY-150-1-45', 'Siemon V-TRAY-150-1-45 Accesorio para Gabinetes series V600/V800 Bandeja Vertical Tray...', 'Network', 255.00, 'Accesorio para Gabinetes series V600/V800 Bandeja Vertical Tray Ancho: 150mm Color Negro Altura 4...', 'DISPONIBLE'),
  ('Siemon', 'VP-GRD', 'Siemon VP-GRD Kit de puesta a tierra: incluye barra de tierra, cable de tierra', 'Network', 200.00, 'Kit de puesta a tierra: incluye barra de tierra, cable de tierra, hardware de montaje y accesorio...', 'DISPONIBLE'),
  ('Siemon', 'VP-SPL', 'Siemon VP-SPL Carrete de gestión de fibra de ¼ de vuelta (bolsa de 5) Se puede', 'Network', 17.00, 'Carrete de gestión de fibra de ¼ de vuelta (bolsa de 5) Se puede instalar en el canal de parcheo...', 'DISPONIBLE'),
  ('Siemon', 'WM-143-5', 'Siemon WM-143-5 Organizador de Cable Horizontal para montaje aéreo, 5 soportes S143', 'Network', 33.00, 'Organizador de Cable Horizontal para montaje aéreo, 5 soportes S143, 1U, De un solo lado, Ancho 1...', 'DISPONIBLE'),
  ('Siemon', 'WM-144-5', 'Siemon WM-144-5 Organizador de Cable Horizontal para montaje aéreo, 5 soportes S144', 'Network', 38.00, 'Organizador de Cable Horizontal para montaje aéreo, 5 soportes S144, 2U, De un solo lado, Ancho 1...', 'DISPONIBLE'),
  ('Siemon', 'WM-145-5', 'Siemon WM-145-5 Organizador de Cable Horizontal para montaje aéreo, 5 soportes S145', 'Network', 45.00, 'Organizador de Cable Horizontal para montaje aéreo, 5 soportes S145, 2U, De un solo lado, Ancho 1...', 'DISPONIBLE'),
  ('Siemon', 'HCM-4-1U', 'Siemon HCM-4-1U Organizador de Cable Horizontal RouteIT, Sencillo, 4" de profundidad', 'Network', 38.00, 'Organizador de Cable Horizontal RouteIT, Sencillo, 4" de profundidad, Rackeable 19", 1U, Cubierta...', 'DISPONIBLE'),
  ('Siemon', 'HCM-4-2U', 'Siemon HCM-4-2U Organizador de Cable Horizontal RouteIT, Sencillo, 4" de profundidad', 'Network', 57.00, 'Organizador de Cable Horizontal RouteIT, Sencillo, 4" de profundidad, Rackeable 19", 2U, Cubierta...', 'DISPONIBLE'),
  ('Siemon', 'HCM-6-1U', 'Siemon HCM-6-1U Organizador de Cable Horizontal RouteIT, Sencillo, 4" de profundidad', 'Network', 48.00, 'Organizador de Cable Horizontal RouteIT, Sencillo, 4" de profundidad, Rackeable 19", 1U, Cubierta...', 'DISPONIBLE');

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
