begin;
drop table if exists cat_acceso_2026;
create temporary table cat_acceso_2026 (
  marca text not null, modelo text not null, nombre text not null,
  categoria text not null, costo numeric(14,2) not null, descripcion text,
  estatus text not null, primary key (marca, modelo)
);
insert into cat_acceso_2026 (marca, modelo, nombre, categoria, costo, descripcion, estatus)
values
  ('Hikvision', 'DS-PD1-MC-WWS(H)', 'Hikvision DS-PD1-MC-WWS(H) 433mhz) contacto magnetic', 'Domótica', 12.50, '433mhz) contacto magnetico inalambri', 'DISPONIBLE'),
  ('Hikvision', 'DS-PD1-WL-W', 'Hikvision DS-PD1-WL-W 433mhz) detector de fugas de a', 'Domótica', 24.00, '433mhz) detector de fugas de agua in', 'DISPONIBLE'),
  ('Hikvision', 'DS-19K00-Y', 'Hikvision DS-19K00-Y 433mhz) control remoto (keyfob', 'Insumos', 11.00, '433mhz) control remoto (keyfob inala', 'DISPONIBLE'),
  ('Hikvision', 'DS-PA201P-Kit-16WB', 'Hikvision DS-PA201P-Kit-16WB 433mhz) kit panel de al', 'Domótica', 110.00, '433mhz) kit panel de alarma inalambr', 'DISPONIBLE'),
  ('Hikvision', 'DS-PC201N', 'Hikvision DS-PC201N MODULO DE CONEXIÓN ETHERNET PARA', 'Domótica', 10.00, 'MODULO DE CONEXIÓN ETHERNET PARA PAN', 'DISPONIBLE'),
  ('Hikvision', 'DS-PD201MC-WB', 'Hikvision DS-PD201MC-WB 433mhz) contacto magnetico i', 'Domótica', 20.00, '433mhz) contacto magnetico inlambric', 'DISPONIBLE'),
  ('Hikvision', 'DS-PD201PC10-WB', 'Hikvision DS-PD201PC10-WB 433mhz) detector pir + cam', 'Domótica', 46.00, '433mhz) detector pir + camara inalam', 'DISPONIBLE'),
  ('Hikvision', 'DS-PK201B-WB', 'Hikvision DS-PK201B-WB 433mhz) teclado inalambrico p', 'Domótica', 26.00, '433mhz) teclado inalambrico para arm', 'DISPONIBLE'),
  ('Hikvision', 'DS-PKF201-WB', 'Hikvision DS-PKF201-WB 433mhz) control remoto keyfob', 'Domótica', 12.00, '433mhz) control remoto keyfob inalam', 'DISPONIBLE'),
  ('Hikvision', 'DS-PS201-WB/Red', 'Hikvision DS-PS201-WB/Red 433mhz) sirena inalambrica', 'Domótica', 26.00, '433mhz) sirena inalambrica para inte', 'DISPONIBLE'),
  ('Hikvision', 'DS-PS201-WB/Blue', 'Hikvision DS-PS201-WB/Blue 433mhz) sirena inalambric', 'Domótica', 26.00, '433mhz) sirena inalambrica para inte', 'DISPONIBLE'),
  ('Hikvision', 'DS-PWA48-E-WB', 'Hikvision DS-PWA48-E-WB 433MHz) PANEL DE ALARMA INAL', 'Domótica', 104.00, '433MHz) PANEL DE ALARMA INALÁMBRICO', 'DISPONIBLE'),
  ('Hikvision', 'DS-PWA48-Kit-WB(LA)', 'Hikvision DS-PWA48-Kit-WB(LA) 433mhz) kit panel de a', 'Domótica', 164.00, '433mhz) kit panel de alarma ax pro 4', 'DISPONIBLE'),
  ('Hikvision', 'DS-PWA64-Kit-WB', 'Hikvision DS-PWA64-Kit-WB 433mhz) kit panel de alarm', 'Domótica', 147.50, '433mhz) kit panel de alarma ax pro 6', 'DISPONIBLE'),
  ('Hikvision', 'DS-PWA96-Kit-WB/4G', 'Hikvision DS-PWA96-Kit-WB/4G 433mhz) kit panel de al', 'Domótica', 239.00, '433mhz) kit panel de alarma ax pro 9', 'DISPONIBLE'),
  ('Hikvision', 'DS-PK1-E-WB', 'Hikvision DS-PK1-E-WB 433mhz) teclado inalambrico le', 'Domótica', 27.50, '433mhz) teclado inalambrico led conf', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDC15-EG2-WB(B)', 'Hikvision DS-PDC15-EG2-WB(B) 433mhz) detector pir in', 'Domótica', 35.00, '433mhz) detector pir inalambrico tip', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDD12P-EG2-WB', 'Hikvision DS-PDD12P-EG2-WB 433mhz) detector inalambr', 'Domótica', 62.00, '433mhz) detector inalambrico movimie', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDPC12P-EG2-WB', 'Hikvision DS-PDPC12P-EG2-WB 433mhz) detector pir ina', 'Domótica', 80.00, '433mhz) detector pir inalambrico + c', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDPC12PF-EG2-WB', 'Hikvision DS-PDPC12PF-EG2-WB 433mhz) detector pir in', 'Domótica', 87.00, '433mhz) detector pir inalambrico + c', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDCL12-EG2-WB', 'Hikvision DS-PDCL12-EG2-WB 433mhz) detector inalambr', 'Domótica', 25.00, '433mhz) detector inalambrico de movi', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDP18-HM-WB', 'Hikvision DS-PDP18-HM-WB 433mhz) detector inalambric', 'Domótica', 65.00, '433mhz) detector inalambrico movimie', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDMCS-EG2-WB', 'Hikvision DS-PDMCS-EG2-WB 433mhz) contacto magnetico', 'Domótica', 16.00, '433mhz) contacto magnetico inlambric', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDMC-EG2-WB', 'Hikvision DS-PDMC-EG2-WB 433mhz) contacto magnetico', 'Domótica', 21.00, '433mhz) contacto magnetico inlambric', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDMCX-E-WB', 'Hikvision DS-PDMCX-E-WB 433mhz) contacto magnetico e', 'Domótica', 29.00, '433mhz) contacto magnetico exterior', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDMCK-EG2-WB', 'Hikvision DS-PDMCK-EG2-WB 433mhz) contacto magnetico', 'Domótica', 27.00, '433mhz) contacto magnetico + vibraci', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDWL-E-WB', 'Hikvision DS-PDWL-E-WB 433mhz) detector de fuga de a', 'Domótica', 34.00, '433mhz) detector de fuga de agua ina', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDSMK-S-WB', 'Hikvision DS-PDSMK-S-WB 433mhz) detector de humo fot', 'Domótica', 39.00, '433mhz) detector de humo fotoelectri', 'DISPONIBLE'),
  ('Hikvision', 'DS-PD452SMK-WB', 'Hikvision DS-PD452SMK-WB 433mhz) detector de humo, c', 'Domótica', 66.00, '433mhz) detector de humo, calor y mo', 'DISPONIBLE'),
  ('Hikvision', 'DS-PKF1-WB', 'Hikvision DS-PKF1-WB 433mhz) control remoto (keyfob', 'Domótica', 22.00, '433mhz) control remoto (keyfob inala', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDEB1-EG2-WB', 'Hikvision DS-PDEB1-EG2-WB 433mhz) boton de panico/em', 'Domótica', 16.00, '433mhz) boton de panico/emergencia i', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDEBP1-EG2-WB', 'Hikvision DS-PDEBP1-EG2-WB 433mhz) boton de panico/e', 'Domótica', 16.00, '433mhz) boton de panico/emergencia i', 'DISPONIBLE'),
  ('Hikvision', 'DS-PS1-I-WB/Red', 'Hikvision DS-PS1-I-WB/Red 433mhz) sirena para interi', 'Domótica', 38.00, '433mhz) sirena para interior inalamb', 'DISPONIBLE'),
  ('Hikvision', 'DS-PS1-E-WB/Blue', 'Hikvision DS-PS1-E-WB/Blue 433mhz) luz azul - no dis', 'Domótica', 25.00, '433mhz) luz azul - no disponible sir', 'DISPONIBLE'),
  ('Hikvision', 'DS-PM1-O1H-WB', 'Hikvision DS-PM1-O1H-WB 433mhz) contactor inalambric', 'Domótica', 28.00, '433mhz) contactor inalambrico switch', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDB-IN', 'Hikvision DS-PDB-IN - ceilingbracket base de sensor', 'Insumos', 1.25, '- ceilingbracket base de sensor para', 'DISPONIBLE'),
  ('Hikvision', 'DS-KEB801X-C', 'Hikvision DS-KEB801X-C ESTACION DE ALARMA DE PANICO', 'Domótica', 599.00, 'ESTACION DE ALARMA DE PANICO DE EMER', 'DISPONIBLE'),
  ('Hikvision', 'DS-1AC6APL1', 'Hikvision DS-1AC6APL1 6 HILOS - NO DISPONIBLE CABLE', 'Insumos', 177.00, '6 HILOS - NO DISPONIBLE CABLE CABLE', 'DISPONIBLE'),
  ('Hikvision', 'DS-1AC2B4APL1', 'Hikvision DS-1AC2B4APL1 2+4 hilos', 'Insumos', 220.00, '2+4 hilos', 'DISPONIBLE'),
  ('Hikvision', 'ISD-SMG1118L', 'Hikvision ISD-SMG1118L Arco detector de metal de 18', 'Domótica', 1590.00, 'Arco detector de metal de 18 zonas p', 'DISPONIBLE'),
  ('Hikvision', 'ISD-SMG218L', 'Hikvision ISD-SMG218L Arco detector de metal de 18 z', 'Domótica', 2095.00, 'Arco detector de metal de 18 zonas a', 'DISPONIBLE'),
  ('Hikvision', 'NP-SH100', 'Hikvision NP-SH100 Detector de metales manual sensib', 'Domótica', 50.00, 'Detector de metales manual sensibili', 'DISPONIBLE'),
  ('Hikvision', 'DS-TDSB0G-FK/60m', 'Hikvision DS-TDSB0G-FK/60m RADAR PERIMETRAL DE 60 ME', 'Domótica', 1275.00, 'RADAR PERIMETRAL DE 60 METROS DE DIS', 'DISPONIBLE'),
  ('Hikvision', 'DS-TDSB0G-FK/120m', 'Hikvision DS-TDSB0G-FK/120m RADAR PERIMETRAL DE 120', 'Domótica', 1850.00, 'RADAR PERIMETRAL DE 120 METROS DE DI', 'DISPONIBLE'),
  ('Hikvision', 'DS-TDSB0G-FK/500m', 'Hikvision DS-TDSB0G-FK/500m RADAR PERIMETRAL DE 500', 'Domótica', 12950.00, 'RADAR PERIMETRAL DE 500 METROS DE DI', 'DISPONIBLE'),
  ('Hikvision', 'DS-PRB-1110', 'Hikvision DS-PRB-1110 SOPORTE DE PARED PARA RADAR Ma', 'Insumos', 28.00, 'SOPORTE DE PARED PARA RADAR Material', 'DISPONIBLE'),
  ('Hikvision', 'DS-PRB-1120', 'Hikvision DS-PRB-1120 SOPORTE AUXILIAR DE RADAR PARA', 'Insumos', 17.00, 'SOPORTE AUXILIAR DE RADAR PARA PTZ M', 'DISPONIBLE'),
  ('Hikvision', 'DS-PRB-1200', 'Hikvision DS-PRB-1200 SOPORTE DE POSTE PARA RADAR Ma', 'Insumos', 47.00, 'SOPORTE DE POSTE PARA RADAR Material', 'DISPONIBLE'),
  ('Hikvision', 'DS-PRB-1310', 'Hikvision DS-PRB-1310 SOPORTE DE PARED / POSTE PARA', 'Insumos', 65.00, 'SOPORTE DE PARED / POSTE PARA RADAR', 'DISPONIBLE'),
  ('Hikvision', 'DS-PRB-2200', 'Hikvision DS-PRB-2200 SOPORTE DE POSTE PARA RADAR Y', 'Insumos', 70.00, 'SOPORTE DE POSTE PARA RADAR Y PTZ Ma', 'DISPONIBLE'),
  ('Ubiquiti', 'UA-Reader', 'Ubiquiti UA-Reader Lite UniFi Access Reader Lite Un', 'Network', 120.00, 'Lite UniFi Access Reader Lite Un con', 'DISPONIBLE'),
  ('Ubiquiti', 'UA-Hub', 'Ubiquiti UA-Hub UniFi Access Hub Un mecanismo de pue', 'Network', 99.00, 'UniFi Access Hub Un mecanismo de pue', 'DISPONIBLE'),
  ('Ubiquiti', 'UA-G2-SK-Pro', 'Ubiquiti UA-G2-SK-Pro Access G2 Starter Kit Pro Expe', 'Network', 739.00, 'Access G2 Starter Kit Pro Experienci', 'DISPONIBLE'),
  ('Ubiquiti', 'UA-Intercom', 'Ubiquiti UA-Intercom UniFi Intercom Terminal de inte', 'Domótica', 492.00, 'UniFi Intercom Terminal de intercomu', 'DISPONIBLE'),
  ('Ubiquiti', 'UA-Intercom-Viewer', 'Ubiquiti UA-Intercom-Viewer Display de intercom Pant', 'Domótica', 492.00, 'Display de intercom Pantalla que fun', 'DISPONIBLE'),
  ('Ubiquiti', 'UVC-G4', 'Ubiquiti UVC-G4 Doorbell Pro PoE Kit Your premium Un', 'Domótica', 575.00, 'Doorbell Pro PoE Kit Your premium Un', 'DISPONIBLE');

update public.products p
set nombre=e.nombre, categoria=e.categoria, marca=e.marca, descripcion=e.descripcion,
    descripcion2='Lista distribuidor 2026 · '||e.estatus, costo=e.costo, precio=e.costo, utilidad=0
from cat_acceso_2026 e
where lower(btrim(p.modelo))=lower(btrim(e.modelo))
  and (p.marca is null or btrim(p.marca)='' or lower(btrim(p.marca))=lower(btrim(e.marca)));
insert into public.products (nombre, categoria, marca, modelo, descripcion, descripcion2, costo, precio, utilidad, cantidad)
select e.nombre, e.categoria, e.marca, e.modelo, e.descripcion,
       'Lista distribuidor 2026 · '||e.estatus, e.costo, e.costo, 0, 0
from cat_acceso_2026 e
where not exists (
  select 1 from public.products p
  where lower(btrim(p.modelo))=lower(btrim(e.modelo))
    and (p.marca is null or btrim(p.marca)='' or lower(btrim(p.marca))=lower(btrim(e.marca)))
);
commit;
