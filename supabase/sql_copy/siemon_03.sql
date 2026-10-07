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
  ('Siemon', 'Z6A-S06B', 'Siemon Z6A-S06B Cobre, Jack, Outlet, ZMAX, Blindado, Categoria 6A, RJ45, Hybrid', 'Network', 7.00, 'Cobre, Jack, Outlet, ZMAX, Blindado, Categoria 6A, RJ45, Hybrid, Montaje híbrido en Placa de Pared (Plano y Angulado), Azul, Sin Herramientas, T568A/B, Paquete Granel, La solución punta a punta blindada Z-MAX 6A de Siemon combina el mejor (y consistente) desempeño en su clase', 'DISPONIBLE'),
  ('Siemon', 'Z6A-S63', 'Siemon Z6A-S63 Cobre, Jack, Outlet, ZMAX, Blindado, Categoria 6A, RJ45, Hybrid', 'Network', 8.00, 'Cobre, Jack, Outlet, ZMAX, Blindado, Categoria 6A, RJ45, Hybrid, Montaje híbrido en Placa de Pared (Plano y Angulado), Violeta, Sin Herramientas, T568A/B, Paquete Granel, La solución punta a punta blindada Z-MAX 6A de Siemon combina el mejor (y consistente) desempeño en su clase', 'DISPONIBLE'),
  ('Siemon', 'Z6A-SK01B', 'Siemon Z6A-SK01B Cobre, Jack, Outlet, Keystone, UltraMAX, Blindado, Categoria 6A, RJ45', 'Network', 7.00, 'Cobre, Jack, Outlet, Keystone, UltraMAX, Blindado, Categoria 6A, RJ45, Hybrid, Montaje híbrido en Placa de Pared (Plano y Angulado), Negro, Sin Herramientas, T568A/B, Paquete Granel, La solución punta a punta blindada Z-MAX 6A de Siemon combina el mejor (y consistente) desempeño en su clase', 'DISPONIBLE'),
  ('Siemon', 'Z6A-SK02B', 'Siemon Z6A-SK02B Cobre, Jack, Outlet, Keystone, UltraMAX, Blindado, Categoria 6A, RJ45', 'Network', 7.00, 'Cobre, Jack, Outlet, Keystone, UltraMAX, Blindado, Categoria 6A, RJ45, Hybrid, Montaje híbrido en Placa de Pared (Plano y Angulado), Blanco, Sin Herramientas, T568A/B, Paquete Granel, La solución punta a punta blindada Z-MAX 6A de Siemon combina el mejor (y consistente) desempeño en su clase', 'DISPONIBLE'),
  ('Siemon', 'U6A-H01NB', 'Siemon U6A-H01NB Jack UltraMAX Cat6A, UTP, Montaje híbrido en Faceplate (Plano y', 'Network', 6.00, 'Jack UltraMAX Cat6A, UTP, Montaje híbrido en Faceplate (Plano y Angulado), Color Negro, Punch Down. T568A/B. Diseño de lazado lineal único que permite a los usuarios terminar sus conexiones desde cualquier lado y obtener una terminación rápida y consistente. Cumple con RoHS. Clasificación de Flamabilidad: UL 94 V-0. Paquete Granel', 'DISPONIBLE'),
  ('Siemon', 'U6A-H02NB', 'Siemon U6A-H02NB Jack UltraMAX Cat6A, UTP, Montaje híbrido en Faceplate (Plano y', 'Network', 6.00, 'Jack UltraMAX Cat6A, UTP, Montaje híbrido en Faceplate (Plano y Angulado), Color Blanco, Punch Down. T568A/B. Diseño de lazado lineal único que permite a los usuarios terminar sus conexiones desde cualquier lado y obtener una terminación rápida y consistente. Cumple con RoHS. Clasificación de Flamabilidad: UL 94 V-0. Paquete Granel', 'DISPONIBLE'),
  ('Siemon', 'U6A-H06NB', 'Siemon U6A-H06NB Jack UltraMAX Cat6A, UTP, Montaje híbrido en Faceplate (Plano y', 'Network', 6.00, 'Jack UltraMAX Cat6A, UTP, Montaje híbrido en Faceplate (Plano y Angulado), Color Azul, Punch Down. T568A/B. Diseño de lazado lineal único que permite a los usuarios terminar sus conexiones desde cualquier lado y obtener una terminación rápida y consistente. Cumple con RoHS. Clasificación de Flamabilidad: UL 94 V-0. Paquete Granel', 'DISPONIBLE'),
  ('Siemon', 'ZP1-6AS-01B', 'Siemon ZP1-6AS-01B Cobre, RJ45, Z-Plug, Blindado, 6A, Negro, Straight, Terminación en', 'Network', 11.00, 'Cobre, RJ45, Z-Plug, Blindado, 6A, Negro, Straight, Terminación en Campo, Compatible con Todas las Categorías, Con Clip Protector de Seguro y Bota, Los Plugs cumplen con UL 2043, Paquete Granel, ideales para Instalaciones de Cámaras IP Megapixel, Access Points, 10BASE-T, 100BASE-T, 1000BASE-T, 10GBASE-T, HDBase-T', 'DISPONIBLE'),
  ('Siemon', '9C6M4-E2-RXA', 'Siemon 9C6M4-E2-RXA Color Gris', 'Network', 185.00, 'Color Gris', 'DISPONIBLE'),
  ('Siemon', '9C6M4-E2-06-RXA', 'Siemon 9C6M4-E2-06-RXA Color Azul', 'Network', 185.00, 'Color Azul', 'DISPONIBLE'),
  ('Siemon', '9C6O4-E2-01-R1A', 'Siemon 9C6O4-E2-01-R1A Exterior Negro Cable, Cobre, Categoria 6 , Exterior , E2, 4 Pares', 'Network', 255.00, 'Exterior Negro Cable, Cobre, Categoria 6 , Exterior , E2, 4 Pares, Sólido, UTP, OSP (Outside Plant), Color Negro, Carreteex, Diseño de bobina tipo REELEX® para fácil jalado e instalación (sin nudos), 305 Metros, Conductor de cobre solido calibre 23 AWG de baja perdida , Class Eca, Alto desempeño , cumpliendo con los estándares TIA/EIA e ISO/IEC, Industrial para Climas Extremos , Enterrado Directo, Fuerte chaqueta de poliolefina, resistente a los rayos UV. Relleno de gel (no conductor) bloqueador', 'DISPONIBLE'),
  ('Siemon', 'MC6-01-04B', 'Siemon MC6-01-04B 01 Pies, 0.30 Metros', 'Network', 4.50, '01 Pies, 0.30 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC6-02-04B', 'Siemon MC6-02-04B 02 Pies, 0.61 Metros', 'Network', 4.75, '02 Pies, 0.61 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC6-03-04B', 'Siemon MC6-03-04B 03 Pies, 0.91 Metros', 'Network', 5.00, '03 Pies, 0.91 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC6-05-04B', 'Siemon MC6-05-04B 05 Pies, 1.52 Metros', 'Network', 5.50, '05 Pies, 1.52 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC6-07-04B', 'Siemon MC6-07-04B 07 Pies, 2.13 Metros', 'Network', 5.50, '07 Pies, 2.13 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC6-10-04B', 'Siemon MC6-10-04B 10 Pies, 3.05 Metros', 'Network', 6.50, '10 Pies, 3.05 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC6-01-06B', 'Siemon MC6-01-06B 01 Pies, 0.30 Metros', 'Network', 4.50, '01 Pies, 0.30 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC6-02-06B', 'Siemon MC6-02-06B 02 Pies, 0.61 Metros', 'Network', 4.75, '02 Pies, 0.61 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC6-03-06B', 'Siemon MC6-03-06B 03 Pies, 0.91 Metros', 'Network', 5.00, '03 Pies, 0.91 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC6-05-06B', 'Siemon MC6-05-06B 05 Pies, 1.52 Metros', 'Network', 5.50, '05 Pies, 1.52 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC6-07-06B', 'Siemon MC6-07-06B 07 Pies, 2.13 Metros', 'Network', 5.50, '07 Pies, 2.13 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC6-10-06B', 'Siemon MC6-10-06B 10 Pies, 3.05 Metros', 'Network', 6.50, '10 Pies, 3.05 Metros', 'DISPONIBLE');

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
