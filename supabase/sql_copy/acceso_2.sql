begin;
drop table if exists cat_acceso_2026;
create temporary table cat_acceso_2026 (
  marca text not null, modelo text not null, nombre text not null,
  categoria text not null, costo numeric(14,2) not null, descripcion text,
  estatus text not null, primary key (marca, modelo)
);
insert into cat_acceso_2026 (marca, modelo, nombre, categoria, costo, descripcion, estatus)
values
  ('Hikvision', 'DS-K2210', 'Hikvision DS-K2210 CONTROLADOR MAESTRO PARA ASCENSOR', 'Domótica', 270.00, 'CONTROLADOR MAESTRO PARA ASCENSOR 12', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2M0016A', 'Hikvision DS-K2M0016A Distribuidor esclavo para cont', 'Domótica', 350.00, 'Distribuidor esclavo para controlado', 'DISPONIBLE'),
  ('Hikvision', 'WG-PRINT-58HW-USB', 'Hikvision WG-PRINT-58HW-USB Impresora térmica de tic', 'Domótica', 120.00, 'Impresora térmica de tickets para vi', 'DISPONIBLE'),
  ('Hikvision', 'DS-TRI900-1/A', 'Hikvision DS-TRI900-1/A Lector de tarjetas uhf (tag)', 'Domótica', 435.00, 'Lector de tarjetas uhf (tag) largo a', 'DISPONIBLE'),
  ('Hikvision', 'DS-TRD902-1/A', 'Hikvision DS-TRD902-1/A Emisor / enrolador de tarjet', 'Domótica', 2.50, 'Emisor / enrolador de tarjetas uhf c', 'DISPONIBLE'),
  ('Hikvision', 'DS-K3G200LX-R/Dm55', 'Hikvision DS-K3G200LX-R/Dm55 TORNIQUETE TIPO TRIPODE', 'Domótica', 735.00, 'TORNIQUETE TIPO TRIPODE Acero inoxid', 'DISPONIBLE'),
  ('Hikvision', 'DS-K3G200LX-R/Pg', 'Hikvision DS-K3G200LX-R/Pg - Dm55 TORNIQUETE TIPO TR', 'Domótica', 760.00, '- Dm55 TORNIQUETE TIPO TRIPODE Acero', 'DISPONIBLE'),
  ('Hikvision', 'DS-K3G301LX-R/Dm55', 'Hikvision DS-K3G301LX-R/Dm55 Torniquete tipo tripode', 'Domótica', 750.00, 'Torniquete tipo tripode bidirecciona', 'DISPONIBLE'),
  ('Hikvision', 'DS-K3G301LX-R/Pg', 'Hikvision DS-K3G301LX-R/Pg - dm55 torniquete tipo tr', 'Domótica', 760.00, '- dm55 torniquete tipo tripode bidir', 'DISPONIBLE'),
  ('Hikvision', 'DS-K3B220LX-R/Pg', 'Hikvision DS-K3B220LX-R/Pg - Dp65 Lado Derecho TORNI', 'Domótica', 1725.00, '- Dp65 Lado Derecho TORNIQUETE TIPO', 'DISPONIBLE'),
  ('Hikvision', 'DS-K3B220LX-M/Pg', 'Hikvision DS-K3B220LX-M/Pg - Dp90 Centro TORNIQUETE', 'Domótica', 990.00, '- Dp90 Centro TORNIQUETE TIPO BARRER', 'DISPONIBLE'),
  ('Hikvision', 'DS-K3B411BX-R/M', 'Hikvision DS-K3B411BX-R/M - Dp65 Lado Derecho TORNIQ', 'Domótica', 1415.00, '- Dp65 Lado Derecho TORNIQUETE TIPO', 'DISPONIBLE'),
  ('Hikvision', 'DS-K3B501SX-L/MPg', 'Hikvision DS-K3B501SX-L/MPg - Dm65 Lado Izquierdo TO', 'Domótica', 1690.00, '- Dm65 Lado Izquierdo TORNIQUETE TIP', 'DISPONIBLE'),
  ('Hikvision', 'DS-K3B501SX-M/MPg', 'Hikvision DS-K3B501SX-M/MPg - Dm65 Centro TORNIQUETE', 'Domótica', 1690.00, '- Dm65 Centro TORNIQUETE TIPO BARRER', 'DISPONIBLE'),
  ('Hikvision', 'DS-K6B961TDQLX', 'Hikvision DS-K6B961TDQLX - L/Dp90 Lado Izquierdo 5,9', 'Domótica', 9499.00, '- L/Dp90 Lado Izquierdo 5,999.00 DIS', 'DISPONIBLE'),
  ('Hikvision', 'DS-K6B961TEQLX', 'Hikvision DS-K6B961TEQLX - R/Dp90 Lado Derecho', 'Domótica', 5999.00, '- R/Dp90 Lado Derecho', 'DISPONIBLE'),
  ('Hikvision', 'DS-K6B961TDQLX-2', 'Hikvision DS-K6B961TDQLX-2 - M/Dp90-65 Lado Centro 9', 'Domótica', 9499.00, '- M/Dp90-65 Lado Centro 90 cm / 65 c', 'DISPONIBLE'),
  ('Hikvision', 'DS-K7R83X', 'Hikvision DS-K7R83X PANEL DE CONTROL REMOTO PARA TOR', 'Domótica', 275.00, 'PANEL DE CONTROL REMOTO PARA TORNIQU', 'DISPONIBLE'),
  ('Hikvision', 'Q340-HK', 'Hikvision Q340-HK Lector de código qr - especial par', 'Domótica', 150.00, 'Lector de código qr - especial para', 'DISPONIBLE'),
  ('Hikvision', 'DS-KAB-COVER', 'Hikvision DS-KAB-COVER TAPA DE PLASTICO Tapa del ori', 'Domótica', 20.00, 'TAPA DE PLASTICO Tapa del orificio d', 'DISPONIBLE'),
  ('Hikvision', 'DS-KAB-601COVER', 'Hikvision DS-KAB-601COVER TAPA DE ACERO INOXIDABLE T', 'Domótica', 45.00, 'TAPA DE ACERO INOXIDABLE Tapa del or', 'DISPONIBLE'),
  ('Hikvision', 'DS-KAB6-ZU1', 'Hikvision DS-KAB6-ZU1 SOPORTE PARA TERMINALES DE REC', 'Domótica', 365.00, 'SOPORTE PARA TERMINALES DE RECONOCIM', 'DISPONIBLE'),
  ('Hikvision', 'DS-TMG300-DR/A', 'Hikvision DS-TMG300-DR/A Brazo iluminado de 3m BARRE', 'Domótica', 895.00, 'Brazo iluminado de 3m BARRERA VEHICU', 'DISPONIBLE'),
  ('Hikvision', 'DS-TMG301-DR(2+2)', 'Hikvision DS-TMG301-DR(2+2) Brazo articulado de 4m B', 'Domótica', 750.00, 'Brazo articulado de 4m BARRERA VEHIC', 'DISPONIBLE'),
  ('Hikvision', 'DS-TMG001-5', 'Hikvision DS-TMG001-5 3m octagonal) BRAZO RECTO DE R', 'Insumos', 175.00, '3m octagonal) BRAZO RECTO DE REPUEST', 'DISPONIBLE'),
  ('Hikvision', 'DS-TMG004-5', 'Hikvision DS-TMG004-5 4m) BRAZO TIPO CERCA DE REPUES', 'Insumos', 345.00, '4m) BRAZO TIPO CERCA DE REPUESTO PAR', 'DISPONIBLE'),
  ('Hikvision', 'DS-TMT201-D', 'Hikvision DS-TMT201-D ESTACIÓN DE TICKETS DE ENTRADA', 'Domótica', 2450.00, 'ESTACIÓN DE TICKETS DE ENTRADA DE ES', 'DISPONIBLE'),
  ('Hikvision', 'DS-TMG035', 'Hikvision DS-TMG035 Anti Fall Radar', 'Domótica', 185.00, 'Anti Fall Radar', 'DISPONIBLE'),
  ('Hikvision', 'DS-TMG035-2', 'Hikvision DS-TMG035-2 Trigger Radar', 'Domótica', 210.00, 'Trigger Radar', 'DISPONIBLE'),
  ('Hikvision', 'DS-TPE104', 'Hikvision DS-TPE104 TERMINAL DE CONTROL DE GESTIÓN P', 'Domótica', 1250.00, 'TERMINAL DE CONTROL DE GESTIÓN PARA', 'DISPONIBLE'),
  ('Hikvision', 'DS-TCG405-E', 'Hikvision DS-TCG405-E Camara unidad de video de entr', 'Cámaras IP', 675.00, 'Camara unidad de video de entrada in', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS202T', 'Hikvision DS-KIS202T Puerta DS-KB2411-IM Monitor DS-', 'Domótica', 105.00, 'Puerta DS-KB2411-IM Monitor DS-KH222', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS203T', 'Hikvision DS-KIS203T Puerta DS-KB2421-IM Monitor DS-', 'Domótica', 120.00, 'Puerta DS-KB2421-IM Monitor DS-KH222', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS302-P', 'Hikvision DS-KIS302-P Puerta DS-KB2421-IM Monitor DS', 'Domótica', 145.00, 'Puerta DS-KB2421-IM Monitor DS-KH632', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS103', 'Hikvision DS-KIS103 Puerta DS-KB2421-IM Monitor DS-K', 'Domótica', 35.00, 'Puerta DS-KB2421-IM Monitor DS-KH632', 'DISPONIBLE'),
  ('Hikvision', 'DS-KH2220', 'Hikvision DS-KH2220 MONITOR PARA VIDEO PORTERO ANALÓ', 'Domótica', 55.00, 'MONITOR PARA VIDEO PORTERO ANALÓGICO', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS212', 'Hikvision DS-KIS212 Puerta DS-KB2412T-IM Monitor DS-', 'Domótica', 105.00, 'Puerta DS-KB2412T-IM Monitor DS-KH22', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS213', 'Hikvision DS-KIS213 Puerta DS-KB2422T-IM Monitor DS-', 'Domótica', 105.00, 'Puerta DS-KB2422T-IM Monitor DS-KH22', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS213-P', 'Hikvision DS-KIS213-P Puerta DS-KB2422T-IM Monitor D', 'Domótica', 140.00, 'Puerta DS-KB2422T-IM Monitor DS-KH22', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS312-P', 'Hikvision DS-KIS312-P Puerta DS-KB2412T-IM Monitor D', 'Domótica', 135.00, 'Puerta DS-KB2412T-IM Monitor DS-KH63', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS313-P', 'Hikvision DS-KIS313-P Puerta DS-KB2412T-IM Monitor D', 'Domótica', 150.00, 'Puerta DS-KB2412T-IM Monitor DS-KH22', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS602', 'Hikvision DS-KIS602 Puerta DS-KD8003-IME1 Monitor DS', 'Domótica', 235.00, 'Puerta DS-KD8003-IME1 Monitor DS-KH6', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS604-P(B)', 'Hikvision DS-KIS604-P(B) Puerta DS-KV8113-WME1 Monit', 'Domótica', 200.00, 'Puerta DS-KV8113-WME1 Monitor DS-KH6', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS603-P(B)', 'Hikvision DS-KIS603-P(B) Puerta DS-KV6113-WPE1 Monit', 'Domótica', 200.00, 'Puerta DS-KV6113-WPE1 Monitor DS-KH6', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS606-P', 'Hikvision DS-KIS606-P Puerta DS-KV6113-PE1(C) Monito', 'Domótica', 195.00, 'Puerta DS-KV6113-PE1(C) Monitor DS-K', 'DISPONIBLE'),
  ('Hikvision', 'DS-KH6000-E1', 'Hikvision DS-KH6000-E1 ESTACIÓN INTERIOR IP DE BAJO', 'Domótica', 45.00, 'ESTACIÓN INTERIOR IP DE BAJO COSTO S', 'DISPONIBLE'),
  ('Hikvision', 'DS-KH6100-E1', 'Hikvision DS-KH6100-E1 ESTACIÓN INTERIOR IP DE BAJO', 'Domótica', 60.00, 'ESTACIÓN INTERIOR IP DE BAJO COSTO C', 'DISPONIBLE'),
  ('Hikvision', 'DS-KH6110-WE1', 'Hikvision DS-KH6110-WE1 ESTACIÓN INTERIOR IP DE BAJO', 'Domótica', 80.00, 'ESTACIÓN INTERIOR IP DE BAJO COSTO C', 'DISPONIBLE'),
  ('Hikvision', 'DS-KH6220-LE1', 'Hikvision DS-KH6220-LE1 NO TOUCH) MONITOR PANTALLA 7', 'Domótica', 60.00, 'NO TOUCH) MONITOR PANTALLA 7 Pantall', 'DISPONIBLE'),
  ('Hikvision', 'DS-KH6320-WTE1', 'Hikvision DS-KH6320-WTE1 MONITOR PANTALLA TACTIL 7 M', 'Domótica', 110.00, 'MONITOR PANTALLA TACTIL 7 Micrófono', 'DISPONIBLE'),
  ('Hikvision', 'DS-KH6350-WTE1/White', 'Hikvision DS-KH6350-WTE1/White Color Blanco MONITOR', 'Domótica', 110.00, 'Color Blanco MONITOR PANTALLA TACTIL', 'DISPONIBLE'),
  ('Hikvision', 'DS-KH8350-WTE1', 'Hikvision DS-KH8350-WTE1 MONITOR PANTALLA TACTIL 7 D', 'Domótica', 215.00, 'MONITOR PANTALLA TACTIL 7 Diseño ult', 'DISPONIBLE'),
  ('Hikvision', 'DS-KM9503', 'Hikvision DS-KM9503 ESTACIÓN PRINCIPAL IP ANDROID TA', 'Domótica', 629.00, 'ESTACIÓN PRINCIPAL IP ANDROID TACTIL', 'DISPONIBLE'),
  ('Hikvision', 'DS-KB8113-IME1(B)', 'Hikvision DS-KB8113-IME1(B) ESTACIÓN DE PUERTA IP -', 'Domótica', 85.00, 'ESTACIÓN DE PUERTA IP - FRENTE DE CA', 'DISPONIBLE'),
  ('Hikvision', 'DS-KV6113-WPE1(C)', 'Hikvision DS-KV6113-WPE1(C) ESTACIÓN DE PUERTA VILLA', 'Domótica', 99.00, 'ESTACIÓN DE PUERTA VILLA METALICO (P', 'DISPONIBLE'),
  ('Hikvision', 'DS-KV8113-WME1(C)', 'Hikvision DS-KV8113-WME1(C) ESTACIÓN DE PUERTA VILLA', 'Domótica', 120.00, 'ESTACIÓN DE PUERTA VILLA METALICO (P', 'DISPONIBLE'),
  ('Hikvision', 'DS-KD9633-WBE6', 'Hikvision DS-KD9633-WBE6 ESTACIÓN PUERTA FACIAL MULT', 'Domótica', 775.00, 'ESTACIÓN PUERTA FACIAL MULTI APARTAM', 'DISPONIBLE'),
  ('Hikvision', 'DS-KDM9633-FKP', 'Hikvision DS-KDM9633-FKP MODULO DE HUELLA Y TECLADO', 'Domótica', 104.50, 'MODULO DE HUELLA Y TECLADO PARA ESTA', 'DISPONIBLE');

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
