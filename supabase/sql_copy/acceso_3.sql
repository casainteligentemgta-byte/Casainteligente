begin;
drop table if exists cat_acceso_2026;
create temporary table cat_acceso_2026 (
  marca text not null, modelo text not null, nombre text not null,
  categoria text not null, costo numeric(14,2) not null, descripcion text,
  estatus text not null, primary key (marca, modelo)
);
insert into cat_acceso_2026 (marca, modelo, nombre, categoria, costo, descripcion, estatus)
values
  ('Hikvision', 'DS-PK-LRT', 'Hikvision DS-PK-LRT Blanco) teclado cableado lcd (color', 'Domótica', 35.00, 'Blanco) teclado cableado lcd (color blan', 'DISPONIBLE'),
  ('Hikvision', 'DS-PK1-LRT-HWB', 'Hikvision DS-PK1-LRT-HWB Blanco) teclado cableado lcd (c', 'Domótica', 50.00, 'Blanco) teclado cableado lcd (color blan', 'DISPONIBLE'),
  ('Hikvision', 'DS-PMA-P', 'Hikvision DS-PMA-P Modulo pstn para central hibrida comu', 'Domótica', 12.50, 'Modulo pstn para central hibrida comunic', 'DISPONIBLE'),
  ('Hikvision', 'DS-PM2-S(AU)', 'Hikvision DS-PM2-S(AU) Modulo comunicación 3g/4g central', 'Domótica', 76.00, 'Modulo comunicación 3g/4g central ax hyb', 'DISPONIBLE'),
  ('Hikvision', 'DS-PM-RSWR', 'Hikvision DS-PM-RSWR 433mhz) expansor de 8 zonas inalamb', 'Domótica', 30.00, '433mhz) expansor de 8 zonas inalambricas', 'DISPONIBLE'),
  ('Hikvision', 'DS-PM1-I8O2-H', 'Hikvision DS-PM1-I8O2-H Expansor de 8 zonas cableadas so', 'Domótica', 28.00, 'Expansor de 8 zonas cableadas soporta co', 'DISPONIBLE'),
  ('Hikvision', 'DS-PM1-RT-HWB', 'Hikvision DS-PM1-RT-HWB Expansor de 32 zonas inalambrica', 'Domótica', 98.00, 'Expansor de 32 zonas inalambricas tri-x', 'DISPONIBLE'),
  ('Hikvision', 'DS-PM1-O4L-H', 'Hikvision DS-PM1-O4L-H Rele de baja corriente de 4 vías', 'Domótica', 37.50, 'Rele de baja corriente de 4 vías cablead', 'DISPONIBLE'),
  ('Hikvision', 'DS-PM1-O4H-H', 'Hikvision DS-PM1-O4H-H Rele de potencia de 4 vías cablea', 'Domótica', 37.50, 'Rele de potencia de 4 vías cableado modu', 'DISPONIBLE'),
  ('Hikvision', 'DS-PM-RSO4', 'Hikvision DS-PM-RSO4 433mhz) expansor rs-485 con 4 salid', 'Domótica', 28.00, '433mhz) expansor rs-485 con 4 salidas ca', 'DISPONIBLE'),
  ('Hikvision', 'DS-PM-RSO8', 'Hikvision DS-PM-RSO8 433mhz) expansor rs-485 con 8 salid', 'Domótica', 39.00, '433mhz) expansor rs-485 con 8 salidas ca', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDP18-EG2(B)', 'Hikvision DS-PDP18-EG2(B) Detector de movimiento antimas', 'Domótica', 7.50, 'Detector de movimiento antimascota cable', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDD12P-EG2', 'Hikvision DS-PDD12P-EG2 Detector de movimiento antimasco', 'Domótica', 18.00, 'Detector de movimiento antimascota cable', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDD12-EG2', 'Hikvision DS-PDD12-EG2 Detector de movimiento antimascot', 'Domótica', 21.00, 'Detector de movimiento antimascota cable', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDPG12P-EG2', 'Hikvision DS-PDPG12P-EG2 Detector cableado de movimiento', 'Domótica', 25.00, 'Detector cableado de movimiento + ruptur', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDPC12P-EG2', 'Hikvision DS-PDPC12P-EG2 Detector pir cableado + camara', 'Domótica', 65.00, 'Detector pir cableado + camara integrada', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDBG8-EG2', 'Hikvision DS-PDBG8-EG2 Detector de ruptura de cristal ca', 'Domótica', 15.00, 'Detector de ruptura de cristal cableado', 'DISPONIBLE'),
  ('Hikvision', 'DS-PD1-BG9', 'Hikvision DS-PD1-BG9 Detector de ruptura de cristal cabl', 'Domótica', 22.00, 'Detector de ruptura de cristal cableado', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDSK-P', 'Hikvision DS-PDSK-P Detector sismico cableado rango de d', 'Domótica', 12.50, 'Detector sismico cableado rango de detec', 'DISPONIBLE'),
  ('Hikvision', 'DS-PD1-EB', 'Hikvision DS-PD1-EB Boton de emergencia (panico) carcasa', 'Domótica', 2.00, 'Boton de emergencia (panico) carcasa de', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDSMK-4', 'Hikvision DS-PDSMK-4', 'Domótica', 10.00, 'Hikvision DS-PDSMK-4', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDSMK-4BAR', 'Hikvision DS-PDSMK-4BAR Reinicio automatico sirena inter', 'Domótica', 14.50, 'Reinicio automatico sirena interna', 'DISPONIBLE'),
  ('Hikvision', 'DS-PI-T250', 'Hikvision DS-PI-T250 250 metros', 'Domótica', 105.00, '250 metros', 'DISPONIBLE'),
  ('Hikvision', 'DS-PD1-MC-WS', 'Hikvision DS-PD1-MC-WS Contacto magnetico superficial pl', 'Domótica', 2.00, 'Contacto magnetico superficial plastico', 'DISPONIBLE'),
  ('Hikvision', 'DS-PD1-MC-MS', 'Hikvision DS-PD1-MC-MS Contacto magnetico superficial me', 'Domótica', 5.50, 'Contacto magnetico superficial metalico', 'DISPONIBLE'),
  ('Omegasat', 'OM-SIRENE', 'Omegasat OM-SIRENE Sirena diseño moderno color blanco 1', 'Domótica', 4.00, 'Sirena diseño moderno color blanco 1 ton', 'DISPONIBLE'),
  ('Omegasat', 'OM-SIRENE-Black', 'Omegasat OM-SIRENE-Black Sirena diseño moderno color neg', 'Domótica', 4.00, 'Sirena diseño moderno color negro 1 tono', 'DISPONIBLE'),
  ('Hikvision', 'DS-PS3001', 'Hikvision DS-PS3001 Sirena cableada. ideal para cualquie', 'Domótica', 13.00, 'Sirena cableada. ideal para cualquier pa', 'DISPONIBLE'),
  ('Hikvision', 'DS-PKA-WLM-433', 'Hikvision DS-PKA-WLM-433 Negro', 'Domótica', 29.00, 'Negro', 'DISPONIBLE'),
  ('Hikvision', 'DS-PKA-WLM-433-White', 'Hikvision DS-PKA-WLM-433-White Blanco', 'Domótica', 29.00, 'Blanco', 'DISPONIBLE'),
  ('Hikvision', 'DS-PD1-MC-WWS(H)', 'Hikvision DS-PD1-MC-WWS(H) 433mhz) contacto magnetico in', 'Domótica', 12.50, '433mhz) contacto magnetico inalambrico d', 'DISPONIBLE'),
  ('Hikvision', 'DS-PD1-WL-W', 'Hikvision DS-PD1-WL-W 433mhz) detector de fugas de agua', 'Domótica', 24.00, '433mhz) detector de fugas de agua inalam', 'DISPONIBLE'),
  ('Hikvision', 'DS-19K00-Y', 'Hikvision DS-19K00-Y 433mhz) control remoto (keyfob inal', 'Insumos', 11.00, '433mhz) control remoto (keyfob inalambri', 'DISPONIBLE'),
  ('Hikvision', 'DS-PA201P-Kit-16WB', 'Hikvision DS-PA201P-Kit-16WB 433mhz) kit panel de alarma', 'Domótica', 110.00, '433mhz) kit panel de alarma inalambrico', 'DISPONIBLE'),
  ('Hikvision', 'DS-PC201N', 'Hikvision DS-PC201N MODULO DE CONEXIÓN ETHERNET PARA PAN', 'Domótica', 10.00, 'MODULO DE CONEXIÓN ETHERNET PARA PANELES', 'DISPONIBLE'),
  ('Hikvision', 'DS-PD201MC-WB', 'Hikvision DS-PD201MC-WB 433mhz) contacto magnetico inlam', 'Domótica', 20.00, '433mhz) contacto magnetico inlambrico ax', 'DISPONIBLE'),
  ('Hikvision', 'DS-PD201PC10-WB', 'Hikvision DS-PD201PC10-WB 433mhz) detector pir + camara', 'Domótica', 46.00, '433mhz) detector pir + camara inalambric', 'DISPONIBLE'),
  ('Hikvision', 'DS-PK201B-WB', 'Hikvision DS-PK201B-WB 433mhz) teclado inalambrico para', 'Domótica', 26.00, '433mhz) teclado inalambrico para armar y', 'DISPONIBLE'),
  ('Hikvision', 'DS-PKF201-WB', 'Hikvision DS-PKF201-WB 433mhz) control remoto keyfob ina', 'Domótica', 12.00, '433mhz) control remoto keyfob inalambric', 'DISPONIBLE'),
  ('Hikvision', 'DS-PS201-WB/Red', 'Hikvision DS-PS201-WB/Red 433mhz) sirena inalambrica par', 'Domótica', 26.00, '433mhz) sirena inalambrica para interior', 'DISPONIBLE'),
  ('Hikvision', 'DS-PS201-WB/Blue', 'Hikvision DS-PS201-WB/Blue 433mhz) sirena inalambrica pa', 'Domótica', 26.00, '433mhz) sirena inalambrica para interior', 'DISPONIBLE'),
  ('Hikvision', 'DS-PWA48-E-WB', 'Hikvision DS-PWA48-E-WB 433MHz) PANEL DE ALARMA INALÁMBR', 'Domótica', 104.00, '433MHz) PANEL DE ALARMA INALÁMBRICO DE H', 'DISPONIBLE'),
  ('Hikvision', 'DS-PWA48-Kit-WB(LA)', 'Hikvision DS-PWA48-Kit-WB(LA) 433mhz) kit panel de alarm', 'Domótica', 164.00, '433mhz) kit panel de alarma ax pro 48 zo', 'DISPONIBLE'),
  ('Hikvision', 'DS-PWA64-Kit-WB', 'Hikvision DS-PWA64-Kit-WB 433mhz) kit panel de alarma ax', 'Domótica', 147.50, '433mhz) kit panel de alarma ax pro 64 zo', 'DISPONIBLE'),
  ('Hikvision', 'DS-PWA96-Kit-WB/4G', 'Hikvision DS-PWA96-Kit-WB/4G 433mhz) kit panel de alarma', 'Domótica', 239.00, '433mhz) kit panel de alarma ax pro 96 zo', 'DISPONIBLE'),
  ('Hikvision', 'DS-PK1-E-WB', 'Hikvision DS-PK1-E-WB 433mhz) teclado inalambrico led co', 'Domótica', 27.50, '433mhz) teclado inalambrico led configur', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDC15-EG2-WB(B)', 'Hikvision DS-PDC15-EG2-WB(B) 433mhz) detector pir inalam', 'Domótica', 35.00, '433mhz) detector pir inalambrico tipo co', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDD12P-EG2-WB', 'Hikvision DS-PDD12P-EG2-WB 433mhz) detector inalambrico', 'Domótica', 62.00, '433mhz) detector inalambrico movimiento', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDPC12P-EG2-WB', 'Hikvision DS-PDPC12P-EG2-WB 433mhz) detector pir inalamb', 'Domótica', 80.00, '433mhz) detector pir inalambrico + camar', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDPC12PF-EG2-WB', 'Hikvision DS-PDPC12PF-EG2-WB 433mhz) detector pir inalam', 'Domótica', 87.00, '433mhz) detector pir inalambrico + camar', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDCL12-EG2-WB', 'Hikvision DS-PDCL12-EG2-WB 433mhz) detector inalambrico', 'Domótica', 25.00, '433mhz) detector inalambrico de movimien', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDP18-HM-WB', 'Hikvision DS-PDP18-HM-WB 433mhz) detector inalambrico mo', 'Domótica', 65.00, '433mhz) detector inalambrico movimiento', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDMCS-EG2-WB', 'Hikvision DS-PDMCS-EG2-WB 433mhz) contacto magnetico inl', 'Domótica', 16.00, '433mhz) contacto magnetico inlambrico co', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDMC-EG2-WB', 'Hikvision DS-PDMC-EG2-WB 433mhz) contacto magnetico inla', 'Domótica', 21.00, '433mhz) contacto magnetico inlambrico co', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDMCX-E-WB', 'Hikvision DS-PDMCX-E-WB 433mhz) contacto magnetico exter', 'Domótica', 29.00, '433mhz) contacto magnetico exterior inla', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDMCK-EG2-WB', 'Hikvision DS-PDMCK-EG2-WB 433mhz) contacto magnetico + v', 'Domótica', 27.00, '433mhz) contacto magnetico + vibración i', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDWL-E-WB', 'Hikvision DS-PDWL-E-WB 433mhz) detector de fuga de agua', 'Domótica', 34.00, '433mhz) detector de fuga de agua inalamb', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDSMK-S-WB', 'Hikvision DS-PDSMK-S-WB 433mhz) detector de humo fotoele', 'Domótica', 39.00, '433mhz) detector de humo fotoelectrico i', 'DISPONIBLE'),
  ('Hikvision', 'DS-PD452SMK-WB', 'Hikvision DS-PD452SMK-WB 433mhz) detector de humo, calor', 'Domótica', 66.00, '433mhz) detector de humo, calor y monóxi', 'DISPONIBLE'),
  ('Hikvision', 'DS-PKF1-WB', 'Hikvision DS-PKF1-WB 433mhz) control remoto (keyfob inal', 'Domótica', 22.00, '433mhz) control remoto (keyfob inalambri', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDEB1-EG2-WB', 'Hikvision DS-PDEB1-EG2-WB 433mhz) boton de panico/emerge', 'Domótica', 16.00, '433mhz) boton de panico/emergencia inala', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDEBP1-EG2-WB', 'Hikvision DS-PDEBP1-EG2-WB 433mhz) boton de panico/emerg', 'Domótica', 16.00, '433mhz) boton de panico/emergencia inala', 'DISPONIBLE'),
  ('Hikvision', 'DS-PS1-I-WB/Red', 'Hikvision DS-PS1-I-WB/Red 433mhz) sirena para interior i', 'Domótica', 38.00, '433mhz) sirena para interior inalambrica', 'DISPONIBLE'),
  ('Hikvision', 'DS-PS1-E-WB/Blue', 'Hikvision DS-PS1-E-WB/Blue 433mhz) luz azul - no disponi', 'Domótica', 25.00, '433mhz) luz azul - no disponible sirena', 'DISPONIBLE'),
  ('Hikvision', 'DS-PM1-O1H-WB', 'Hikvision DS-PM1-O1H-WB 433mhz) contactor inalambrico sw', 'Domótica', 28.00, '433mhz) contactor inalambrico switch ina', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDB-IN', 'Hikvision DS-PDB-IN - ceilingbracket base de sensor para', 'Insumos', 1.25, '- ceilingbracket base de sensor para ins', 'DISPONIBLE'),
  ('Hikvision', 'DS-KEB801X-C', 'Hikvision DS-KEB801X-C ESTACION DE ALARMA DE PANICO DE E', 'Domótica', 599.00, 'ESTACION DE ALARMA DE PANICO DE EMERGENC', 'DISPONIBLE'),
  ('Hikvision', 'DS-1AC6APL1', 'Hikvision DS-1AC6APL1 6 HILOS - NO DISPONIBLE CABLE CABL', 'Insumos', 177.00, '6 HILOS - NO DISPONIBLE CABLE CABLE DE A', 'DISPONIBLE'),
  ('Hikvision', 'DS-1AC2B4APL1', 'Hikvision DS-1AC2B4APL1 2+4 hilos', 'Insumos', 220.00, '2+4 hilos', 'DISPONIBLE'),
  ('Hikvision', 'ISD-SMG1118L', 'Hikvision ISD-SMG1118L Arco detector de metal de 18 zona', 'Domótica', 1590.00, 'Arco detector de metal de 18 zonas preci', 'DISPONIBLE'),
  ('Hikvision', 'ISD-SMG218L', 'Hikvision ISD-SMG218L Arco detector de metal de 18 zonas', 'Domótica', 2095.00, 'Arco detector de metal de 18 zonas arco', 'DISPONIBLE'),
  ('Hikvision', 'NP-SH100', 'Hikvision NP-SH100 Detector de metales manual sensibilid', 'Domótica', 50.00, 'Detector de metales manual sensibilidad', 'DISPONIBLE'),
  ('Hikvision', 'DS-TDSB0G-FK/60m', 'Hikvision DS-TDSB0G-FK/60m RADAR PERIMETRAL DE 60 METROS', 'Domótica', 1275.00, 'RADAR PERIMETRAL DE 60 METROS DE DISTANC', 'DISPONIBLE'),
  ('Hikvision', 'DS-TDSB0G-FK/120m', 'Hikvision DS-TDSB0G-FK/120m RADAR PERIMETRAL DE 120 METR', 'Domótica', 1850.00, 'RADAR PERIMETRAL DE 120 METROS DE DISTAN', 'DISPONIBLE'),
  ('Hikvision', 'DS-TDSB0G-FK/500m', 'Hikvision DS-TDSB0G-FK/500m RADAR PERIMETRAL DE 500 METR', 'Domótica', 12950.00, 'RADAR PERIMETRAL DE 500 METROS DE DISTAN', 'DISPONIBLE'),
  ('Hikvision', 'DS-PRB-1110', 'Hikvision DS-PRB-1110 SOPORTE DE PARED PARA RADAR Materi', 'Insumos', 28.00, 'SOPORTE DE PARED PARA RADAR Material: Me', 'DISPONIBLE'),
  ('Hikvision', 'DS-PRB-1120', 'Hikvision DS-PRB-1120 SOPORTE AUXILIAR DE RADAR PARA PTZ', 'Insumos', 17.00, 'SOPORTE AUXILIAR DE RADAR PARA PTZ Mater', 'DISPONIBLE'),
  ('Hikvision', 'DS-PRB-1200', 'Hikvision DS-PRB-1200 SOPORTE DE POSTE PARA RADAR Materi', 'Insumos', 47.00, 'SOPORTE DE POSTE PARA RADAR Material: Me', 'DISPONIBLE'),
  ('Hikvision', 'DS-PRB-1310', 'Hikvision DS-PRB-1310 SOPORTE DE PARED / POSTE PARA RADA', 'Insumos', 65.00, 'SOPORTE DE PARED / POSTE PARA RADAR Mate', 'DISPONIBLE'),
  ('Hikvision', 'DS-PRB-2200', 'Hikvision DS-PRB-2200 SOPORTE DE POSTE PARA RADAR Y PTZ', 'Insumos', 70.00, 'SOPORTE DE POSTE PARA RADAR Y PTZ Materi', 'DISPONIBLE'),
  ('Ubiquiti', 'UA-Reader', 'Ubiquiti UA-Reader Lite UniFi Access Reader Lite Un conv', 'Network', 120.00, 'Lite UniFi Access Reader Lite Un conveni', 'DISPONIBLE'),
  ('Ubiquiti', 'UA-Hub', 'Ubiquiti UA-Hub UniFi Access Hub Un mecanismo de puerta', 'Network', 99.00, 'UniFi Access Hub Un mecanismo de puerta', 'DISPONIBLE'),
  ('Ubiquiti', 'UA-G2-SK-Pro', 'Ubiquiti UA-G2-SK-Pro Access G2 Starter Kit Pro Experien', 'Network', 739.00, 'Access G2 Starter Kit Pro Experiencia pr', 'DISPONIBLE'),
  ('Ubiquiti', 'UA-Intercom', 'Ubiquiti UA-Intercom UniFi Intercom Terminal de intercom', 'Domótica', 492.00, 'UniFi Intercom Terminal de intercomunica', 'DISPONIBLE'),
  ('Ubiquiti', 'UA-Intercom-Viewer', 'Ubiquiti UA-Intercom-Viewer Display de intercom Pantalla', 'Domótica', 492.00, 'Display de intercom Pantalla que funcion', 'DISPONIBLE'),
  ('Ubiquiti', 'UVC-G4', 'Ubiquiti UVC-G4 Doorbell Pro PoE Kit Your premium UniFi', 'Domótica', 575.00, 'Doorbell Pro PoE Kit Your premium UniFi', 'DISPONIBLE');

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
