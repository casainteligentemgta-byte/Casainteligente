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
  ('Siemon', '9T7L4-E10', 'Siemon 9T7L4-E10 Cable, Cobre, Categoria 7A , E10, 4 Pares, Sólido, Blindado S/FTP', 'Network', 375.00, 'Cable, Cobre, Categoria 7A , E10, 4 Pares, Sólido, Blindado S/FTP , LSOH-1/3-22 (Bajo humo, Cero Halógenos), Violeta , Inmune a la interferencia electromagnética, ruido eléctrico, electricidad estática y fuentes de radiofrecuencia, supera todos los requisitos de la norma ISO/IEC para la calidad de transmisión en Categoría 7A/Clase FA , Carrete, 305 Metros, 23 AWG, Class Dca-s1a,d1,a1', 'TRANSITO'),
  ('Siemon', 'T2E2-02M-B06L', 'Siemon T2E2-02M-B06L Cobre, Patch Cord, TERA 2-Pares, Conector Modular RJ45, Categoria 5e', 'Network', 16.00, 'Cobre, Patch Cord, TERA 2-Pares, Conector Modular RJ45, Categoria 5e, Blindado F/UTP, 10/100GBASET, Trenzado, LSOH-1, Marfil Cable, Bota Azul, 2 Metros, 26 AWG', 'DISPONIBLE'),
  ('Siemon', 'T4A-S02M-B06L', 'Siemon T4A-S02M-B06L Cobre, Patch Cord, TERA 4-Pares, Conector Modular RJ45, Categoria 6A', 'Network', 22.00, 'Cobre, Patch Cord, TERA 4-Pares, Conector Modular RJ45, Categoria 6A, 1/10G, S/FTP, T568B, Trenzado, CM/LSOH-1, Marfil Cable, Bota Azul, 2 Metros, 26 AWG', 'DISPONIBLE'),
  ('Siemon', 'T4-03M-B01L', 'Siemon T4-03M-B01L Cobre, Patch Cord, TERA 4-Pares, Conector Modular RJ45, Compatible con', 'Network', 36.00, 'Cobre, Patch Cord, TERA 4-Pares, Conector Modular RJ45, Compatible con categoría 7A, S/FTP, TERA a TERA, CM/LS0H, chaqueta blanca, bota Negra, 3 Metros, 26 AWG', 'DISPONIBLE'),
  ('Siemon', 'T4-03M-B06L', 'Siemon T4-03M-B06L Cobre, Patch Cord, TERA 4-Pares, Conector Modular RJ45, Compatible con', 'Network', 36.00, 'Cobre, Patch Cord, TERA 4-Pares, Conector Modular RJ45, Compatible con categoría 7A, S/FTP, TERA a TERA, CM/LS0H, chaqueta blanca, bota Azul, 3 Metros, 26 AWG', 'DISPONIBLE'),
  ('Siemon', 'T7F-01-1', 'Siemon T7F-01-1 Cobre, Outlet, TERA, Blindado, Categoria 7A/8, TERA, Plano, Negro, Sin', 'Network', 15.50, 'Cobre, Outlet, TERA, Blindado, Categoria 7A/8, TERA, Plano, Negro, Sin Herramientas, Terminación rápida y fácil, T568A/B, con Puerta Protectora contra polvo y contaminantes, 22-23 AWG', 'DISPONIBLE'),
  ('Siemon', 'T7P4-B01-1', 'Siemon T7P4-B01-1 Cobre, Plug, TERA, Blindado, Categoria 7A/8, TERA, 4 Pares, Bota Negro', 'Network', 12.50, 'Cobre, Plug, TERA, Blindado, Categoria 7A/8, TERA, 4 Pares, Bota Negro, Sin Herramientas, Terminación rápida y fácil, T568A/B, 22-23 AWG', 'DISPONIBLE'),
  ('Siemon', 'T7P4-B01-2', 'Siemon T7P4-B01-2 Cobre, Plug, TERA, Blindado, Categoria 7A/8, TERA, 4 Pares, Bota', 'Network', 12.50, 'Cobre, Plug, TERA, Blindado, Categoria 7A/8, TERA, 4 Pares, Bota Blanca, Sin Herramientas, Terminación rápida y fácil, T568A/B, 22-23 AWG', 'DISPONIBLE'),
  ('Siemon', '9A6L4-A5', 'Siemon 9A6L4-A5 Cable, Cobre, Categoria 6A , A5, 4 Pares, Sólido, Blindado F/UTP', 'Network', 255.00, 'Cable, Cobre, Categoria 6A , A5, 4 Pares, Sólido, Blindado F/UTP , LSOH- 1/3-22 (Libre de Gases Toxicos), Violeta , Soporta Aplicaciones 10GBase- T , Excede los requermientos ANSI/TIA-568.2-D y ISO/IEC 11801 Class EA , Carrete, 305 Metros, 23 AWG, Class Dca-s2,d2,a1 , Frecuencia: 500MHz , Tensión máxima: 110N, Clasificación de temperatura: 0 a 60°C en instalación y -20 a 75°C en operación', 'DISPONIBLE'),
  ('Siemon', '9A6L4-A5-06', 'Siemon 9A6L4-A5-06 Cable, Cobre, Categoria 6A , A5, 4 Pares, Sólido, Blindado F/UTP', 'Network', 255.00, 'Cable, Cobre, Categoria 6A , A5, 4 Pares, Sólido, Blindado F/UTP , LSOH- 1/3-22 (Libre de Gases Toxicos), Azul , Soporta Aplicaciones 10GBase-T , Excede los requermientos ANSI/TIA-568.2-D y ISO/IEC 11801 Class EA , Carrete, 305 Metros, 23 AWG, Class Dca-s2,d2,a1 , Frecuencia: 500MHz , Tensión máxima: 110N, Clasificación de temperatura: 0 a 60°C en instalación y -20 a 75°C en operación', 'DISPONIBLE'),
  ('Siemon', '9A6O4-A5-01AR1A', 'Siemon 9A6O4-A5-01AR1A Exterior Negro Bobina de Cable Cat6A F/UTP Blindado lámina de aluminio', 'Network', 449.00, 'Exterior Negro Bobina de Cable Cat6A F/UTP Blindado lámina de aluminio para protección contra ruido EMI o RFI . Planta Externa ( OSP ), Para Exterior con Gel para bloqueo de agua, Cat6A (23 AWG), Industrial para Climas Extremos , Enterrado Directo, Lash Aéreo, Tubería o Conductos Subterráneos. Color Negro, 305M. Temperatura de operación: 75ºC . Chaqueta de Polilefino (PE) con Protección contra Rayos UV . Separador de pares cruzados. Soporte de aplicaciones robustas como 10GBASE-T, PoE+ y HDBaseT', 'DISPONIBLE'),
  ('Siemon', 'SP6A-S01-06B', 'Siemon SP6A-S01-06B 01 Pies, 0.30 Metros', 'Network', 11.00, '01 Pies, 0.30 Metros', 'DISPONIBLE'),
  ('Siemon', 'SP6A-S02-06B', 'Siemon SP6A-S02-06B 02 Pies, 0.61 Metros', 'Network', 11.50, '02 Pies, 0.61 Metros', 'DISPONIBLE'),
  ('Siemon', 'SP6A-S03-06B', 'Siemon SP6A-S03-06B 03 Pies, 0.91 Metros', 'Network', 12.00, '03 Pies, 0.91 Metros', 'DISPONIBLE'),
  ('Siemon', 'SP6A-S05-06B', 'Siemon SP6A-S05-06B 05 Pies, 1.52 Metros', 'Network', 12.50, '05 Pies, 1.52 Metros', 'DISPONIBLE'),
  ('Siemon', 'SP6A-S07-06B', 'Siemon SP6A-S07-06B 07 Pies, 2.13 Metros', 'Network', 13.50, '07 Pies, 2.13 Metros', 'DISPONIBLE'),
  ('Siemon', 'SP6A-S10-06B', 'Siemon SP6A-S10-06B 10 Pies, 3.05 Metros', 'Network', 15.00, '10 Pies, 3.05 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S01-04B', 'Siemon ZM6A-S01-04B 01 Pies, 0.30 Metros', 'Network', 11.00, '01 Pies, 0.30 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S02-04B', 'Siemon ZM6A-S02-04B 02 Pies, 0.61 Metros', 'Network', 11.50, '02 Pies, 0.61 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S03-04B', 'Siemon ZM6A-S03-04B 03 Pies, 0.91 Metros', 'Network', 12.00, '03 Pies, 0.91 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S05-04B', 'Siemon ZM6A-S05-04B 05 Pies, 1.52 Metros', 'Network', 12.50, '05 Pies, 1.52 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S07-04B', 'Siemon ZM6A-S07-04B 07 Pies, 2.13 Metros', 'Network', 13.50, '07 Pies, 2.13 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S10-04B', 'Siemon ZM6A-S10-04B 10 Pies, 3.05 Metros', 'Network', 15.00, '10 Pies, 3.05 Metros', 'DISPONIBLE');

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
