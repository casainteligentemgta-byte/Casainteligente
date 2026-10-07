begin;
drop table if exists cat_siemon_2026;
create temporary table cat_siemon_2026 (
  marca text not null, modelo text not null, nombre text not null,
  categoria text not null, costo numeric(14,2) not null, descripcion text,
  estatus text not null, primary key (marca, modelo)
);
insert into cat_siemon_2026 (marca, modelo, nombre, categoria, costo, descripcion, estatus)
values
  ('Siemon', 'FJ1-SCASCAL-03', 'Siemon FJ1-SCASCAL-03 Fibra, Jumper, Simplex, XGLO, Monomodo, SC APC, SC', 'Network', 22.00, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC APC,', 'DISPONIBLE'),
  ('Siemon', 'FJ1-SCASCAL-05', 'Siemon FJ1-SCASCAL-05 Fibra, Jumper, Simplex, XGLO, Monomodo, SC APC, SC', 'Network', 23.00, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC APC,', 'DISPONIBLE'),
  ('Siemon', 'FJ1-SCUSCUL-03', 'Siemon FJ1-SCUSCUL-03 Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC, SC', 'Network', 17.00, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC,', 'DISPONIBLE'),
  ('Siemon', 'FJ1-SCUSCUL-05', 'Siemon FJ1-SCUSCUL-05 Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC, SC', 'Network', 18.50, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC,', 'DISPONIBLE'),
  ('Siemon', 'FJ1-SCUSCAL-03', 'Siemon FJ1-SCUSCAL-03 Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC, SC', 'Network', 21.50, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC,', 'DISPONIBLE'),
  ('Siemon', 'FJ1-SCUSCAL-05', 'Siemon FJ1-SCUSCAL-05 Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC, SC', 'Network', 22.50, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC,', 'DISPONIBLE'),
  ('Siemon', 'J2-LCULCUL-02H', 'Siemon J2-LCULCUL-02H Fibra, Jumper, Duplex, ValuLight, Monomodo, LC UPC', 'Network', 18.50, 'Fibra, Jumper, Duplex, ValuLight, Monomodo, LC U', 'DISPONIBLE'),
  ('Siemon', 'J2-LCULCUL-03H', 'Siemon J2-LCULCUL-03H Fibra, Jumper, Duplex, ValuLight, Monomodo, LC UPC', 'Network', 19.00, 'Fibra, Jumper, Duplex, ValuLight, Monomodo, LC U', 'DISPONIBLE'),
  ('Siemon', 'J2-LCULCUL-05H', 'Siemon J2-LCULCUL-05H Fibra, Jumper, Duplex, ValuLight, Monomodo, LC UPC', 'Network', 20.00, 'Fibra, Jumper, Duplex, ValuLight, Monomodo, LC U', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCULCUL-02H', 'Siemon FJ2-LCULCUL-02H Fibra, Jumper, Duplex, XGLO, Monomodo, LC UPC, LC', 'Network', 30.50, 'Fibra, Jumper, Duplex, XGLO, Monomodo, LC UPC, L', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCULCUL-03H', 'Siemon FJ2-LCULCUL-03H Fibra, Jumper, Duplex, XGLO, Monomodo, LC UPC, LC', 'Network', 31.50, 'Fibra, Jumper, Duplex, XGLO, Monomodo, LC UPC, L', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-01AH', 'Siemon FJ2-LCLC5V-01AH Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, O', 'Network', 26.50, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC,', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-02AH', 'Siemon FJ2-LCLC5V-02AH Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, O', 'Network', 28.00, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC,', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-03AH', 'Siemon FJ2-LCLC5V-03AH Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, O', 'Network', 30.00, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC,', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-02AQ', 'Siemon FJ2-LCLC5V-02AQ Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, O', 'Network', 25.50, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC,', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-03AQ', 'Siemon FJ2-LCLC5V-03AQ Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, O', 'Network', 27.50, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC,', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-05AQ', 'Siemon FJ2-LCLC5V-05AQ Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, O', 'Network', 33.00, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC,', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-12AQ', 'Siemon FJ2-LCLC5V-12AQ Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, O', 'Network', 42.00, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC,', 'DISPONIBLE'),
  ('Siemon', 'LBP-LCLC5V-01AQ', 'Siemon LBP-LCLC5V-01AQ 1 Metro', 'Network', 29.50, '1 Metro', 'DISPONIBLE'),
  ('Siemon', 'LBP-LCLC5V-02AQ', 'Siemon LBP-LCLC5V-02AQ 2 Metros', 'Network', 30.00, '2 Metros', 'DISPONIBLE'),
  ('Siemon', 'LBP-LCLC5V-02EH', 'Siemon LBP-LCLC5V-02EH 2 metros Fibra, Jumper, Conector Patentado BladeP', 'Network', 25.00, '2 metros Fibra, Jumper, Conector Patentado Blade', 'DISPONIBLE'),
  ('Siemon', 'LBP-LCULCUL-03H', 'Siemon LBP-LCULCUL-03H 3 metros Fibra, Jumper, Conector Patentado BladeP', 'Network', 32.50, '3 metros Fibra, Jumper, Conector Patentado Blade', 'DISPONIBLE'),
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
  ('Siemon', 'SFPH10GB2.0M01L', 'Siemon SFPH10GB2.0M01L Cable de alta velocidad High Speed, DAC (conexión', 'Network', 62.50, 'Cable de alta velocidad High Speed, DAC (conexió', 'DISPONIBLE'),
  ('Siemon', 'SFPH10GB3.0M01L', 'Siemon SFPH10GB3.0M01L Cable de alta velocidad High Speed, DAC (conexión', 'Network', 65.00, 'Cable de alta velocidad High Speed, DAC (conexió', 'DISPONIBLE'),
  ('Siemon', 'SFPH10GB3.0M03L', 'Siemon SFPH10GB3.0M03L Cable de alta velocidad High Speed, DAC (conexión', 'Network', 65.00, 'Cable de alta velocidad High Speed, DAC (conexió', 'DISPONIBLE'),
  ('Siemon', '9F8LB1-12D-Metro', 'Siemon 9F8LB1-12D-Metro Cable, 12 Fibras, XGLO, Monomodo, OS1/OS2, 8.3/1', 'Network', 0.95, 'Cable, 12 Fibras, XGLO, Monomodo, OS1/OS2, 8.3/1', 'DISPONIBLE'),
  ('Siemon', '9F8LE4-12D-Metro', 'Siemon 9F8LE4-12D-Metro Cable, 12 Fibras, XGLO, Monomodo, OS1/OS2, 8.3/1', 'Network', 1.40, 'Cable, 12 Fibras, XGLO, Monomodo, OS1/OS2, 8.3/1', 'DISPONIBLE'),
  ('Siemon', '9F5LB1-6B-Metro', 'Siemon 9F5LB1-6B-Metro Cable, 6 Fibras, XGLO, Multimodo, OM3, 50/125, In', 'Network', 1.75, 'Cable, 6 Fibras, XGLO, Multimodo, OM3, 50/125, I', 'DISPONIBLE'),
  ('Siemon', '9F5VB3-6B-Metro', 'Siemon 9F5VB3-6B-Metro Cable, 6 Fibras, XGLO, Multimodo, OM4, 50/125, In', 'Network', 2.75, 'Cable, 6 Fibras, XGLO, Multimodo, OM4, 50/125, I', 'DISPONIBLE'),
  ('Siemon', '9GD5H006D-T501M', 'Siemon 9GD5H006D-T501M Cable, 6 Fibras, XGLO, Multimodo, OM4, 50/125, In', 'Network', 3.10, 'Cable, 6 Fibras, XGLO, Multimodo, OM4, 50/125, I', 'DISPONIBLE'),
  ('Siemon', '9F5LE4-6B-Metro', 'Siemon 9F5LE4-6B-Metro Cable, 6 Fibras, XGLO, Multimodo, OM3, 50/125, Ou', 'Network', 2.75, 'Cable, 6 Fibras, XGLO, Multimodo, OM3, 50/125, O', 'DISPONIBLE'),
  ('Siemon', '9F5LE4-12D-Metro', 'Siemon 9F5LE4-12D-Metro Cable, 12 Fibras, XGLO, Multimodo, OM3, 50/125,', 'Network', 4.50, 'Cable, 12 Fibras, XGLO, Multimodo, OM3, 50/125,', 'DISPONIBLE'),
  ('Siemon', '9F5LE4-24B-Metro', 'Siemon 9F5LE4-24B-Metro Cable, 24 Fibras, XGLO, Multimodo, OM3, 50/125,', 'Network', 7.50, 'Cable, 24 Fibras, XGLO, Multimodo, OM3, 50/125,', 'DISPONIBLE'),
  ('Siemon', 'HT-40', 'Siemon HT-40 Mangas de Protección, para Empalmes de Fibra Óptica, Encogi', 'Network', 0.45, 'Mangas de Protección, para Empalmes de Fibra Ópt', 'DISPONIBLE'),
  ('Siemon', 'HT-60', 'Siemon HT-60 Mangas de Protección, para Empalmes de Fibra Óptica, Encogi', 'Network', 0.50, 'Mangas de Protección, para Empalmes de Fibra Ópt', 'DISPONIBLE'),
  ('Siemon', 'LVE-1U-MD-T01A', 'Siemon LVE-1U-MD-T01A Distribuidor de Fibra Óptica de Alta Densidad Ligt', 'Network', 245.00, 'Distribuidor de Fibra Óptica de Alta Densidad Li', 'DISPONIBLE'),
  ('Siemon', 'LVE-1U-MD-P01A', 'Siemon LVE-1U-MD-P01A Distribuidor de Fibra Óptica de Alta Densidad Ligt', 'Network', 370.00, 'Distribuidor de Fibra Óptica de Alta Densidad Li', 'DISPONIBLE'),
  ('Siemon', 'LVE-2U-MD-P01A', 'Siemon LVE-2U-MD-P01A Distribuidor de Fibra Óptica de Alta Densidad Ligt', 'Network', 525.00, 'Distribuidor de Fibra Óptica de Alta Densidad Li', 'DISPONIBLE'),
  ('Siemon', 'LVE-4U-MD-P01A', 'Siemon LVE-4U-MD-P01A Distribuidor de Fibra Óptica de Alta Densidad Ligt', 'Network', 589.00, 'Distribuidor de Fibra Óptica de Alta Densidad Li', 'DISPONIBLE'),
  ('Siemon', 'LV-RSM-KIT-A', 'Siemon LV-RSM-KIT-A Kit de carretes de fibra para gestor de cables trase', 'Network', 26.00, 'Kit de carretes de fibra para gestor de cables t', 'DISPONIBLE'),
  ('Siemon', 'LVPC-1UAS01A', 'Siemon LVPC-1UAS01A Panel de fibra, Combo Lightverse, Montaje en rack, 1', 'Network', 66.00, 'Panel de fibra, Combo Lightverse, Montaje en rac', 'DISPONIBLE'),
  ('Siemon', 'TRAYHD-1-A', 'Siemon TRAYHD-1-A Charola de empalme LightVerse para Fibra Óptica, 24 em', 'Network', 40.00, 'Charola de empalme LightVerse para Fibra Óptica,', 'DISPONIBLE'),
  ('Siemon', 'LVA-BLANK-01A', 'Siemon LVA-BLANK-01A Placa Ciega, Color Negro, Compatible con Distribuid', 'Network', 2.50, 'Placa Ciega, Color Negro, Compatible con Distrib', 'DISPONIBLE'),
  ('Siemon', 'LVA12-LCQ-BC-A', 'Siemon LVA12-LCQ-BC-A Placa Acopladora Lightverse, 6 Conectores Dúplex L', 'Network', 45.00, 'Placa Acopladora Lightverse, 6 Conectores Dúplex', 'DISPONIBLE'),
  ('Siemon', 'LVA24-LCQ-BC-A', 'Siemon LVA24-LCQ-BC-A Placa Acopladora Lightverse, 12 Conectores Dúplex', 'Network', 90.00, 'Placa Acopladora Lightverse, 12 Conectores Dúple', 'DISPONIBLE'),
  ('Siemon', 'LVA24-LCU-BC-A', 'Siemon LVA24-LCU-BC-A Placa Acopladora LightVerse, 12 Conectores Dúplex', 'Network', 110.00, 'Placa Acopladora LightVerse, 12 Conectores Dúple', 'DISPONIBLE'),
  ('Siemon', 'LVCA-06-SA', 'Siemon LVCA-06-SA Placa adaptadora combinada LightVerse Combo, blindada', 'Network', 9.00, 'Placa adaptadora combinada LightVerse Combo, bli', 'DISPONIBLE'),
  ('Siemon', 'LVCA-BLNK-A', 'Siemon LVCA-BLNK-A Placa adaptadora combinada LightVerse Combo, en blanc', 'Network', 7.50, 'Placa adaptadora combinada LightVerse Combo, en', 'DISPONIBLE'),
  ('Siemon', 'LVM12TMLSV-BSCA', 'Siemon LVM12TMLSV-BSCA Módulo Plug & Play de alta densidad LightVerse. F', 'Network', 205.00, 'Módulo Plug & Play de alta densidad LightVerse.', 'DISPONIBLE'),
  ('Siemon', 'LVM12TMLSU-BSCA', 'Siemon LVM12TMLSU-BSCA Módulo Plug & Play de alta densidad LightVerse. F', 'Network', 215.00, 'Módulo Plug & Play de alta densidad LightVerse.', 'DISPONIBLE'),
  ('Siemon', 'LVS24-LCPVRAB1A', 'Siemon LVS24-LCPVRAB1A Cassette para Empalme (Fusión) LightVerse de fibr', 'Network', 375.00, 'Cassette para Empalme (Fusión) LightVerse de fib', 'DISPONIBLE'),
  ('Siemon', 'TRAY-3', 'Siemon TRAY-3 Bandeja de Empalme para Fibra Óptica, Para 24 Empalmes por', 'Network', 31.00, 'Bandeja de Empalme para Fibra Óptica, Para 24 Em', 'DISPONIBLE'),
  ('Siemon', 'RIC-F-BLNK-01', 'Siemon RIC-F-BLNK-01 Placa adaptadora Quick-Pack, Ciega, Plana, RIC, Hou', 'Network', 3.00, 'Placa adaptadora Quick-Pack, Ciega, Plana, RIC,', 'DISPONIBLE'),
  ('Siemon', 'RIC-F-LCQ12-01C', 'Siemon RIC-F-LCQ12-01C Placa acopladora de Fibra Óptica Quick-Pack, Con', 'Network', 41.00, 'Placa acopladora de Fibra Óptica Quick-Pack, Con', 'DISPONIBLE'),
  ('Siemon', 'RIC-F-LCU12-01C', 'Siemon RIC-F-LCU12-01C Placa acopladora de Fibra Óptica Quick-Pack, Con', 'Network', 52.50, 'Placa acopladora de Fibra Óptica Quick-Pack, Con', 'DISPONIBLE');

update public.products p
set nombre=e.nombre, categoria=e.categoria, marca=e.marca, descripcion=e.descripcion,
    descripcion2='Lista distribuidor 2026 · '||e.estatus, costo=e.costo, precio=e.costo, utilidad=0
from cat_siemon_2026 e
where lower(btrim(p.modelo))=lower(btrim(e.modelo))
  and (p.marca is null or btrim(p.marca)='' or lower(btrim(p.marca))=lower(btrim(e.marca)));
insert into public.products (nombre, categoria, marca, modelo, descripcion, descripcion2, costo, precio, utilidad, cantidad)
select e.nombre, e.categoria, e.marca, e.modelo, e.descripcion,
       'Lista distribuidor 2026 · '||e.estatus, e.costo, e.costo, 0, 0
from cat_siemon_2026 e
where not exists (
  select 1 from public.products p
  where lower(btrim(p.modelo))=lower(btrim(e.modelo))
    and (p.marca is null or btrim(p.marca)='' or lower(btrim(p.marca))=lower(btrim(e.marca)))
);
commit;
