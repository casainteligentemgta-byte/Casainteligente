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
  ('Siemon', 'ZM6A-S10-04B', 'Siemon ZM6A-S10-04B 10 Pies, 3.05 Metros', 'Network', 15.00, '10 Pies, 3.05 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S01-06B', 'Siemon ZM6A-S01-06B 01 Pies, 0.30 Metros', 'Network', 11.00, '01 Pies, 0.30 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S02-06B', 'Siemon ZM6A-S02-06B 02 Pies, 0.61 Metros', 'Network', 11.50, '02 Pies, 0.61 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S03-06B', 'Siemon ZM6A-S03-06B 03 Pies, 0.91 Metros', 'Network', 12.00, '03 Pies, 0.91 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S05-06B', 'Siemon ZM6A-S05-06B 05 Pies, 1.52 Metros', 'Network', 12.50, '05 Pies, 1.52 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S07-06B', 'Siemon ZM6A-S07-06B 07 Pies, 2.13 Metros', 'Network', 13.50, '07 Pies, 2.13 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S10-06B', 'Siemon ZM6A-S10-06B 10 Pies, 3.05 Metros', 'Network', 15.00, '10 Pies, 3.05 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S01M-06B', 'Siemon ZM6A-S01M-06B 1 Metro', 'Network', 12.00, '1 Metro', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S02M-06B', 'Siemon ZM6A-S02M-06B 2 Metros', 'Network', 13.50, '2 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S10M-06B', 'Siemon ZM6A-S10M-06B 10 Metros', 'Network', 27.00, '10 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S20M-06B', 'Siemon ZM6A-S20M-06B 20 Metros', 'Network', 49.00, '20 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S05-08B', 'Siemon ZM6A-S05-08B 05 Pies, 1.52 Metros', 'Network', 10.00, '05 Pies, 1.52 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S07-08B', 'Siemon ZM6A-S07-08B 07 Pies, 2.13 Metros', 'Network', 10.50, '07 Pies, 2.13 Metros', 'DISPONIBLE'),
  ('Siemon', 'ZM6A-S10-08B', 'Siemon ZM6A-S10-08B 10 Pies, 3.05 Metros', 'Network', 11.50, '10 Pies, 3.05 Metros', 'DISPONIBLE'),
  ('Siemon', 'PC6A-S001MA02LS', 'Siemon PC6A-S001MA02LS 3.2 Pies, 1 Metro', 'Network', 7.00, '3.2 Pies, 1 Metro', 'DISPONIBLE'),
  ('Siemon', 'PC6A-S003MA02LS', 'Siemon PC6A-S003MA02LS 9.8 Pies, 3 Metros', 'Network', 8.75, '9.8 Pies, 3 Metros', 'DISPONIBLE'),
  ('Siemon', 'PC6A-S001MA04LS', 'Siemon PC6A-S001MA04LS 3.2 Pies, 1 Metro', 'Network', 7.00, '3.2 Pies, 1 Metro', 'DISPONIBLE'),
  ('Siemon', 'PC6A-S003MA04LS', 'Siemon PC6A-S003MA04LS 9.8 Pies, 3 Metros', 'Network', 8.75, '9.8 Pies, 3 Metros', 'DISPONIBLE'),
  ('Siemon', 'PC6A-S001MA06LS', 'Siemon PC6A-S001MA06LS 3.2 Pies, 1 Metro', 'Network', 7.00, '3.2 Pies, 1 Metro', 'DISPONIBLE'),
  ('Siemon', 'PC6A-S002MA06LS', 'Siemon PC6A-S002MA06LS 6.5 Pies, 2 Metros', 'Network', 8.00, '6.5 Pies, 2 Metros', 'DISPONIBLE'),
  ('Siemon', 'PC6A-S005MA06LS', 'Siemon PC6A-S005MA06LS 16.4 Pies, 5 Metros', 'Network', 12.25, '16.4 Pies, 5 Metros', 'DISPONIBLE'),
  ('Siemon', 'PC6A-S007MA06LS', 'Siemon PC6A-S007MA06LS 23 Pies, 7 Metros', 'Network', 14.25, '23 Pies, 7 Metros', 'DISPONIBLE'),
  ('Siemon', 'KPNLS-F1-24-01S', 'Siemon KPNLS-F1-24-01S Patch Panel UTP Keystone de 24 puertos Modular (vacío), Blindado', 'Network', 38.00, 'Patch Panel UTP Keystone de 24 puertos Modular (vacío), Blindado, Plano, 1UR, compatible con Jacks Keystone UTP Z-MAX® y MAX®. Numeración frontal disponible. Material: Acero de peso ligero y acabado en color negro. Palancas de liberación para retirar Jacks', 'DISPONIBLE'),
  ('Siemon', 'KPNLS-A1-24-01S', 'Siemon KPNLS-A1-24-01S Patch Panel UTP Keystone de 24 puertos Modular (vacío), Blindado', 'Network', 55.00, 'Patch Panel UTP Keystone de 24 puertos Modular (vacío), Blindado, Angulado, 1UR, compatible con Jacks Keystone UTP Z-MAX® y MAX®. Numeración frontal disponible. Material: Acero de peso ligero y acabado en color negro. Palancas de liberación para retirar Jacks', 'DISPONIBLE'),
  ('Siemon', 'TM-PNLZ-24-01', 'Siemon TM-PNLZ-24-01 Cobre, Patch Panel, TERA-MAX / Z-MAX, Vacio, Blindado, 24 Puertos', 'Network', 63.00, 'Cobre, Patch Panel, TERA-MAX / Z-MAX, Vacio, Blindado, 24 Puertos, Plano, 1U, Negro, Administrador de cables fijo, Numeración frontal para una fácil identificación, Montable directamente en Rack estándar de 19in, Conexión a tierra integrada', 'DISPONIBLE'),
  ('Siemon', 'TM-PNLZA-24-01', 'Siemon TM-PNLZA-24-01 Cobre, Patch Panel, TERA-MAX / Z-MAX, Vacio, Blindado, 24 Puertos', 'Network', 65.00, 'Cobre, Patch Panel, TERA-MAX / Z-MAX, Vacio, Blindado, 24 Puertos, Angulado, 1U, Negro, Administrador de cables fijo, Numeración frontal para una fácil identificación, Montable directamente en Rack estándar de 19in, Conexión a tierra integrada', 'DISPONIBLE'),
  ('Siemon', 'Z6AS-PF-24', 'Siemon Z6AS-PF-24 Cobre, Patch Panel, Z-MAX, Blindado, 24 Puertos, Plano, 1U, Negro', 'Network', 315.00, 'Cobre, Patch Panel, Z-MAX, Blindado, 24 Puertos, Plano, 1U, Negro, Administrador de cables fijo, Numeración frontal para una fácil identificación, Montable directamente en Rack estándar de 19in, Conexión a tierra integrada, Incluye Jacks, Categoria 6A', 'DISPONIBLE'),
  ('Siemon', 'UP6A-F1-24K-RS', 'Siemon UP6A-F1-24K-RS 24 Puertos, Plano, 1U', 'Network', 240.00, '24 Puertos, Plano, 1U', 'DISPONIBLE'),
  ('Siemon', 'UP6A-F2-48K-RS', 'Siemon UP6A-F2-48K-RS 48 Puertos, Plano, 2U', 'Network', 425.00, '48 Puertos, Plano, 2U', 'DISPONIBLE'),
  ('Siemon', 'Z6A-S01B', 'Siemon Z6A-S01B Cobre, Jack, Outlet, ZMAX, Blindado, Categoria 6A, RJ45, Hybrid', 'Network', 7.00, 'Cobre, Jack, Outlet, ZMAX, Blindado, Categoria 6A, RJ45, Hybrid, Montaje híbrido en Placa de Pared (Plano y Angulado), Negro, Sin Herramientas, T568A/B, Paquete Granel, La solución punta a punta blindada Z-MAX 6A de Siemon combina el mejor (y consistente) desempeño en su clase', 'DISPONIBLE'),
  ('Siemon', 'Z6A-S02B', 'Siemon Z6A-S02B Cobre, Jack, Outlet, ZMAX, Blindado, Categoria 6A, RJ45, Hybrid', 'Network', 7.00, 'Cobre, Jack, Outlet, ZMAX, Blindado, Categoria 6A, RJ45, Hybrid, Montaje híbrido en Placa de Pared (Plano y Angulado), Blanco, Sin Herramientas, T568A/B, Paquete Granel, La solución punta a punta blindada Z-MAX 6A de Siemon combina el mejor (y consistente) desempeño en su clase', 'DISPONIBLE'),
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
  ('Siemon', 'MC6-10-06B', 'Siemon MC6-10-06B 10 Pies, 3.05 Metros', 'Network', 6.50, '10 Pies, 3.05 Metros', 'DISPONIBLE'),
  ('Siemon', 'PC6-001M-A02LS', 'Siemon PC6-001M-A02LS 3.2 Pies, 1 Metro', 'Network', 4.50, '3.2 Pies, 1 Metro', 'DISPONIBLE'),
  ('Siemon', 'PC6-002M-A02LS', 'Siemon PC6-002M-A02LS 6.5 Pies, 2 Metros', 'Network', 5.50, '6.5 Pies, 2 Metros', 'DISPONIBLE'),
  ('Siemon', 'PC6-003M-A02LS', 'Siemon PC6-003M-A02LS 9.8 Pies, 3 Metros', 'Network', 6.00, '9.8 Pies, 3 Metros', 'DISPONIBLE'),
  ('Siemon', 'PC6-001M-A06LS', 'Siemon PC6-001M-A06LS 3.2 Pies, 1 Metro', 'Network', 4.00, '3.2 Pies, 1 Metro', 'DISPONIBLE'),
  ('Siemon', 'PC6-002M-A06LS', 'Siemon PC6-002M-A06LS 6.5 Pies, 2 Metros', 'Network', 5.00, '6.5 Pies, 2 Metros', 'DISPONIBLE'),
  ('Siemon', 'PC6-003M-A06LS', 'Siemon PC6-003M-A06LS 9.8 Pies, 3 Metros', 'Network', 6.00, '9.8 Pies, 3 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC6-02-06-28B', 'Siemon MC6-02-06-28B 02 Pies, 0.61 Metros', 'Network', 5.00, '02 Pies, 0.61 Metros', 'DISPONIBLE'),
  ('Siemon', 'MC6-03-06-28B', 'Siemon MC6-03-06-28B 03 Pies, 0.91 Metros', 'Network', 5.50, '03 Pies, 0.91 Metros', 'DISPONIBLE'),
  ('Siemon', 'LKM1-002M-06DS', 'Siemon LKM1-002M-06DS Lkm1 - 002m - 06ds 2 metros', 'Network', 8.50, 'Lkm1 - 002m - 06ds 2 metros', 'DISPONIBLE');

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

select marca, count(*) as n
from public.products
where lower(btrim(coalesce(marca, ''))) in ('siemon')
group by 1
order by 1;

