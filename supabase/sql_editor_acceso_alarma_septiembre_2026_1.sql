-- =============================================================================
-- Acceso-Alarma septiembre 2026 · parte 1 de 3 (86 SKU de 258)
-- Correr DESPUÉS de las 3 partes de Siemon.
-- Copiar este archivo COMPLETO (GitHub Raw → Ctrl+A → Ctrl+C) → SQL Editor → Run.
-- Primero: DS-K1801M  ·  Último: DS-K2M061
-- costo = lista USD; precio = costo; utilidad = 0. Sin updated_at.
-- =============================================================================
rollback;

begin;

drop table if exists cat_acceso_2026;
create temporary table cat_acceso_2026 (
  marca text not null,
  modelo text not null,
  nombre text not null,
  categoria text not null,
  costo numeric(14,2) not null,
  descripcion text,
  estatus text not null,
  primary key (marca, modelo)
);

insert into cat_acceso_2026 (marca, modelo, nombre, categoria, costo, descripcion, estatus)
values
  ('Hikvision', 'DS-K1801M', 'Hikvision DS-K1801M Tarjeta mifare', 'Domótica', 15.00, 'Tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1801E', 'Hikvision DS-K1801E Tarjeta em 125khz', 'Domótica', 15.00, 'Tarjeta em 125khz', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1802M', 'Hikvision DS-K1802M Tarjeta mifare', 'Domótica', 16.00, 'Tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1802E', 'Hikvision DS-K1802E Tarjeta em 125khz', 'Domótica', 16.00, 'Tarjeta em 125khz', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1104M', 'Hikvision DS-K1104M Tarjeta mifare', 'Domótica', 50.00, 'Tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1104MK', 'Hikvision DS-K1104MK Tarjeta mifare + teclado (0 - 9, *, #', 'Domótica', 55.00, 'Tarjeta mifare + teclado (0 - 9, *, #', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1105EMB', 'Hikvision DS-K1105EMB Tarjeta m1 13.56mhz tarjeta em 125 khz sin teclado', 'Domótica', 39.00, 'Tarjeta m1 13.56mhz tarjeta em 125 khz sin teclado', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1105EMKB', 'Hikvision DS-K1105EMKB Tarjeta m1 13.56mhz tarjeta em 125 khz teclado', 'Domótica', 44.00, 'Tarjeta m1 13.56mhz tarjeta em 125 khz teclado', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1105EMKB-QR', 'Hikvision DS-K1105EMKB-QR Tarjeta m1 13.56mhz tarjeta em 125 khz teclado + qr', 'Domótica', 49.00, 'Tarjeta m1 13.56mhz tarjeta em 125 khz teclado + qr', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1107AM', 'Hikvision DS-K1107AM Tarjeta mifare', 'Domótica', 27.50, 'Tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1107AE', 'Hikvision DS-K1107AE Tarjeta em 125khz', 'Domótica', 27.50, 'Tarjeta em 125khz', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1107E', 'Hikvision DS-K1107E Tarjeta em 125khz', 'Domótica', 26.00, 'Tarjeta em 125khz', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1108AM', 'Hikvision DS-K1108AM Tarjeta mifare', 'Domótica', 29.00, 'Tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1108AE', 'Hikvision DS-K1108AE Tarjeta em 125khz', 'Domótica', 29.00, 'Tarjeta em 125khz', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1108AMK', 'Hikvision DS-K1108AMK Tarjeta mifare', 'Domótica', 34.00, 'Tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1108AEK', 'Hikvision DS-K1108AEK Tarjeta em 125khz', 'Domótica', 34.00, 'Tarjeta em 125khz', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1109DKFB', 'Hikvision DS-K1109DKFB Tarjeta desfire. felica y mifare + huella', 'Domótica', 74.00, 'Tarjeta desfire. felica y mifare + huella', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1109DKB-QR', 'Hikvision DS-K1109DKB-QR Tarjeta desfire. felica y mifare + codigo qr', 'Domótica', 74.00, 'Tarjeta desfire. felica y mifare + codigo qr', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1109DKFB-QR', 'Hikvision DS-K1109DKFB-QR Tarjeta desfire. felica y mifare + huella + qr', 'Domótica', 119.00, 'Tarjeta desfire. felica y mifare + huella + qr', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1109EKFB', 'Hikvision DS-K1109EKFB Tarjeta em + huella', 'Domótica', 74.00, 'Tarjeta em + huella', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1201AEF', 'Hikvision DS-K1201AEF Huella+tarjeta em', 'Domótica', 69.00, 'Huella+tarjeta em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1A8503MF', 'Hikvision DS-K1A8503MF Huella +tarjeta mifare 56.50 disponible control de acceso lectora de', 'Domótica', 56.50, 'Huella +tarjeta mifare 56.50 disponible control de acceso lectora de tarjetas interfaces: rs-485, wiegand (w26/w34), osdp indice de proteccion intemperie: ip65 (intemperie) alarma tamper buzzer incorporado para identificar estado de lectura función de actualización en línea lectora de tarjetas interfaces: rs-485, wiegand (w26/w34), osdp indice de proteccion intemperie: ip65 (intemperie) alarma anti-tamper buzzer incorporado para indicación de estatus configuracion de id: a través del dip switch ', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1A8503MF-B', 'Hikvision DS-K1A8503MF-B Huella +tarjeta mifare bateria respaldo', 'Domótica', 61.50, 'Huella +tarjeta mifare bateria respaldo', 'DISPONIBLE'),
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
  ('Hikvision', 'DS-K1T320MWX', 'Hikvision DS-K1T320MWX Rostro +tarjeta mifare) 85.00 disponible terminal de huella dactilar', 'Domótica', 85.00, 'Rostro +tarjeta mifare) 85.00 disponible terminal de huella dactilar intemperie ip65 / antivandalismo ik08 comunicación: tcp/ip, rs-485, salida wiegand (w26/w34) y entrada (wiegand 26/34), wi-fi entradas: boton de salida × 1, sensor puerta × 1, alarma × 2 salidas: rele (salida cerradura) × 1, salida de alarma × 1 lector de tarjeta mifare 13.56mhz (modelo ds-k1t805m) lector de tarjeta em 125khz (modelo ds-k1t805e) 3,000 huellas, 10,000 tarjetas, 100.000 eventos alimentacion 12vdc 1a terminal de a', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T320EFX', 'Hikvision DS-K1T320EFX Rostro + huella + tarjeta em', 'Domótica', 102.00, 'Rostro + huella + tarjeta em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T320EFWX', 'Hikvision DS-K1T320EFWX Rostro + huella + tarjeta em) wi-fi', 'Domótica', 107.00, 'Rostro + huella + tarjeta em) wi-fi', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T320MFWX-B', 'Hikvision DS-K1T320MFWX-B Rostro + huella + tarjeta mifare) wi-fi', 'Domótica', 99.00, 'Rostro + huella + tarjeta mifare) wi-fi', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T320EFWX-B', 'Hikvision DS-K1T320EFWX-B Rostro + huella + tarjeta em) wi-fi', 'Domótica', 99.00, 'Rostro + huella + tarjeta em) wi-fi', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T320EFWX-B/S', 'Hikvision DS-K1T320EFWX-B/S Rostro + huella + tarjeta em) wi-fi', 'Domótica', 110.00, 'Rostro + huella + tarjeta em) wi-fi', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T321MFWX', 'Hikvision DS-K1T321MFWX Rostro + huella + tarjeta mifare', 'Domótica', 90.00, 'Rostro + huella + tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T321EFWX', 'Hikvision DS-K1T321EFWX Rostro + huella + tarjeta em', 'Domótica', 90.00, 'Rostro + huella + tarjeta em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T321MFWX-B/S', 'Hikvision DS-K1T321MFWX-B/S Rostro + huella + tarjeta mifare', 'Domótica', 100.00, 'Rostro + huella + tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T321EFWX-B/S', 'Hikvision DS-K1T321EFWX-B/S Rostro + huella + tarjeta em', 'Domótica', 100.00, 'Rostro + huella + tarjeta em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T323EBWX-QRE1', 'Hikvision DS-K1T323EBWX-QRE1 Rostro + codigo qr + tarjeta em', 'Domótica', 129.00, 'Rostro + codigo qr + tarjeta em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T323EBFWX-E1', 'Hikvision DS-K1T323EBFWX-E1 Rostro + huella + tarjeta em) 130.00 disponible terminal de', 'Domótica', 130.00, 'Rostro + huella + tarjeta em) 130.00 disponible terminal de reconocimiento facial + tarjeta + huella pantalla tactil lcd 2.4", lente de 2mp multiples metodos autenticacion: rostro, tarjeta, huella, pin, etc soporta 500 rostros, 1,000 tarjetas, 100,000 eventos distancia de reconocimiento: 0.3 m a 1.5 m duracion reconocimiento facial: < 0.2 s/usuario interfaces: red tcp/ip × 1, usb × 1, cerradura eléctrica × 1, contacto puerta × 1, tamper × 1, boton de salida × 1 conexión wi-fi para las versiones ', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1A340WX', 'Hikvision DS-K1A340WX Terminal de asistencia de reconocimiento facial pantalla tactil lcd', 'Domótica', 95.00, 'Terminal de asistencia de reconocimiento facial pantalla tactil lcd 4.3" distancia de reconocimiento: 0.3 m a 1.5 m camara: camara ip 2 mp doble lente con wdr registra 1.500 rostros y 300.000 eventos genera reportes automaticamente soporta protocolos isapi / isup 5.0 comunicación: ethernet 10/100mbps; wi-fi / usb', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T341CMFW', 'Hikvision DS-K1T341CMFW Rostro +tarjeta mifare + huella) wifi', 'Domótica', 198.00, 'Rostro +tarjeta mifare + huella) wifi', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T343MWX', 'Hikvision DS-K1T343MWX Rostro +tarjeta mifare', 'Domótica', 120.00, 'Rostro +tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T343EWX', 'Hikvision DS-K1T343EWX Rostro +tarjeta em', 'Domótica', 120.00, 'Rostro +tarjeta em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T344MBWX-QRE1', 'Hikvision DS-K1T344MBWX-QRE1 Rostro + tarjeta m1 + qr) terminal poe reconocimiento facial + huella +', 'Insumos', 132.00, 'Rostro + tarjeta m1 + qr) terminal poe reconocimiento facial + huella + tarjeta pantalla tactil lcd 4.3" distancia de reconocimiento: 0.3 m a 1.5 m camara: camara ip 2 mp doble lente con wdr comunicación: ethernet 10/100mbps; wi-fi, bluetooth modulo para escanear codigos qr soporta 3000 rostros, 3000 huellas y 3000 tarjetas interfaces: usb × 1, cerradura eléctrica × 1, contacto puerta × 1, tamper × 1, boton de salida × 1, rs-485 × 1, wiegand × 1, entrada de alarma × 2, salida de alarma × 1 alime', 'DISPONIBLE'),
  ('Hikvision', 'DS-KAS321', 'Hikvision DS-KAS321 Rostro + huella + tarjeta mifare', 'Domótica', 149.50, 'Rostro + huella + tarjeta mifare', 'DISPONIBLE'),
  ('Hikvision', 'DS-KAS321/EM', 'Hikvision DS-KAS321/EM Rostro + huella + tarjeta em', 'Domótica', 149.50, 'Rostro + huella + tarjeta em', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1T670MFWX', 'Hikvision DS-K1T670MFWX Rostro + tarjeta + huella) terminal recomicimiento facial pantalla', 'Domótica', 335.00, 'Rostro + tarjeta + huella) terminal recomicimiento facial pantalla tactil lcd 7". intemperie: ip65 audio 2 vías (compatible con video porteros ip) distancia de reconocimiento: 0.3 m a 3 m lector de tarjetas m1 y huella dactilar capacidad: 6,000 rostros, 10,000 huellas, 50,000 tarjetas interfaces: red rj45 x 1, wi-fi x 1, rs-485 × 1, wiegand, usb2.0 × 2, salida alarma × 1, entrada alarma × 2, salida cerradura × 1, entrada contacto puerta × 1, boton de salida × 1, tamper × 1', 'DISPONIBLE'),
  ('Hikvision', 'DS-KAB673-FBQR', 'Hikvision DS-KAB673-FBQR Modulo lector para terminal ds ‐ k1t673dwx lector de huellas, códigos', 'Domótica', 95.00, 'Modulo lector para terminal ds ‐ k1t673dwx lector de huellas, códigos qr y bluetooth conexión usb dimensiones 110.5 mm × 23.7 mm × 47.7 mm', 'DISPONIBLE'),
  ('Hikvision', 'DS-K5604A-3XF/V', 'Hikvision DS-K5604A-3XF/V ROSTRO + FIEBRE + MASCARILLA) INCLUYE PEDESTAL SERIE ULTRA TERMINAL', 'Domótica', 999.00, 'ROSTRO + FIEBRE + MASCARILLA) INCLUYE PEDESTAL SERIE ULTRA TERMINAL RECONOCIMIENTO FACIAL + MEDICION DE TEMPERATURA Y DETECCIÓN DE FIEBRE Y MASCARILLA Pantalla LCD touch 10.1" (1024x600) Doble Camara de 2 mp,con luz complementaria (IR,WDR). Detección de temperatura corporal. Rango de detección de 30°C a 45°C Rango de precision 0.5°C. Comunicación IP (10/100/1000 Mbps) Distancia para reconocer rostro: 0.3 a 2 metros. Reconocimiento en 0.2 segundos Multiple autentificacion con temperatura Soporta ', 'DISPONIBLE'),
  ('Hikvision', 'DS-K1F820-F', 'Hikvision DS-K1F820-F Enrolador de huellas plug and play usb sin uso de dirvers, usb 2.0', 'Domótica', 58.00, 'Enrolador de huellas plug and play usb sin uso de dirvers, usb 2.0 trabaja con windows xp, 7 y 10 compatible con ivms4200 resolución 508 dpi de alta definción admite software cliente', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2812', 'Hikvision DS-K2812 Controlador de acceso ip 2 puertas (10.000 tarjetas) conexion con 1', 'Domótica', 120.00, 'Controlador de acceso ip 2 puertas (10.000 tarjetas) conexion con 1 lector rs485 y 4 lectores wiegand interfaces: 1 puerto red rj45. 2 cerraduras, 2 botones de salida, 2 contactos de puerta, 5 entradas de alarma, 4 salidas de alarma, 1 tamper.50.000 eventos', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2804', 'Hikvision DS-K2804 Controlador de acceso ip 4 puertas (10.000 tarjetas) conexion con 8', 'Domótica', 135.00, 'Controlador de acceso ip 4 puertas (10.000 tarjetas) conexion con 8 lectores de tarejta (wiegand) 4 sensor puerta, 4 boton salida, 4 entradas case, 4 rele puerta, 4 rele alarma', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2602T', 'Hikvision DS-K2602T Controlador de acceso ip 2 puertas (100.000 tarjetas) conexion con 4', 'Domótica', 220.00, 'Controlador de acceso ip 2 puertas (100.000 tarjetas) conexion con 4 lectores de tarjeta (rs485) y 4 lectores de tarejta (wiegand) 4 entadas alarma, 2 magnetico puerta, 2 switch puerta, 4 entradas case, 1 tamper, 2 rele puerta, 2 rele alarma', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2604T', 'Hikvision DS-K2604T Controlador de acceso ip 4 puertas (100.000 tarjetas) conexion con 8', 'Domótica', 275.00, 'Controlador de acceso ip 4 puertas (100.000 tarjetas) conexion con 8 lectores de tarjeta (rs485) y 4 lectores de tarejta (wiegand) 4 entadas alarma, 4 magnetico puerta, 4 switch puerta, 8 entradas case, 1 tamper, 4 rele puerta, 4 rele alarma', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2622X', 'Hikvision DS-K2622X Controlador de acceso ip 2 puertas administrable 4 lectores de huella o', 'Domótica', 220.00, 'Controlador de acceso ip 2 puertas administrable 4 lectores de huella o tarjeta (rs-485 o wiegand) administrable por interfaz web o app hik-connect teams 100,000 tarjetas / 10,000 huellas / 100,000 usuarios 4 entadas alarma, 4 salidas alarma, 2 salidas de rele', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2624X', 'Hikvision DS-K2624X Controlador de acceso ip 4 puertas administrable 4 lectores de huella o', 'Domótica', 275.00, 'Controlador de acceso ip 4 puertas administrable 4 lectores de huella o tarjeta (rs-485 o wiegand) administrable por interfaz web o app hik-connect teams 100,000 tarjetas / 10,000 huellas / 100,000 usuarios 8 entadas alarma, 4 salidas alarma, 4 salidas de rele', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2702WX-E1', 'Hikvision DS-K2702WX-E1 Controlador de acceso ip 2 puertas expandible a 126 intefaces: 1 red', 'Domótica', 365.00, 'Controlador de acceso ip 2 puertas expandible a 126 intefaces: 1 red gigabit o wifi . 2 cerraduras, 2 botones de salida, 2 contactos puerta, 4 entradas alarma, 4 salidas alarma, 1 tamper, 4 wiegand 26/34, 1 usb, 1 poe, 1 interfaz incendio, 7 rs-485 (2 para lectoras, 4 para comunicación soportando 16 modulos de acceso ds- k2m002x cada una y 1 de respaldo). alimentacion poe', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2704X', 'Hikvision DS-K2704X Controlador de acceso ip 4 puertas expandible a 128 intefaces: 1 red', 'Domótica', 375.00, 'Controlador de acceso ip 4 puertas expandible a 128 intefaces: 1 red gigabit. 4 cerraduras, 4 botones de salida, 4 contactos puerta, 8 entradas alarma, 4 salidas alarma, 1 tamper, 4 wiegand 26/34, 1 usb, 1 poe, 1 interfaz incendio, 7 rs-485 (2 para lectoras, 5 para comunicación soportando 16 modulos de acceso ds- k2m002x cada una y 1 de redundancia', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2708X', 'Hikvision DS-K2708X Controlador de acceso ip 8 puertas expandible a 128 intefaces: 1 red', 'Domótica', 560.00, 'Controlador de acceso ip 8 puertas expandible a 128 intefaces: 1 red gigabit. 8 cerraduras, 8 botones de salida, 8 contactos puerta, 16 entradas alarma, 8 salidas alarma, 1 tamper, 8 wiegand 26/34, 1 usb, 1 poe, 1 interfaz incendio, 15 rs-485 (7 para lectoras, 8 para comunicación soportando 16 modulos de acceso ds- k2m002x cada una y 1 de redundancia', 'DISPONIBLE'),
  ('Hikvision', 'DS-K4E208', 'Hikvision DS-K4E208 Cerradura hembrilla electrónica tamaño de la cerradura: 366 (l) x (w)', 'Domótica', 20.00, 'Cerradura hembrilla electrónica tamaño de la cerradura: 366 (l) x (w) 105x (h) 50 (mm) voltaje de entrada: 12 vcc corriente de trabajo: 3a temperatura de trabajo: -40+80 ℃ puerta adecuada: puerta de madera, puerta de metal desbloqueo: impulso eléctrico o llave mecánica', 'DISPONIBLE'),
  ('Hikvision', 'DS-K4E100', 'Hikvision DS-K4E100 Cerradura inteligente de motor eléctrico cerradura eléctrica', 'Domótica', 55.00, 'Cerradura inteligente de motor eléctrico cerradura eléctrica inteligente universal, no es necesario distinguir dirección de puerta, los lados izquierdo y derecho, dentro como fuera de la puerta corriente de trabajo: cc 12v ± 10%. 350 ma dimensiones: 130mm × 100mm × 61,25mm (5,12" × 3,94" × 2,41") material: acero inoxidable longitud de la lengüeta de bloqueo: 20 mm 35.00 disponible estatus control de acceso hikvision ds-k4h250s cerradura electromagnetica 280 kg (600 lb) alimentación 12vdc / 24vdc', 'DISPONIBLE'),
  ('Hikvision', 'DS-K4H258S', 'Hikvision DS-K4H258S Cerradura electromagnetica 280 kg (600 lb) alimentacion 12vdc led verde', 'Domótica', 30.00, 'Cerradura electromagnetica 280 kg (600 lb) alimentacion 12vdc led verde indicador de estatus', 'DISPONIBLE'),
  ('Hikvision', 'DS-K4H255S', 'Hikvision DS-K4H255S Cerradura electromagnetica 280 kg (600 lb) alimentacion 12vdc led verde', 'Domótica', 28.00, 'Cerradura electromagnetica 280 kg (600 lb) alimentacion 12vdc led verde indicador de estatus', 'DISPONIBLE'),
  ('Hikvision', 'DS-K4H250-LZ', 'Hikvision DS-K4H250-LZ Bracket para puerta (cerradura ds-k4h250s) soporte en l 250×47×28.5mm', 'Insumos', 30.00, 'Bracket para puerta (cerradura ds-k4h250s) soporte en l 250×47×28.5mm soporte en z 180×50×50mm', 'DISPONIBLE'),
  ('Hikvision', 'DS-K4H258-LZ', 'Hikvision DS-K4H258-LZ Bracket para puerta (cerradura ds-k4h258s) soporte en l 238×30×47mm', 'Insumos', 15.00, 'Bracket para puerta (cerradura ds-k4h258s) soporte en l 238×30×47mm soporte en z 185×44×100mm', 'DISPONIBLE'),
  ('Hikvision', 'DS-K4H255-LZ', 'Hikvision DS-K4H255-LZ Bracket para puerta (cerradura ds-k4h255s) soporte en l 238×30×47mm', 'Insumos', 14.00, 'Bracket para puerta (cerradura ds-k4h255s) soporte en l 238×30×47mm soporte en z 185×44×100mm', 'DISPONIBLE'),
  ('Hikvision', 'DS-K4H258D-LZ', 'Hikvision DS-K4H258D-LZ Bracket de puerta para cerradura doble ds-k4h258d soporte en l', 'Insumos', 30.00, 'Bracket de puerta para cerradura doble ds-k4h258d soporte en l 238×30×47mm soporte en z 185×44×100mm', 'DISPONIBLE'),
  ('Hikvision', 'DS-K4T100-U1', 'Hikvision DS-K4T100-U1 Bracket en u para hembrilla electrica puerta de cristal sin marco', 'Insumos', 8.50, 'Bracket en u para hembrilla electrica puerta de cristal sin marco. dimensiones 70×44×24.5mm distancia minima entre el marco y la puerta: 5mm', 'DISPONIBLE'),
  ('Hikvision', 'DS-K4T108-U1', 'Hikvision DS-K4T108-U1 Bracket en u para hembrilla electrica puerta de cristal sin marco', 'Insumos', 8.00, 'Bracket en u para hembrilla electrica puerta de cristal sin marco. dimensiones 70×44×24.5mm distancia minima entre el marco y la puerta: 5mm', 'DISPONIBLE'),
  ('Hikvision', 'DS-K7PEB/Red', 'Hikvision DS-K7PEB/Red Boton emergencia rompa vidrio (rojo) contactos no / nc / com', 'Domótica', 20.00, 'Boton emergencia rompa vidrio (rojo) contactos no / nc / com', 'DISPONIBLE'),
  ('Hikvision', 'DS-K7P01', 'Hikvision DS-K7P01 Boton de salida metalico (push to exit) contactos no / nc / com', 'Domótica', 10.00, 'Boton de salida metalico (push to exit) contactos no / nc / com', 'DISPONIBLE'),
  ('Hikvision', 'DS-K7P02', 'Hikvision DS-K7P02 Boton de salida metalico (push to exit) contactos no / nc / com', 'Domótica', 10.00, 'Boton de salida metalico (push to exit) contactos no / nc / com', 'DISPONIBLE'),
  ('Hikvision', 'DS-K7P05', 'Hikvision DS-K7P05 Boton de salida y emergencia (push to exit) contactos no / nc / com', 'Domótica', 15.00, 'Boton de salida y emergencia (push to exit) contactos no / nc / com acero inoxidable', 'DISPONIBLE'),
  ('Hikvision', 'DS-K7P06', 'Hikvision DS-K7P06 Boton de salida y emergencia (push to exit) contactos no / nc / com', 'Domótica', 15.00, 'Boton de salida y emergencia (push to exit) contactos no / nc / com acero inoxidable', 'DISPONIBLE'),
  ('Hikvision', 'DS-KEM125', 'Hikvision DS-KEM125 Tarjeta de proximidad em frecuencia: 125k distancia: ≤15cm', 'Domótica', 1.50, 'Tarjeta de proximidad em frecuencia: 125k distancia: ≤15cm', 'DISPONIBLE'),
  ('Hikvision', 'FM11RF08-M1', 'Hikvision FM11RF08-M1 Tarjeta de proximidad mifare® frecuencia: 13.56mhz distancia: ≤10cm', 'Domótica', 1.50, 'Tarjeta de proximidad mifare® frecuencia: 13.56mhz distancia: ≤10cm 1.50 disponible hikvision ic s50 tarjeta de proximidad mifare® frecuencia: 13.56mhz distancia: ≤10cm', 'DISPONIBLE'),
  ('Hikvision', 'S50+TK4100', 'Hikvision S50+TK4100 Tarjeta de proximidad dual mifare® + em frecuencia: 125k y 13.56mhz', 'Domótica', 1.50, 'Tarjeta de proximidad dual mifare® + em frecuencia: 125k y 13.56mhz distancia: ≤10cm', 'DISPONIBLE'),
  ('Hikvision', 'DS-K7M101-E0', 'Hikvision DS-K7M101-E0 Tarjeta inteligente sin contacto em frecuencia: 125k distancia de', 'Domótica', 1.50, 'Tarjeta inteligente sin contacto em frecuencia: 125k distancia de lectura de la tarjeta: 2.5 cm a 10 cm', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2M061', 'Hikvision DS-K2M061 Modulo de control de puerta segura comunicación rs-485 hacia biometrico', 'Domótica', 38.00, 'Modulo de control de puerta segura comunicación rs-485 hacia biometrico soporta 1 entrada wiegand dip switch 4 canales para configurar numeros de id interfaz para cerradura y botón de salida', 'DISPONIBLE');

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
from cat_acceso_2026 e
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
from cat_acceso_2026 e
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
where lower(btrim(coalesce(marca, ''))) in ('hikvision', 'hikfire', 'ubiquiti', 'omegasat')
group by 1
order by 1;

