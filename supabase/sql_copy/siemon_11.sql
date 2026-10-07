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
  ('Siemon', 'LBP-LCLC5V-02EH', 'Siemon LBP-LCLC5V-02EH 2 metros Fibra, Jumper, Conector Patentado BladePatch Duplex, Solución', 'Network', 25.00, '2 metros Fibra, Jumper, Conector Patentado BladePatch Duplex, Solución única para entornos de conexión de fibra óptica de alta densidad. Cuenta con un revolucionario e innovador diseño de bota, push-pull, para controlar el broche del seguro, posibilitando el fácil acceso y remoción en zonas muy estrecha. XGLO, Multimodo, LC LC Duplex, RFP, OM4, 50/125, Color Aqua, LSOH-3C, 02 Metros', 'DISPONIBLE'),
  ('Siemon', 'LBP-LCULCUL-03H', 'Siemon LBP-LCULCUL-03H 3 metros Fibra, Jumper, Conector Patentado BladePatch Duplex, Solución', 'Network', 32.50, '3 metros Fibra, Jumper, Conector Patentado BladePatch Duplex, Solución única para entornos de conexión de fibra óptica de alta densidad. Cuenta con un revolucionario e innovador diseño de bota, push-pull, para controlar el broche del seguro, posibilitando el fácil acceso y remoción en zonas muy estrecha. XGLO, Monomodo, LC UPC LC UPC Duplex, RFP, OS1/OS2, 8.3/125, Color Amarillo, LSOH-3C, 03 Metros', 'DISPONIBLE'),
  ('Siemon', 'LBP-LCALCAL-01', 'Siemon LBP-LCALCAL-01 1 Metro', 'Network', 40.00, '1 Metro', 'DISPONIBLE'),
  ('Siemon', 'LBP-LCALCAL-02', 'Siemon LBP-LCALCAL-02 2 Metros', 'Network', 41.50, '2 Metros', 'DISPONIBLE'),
  ('Siemon', 'LBP-LCALCAL-03', 'Siemon LBP-LCALCAL-03 3 Metros', 'Network', 43.00, '3 Metros', 'DISPONIBLE'),
  ('Siemon', 'FRP12ALFF-026MA', 'Siemon FRP12ALFF-026MA 26 metros', 'Network', 265.00, '26 metros', 'DISPONIBLE'),
  ('Siemon', 'FRP12ALFF-034MA', 'Siemon FRP12ALFF-034MA 34 metros', 'Network', 275.00, '34 metros', 'DISPONIBLE'),
  ('Siemon', 'FLP12VLFF-010MA', 'Siemon FLP12VLFF-010MA 15 metros', 'Network', 249.00, '15 metros', 'DISPONIBLE'),
  ('Siemon', 'FLP12VLFF-015MA', 'Siemon FLP12VLFF-015MA 15 metros', 'Network', 278.00, '15 metros', 'DISPONIBLE'),
  ('Siemon', 'FRP12VLFF-015MA', 'Siemon FRP12VLFF-015MA 15 metros', 'Network', 220.00, '15 metros', 'DISPONIBLE'),
  ('Siemon', 'FRP12VLFF-018MA', 'Siemon FRP12VLFF-018MA 18 metros', 'Network', 235.00, '18 metros', 'DISPONIBLE'),
  ('Siemon', 'FRP12VLFF-020MA', 'Siemon FRP12VLFF-020MA 20 metros', 'Network', 245.00, '20 metros', 'DISPONIBLE'),
  ('Siemon', 'FRP12VLFF-024MA', 'Siemon FRP12VLFF-024MA 24 metros', 'Network', 275.00, '24 metros', 'DISPONIBLE'),
  ('Siemon', 'FRP12VLFF-026MA', 'Siemon FRP12VLFF-026MA 26 metros', 'Network', 285.00, '26 metros', 'DISPONIBLE'),
  ('Siemon', 'SFPH10GB2.0M01L', 'Siemon SFPH10GB2.0M01L Cable de alta velocidad High Speed, DAC (conexión directa de cobre)', 'Network', 62.50, 'Cable de alta velocidad High Speed, DAC (conexión directa de cobre), Ethernet 10G NRZ, 30AWG, CR1 a CR1, SFP+ a SFP+, 30 AWG, 2 metros, chaqueta LSZH/CM, Color Negro, compatible con Cisco, IEEE- 802.3ba', 'DISPONIBLE'),
  ('Siemon', 'SFPH10GB3.0M01L', 'Siemon SFPH10GB3.0M01L Cable de alta velocidad High Speed, DAC (conexión directa de cobre)', 'Network', 65.00, 'Cable de alta velocidad High Speed, DAC (conexión directa de cobre), Ethernet 10G NRZ, 30AWG, CR1 a CR1, SFP+ a SFP+, 30 AWG, 3 metros, chaqueta LSZH/CM, Color Negro, compatible con Cisco, IEEE- 802.3ba', 'DISPONIBLE'),
  ('Siemon', 'SFPH10GB3.0M03L', 'Siemon SFPH10GB3.0M03L Cable de alta velocidad High Speed, DAC (conexión directa de cobre)', 'Network', 65.00, 'Cable de alta velocidad High Speed, DAC (conexión directa de cobre), Ethernet 10G NRZ, 30AWG, CR1 a CR1, SFP+ a SFP+, 30 AWG, 3 metros, chaqueta LSZH/CM, Color Rojo, compatible con Cisco, IEEE- 802.3ba', 'DISPONIBLE'),
  ('Siemon', '9F8LB1-12D-Metro', 'Siemon 9F8LB1-12D-Metro Cable, 12 Fibras, XGLO, Monomodo, OS1/OS2, 8.3/125, Indoor (interior)', 'Network', 0.95, 'Cable, 12 Fibras, XGLO, Monomodo, OS1/OS2, 8.3/125, Indoor (interior), Tight Buffered, Non-Armored, OFNR, Amarillo, Internacional', 'DISPONIBLE'),
  ('Siemon', '9F8LE4-12D-Metro', 'Siemon 9F8LE4-12D-Metro Cable, 12 Fibras, XGLO, Monomodo, OS1/OS2, 8.3/125, Outside Plant', 'Network', 1.40, 'Cable, 12 Fibras, XGLO, Monomodo, OS1/OS2, 8.3/125, Outside Plant (Exterior), Loose Tube, GEL, Armored, MDPE, Negro, Internacional', 'DISPONIBLE'),
  ('Siemon', '9F5LB1-6B-Metro', 'Siemon 9F5LB1-6B-Metro Cable, 6 Fibras, XGLO, Multimodo, OM3, 50/125, Indoor (interior), Tight', 'Network', 1.75, 'Cable, 6 Fibras, XGLO, Multimodo, OM3, 50/125, Indoor (interior), Tight Buffered ideal para campus y backbones de edificios, Non-Armored, Riser OFNR, Aqua, Internacional', 'DISPONIBLE'),
  ('Siemon', '9F5VB3-6B-Metro', 'Siemon 9F5VB3-6B-Metro Cable, 6 Fibras, XGLO, Multimodo, OM4, 50/125, Indoor (interior), Tight', 'Network', 2.75, 'Cable, 6 Fibras, XGLO, Multimodo, OM4, 50/125, Indoor (interior), Tight Buffered ideal para data centers, campus y backbones de edificios, Non- Armored, LSOH-3C, Aqua, Internacional', 'DISPONIBLE'),
  ('Siemon', '9GD5H006D-T501M', 'Siemon 9GD5H006D-T501M Cable, 6 Fibras, XGLO, Multimodo, OM4, 50/125, Indoor (interior) /', 'Network', 3.10, 'Cable, 6 Fibras, XGLO, Multimodo, OM4, 50/125, Indoor (interior) / Outdoor (Exterior), Tight Buffered, DWB Core, Non-Armored, LSOH-3C, Negro, Internacional', 'DISPONIBLE'),
  ('Siemon', '9F5LE4-6B-Metro', 'Siemon 9F5LE4-6B-Metro Cable, 6 Fibras, XGLO, Multimodo, OM3, 50/125, Outside Plant', 'Network', 2.75, 'Cable, 6 Fibras, XGLO, Multimodo, OM3, 50/125, Outside Plant (Exterior), Loose Tube, GEL, Armored, MDPE, Negro, Internacional', 'DISPONIBLE'),
  ('Siemon', '9F5LE4-12D-Metro', 'Siemon 9F5LE4-12D-Metro Cable, 12 Fibras, XGLO, Multimodo, OM3, 50/125, Outside Plant', 'Network', 4.50, 'Cable, 12 Fibras, XGLO, Multimodo, OM3, 50/125, Outside Plant (Exterior), Loose Tube, GEL, Armored, MDPE, Negro, Internacional', 'DISPONIBLE'),
  ('Siemon', '9F5LE4-24B-Metro', 'Siemon 9F5LE4-24B-Metro Cable, 24 Fibras, XGLO, Multimodo, OM3, 50/125, Outside Plant', 'Network', 7.50, 'Cable, 24 Fibras, XGLO, Multimodo, OM3, 50/125, Outside Plant (Exterior), Loose Tube, GEL, Armored, MDPE, Negro, Internacional', 'DISPONIBLE');

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
