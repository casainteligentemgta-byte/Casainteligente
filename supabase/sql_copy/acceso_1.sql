begin;
drop table if exists cat_acceso_2026;
create temporary table cat_acceso_2026 (
  marca text not null, modelo text not null, nombre text not null,
  categoria text not null, costo numeric(14,2) not null, descripcion text,
  estatus text not null, primary key (marca, modelo)
);
insert into cat_acceso_2026 (marca, modelo, nombre, categoria, costo, descripcion, estatus)
values
  ('Hikvision', 'DS-K1801M', 'Hikvision DS-K1801M Tarjeta mifare', 'Domótica', 15.00, 'Tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1801E', 'Hikvision DS-K1801E Tarjeta em 125khz', 'Domótica', 15.00, 'Tarjeta em 125khz', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1802M', 'Hikvision DS-K1802M Tarjeta mifare', 'Domótica', 16.00, 'Tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1802E', 'Hikvision DS-K1802E Tarjeta em 125khz', 'Domótica', 16.00, 'Tarjeta em 125khz', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1104M', 'Hikvision DS-K1104M Tarjeta mifare', 'Domótica', 50.00, 'Tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1104MK', 'Hikvision DS-K1104MK Tarjeta mifare + teclado (0 - 9, *,', 'Domótica', 55.00, 'Tarjeta mifare + teclado (0 - 9, *, #', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1105EMB', 'Hikvision DS-K1105EMB Tarjeta m1 13.56mhz tarjeta em 125', 'Domótica', 39.00, 'Tarjeta m1 13.56mhz tarjeta em 125 khz s', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1105EMKB', 'Hikvision DS-K1105EMKB Tarjeta m1 13.56mhz tarjeta em 12', 'Domótica', 44.00, 'Tarjeta m1 13.56mhz tarjeta em 125 khz t', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1105EMKB-QR', 'Hikvision DS-K1105EMKB-QR Tarjeta m1 13.56mhz tarjeta em', 'Domótica', 49.00, 'Tarjeta m1 13.56mhz tarjeta em 125 khz t', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1107AM', 'Hikvision DS-K1107AM Tarjeta mifare', 'Domótica', 27.50, 'Tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1107AE', 'Hikvision DS-K1107AE Tarjeta em 125khz', 'Domótica', 27.50, 'Tarjeta em 125khz', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1107E', 'Hikvision DS-K1107E Tarjeta em 125khz', 'Domótica', 26.00, 'Tarjeta em 125khz', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1108AM', 'Hikvision DS-K1108AM Tarjeta mifare', 'Domótica', 29.00, 'Tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1108AE', 'Hikvision DS-K1108AE Tarjeta em 125khz', 'Domótica', 29.00, 'Tarjeta em 125khz', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1108AMK', 'Hikvision DS-K1108AMK Tarjeta mifare', 'Domótica', 34.00, 'Tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1108AEK', 'Hikvision DS-K1108AEK Tarjeta em 125khz', 'Domótica', 34.00, 'Tarjeta em 125khz', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1109DKFB', 'Hikvision DS-K1109DKFB Tarjeta desfire. felica y mifare', 'Domótica', 74.00, 'Tarjeta desfire. felica y mifare + huell', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1109DKB-QR', 'Hikvision DS-K1109DKB-QR Tarjeta desfire. felica y mifar', 'Domótica', 74.00, 'Tarjeta desfire. felica y mifare + codig', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1109DKFB-QR', 'Hikvision DS-K1109DKFB-QR Tarjeta desfire. felica y mifa', 'Domótica', 119.00, 'Tarjeta desfire. felica y mifare + huell', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1109EKFB', 'Hikvision DS-K1109EKFB Tarjeta em + huella', 'Domótica', 74.00, 'Tarjeta em + huella', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1201AEF', 'Hikvision DS-K1201AEF Huella+tarjeta em', 'Domótica', 69.00, 'Huella+tarjeta em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1A8503MF', 'Hikvision DS-K1A8503MF Huella +tarjeta mifare 56.50 disp', 'Domótica', 56.50, 'Huella +tarjeta mifare 56.50 disponible', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1A8503MF-B', 'Hikvision DS-K1A8503MF-B Huella +tarjeta mifare bateria', 'Domótica', 61.50, 'Huella +tarjeta mifare bateria respaldo', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T8003MF', 'Hikvision DS-K1T8003MF Huella +tarjeta mifare', 'Domótica', 60.00, 'Huella +tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T8003EF', 'Hikvision DS-K1T8003EF Huella +tarjeta em', 'Domótica', 60.00, 'Huella +tarjeta em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T804AMF', 'Hikvision DS-K1T804AMF Huella +tarjeta mifare', 'Domótica', 95.00, 'Huella +tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T804AEF', 'Hikvision DS-K1T804AEF Huella +tarjeta em', 'Domótica', 95.00, 'Huella +tarjeta em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T805MBFWX', 'Hikvision DS-K1T805MBFWX Huella +tarjeta mifare', 'Domótica', 108.00, 'Huella +tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T805EBWX', 'Hikvision DS-K1T805EBWX Tarjeta em', 'Domótica', 93.00, 'Tarjeta em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T805EBFWX', 'Hikvision DS-K1T805EBFWX Huella + tarjeta em', 'Domótica', 108.00, 'Huella + tarjeta em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T807MBFWX-E1', 'Hikvision DS-K1T807MBFWX-E1 Huella +tarjeta mifare', 'Domótica', 85.00, 'Huella +tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T807EBFWX-E1', 'Hikvision DS-K1T807EBFWX-E1 Huella + tarjeta em', 'Domótica', 85.00, 'Huella + tarjeta em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T809MX', 'Hikvision DS-K1T809MX Tarjeta mifare', 'Domótica', 35.00, 'Tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T809EX', 'Hikvision DS-K1T809EX Tarjeta em', 'Domótica', 35.00, 'Tarjeta em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T320MWX', 'Hikvision DS-K1T320MWX Rostro +tarjeta mifare) 85.00 dis', 'Domótica', 85.00, 'Rostro +tarjeta mifare) 85.00 disponible', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T320EFX', 'Hikvision DS-K1T320EFX Rostro + huella + tarjeta em', 'Domótica', 102.00, 'Rostro + huella + tarjeta em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T320EFWX', 'Hikvision DS-K1T320EFWX Rostro + huella + tarjeta em) wi', 'Domótica', 107.00, 'Rostro + huella + tarjeta em) wi-fi', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T320MFWX-B', 'Hikvision DS-K1T320MFWX-B Rostro + huella + tarjeta mifa', 'Domótica', 99.00, 'Rostro + huella + tarjeta mifare) wi-fi', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T320EFWX-B', 'Hikvision DS-K1T320EFWX-B Rostro + huella + tarjeta em)', 'Domótica', 99.00, 'Rostro + huella + tarjeta em) wi-fi', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T320EFWX-B/S', 'Hikvision DS-K1T320EFWX-B/S Rostro + huella + tarjeta em', 'Domótica', 110.00, 'Rostro + huella + tarjeta em) wi-fi', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T321MFWX', 'Hikvision DS-K1T321MFWX Rostro + huella + tarjeta mifare', 'Domótica', 90.00, 'Rostro + huella + tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T321EFWX', 'Hikvision DS-K1T321EFWX Rostro + huella + tarjeta em', 'Domótica', 90.00, 'Rostro + huella + tarjeta em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T321MFWX-B/S', 'Hikvision DS-K1T321MFWX-B/S Rostro + huella + tarjeta mi', 'Domótica', 100.00, 'Rostro + huella + tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T321EFWX-B/S', 'Hikvision DS-K1T321EFWX-B/S Rostro + huella + tarjeta em', 'Domótica', 100.00, 'Rostro + huella + tarjeta em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T323EBWX-QRE1', 'Hikvision DS-K1T323EBWX-QRE1 Rostro + codigo qr + tarjet', 'Domótica', 129.00, 'Rostro + codigo qr + tarjeta em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T323EBFWX-E1', 'Hikvision DS-K1T323EBFWX-E1 Rostro + huella + tarjeta em', 'Domótica', 130.00, 'Rostro + huella + tarjeta em) 130.00 dis', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1A340WX', 'Hikvision DS-K1A340WX Terminal de asistencia de reconoci', 'Domótica', 95.00, 'Terminal de asistencia de reconocimiento', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T341CMFW', 'Hikvision DS-K1T341CMFW Rostro +tarjeta mifare + huella)', 'Domótica', 198.00, 'Rostro +tarjeta mifare + huella) wifi', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T343MWX', 'Hikvision DS-K1T343MWX Rostro +tarjeta mifare', 'Domótica', 120.00, 'Rostro +tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T343EWX', 'Hikvision DS-K1T343EWX Rostro +tarjeta em', 'Domótica', 120.00, 'Rostro +tarjeta em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T344MBWX-QRE1', 'Hikvision DS-K1T344MBWX-QRE1 Rostro + tarjeta m1 + qr) t', 'Insumos', 132.00, 'Rostro + tarjeta m1 + qr) terminal poe r', 'DISPONIBLE'),
  ('Hikvision', 'DS-KAS321', 'Hikvision DS-KAS321 Rostro + huella + tarjeta mifare', 'Domótica', 149.50, 'Rostro + huella + tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-KAS321/EM', 'Hikvision DS-KAS321/EM Rostro + huella + tarjeta em', 'Domótica', 149.50, 'Rostro + huella + tarjeta em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T670MFWX', 'Hikvision DS-K1T670MFWX Rostro + tarjeta + huella) termi', 'Domótica', 335.00, 'Rostro + tarjeta + huella) terminal reco', 'DISPONIBLE'),
  ('Hikvision', 'DS-KAB673-FBQR', 'Hikvision DS-KAB673-FBQR Modulo lector para terminal ds', 'Domótica', 95.00, 'Modulo lector para terminal ds ‐ k1t673d', 'DISPONIBLE'),
  ('Hikvision', 'DS-K5604A-3XF/V', 'Hikvision DS-K5604A-3XF/V ROSTRO + FIEBRE + MASCARILLA)', 'Domótica', 999.00, 'ROSTRO + FIEBRE + MASCARILLA) INCLUYE PE', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1F820-F', 'Hikvision DS-K1F820-F Enrolador de huellas plug and play', 'Domótica', 58.00, 'Enrolador de huellas plug and play usb s', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2812', 'Hikvision DS-K2812 Controlador de acceso ip 2 puertas (1', 'Domótica', 120.00, 'Controlador de acceso ip 2 puertas (10.0', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2804', 'Hikvision DS-K2804 Controlador de acceso ip 4 puertas (1', 'Domótica', 135.00, 'Controlador de acceso ip 4 puertas (10.0', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2602T', 'Hikvision DS-K2602T Controlador de acceso ip 2 puertas (', 'Domótica', 220.00, 'Controlador de acceso ip 2 puertas (100.', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2604T', 'Hikvision DS-K2604T Controlador de acceso ip 4 puertas (', 'Domótica', 275.00, 'Controlador de acceso ip 4 puertas (100.', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2622X', 'Hikvision DS-K2622X Controlador de acceso ip 2 puertas a', 'Domótica', 220.00, 'Controlador de acceso ip 2 puertas admin', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2624X', 'Hikvision DS-K2624X Controlador de acceso ip 4 puertas a', 'Domótica', 275.00, 'Controlador de acceso ip 4 puertas admin', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2702WX-E1', 'Hikvision DS-K2702WX-E1 Controlador de acceso ip 2 puert', 'Domótica', 365.00, 'Controlador de acceso ip 2 puertas expan', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2704X', 'Hikvision DS-K2704X Controlador de acceso ip 4 puertas e', 'Domótica', 375.00, 'Controlador de acceso ip 4 puertas expan', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2708X', 'Hikvision DS-K2708X Controlador de acceso ip 8 puertas e', 'Domótica', 560.00, 'Controlador de acceso ip 8 puertas expan', 'DISPONIBLE'),
  ('Hikvision', 'DS-K4E208', 'Hikvision DS-K4E208 Cerradura hembrilla electrónica tama', 'Domótica', 20.00, 'Cerradura hembrilla electrónica tamaño d', 'DISPONIBLE'),
  ('Hikvision', 'DS-K4E100', 'Hikvision DS-K4E100 Cerradura inteligente de motor eléct', 'Domótica', 55.00, 'Cerradura inteligente de motor eléctrico', 'DISPONIBLE'),
  ('Hikvision', 'DS-K4H258S', 'Hikvision DS-K4H258S Cerradura electromagnetica 280 kg (', 'Domótica', 30.00, 'Cerradura electromagnetica 280 kg (600 l', 'DISPONIBLE'),
  ('Hikvision', 'DS-K4H255S', 'Hikvision DS-K4H255S Cerradura electromagnetica 280 kg (', 'Domótica', 28.00, 'Cerradura electromagnetica 280 kg (600 l', 'DISPONIBLE'),
  ('Hikvision', 'DS-K4H250-LZ', 'Hikvision DS-K4H250-LZ Bracket para puerta (cerradura ds', 'Insumos', 30.00, 'Bracket para puerta (cerradura ds-k4h250', 'DISPONIBLE'),
  ('Hikvision', 'DS-K4H258-LZ', 'Hikvision DS-K4H258-LZ Bracket para puerta (cerradura ds', 'Insumos', 15.00, 'Bracket para puerta (cerradura ds-k4h258', 'DISPONIBLE'),
  ('Hikvision', 'DS-K4H255-LZ', 'Hikvision DS-K4H255-LZ Bracket para puerta (cerradura ds', 'Insumos', 14.00, 'Bracket para puerta (cerradura ds-k4h255', 'DISPONIBLE'),
  ('Hikvision', 'DS-K4H258D-LZ', 'Hikvision DS-K4H258D-LZ Bracket de puerta para cerradura', 'Insumos', 30.00, 'Bracket de puerta para cerradura doble d', 'DISPONIBLE'),
  ('Hikvision', 'DS-K4T100-U1', 'Hikvision DS-K4T100-U1 Bracket en u para hembrilla elect', 'Insumos', 8.50, 'Bracket en u para hembrilla electrica pu', 'DISPONIBLE'),
  ('Hikvision', 'DS-K4T108-U1', 'Hikvision DS-K4T108-U1 Bracket en u para hembrilla elect', 'Insumos', 8.00, 'Bracket en u para hembrilla electrica pu', 'DISPONIBLE'),
  ('Hikvision', 'DS-K7PEB/Red', 'Hikvision DS-K7PEB/Red Boton emergencia rompa vidrio (ro', 'Domótica', 20.00, 'Boton emergencia rompa vidrio (rojo) con', 'DISPONIBLE'),
  ('Hikvision', 'DS-K7P01', 'Hikvision DS-K7P01 Boton de salida metalico (push to exi', 'Domótica', 10.00, 'Boton de salida metalico (push to exit)', 'DISPONIBLE'),
  ('Hikvision', 'DS-K7P02', 'Hikvision DS-K7P02 Boton de salida metalico (push to exi', 'Domótica', 10.00, 'Boton de salida metalico (push to exit)', 'DISPONIBLE'),
  ('Hikvision', 'DS-K7P05', 'Hikvision DS-K7P05 Boton de salida y emergencia (push to', 'Domótica', 15.00, 'Boton de salida y emergencia (push to ex', 'DISPONIBLE'),
  ('Hikvision', 'DS-K7P06', 'Hikvision DS-K7P06 Boton de salida y emergencia (push to', 'Domótica', 15.00, 'Boton de salida y emergencia (push to ex', 'DISPONIBLE'),
  ('Hikvision', 'DS-KEM125', 'Hikvision DS-KEM125 Tarjeta de proximidad em frecuencia:', 'Domótica', 1.50, 'Tarjeta de proximidad em frecuencia: 125', 'DISPONIBLE'),
  ('Hikvision', 'FM11RF08-M1', 'Hikvision FM11RF08-M1 Tarjeta de proximidad mifare® frec', 'Domótica', 1.50, 'Tarjeta de proximidad mifare® frecuencia', 'DISPONIBLE'),
  ('Hikvision', 'S50+TK4100', 'Hikvision S50+TK4100 Tarjeta de proximidad dual mifare®', 'Domótica', 1.50, 'Tarjeta de proximidad dual mifare® + em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K7M101-E0', 'Hikvision DS-K7M101-E0 Tarjeta inteligente sin contacto', 'Domótica', 1.50, 'Tarjeta inteligente sin contacto em frec', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2M061', 'Hikvision DS-K2M061 Modulo de control de puerta segura c', 'Domótica', 38.00, 'Modulo de control de puerta segura comun', 'DISPONIBLE');

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
