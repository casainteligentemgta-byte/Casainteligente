begin;
drop table if exists cat_siemon_2026;
create temporary table cat_siemon_2026 (
  marca text not null, modelo text not null, nombre text not null,
  categoria text not null, costo numeric(14,2) not null, descripcion text,
  estatus text not null, primary key (marca, modelo)
);
insert into cat_siemon_2026 (marca, modelo, nombre, categoria, costo, descripcion, estatus)
values
  ('Siemon', 'CLIP-07', 'Siemon CLIP-07 25 piezas Clip de identificación para Patch Cord Siemon M', 'Network', 4.00, '25 piezas Clip de identificación para Patch Cord', 'DISPONIBLE'),
  ('Siemon', 'CLIP-08', 'Siemon CLIP-08 25 piezas Clip de identificación para Patch Cord Siemon M', 'Network', 4.00, '25 piezas Clip de identificación para Patch Cord', 'DISPONIBLE'),
  ('Siemon', 'Z-ICON-01B', 'Siemon Z-ICON-01B 100 piezas Icono ID UltraMax para identificación de Ja', 'Network', 42.00, '100 piezas Icono ID UltraMax para identificación', 'DISPONIBLE'),
  ('Siemon', 'Z-ICON-02B', 'Siemon Z-ICON-02B 100 piezas Icono ID UltraMax para identificación de Ja', 'Network', 42.00, '100 piezas Icono ID UltraMax para identificación', 'DISPONIBLE'),
  ('Siemon', 'Z-ICON-06B', 'Siemon Z-ICON-06B 100 piezas Icono ID UltraMax para identificación de Ja', 'Network', 42.00, '100 piezas Icono ID UltraMax para identificación', 'DISPONIBLE'),
  ('Siemon', 'CT4-BOX-02', 'Siemon CT4-BOX-02 Caja de Montaje Superficial, Para Placas de Pared (Fac', 'Network', 3.50, 'Caja de Montaje Superficial, Para Placas de Pare', 'DISPONIBLE'),
  ('Siemon', 'KFP-S-01-02-S', 'Siemon KFP-S-01-02-S Faceplate, Placa de pared Keystone de 1 salida, col', 'Network', 2.00, 'Faceplate, Placa de pared Keystone de 1 salida,', 'DISPONIBLE'),
  ('Siemon', 'KFP-S-02-02-S', 'Siemon KFP-S-02-02-S Faceplate, Placa de pared Keystone de 2 salidas, co', 'Network', 2.00, 'Faceplate, Placa de pared Keystone de 2 salidas,', 'DISPONIBLE'),
  ('Siemon', 'KFP-S-04-02-S', 'Siemon KFP-S-04-02-S Faceplate, Placa de pared Keystone de 4 salidas, co', 'Network', 2.00, 'Faceplate, Placa de pared Keystone de 4 salidas,', 'DISPONIBLE'),
  ('Siemon', 'MX-FP-S-01-02B', 'Siemon MX-FP-S-01-02B Faceplate, US, Placa de pared modular MAX, de 1 sa', 'Network', 2.00, 'Faceplate, US, Placa de pared modular MAX, de 1', 'DISPONIBLE'),
  ('Siemon', 'MX-FP-S-02-02B', 'Siemon MX-FP-S-02-02B Faceplate, US, Placa de pared modular MAX, de 2 sa', 'Network', 2.00, 'Faceplate, US, Placa de pared modular MAX, de 2', 'DISPONIBLE'),
  ('Siemon', 'MX-FP-S-04-02B', 'Siemon MX-FP-S-04-02B Faceplate, US, Placa de pared modular MAX, de 4 sa', 'Network', 2.00, 'Faceplate, US, Placa de pared modular MAX, de 4', 'DISPONIBLE'),
  ('Siemon', '10GMX-FPS02-02B', 'Siemon 10GMX-FPS02-02B Faceplate, Placa de Pared Modular 10G MAX de 2 Sa', 'Network', 2.50, 'Faceplate, Placa de Pared Modular 10G MAX de 2 S', 'DISPONIBLE'),
  ('Siemon', '10GMX-FPS04-02B', 'Siemon 10GMX-FPS04-02B Faceplate, Placa de Pared Modular 10G MAX de 4 Sa', 'Network', 2.50, 'Faceplate, Placa de Pared Modular 10G MAX de 4 S', 'DISPONIBLE'),
  ('Siemon', 'CT2-FP-02B', 'Siemon CT2-FP-02B Faceplate, CT, US, 1 Acoplador, 1 Salida, CT, Blanco,', 'Network', 2.00, 'Faceplate, CT, US, 1 Acoplador, 1 Salida, CT, Bl', 'DISPONIBLE'),
  ('Siemon', 'CTE-MXA-01-02', 'Siemon CTE-MXA-01-02 Adaptador para Placa de Pared CT, TERA-MAX, para se', 'Network', 1.00, 'Adaptador para Placa de Pared CT, TERA-MAX, para', 'DISPONIBLE'),
  ('Siemon', 'CTE-MXA-02-02', 'Siemon CTE-MXA-02-02 Adaptador para Placa de Pared CT, TERA-MAX, para se', 'Network', 1.50, 'Adaptador para Placa de Pared CT, TERA-MAX, para', 'DISPONIBLE'),
  ('Siemon', 'Z-BL-01', 'Siemon Z-BL-01 Panel Blank, Ciego, Z-PNL, Negro, Bolsa de 10 piezas', 'Network', 7.50, 'Panel Blank, Ciego, Z-PNL, Negro, Bolsa de 10 pi', 'DISPONIBLE'),
  ('Siemon', 'MX-BL-02', 'Siemon MX-BL-02 Inserto Ciego Para Placas de Pared MAX y 10G MAX, Color', 'Network', 4.50, 'Inserto Ciego Para Placas de Pared MAX y 10G MAX', 'DISPONIBLE'),
  ('Siemon', 'DIN-PNL-04-01', 'Siemon DIN-PNL-04-01 Cobre, Patch Panel, Ruggedized (Resistentes), UTP,', 'Network', 23.00, 'Cobre, Patch Panel, Ruggedized (Resistentes), UT', 'DISPONIBLE'),
  ('Siemon', 'DIN-PNLS-04-01', 'Siemon DIN-PNLS-04-01 Cobre, Panel de parcheo, Reforzado, Vacío, Apantal', 'Network', 65.00, 'Cobre, Panel de parcheo, Reforzado, Vacío, Apant', 'DISPONIBLE'),
  ('Siemon', 'MX-MMO-20', 'Siemon MX-MMO-20 Bandeja de gestión de fibra opcional permite el aislami', 'Network', 33.00, 'Bandeja de gestión de fibra opcional permite el', 'DISPONIBLE'),
  ('Siemon', 'RS1-07-S', 'Siemon RS1-07-S Rack de marco abierto de 2 postes. Incluye hardware de m', 'Network', 330.00, 'Rack de marco abierto de 2 postes. Incluye hardw', 'DISPONIBLE'),
  ('Siemon', 'RSQ1-07-S', 'Siemon RSQ1-07-S Tornillo ajustable n° 12-24', 'Network', 925.00, 'Tornillo ajustable n° 12-24', 'DISPONIBLE'),
  ('Siemon', 'RSQ1-07C-S', 'Siemon RSQ1-07C-S Tuerca de jaula ajustable', 'Network', 925.00, 'Tuerca de jaula ajustable', 'DISPONIBLE'),
  ('Siemon', 'V82A-2AB111-45F', 'Siemon V82A-2AB111-45F Gabinete V800 45 unidades de rack de altura. Anch', 'Network', 2750.00, 'Gabinete V800 45 unidades de rack de altura. Anc', 'DISPONIBLE'),
  ('Siemon', 'VCM1A-04D-1-45', 'Siemon VCM1A-04D-1-45 Organizador de Cable Vertical Serie Value para Alt', 'Network', 395.00, 'Organizador de Cable Vertical Serie Value para A', 'DISPONIBLE'),
  ('Siemon', 'VCM1A-06D-1-45', 'Siemon VCM1A-06D-1-45 Organizador de Cable Vertical Serie Value para Alt', 'Network', 450.00, 'Organizador de Cable Vertical Serie Value para A', 'DISPONIBLE'),
  ('Siemon', 'VCM1A-10D-1-45', 'Siemon VCM1A-10D-1-45 Organizador de Cable Vertical Serie Value para Alt', 'Network', 620.00, 'Organizador de Cable Vertical Serie Value para A', 'DISPONIBLE'),
  ('Siemon', 'VCM1A-04S-1-45', 'Siemon VCM1A-04S-1-45 Organizador de Cable Vertical Serie Value para Alt', 'Network', 290.00, 'Organizador de Cable Vertical Serie Value para A', 'DISPONIBLE'),
  ('Siemon', 'VCM1A-06S-1-45', 'Siemon VCM1A-06S-1-45 Organizador de Cable Vertical Serie Value para Alt', 'Network', 305.00, 'Organizador de Cable Vertical Serie Value para A', 'DISPONIBLE'),
  ('Siemon', 'VCM1A-10S-1-45', 'Siemon VCM1A-10S-1-45 Organizador de Cable Vertical Serie Value para Alt', 'Network', 425.00, 'Organizador de Cable Vertical Serie Value para A', 'DISPONIBLE'),
  ('Siemon', 'V8A-VPC4-1-45', 'Siemon V8A-VPC4-1-45 Dedos de 4" (102 mm', 'Network', 178.00, 'Dedos de 4" (102 mm', 'DISPONIBLE'),
  ('Siemon', 'V8A-VPC6-1-45', 'Siemon V8A-VPC6-1-45 Dedos de 6" (152mm', 'Network', 158.00, 'Dedos de 6" (152mm', 'DISPONIBLE'),
  ('Siemon', 'VCM1A-SPD-1-45', 'Siemon VCM1A-SPD-1-45 Organizador de cables, 7 pies, negro, cubierta de', 'Network', 300.00, 'Organizador de cables, 7 pies, negro, cubierta d', 'DISPONIBLE'),
  ('Siemon', 'VCM-S', 'Siemon VCM-S Accesorio para organizadores verticales. Kit de panel later', 'Network', 335.00, 'Accesorio para organizadores verticales. Kit de', 'DISPONIBLE'),
  ('Siemon', 'VCM-6', 'Siemon VCM-6 Organizador de Cable Vertical RouteIT, Sencillo de un solo', 'Network', 610.00, 'Organizador de Cable Vertical RouteIT, Sencillo', 'DISPONIBLE'),
  ('Siemon', 'VCM-10', 'Siemon VCM-10 Organizador de Cable Vertical RouteIT, Sencillo de un solo', 'Network', 740.00, 'Organizador de Cable Vertical RouteIT, Sencillo', 'DISPONIBLE'),
  ('Siemon', 'V-TRAY-150-1-45', 'Siemon V-TRAY-150-1-45 Accesorio para Gabinetes series V600/V800 Bandeja', 'Network', 255.00, 'Accesorio para Gabinetes series V600/V800 Bandej', 'DISPONIBLE'),
  ('Siemon', 'VP-GRD', 'Siemon VP-GRD Kit de puesta a tierra: incluye barra de tierra, cable de', 'Network', 200.00, 'Kit de puesta a tierra: incluye barra de tierra,', 'DISPONIBLE'),
  ('Siemon', 'VP-SPL', 'Siemon VP-SPL Carrete de gestión de fibra de ¼ de vuelta (bolsa de 5) Se', 'Network', 17.00, 'Carrete de gestión de fibra de ¼ de vuelta (bols', 'DISPONIBLE'),
  ('Siemon', 'WM-143-5', 'Siemon WM-143-5 Organizador de Cable Horizontal para montaje aéreo, 5 so', 'Network', 33.00, 'Organizador de Cable Horizontal para montaje aér', 'DISPONIBLE'),
  ('Siemon', 'WM-144-5', 'Siemon WM-144-5 Organizador de Cable Horizontal para montaje aéreo, 5 so', 'Network', 38.00, 'Organizador de Cable Horizontal para montaje aér', 'DISPONIBLE'),
  ('Siemon', 'WM-145-5', 'Siemon WM-145-5 Organizador de Cable Horizontal para montaje aéreo, 5 so', 'Network', 45.00, 'Organizador de Cable Horizontal para montaje aér', 'DISPONIBLE'),
  ('Siemon', 'HCM-4-1U', 'Siemon HCM-4-1U Organizador de Cable Horizontal RouteIT, Sencillo, 4" de', 'Network', 38.00, 'Organizador de Cable Horizontal RouteIT, Sencill', 'DISPONIBLE'),
  ('Siemon', 'HCM-4-2U', 'Siemon HCM-4-2U Organizador de Cable Horizontal RouteIT, Sencillo, 4" de', 'Network', 57.00, 'Organizador de Cable Horizontal RouteIT, Sencill', 'DISPONIBLE'),
  ('Siemon', 'HCM-6-1U', 'Siemon HCM-6-1U Organizador de Cable Horizontal RouteIT, Sencillo, 4" de', 'Network', 48.00, 'Organizador de Cable Horizontal RouteIT, Sencill', 'DISPONIBLE'),
  ('Siemon', 'HCM-6-2U', 'Siemon HCM-6-2U Organizador de Cable Horizontal RouteIT, Sencillo, 4" de', 'Network', 75.00, 'Organizador de Cable Horizontal RouteIT, Sencill', 'DISPONIBLE'),
  ('Siemon', 'PNL-BLNK-1', 'Siemon PNL-BLNK-1 Panel Ciego Horizontal para Rack estándar de 19", 1UR,', 'Network', 20.00, 'Panel Ciego Horizontal para Rack estándar de 19"', 'DISPONIBLE'),
  ('Siemon', 'PNL-BLNK-2', 'Siemon PNL-BLNK-2 Panel Ciego Horizontal para Rack estándar de 19", 2UR,', 'Network', 26.00, 'Panel Ciego Horizontal para Rack estándar de 19"', 'DISPONIBLE'),
  ('Siemon', 'PNL-BLNKA-2', 'Siemon PNL-BLNKA-2 Panel Ciego Horizontal Angulado para Rack estándar de', 'Network', 50.00, 'Panel Ciego Horizontal Angulado para Rack estánd', 'DISPONIBLE'),
  ('Siemon', 'VCM-25-12-01', 'Siemon VCM-25-12-01 25 piezas Rollo de 25 cintos reusables de 12" (305 m', 'Network', 28.50, '25 piezas Rollo de 25 cintos reusables de 12" (3', 'DISPONIBLE'),
  ('Siemon', 'MAX-TT', 'Siemon MAX-TT Herramienta de Terminación TurboTool para conectores UTP M', 'Network', 6.75, 'Herramienta de Terminación TurboTool para conect', 'DISPONIBLE'),
  ('Siemon', 'CPT-T', 'Siemon CPT-T Herramienta para Preparación de Cable S/FTP, Incluye dado G', 'Network', 67.00, 'Herramienta para Preparación de Cable S/FTP, Inc', 'DISPONIBLE'),
  ('Siemon', 'UMAX-PD', 'Siemon UMAX-PD Herramienta de Impacto dinamica UltraMAX de 4 pares (Para', 'Network', 215.00, 'Herramienta de Impacto dinamica UltraMAX de 4 pa', 'DISPONIBLE'),
  ('Siemon', 'UMAX-TT', 'Siemon UMAX-TT UltraMAX TurboTool. Proporciona una entrada de cable flex', 'Network', 140.00, 'UltraMAX TurboTool. Proporciona una entrada de c', 'DISPONIBLE'),
  ('Siemon', 'UMAX-TT-D', 'Siemon UMAX-TT-D Troquel de corte de repuesto UltraMAX TurboTool. Los us', 'Network', 20.00, 'Troquel de corte de repuesto UltraMAX TurboTool.', 'DISPONIBLE'),
  ('Siemon', 'PG2', 'Siemon PG2 Protector de palma con inserto UltraMAX. La protección de pal', 'Network', 22.00, 'Protector de palma con inserto UltraMAX. La prot', 'DISPONIBLE'),
  ('Siemon', 'PG2-U', 'Siemon PG2-U Inserto UltraMAX sin protector de palma. La protección de p', 'Network', 6.00, 'Inserto UltraMAX sin protector de palma. La prot', 'DISPONIBLE'),
  ('Siemon', 'Z-TOOL', 'Siemon Z-TOOL Herramienta de Terminación para conectores Z-MAX. Esta her', 'Network', 10.00, 'Herramienta de Terminación para conectores Z-MAX', 'DISPONIBLE'),
  ('Siemon', 'Z-TOOL-ZP', 'Siemon Z-TOOL-ZP Herramienta de terminación para conectores Z-PLUG de SI', 'Network', 7.50, 'Herramienta de terminación para conectores Z-PLU', 'DISPONIBLE'),
  ('Siemon', 'FC1-LB-LC5-9AQ', 'Siemon FC1-LB-LC5-9AQ Conector de Fibra Óptica pre-pulido LightBow LC Si', 'Network', 13.50, 'Conector de Fibra Óptica pre-pulido LightBow LC', 'DISPONIBLE'),
  ('Siemon', 'FC1-LC-SM-B02', 'Siemon FC1-LC-SM-B02 Conector de Fibra Óptica LC Simplex, Para Instalaci', 'Network', 7.50, 'Conector de Fibra Óptica LC Simplex, Para Instal', 'DISPONIBLE'),
  ('Siemon', 'FT-LB-TOOL', 'Siemon FT-LB-TOOL Herramienta de Terminación para conectores de Fibra Óp', 'Network', 30.00, 'Herramienta de Terminación para conectores de Fi', 'DISPONIBLE'),
  ('Siemon', 'FT-MP-AT', 'Siemon FT-MP-AT Herramienta de Activación para MTP Pro', 'Network', 325.00, 'Herramienta de Activación para MTP Pro', 'DISPONIBLE'),
  ('Siemon', 'FT-MP-PE-MM', 'Siemon FT-MP-PE-MM Intercambiador de pines para MTP pro, Multimodo con P', 'Network', 9.50, 'Intercambiador de pines para MTP pro, Multimodo', 'DISPONIBLE'),
  ('Siemon', 'FJ1-SCASCAL-02', 'Siemon FJ1-SCASCAL-02 Fibra, Jumper, Simplex, XGLO, Monomodo, SC APC, SC', 'Network', 21.00, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC APC,', 'DISPONIBLE');

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
