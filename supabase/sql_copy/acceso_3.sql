begin;
drop table if exists cat_acceso_2026;
create temporary table cat_acceso_2026 (
  marca text not null, modelo text not null, nombre text not null,
  categoria text not null, costo numeric(14,2) not null, descripcion text,
  estatus text not null, primary key (marca, modelo)
);
insert into cat_acceso_2026 (marca, modelo, nombre, categoria, costo, descripcion, estatus)
values
  ('Hikvision', 'DS-KD-KK', 'Hikvision DS-KD-KK MODULO DE BOTONES PARA VIDEOPORTE', 'Domótica', 30.00, 'MODULO DE BOTONES PARA VIDEOPORTERO', 'DISPONIBLE'),
  ('Hikvision', 'DS-KD-KP', 'Hikvision DS-KD-KP MODULO DE TECLADO PARA VIDEOPORTE', 'Domótica', 80.00, 'MODULO DE TECLADO PARA VIDEOPORTERO', 'DISPONIBLE'),
  ('Hikvision', 'DS-KD-M', 'Hikvision DS-KD-M MODULO LECTOR TARJETA PARA VIDEOPO', 'Domótica', 50.00, 'MODULO LECTOR TARJETA PARA VIDEOPORT', 'DISPONIBLE'),
  ('Hikvision', 'DS-KD-DIS', 'Hikvision DS-KD-DIS MODULO PANTALLA PARA VIDEOPORTER', 'Domótica', 70.00, 'MODULO PANTALLA PARA VIDEOPORTERO MO', 'DISPONIBLE'),
  ('Hikvision', 'DS-KD-TDM', 'Hikvision DS-KD-TDM MODULO PANTALLA TACTIL PARA VIDE', 'Domótica', 250.00, 'MODULO PANTALLA TACTIL PARA VIDEOPOR', 'DISPONIBLE'),
  ('Hikvision', 'DS-KD9203-ME6', 'Hikvision DS-KD9203-ME6 ESTACIÓN DE PUERTA METALICO', 'Domótica', 360.00, 'ESTACIÓN DE PUERTA METALICO (PUNTO D', 'DISPONIBLE'),
  ('Hikvision', 'DS-KD-ACF1/Plastic', 'Hikvision DS-KD-ACF1/Plastic EMPOTRAR) BASE 2 ESPACI', 'Domótica', 20.00, 'EMPOTRAR) BASE 2 ESPACIOES PARA VIDE', 'DISPONIBLE'),
  ('Hikvision', 'DS-KD-ACF2/Plastic', 'Hikvision DS-KD-ACF2/Plastic EMPOTRAR) BASE 2 ESPACI', 'Domótica', 27.00, 'EMPOTRAR) BASE 2 ESPACIOES PARA VIDE', 'DISPONIBLE'),
  ('Hikvision', 'DS-KD-ACF3/Plastic', 'Hikvision DS-KD-ACF3/Plastic EMPOTRAR) BASE 3 ESPACI', 'Domótica', 35.00, 'EMPOTRAR) BASE 3 ESPACIOES PARA VIDE', 'DISPONIBLE'),
  ('Hikvision', 'DS-QAZ1120G1-B/EU', 'Hikvision DS-QAZ1120G1-B/EU ALTAVOZ DE GABINETE DE R', 'Domótica', 70.00, 'ALTAVOZ DE GABINETE DE RED DE 20W Ch', 'DISPONIBLE'),
  ('Hikvision', 'DS-QAE1A80G1-VB', 'Hikvision DS-QAE1A80G1-VB AMPLIFICADOR IP DE 2 ZONAS', 'Domótica', 195.00, 'AMPLIFICADOR IP DE 2 ZONAS DE 80W Ta', 'DISPONIBLE'),
  ('Hikvision', 'DS-QAE0206G1-V', 'Hikvision DS-QAE0206G1-V ALTAVOZ DE TECHO ANALOGICO', 'Domótica', 15.00, 'ALTAVOZ DE TECHO ANALOGICO DE 6W Alt', 'DISPONIBLE'),
  ('Hikvision', 'DS-QAE0420G1-V', 'Hikvision DS-QAE0420G1-V ALTAVOZ DE COLUMNA ANALOGIC', 'Domótica', 75.00, 'ALTAVOZ DE COLUMNA ANALOGICO Revesti', 'DISPONIBLE'),
  ('Hikvision', 'DS-QAE0206G1E-V', 'Hikvision DS-QAE0206G1E-V ALTAVOZ DE TECHO ANALOGICO', 'Domótica', 170.00, 'ALTAVOZ DE TECHO ANALOGICO Al adopta', 'DISPONIBLE'),
  ('Hikvision', 'DS-TDSB00-EKT', 'Hikvision DS-TDSB00-EKT RADAR DE DETECCIÓN DE CAIDAS', 'Domótica', 190.00, 'RADAR DE DETECCIÓN DE CAIDAS Sin div', 'DISPONIBLE'),
  ('Hikfire', 'HF-S2', 'Hikfire HF-S2 DETECTOR DE HUMO AUTONOMO (STAND-ALONE', 'Domótica', 15.00, 'DETECTOR DE HUMO AUTONOMO (STAND-ALO', 'DISPONIBLE'),
  ('Hikfire', 'HF-GN110', 'Hikfire HF-GN110 DETECTOR DE GAS NATURAL METANO CH4', 'Domótica', 34.00, 'DETECTOR DE GAS NATURAL METANO CH4 (', 'DISPONIBLE'),
  ('Hikfire', 'HF-GP110', 'Hikfire HF-GP110 DETECTOR DE GAS LP PROPANO C3H8 (ST', 'Domótica', 36.50, 'DETECTOR DE GAS LP PROPANO C3H8 (STA', 'DISPONIBLE'),
  ('Hikfire', 'HF-CAB1', 'Hikfire HF-CAB1 TIMBRE DE ALARMA CONVENCIONAL Con un', 'Domótica', 15.00, 'TIMBRE DE ALARMA CONVENCIONAL Con un', 'DISPONIBLE'),
  ('Hikvision', 'DS-PHA20-W2P', 'Hikvision DS-PHA20-W2P Acceso a 2 camaras ip estanda', 'Domótica', 75.00, 'Acceso a 2 camaras ip estandar 802.1', 'DISPONIBLE'),
  ('Hikvision', 'DS-PHA32-P/LA', 'Hikvision DS-PHA32-P/LA Central de alarma hibrida de', 'Domótica', 79.00, 'Central de alarma hibrida de 32 zona', 'DISPONIBLE'),
  ('Hikvision', 'DS-PHA48-EP', 'Hikvision DS-PHA48-EP Central de alarma hibrida 48 z', 'Domótica', 89.00, 'Central de alarma hibrida 48 zonas (', 'DISPONIBLE'),
  ('Hikvision', 'DS-PHA64-LP', 'Hikvision DS-PHA64-LP Central de alarma hibrida 64zo', 'Domótica', 99.00, 'Central de alarma hibrida 64zonas (c', 'DISPONIBLE'),
  ('Hikvision', 'DS-PHA64-Kit-WB', 'Hikvision DS-PHA64-Kit-WB Kit alarma ax pro hibrido', 'Domótica', 124.00, 'Kit alarma ax pro hibrido 64 zonas c', 'DISPONIBLE'),
  ('Hikvision', 'DS-PHA64-W4P2', 'Hikvision DS-PHA64-W4P2 Central de alarma hibrida ca', 'Domótica', 99.00, 'Central de alarma hibrida caja metál', 'DISPONIBLE'),
  ('Hikvision', 'DS-PA-Battery', 'Hikvision DS-PA-Battery Batería de respaldo para pan', 'Domótica', 24.00, 'Batería de respaldo para panel de al', 'DISPONIBLE'),
  ('Hikvision', 'DS-PKG-H8L', 'Hikvision DS-PKG-H8L 8 zonas', 'Domótica', 30.00, '8 zonas', 'DISPONIBLE'),
  ('Hikvision', 'DS-PK-L', 'Hikvision DS-PK-L Blanco) teclado cableado lcd (colo', 'Domótica', 29.00, 'Blanco) teclado cableado lcd (color', 'DISPONIBLE'),
  ('Hikvision', 'DS-PK-LRT', 'Hikvision DS-PK-LRT Blanco) teclado cableado lcd (co', 'Domótica', 35.00, 'Blanco) teclado cableado lcd (color', 'DISPONIBLE'),
  ('Hikvision', 'DS-PK1-LRT-HWB', 'Hikvision DS-PK1-LRT-HWB Blanco) teclado cableado lc', 'Domótica', 50.00, 'Blanco) teclado cableado lcd (color', 'DISPONIBLE'),
  ('Hikvision', 'DS-PMA-P', 'Hikvision DS-PMA-P Modulo pstn para central hibrida', 'Domótica', 12.50, 'Modulo pstn para central hibrida com', 'DISPONIBLE'),
  ('Hikvision', 'DS-PM2-S(AU)', 'Hikvision DS-PM2-S(AU) Modulo comunicación 3g/4g cen', 'Domótica', 76.00, 'Modulo comunicación 3g/4g central ax', 'DISPONIBLE'),
  ('Hikvision', 'DS-PM-RSWR', 'Hikvision DS-PM-RSWR 433mhz) expansor de 8 zonas ina', 'Domótica', 30.00, '433mhz) expansor de 8 zonas inalambr', 'DISPONIBLE'),
  ('Hikvision', 'DS-PM1-I8O2-H', 'Hikvision DS-PM1-I8O2-H Expansor de 8 zonas cableada', 'Domótica', 28.00, 'Expansor de 8 zonas cableadas soport', 'DISPONIBLE'),
  ('Hikvision', 'DS-PM1-RT-HWB', 'Hikvision DS-PM1-RT-HWB Expansor de 32 zonas inalamb', 'Domótica', 98.00, 'Expansor de 32 zonas inalambricas tr', 'DISPONIBLE'),
  ('Hikvision', 'DS-PM1-O4L-H', 'Hikvision DS-PM1-O4L-H Rele de baja corriente de 4 v', 'Domótica', 37.50, 'Rele de baja corriente de 4 vías cab', 'DISPONIBLE'),
  ('Hikvision', 'DS-PM1-O4H-H', 'Hikvision DS-PM1-O4H-H Rele de potencia de 4 vías ca', 'Domótica', 37.50, 'Rele de potencia de 4 vías cableado', 'DISPONIBLE'),
  ('Hikvision', 'DS-PM-RSO4', 'Hikvision DS-PM-RSO4 433mhz) expansor rs-485 con 4 s', 'Domótica', 28.00, '433mhz) expansor rs-485 con 4 salida', 'DISPONIBLE'),
  ('Hikvision', 'DS-PM-RSO8', 'Hikvision DS-PM-RSO8 433mhz) expansor rs-485 con 8 s', 'Domótica', 39.00, '433mhz) expansor rs-485 con 8 salida', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDP18-EG2(B)', 'Hikvision DS-PDP18-EG2(B) Detector de movimiento ant', 'Domótica', 7.50, 'Detector de movimiento antimascota c', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDD12P-EG2', 'Hikvision DS-PDD12P-EG2 Detector de movimiento antim', 'Domótica', 18.00, 'Detector de movimiento antimascota c', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDD12-EG2', 'Hikvision DS-PDD12-EG2 Detector de movimiento antima', 'Domótica', 21.00, 'Detector de movimiento antimascota c', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDPG12P-EG2', 'Hikvision DS-PDPG12P-EG2 Detector cableado de movimi', 'Domótica', 25.00, 'Detector cableado de movimiento + ru', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDPC12P-EG2', 'Hikvision DS-PDPC12P-EG2 Detector pir cableado + cam', 'Domótica', 65.00, 'Detector pir cableado + camara integ', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDBG8-EG2', 'Hikvision DS-PDBG8-EG2 Detector de ruptura de crista', 'Domótica', 15.00, 'Detector de ruptura de cristal cable', 'DISPONIBLE'),
  ('Hikvision', 'DS-PD1-BG9', 'Hikvision DS-PD1-BG9 Detector de ruptura de cristal', 'Domótica', 22.00, 'Detector de ruptura de cristal cable', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDSK-P', 'Hikvision DS-PDSK-P Detector sismico cableado rango', 'Domótica', 12.50, 'Detector sismico cableado rango de d', 'DISPONIBLE'),
  ('Hikvision', 'DS-PD1-EB', 'Hikvision DS-PD1-EB Boton de emergencia (panico) car', 'Domótica', 2.00, 'Boton de emergencia (panico) carcasa', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDSMK-4', 'Hikvision DS-PDSMK-4', 'Domótica', 10.00, 'Hikvision DS-PDSMK-4', 'DISPONIBLE'),
  ('Hikvision', 'DS-PDSMK-4BAR', 'Hikvision DS-PDSMK-4BAR Reinicio automatico sirena i', 'Domótica', 14.50, 'Reinicio automatico sirena interna', 'DISPONIBLE'),
  ('Hikvision', 'DS-PI-T250', 'Hikvision DS-PI-T250 250 metros', 'Domótica', 105.00, '250 metros', 'DISPONIBLE'),
  ('Hikvision', 'DS-PD1-MC-WS', 'Hikvision DS-PD1-MC-WS Contacto magnetico superficia', 'Domótica', 2.00, 'Contacto magnetico superficial plast', 'DISPONIBLE'),
  ('Hikvision', 'DS-PD1-MC-MS', 'Hikvision DS-PD1-MC-MS Contacto magnetico superficia', 'Domótica', 5.50, 'Contacto magnetico superficial metal', 'DISPONIBLE'),
  ('Omegasat', 'OM-SIRENE', 'Omegasat OM-SIRENE Sirena diseño moderno color blanc', 'Domótica', 4.00, 'Sirena diseño moderno color blanco 1', 'DISPONIBLE'),
  ('Omegasat', 'OM-SIRENE-Black', 'Omegasat OM-SIRENE-Black Sirena diseño moderno color', 'Domótica', 4.00, 'Sirena diseño moderno color negro 1', 'DISPONIBLE'),
  ('Hikvision', 'DS-PS3001', 'Hikvision DS-PS3001 Sirena cableada. ideal para cual', 'Domótica', 13.00, 'Sirena cableada. ideal para cualquie', 'DISPONIBLE'),
  ('Hikvision', 'DS-PKA-WLM-433', 'Hikvision DS-PKA-WLM-433 Negro', 'Domótica', 29.00, 'Negro', 'DISPONIBLE'),
  ('Hikvision', 'DS-PKA-WLM-433-White', 'Hikvision DS-PKA-WLM-433-White Blanco', 'Domótica', 29.00, 'Blanco', 'DISPONIBLE');

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
