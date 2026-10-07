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
  ('Siemon', 'FJ2-LCULCUL-03H', 'Siemon FJ2-LCULCUL-03H Fibra, Jumper, Duplex, XGLO, Monomodo, LC UPC, LC UPC, OS1/OS2', 'Network', 31.50, 'Fibra, Jumper, Duplex, XGLO, Monomodo, LC UPC, LC UPC, OS1/OS2, 8.3/125, Amarillo, LSOH-3C, 03 Me...', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-01AH', 'Siemon FJ2-LCLC5V-01AH Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color', 'Network', 26.50, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color Aqua, LSOH-3C, 01 Metro', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-02AH', 'Siemon FJ2-LCLC5V-02AH Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color', 'Network', 28.00, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color Aqua, LSOH-3C, 02 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-03AH', 'Siemon FJ2-LCLC5V-03AH Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color', 'Network', 30.00, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color Aqua, LSOH-3C, 03 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-02AQ', 'Siemon FJ2-LCLC5V-02AQ Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color', 'Network', 25.50, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color Aqua, OFNR, 02 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-03AQ', 'Siemon FJ2-LCLC5V-03AQ Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color', 'Network', 27.50, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color Aqua, OFNR, 03 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-05AQ', 'Siemon FJ2-LCLC5V-05AQ Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color', 'Network', 33.00, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color Aqua, OFNR, 05 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-12AQ', 'Siemon FJ2-LCLC5V-12AQ Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color', 'Network', 42.00, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color Aqua, OFNR, 12 Metros', 'DISPONIBLE'),
  ('Siemon', 'LBP-LCLC5V-01AQ', 'Siemon LBP-LCLC5V-01AQ 1 Metro', 'Network', 29.50, '1 Metro', 'DISPONIBLE'),
  ('Siemon', 'LBP-LCLC5V-02AQ', 'Siemon LBP-LCLC5V-02AQ 2 Metros', 'Network', 30.00, '2 Metros', 'DISPONIBLE'),
  ('Siemon', 'LBP-LCLC5V-02EH', 'Siemon LBP-LCLC5V-02EH 2 metros Fibra, Jumper, Conector Patentado BladePatch Duplex, So...', 'Network', 25.00, '2 metros Fibra, Jumper, Conector Patentado BladePatch Duplex, Solución única para entornos de con...', 'DISPONIBLE'),
  ('Siemon', 'LBP-LCULCUL-03H', 'Siemon LBP-LCULCUL-03H 3 metros Fibra, Jumper, Conector Patentado BladePatch Duplex, So...', 'Network', 32.50, '3 metros Fibra, Jumper, Conector Patentado BladePatch Duplex, Solución única para entornos de con...', 'DISPONIBLE'),
  ('Siemon', 'LBP-LCALCAL-01', 'Siemon LBP-LCALCAL-01 1 Metro', 'Network', 40.00, '1 Metro', 'DISPONIBLE'),
  ('Siemon', 'LBP-LCALCAL-02', 'Siemon LBP-LCALCAL-02 2 Metros', 'Network', 41.50, '2 Metros', 'DISPONIBLE'),
  ('Siemon', 'LBP-LCALCAL-03', 'Siemon LBP-LCALCAL-03 3 Metros', 'Network', 43.00, '3 Metros', 'DISPONIBLE'),
  ('Siemon', 'FRP12ALFF-026MA', 'Siemon FRP12ALFF-026MA 26 metros', 'Network', 265.00, '26 metros', 'DISPONIBLE'),
  ('Siemon', 'FRP12ALFF-034MA', 'Siemon FRP12ALFF-034MA 34 metros', 'Network', 275.00, '34 metros', 'DISPONIBLE'),
  ('Siemon', 'FLP12VLFF-010MA', 'Siemon FLP12VLFF-010MA 15 metros', 'Network', 249.00, '15 metros', 'DISPONIBLE'),
  ('Siemon', 'FLP12VLFF-015MA', 'Siemon FLP12VLFF-015MA 15 metros', 'Network', 278.00, '15 metros', 'DISPONIBLE'),
  ('Siemon', 'FRP12VLFF-015MA', 'Siemon FRP12VLFF-015MA 15 metros', 'Network', 220.00, '15 metros', 'DISPONIBLE'),
  ('Siemon', 'FRP12VLFF-018MA', 'Siemon FRP12VLFF-018MA 18 metros', 'Network', 235.00, '18 metros', 'DISPONIBLE');

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
