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
  ('Siemon', 'MX-MMO-20', 'Siemon MX-MMO-20 Bandeja de gestión de fibra opcional permite el aislamiento y el', 'Network', 33.00, 'Bandeja de gestión de fibra opcional permite el aislamiento y el enrutamiento adecuado del cableado de fibra óptica. Conjunto de tomacorrientes para telecomunicaciones multiusuario, MUTOA, 18 aberturas, MX, marfil. Compatibilidad de la serie de tomacorrientes: UltraMAX (híbrido), Z-MAX (híbrido), TERA, MAX (plano y en ángulo). Esta caja de montaje en superficie multiusuario/multimedia de perfil bajo es insuperable en cuanto a características y flexibilidad, y es ideal para su uso como conjunto d', 'DISPONIBLE'),
  ('Siemon', 'RS1-07-S', 'Siemon RS1-07-S Rack de marco abierto de 2 postes. Incluye hardware de montaje del', 'Network', 330.00, 'Rack de marco abierto de 2 postes. Incluye hardware de montaje del bastidor, (30) tornillos n.° 12-24 y (2) tuercas de conexión a tierra. Value Rack de Siemon proporciona una solución económica y duradera para montar y asegurar equipos TI en espacios de telecomunicaciones. Con unión y conexión a tierra integradas, marcas de espacio U visibles y compatibilidad con la gama completa de soluciones de gestión de cables de Siemon, Value Rack ahorra tiempo, mano de obra y espacio en una variedad de ins', 'DISPONIBLE'),
  ('Siemon', 'RSQ1-07-S', 'Siemon RSQ1-07-S Tornillo ajustable n° 12-24', 'Network', 925.00, 'Tornillo ajustable n° 12-24', 'DISPONIBLE'),
  ('Siemon', 'RSQ1-07C-S', 'Siemon RSQ1-07C-S Tuerca de jaula ajustable', 'Network', 925.00, 'Tuerca de jaula ajustable', 'DISPONIBLE'),
  ('Siemon', 'V82A-2AB111-45F', 'Siemon V82A-2AB111-45F Gabinete V800 45 unidades de rack de altura. Ancho: 800mm (31.5 in)', 'Network', 2750.00, 'Gabinete V800 45 unidades de rack de altura. Ancho: 800mm (31.5 in). Profundidad: 1200mm (47.2 in.). 2 Paneles laterales, Puerta delantera: totalmente ventilada. Puerta trasera: Ventilación dividida. Tipo de Cerradura: Con llave. Sin ruedas. Color: Negro (RAL 9011). Empaquetado plano. Clasificación de carga: Estática: 1000 kg (2204,6 lbs.). Dinámico: 714 kg (1574,1 libras). Identificación del espacio U: Sí (de abajo hacia arriba). Cumplimiento de estándares: EIA/ECA-310-E, IP20. Solución de gabi', 'DISPONIBLE'),
  ('Siemon', 'VCM1A-04D-1-45', 'Siemon VCM1A-04D-1-45 Organizador de Cable Vertical Serie Value para Alta Densidad, Doble de', 'Network', 395.00, 'Organizador de Cable Vertical Serie Value para Alta Densidad, Doble de 2 lados, dedos de 6" (152.4mm), 45RU, Ancho de 4" (101.6mm), Fabricado en Acero Laminado en Frio. Puertas con bisagras dobles con manjias de liberación por Resorte. Soporte de anclaje para asegurar el sistema al piso. Acoplamientos sin necesidad de herramientas. Super ligero, 100% termoplastico de alta resistencia.', 'DISPONIBLE'),
  ('Siemon', 'VCM1A-06D-1-45', 'Siemon VCM1A-06D-1-45 Organizador de Cable Vertical Serie Value para Alta Densidad, Doble de', 'Network', 450.00, 'Organizador de Cable Vertical Serie Value para Alta Densidad, Doble de 2 lados, dedos de 6" (152.4mm), 45RU, Ancho de 6" (152.4mm), Fabricado en Acero Laminado en Frio. Puertas con bisagras dobles con manjias de liberación por Resorte. Soporte de anclaje para asegurar el sistema al piso. Acoplamientos sin necesidad de herramientas. Super ligero, 100% termoplastico de alta resistencia.', 'DISPONIBLE'),
  ('Siemon', 'VCM1A-10D-1-45', 'Siemon VCM1A-10D-1-45 Organizador de Cable Vertical Serie Value para Alta Densidad, Doble de', 'Network', 620.00, 'Organizador de Cable Vertical Serie Value para Alta Densidad, Doble de 2 lados, dedos de 6" (152.4mm), 45RU, Ancho de 10" (254.0mm), Fabricado en Acero Laminado en Frio. Puertas con bisagras dobles con manjias de liberación por Resorte. Soporte de anclaje para asegurar el sistema al piso. Acoplamientos sin necesidad de herramientas. Super ligero, 100% termoplastico de alta resistencia.', 'DISPONIBLE'),
  ('Siemon', 'VCM1A-04S-1-45', 'Siemon VCM1A-04S-1-45 Organizador de Cable Vertical Serie Value para Alta Densidad, Sencillo', 'Network', 290.00, 'Organizador de Cable Vertical Serie Value para Alta Densidad, Sencillo de un solo lado, dedos de 6" (152.4mm), 45RU, Ancho de 4" (101.6mm), Fabricado en Acero Laminado en Frio. Puertas con bisagras dobles con manjias de liberación por Resorte. Soporte de anclaje para asegurar el sistema al piso. Acoplamientos sin necesidad de herramientas. Super ligero, 100% termoplastico de alta resistencia.', 'DISPONIBLE'),
  ('Siemon', 'VCM1A-06S-1-45', 'Siemon VCM1A-06S-1-45 Organizador de Cable Vertical Serie Value para Alta Densidad, Sencillo', 'Network', 305.00, 'Organizador de Cable Vertical Serie Value para Alta Densidad, Sencillo de un solo lado, dedos de 6" (152.4mm), 45RU, Ancho de 6" (152.4mm), Fabricado en Acero Laminado en Frio. Puertas con bisagras dobles con manjias de liberación por Resorte. Soporte de anclaje para asegurar el sistema al piso. Acoplamientos sin necesidad de herramientas. Super ligero, 100% termoplastico de alta resistencia.', 'DISPONIBLE'),
  ('Siemon', 'VCM1A-10S-1-45', 'Siemon VCM1A-10S-1-45 Organizador de Cable Vertical Serie Value para Alta Densidad, Sencillo', 'Network', 425.00, 'Organizador de Cable Vertical Serie Value para Alta Densidad, Sencillo de un solo lado, dedos de 6" (152.4mm), 45RU, Ancho de 10" (254.0mm), Fabricado en Acero Laminado en Frio. Puertas con bisagras dobles con manjias de liberación por Resorte. Soporte de anclaje para asegurar el sistema al piso. Acoplamientos sin necesidad de herramientas. Super ligero, 100% termoplastico de alta resistencia.', 'DISPONIBLE'),
  ('Siemon', 'V8A-VPC4-1-45', 'Siemon V8A-VPC4-1-45 Dedos de 4" (102 mm', 'Network', 178.00, 'Dedos de 4" (102 mm', 'DISPONIBLE'),
  ('Siemon', 'V8A-VPC6-1-45', 'Siemon V8A-VPC6-1-45 Dedos de 6" (152mm', 'Network', 158.00, 'Dedos de 6" (152mm', 'DISPONIBLE'),
  ('Siemon', 'VCM1A-SPD-1-45', 'Siemon VCM1A-SPD-1-45 Organizador de cables, 7 pies, negro, cubierta de final de fila para', 'Network', 300.00, 'Organizador de cables, 7 pies, negro, cubierta de final de fila para doble cara', 'DISPONIBLE');

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
