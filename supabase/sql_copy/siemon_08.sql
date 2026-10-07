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
  ('Siemon', 'VCM-S', 'Siemon VCM-S Accesorio para organizadores verticales. Kit de panel lateral para', 'Network', 335.00, 'Accesorio para organizadores verticales. Kit de panel lateral para organizadores de cables verticales de doble cara RouteIT™ de 177 mm x 457 mm (7 in x 18 in). Nota: El kit de panel lateral es un diseño de dos piezas compuesto por una pieza superior y una inferior e incluye hardware de montaje. Cubierta de final de fila, 7 pies x 18 pulgadas, color negro', 'DISPONIBLE'),
  ('Siemon', 'VCM-6', 'Siemon VCM-6 Organizador de Cable Vertical RouteIT, Sencillo de un solo lado, 45RU', 'Network', 610.00, 'Organizador de Cable Vertical RouteIT, Sencillo de un solo lado, 45RU, Fabricado en Acero Laminado en Frío 16AWG, 6" (152.4mm) de Ancho, Cableados de Alta Densidad, Puertas con doble bisagra para proteger y cubrir el cableado, Dedos reemplazables rápidamente si sufrieron algún daño. Operación de cierre de puerta para una apertura rápida, de fácil acceso y cierre de puerta en un solo punto. Color Negro', 'DISPONIBLE'),
  ('Siemon', 'VCM-10', 'Siemon VCM-10 Organizador de Cable Vertical RouteIT, Sencillo de un solo lado, 45RU', 'Network', 740.00, 'Organizador de Cable Vertical RouteIT, Sencillo de un solo lado, 45RU, Fabricado en Acero Laminado en Frío 16AWG, 10" (254 mm) de Ancho, Cableados de Alta Densidad, Puertas con doble bisagra para proteger y cubrir el cableado, Dedos reemplazables rápidamente si sufrieron algún daño. Operación de cierre de puerta para una apertura rápida, de fácil acceso y cierre de puerta en un solo punto. Color Negro', 'DISPONIBLE'),
  ('Siemon', 'V-TRAY-150-1-45', 'Siemon V-TRAY-150-1-45 Accesorio para Gabinetes series V600/V800 Bandeja Vertical Tray Ancho:', 'Network', 255.00, 'Accesorio para Gabinetes series V600/V800 Bandeja Vertical Tray Ancho: 150mm Color Negro Altura 45U Facil montaje de PDU / Cable Juego de 2 piezas Estas bandejas se pueden montar fácilmente en cualquier ubicación a lo largo de los rieles de gabinete de adelante hacia atrás de los gabinetes V600 y V800 y cuentan con orificios para montaje de PDU, cortes en forma de T para la administración de cables con bridas y aberturas para tuercas enjauladas de 9,5 mm (0,375 pulg.) para montaje de accesorios ', 'DISPONIBLE'),
  ('Siemon', 'VP-GRD', 'Siemon VP-GRD Kit de puesta a tierra: incluye barra de tierra, cable de tierra', 'Network', 200.00, 'Kit de puesta a tierra: incluye barra de tierra, cable de tierra, hardware de montaje y accesorios (capacidad para admitir todas las conexiones de puesta a tierra necesarias para un solo gabinete', 'DISPONIBLE'),
  ('Siemon', 'VP-SPL', 'Siemon VP-SPL Carrete de gestión de fibra de ¼ de vuelta (bolsa de 5) Se puede', 'Network', 17.00, 'Carrete de gestión de fibra de ¼ de vuelta (bolsa de 5) Se puede instalar en el canal de parcheo vertical y en el administrador de cables vertical de final de fila', 'DISPONIBLE'),
  ('Siemon', 'WM-143-5', 'Siemon WM-143-5 Organizador de Cable Horizontal para montaje aéreo, 5 soportes S143', 'Network', 33.00, 'Organizador de Cable Horizontal para montaje aéreo, 5 soportes S143, 1U, De un solo lado, Ancho 19 pulgadas, Color Negro', 'DISPONIBLE'),
  ('Siemon', 'WM-144-5', 'Siemon WM-144-5 Organizador de Cable Horizontal para montaje aéreo, 5 soportes S144', 'Network', 38.00, 'Organizador de Cable Horizontal para montaje aéreo, 5 soportes S144, 2U, De un solo lado, Ancho 19 pulgadas, Color Negro', 'DISPONIBLE'),
  ('Siemon', 'WM-145-5', 'Siemon WM-145-5 Organizador de Cable Horizontal para montaje aéreo, 5 soportes S145', 'Network', 45.00, 'Organizador de Cable Horizontal para montaje aéreo, 5 soportes S145, 2U, De un solo lado, Ancho 19 pulgadas, Color Negro', 'DISPONIBLE'),
  ('Siemon', 'HCM-4-1U', 'Siemon HCM-4-1U Organizador de Cable Horizontal RouteIT, Sencillo, 4" de profundidad', 'Network', 38.00, 'Organizador de Cable Horizontal RouteIT, Sencillo, 4" de profundidad, Rackeable 19", 1U, Cubierta Estandar, Cableados de Alta Densidad, Puertas con doble bisagra para proteger y cubrir el cableado. Color Negro', 'DISPONIBLE'),
  ('Siemon', 'HCM-4-2U', 'Siemon HCM-4-2U Organizador de Cable Horizontal RouteIT, Sencillo, 4" de profundidad', 'Network', 57.00, 'Organizador de Cable Horizontal RouteIT, Sencillo, 4" de profundidad, Rackeable 19", 2U, Cubierta Estandar, Cableados de Alta Densidad, Puertas con doble bisagra para proteger y cubrir el cableado. Color Negro', 'DISPONIBLE'),
  ('Siemon', 'HCM-6-1U', 'Siemon HCM-6-1U Organizador de Cable Horizontal RouteIT, Sencillo, 4" de profundidad', 'Network', 48.00, 'Organizador de Cable Horizontal RouteIT, Sencillo, 4" de profundidad, Rackeable 19", 1U, Cubierta Estandar, Cableados de Alta Densidad, Puertas con doble bisagra para proteger y cubrir el cableado. Color Negro', 'DISPONIBLE'),
  ('Siemon', 'HCM-6-2U', 'Siemon HCM-6-2U Organizador de Cable Horizontal RouteIT, Sencillo, 4" de profundidad', 'Network', 75.00, 'Organizador de Cable Horizontal RouteIT, Sencillo, 4" de profundidad, Rackeable 19", 2U, Cubierta Estandar, Cableados de Alta Densidad, Puertas con doble bisagra para proteger y cubrir el cableado. Color Negro', 'DISPONIBLE'),
  ('Siemon', 'PNL-BLNK-1', 'Siemon PNL-BLNK-1 Panel Ciego Horizontal para Rack estándar de 19", 1UR, Color Negro con', 'Network', 20.00, 'Panel Ciego Horizontal para Rack estándar de 19", 1UR, Color Negro con el logo de SIEMON, Instalación fácil y rápida, mejora el rendimiento térmico al impedir el flujo de aire a través de espacios vacíos', 'DISPONIBLE'),
  ('Siemon', 'PNL-BLNK-2', 'Siemon PNL-BLNK-2 Panel Ciego Horizontal para Rack estándar de 19", 2UR, Color Negro con', 'Network', 26.00, 'Panel Ciego Horizontal para Rack estándar de 19", 2UR, Color Negro con el logo de SIEMON, Instalación fácil y rápida, mejora el rendimiento térmico al impedir el flujo de aire a través de espacios vacíos', 'DISPONIBLE');

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
