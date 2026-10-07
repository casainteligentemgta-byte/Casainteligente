begin;
drop table if exists cat_acceso_2026;
create temporary table cat_acceso_2026 (
  marca text not null, modelo text not null, nombre text not null,
  categoria text not null, costo numeric(14,2) not null, descripcion text,
  estatus text not null, primary key (marca, modelo)
);
insert into cat_acceso_2026 (marca, modelo, nombre, categoria, costo, descripcion, estatus)
values
  ('Hikvision', 'DS-K2210', 'Hikvision DS-K2210 CONTROLADOR MAESTRO PARA ASCENSOR 128', 'Domótica', 270.00, 'CONTROLADOR MAESTRO PARA ASCENSOR 128 PI', 'DISPONIBLE'),
  ('Hikvision', 'DS-K2M0016A', 'Hikvision DS-K2M0016A Distribuidor esclavo para controla', 'Domótica', 350.00, 'Distribuidor esclavo para controlador de', 'DISPONIBLE'),
  ('Hikvision', 'WG-PRINT-58HW-USB', 'Hikvision WG-PRINT-58HW-USB Impresora térmica de tickets', 'Domótica', 120.00, 'Impresora térmica de tickets para visita', 'DISPONIBLE'),
  ('Hikvision', 'DS-TRI900-1/A', 'Hikvision DS-TRI900-1/A Lector de tarjetas uhf (tag) lar', 'Domótica', 435.00, 'Lector de tarjetas uhf (tag) largo alcan', 'DISPONIBLE'),
  ('Hikvision', 'DS-TRD902-1/A', 'Hikvision DS-TRD902-1/A Emisor / enrolador de tarjetas u', 'Domótica', 2.50, 'Emisor / enrolador de tarjetas uhf cumpl', 'DISPONIBLE'),
  ('Hikvision', 'DS-K3G200LX-R/Dm55', 'Hikvision DS-K3G200LX-R/Dm55 TORNIQUETE TIPO TRIPODE Ace', 'Domótica', 735.00, 'TORNIQUETE TIPO TRIPODE Acero inoxidable', 'DISPONIBLE'),
  ('Hikvision', 'DS-K3G200LX-R/Pg', 'Hikvision DS-K3G200LX-R/Pg - Dm55 TORNIQUETE TIPO TRIPOD', 'Domótica', 760.00, '- Dm55 TORNIQUETE TIPO TRIPODE Acero ino', 'DISPONIBLE'),
  ('Hikvision', 'DS-K3G301LX-R/Dm55', 'Hikvision DS-K3G301LX-R/Dm55 Torniquete tipo tripode bid', 'Domótica', 750.00, 'Torniquete tipo tripode bidireccional ca', 'DISPONIBLE'),
  ('Hikvision', 'DS-K3G301LX-R/Pg', 'Hikvision DS-K3G301LX-R/Pg - dm55 torniquete tipo tripod', 'Domótica', 760.00, '- dm55 torniquete tipo tripode bidirecci', 'DISPONIBLE'),
  ('Hikvision', 'DS-K3B220LX-R/Pg', 'Hikvision DS-K3B220LX-R/Pg - Dp65 Lado Derecho TORNIQUET', 'Domótica', 1725.00, '- Dp65 Lado Derecho TORNIQUETE TIPO BARR', 'DISPONIBLE'),
  ('Hikvision', 'DS-K3B220LX-M/Pg', 'Hikvision DS-K3B220LX-M/Pg - Dp90 Centro TORNIQUETE TIPO', 'Domótica', 990.00, '- Dp90 Centro TORNIQUETE TIPO BARRERA -', 'DISPONIBLE'),
  ('Hikvision', 'DS-K3B411BX-R/M', 'Hikvision DS-K3B411BX-R/M - Dp65 Lado Derecho TORNIQUETE', 'Domótica', 1415.00, '- Dp65 Lado Derecho TORNIQUETE TIPO BARR', 'DISPONIBLE'),
  ('Hikvision', 'DS-K3B501SX-L/MPg', 'Hikvision DS-K3B501SX-L/MPg - Dm65 Lado Izquierdo TORNIQ', 'Domótica', 1690.00, '- Dm65 Lado Izquierdo TORNIQUETE TIPO BA', 'DISPONIBLE'),
  ('Hikvision', 'DS-K3B501SX-M/MPg', 'Hikvision DS-K3B501SX-M/MPg - Dm65 Centro TORNIQUETE TIP', 'Domótica', 1690.00, '- Dm65 Centro TORNIQUETE TIPO BARRERA AB', 'DISPONIBLE'),
  ('Hikvision', 'DS-K6B961TDQLX', 'Hikvision DS-K6B961TDQLX - L/Dp90 Lado Izquierdo 5,999.0', 'Domótica', 9499.00, '- L/Dp90 Lado Izquierdo 5,999.00 DISPONI', 'DISPONIBLE'),
  ('Hikvision', 'DS-K6B961TEQLX', 'Hikvision DS-K6B961TEQLX - R/Dp90 Lado Derecho', 'Domótica', 5999.00, '- R/Dp90 Lado Derecho', 'DISPONIBLE'),
  ('Hikvision', 'DS-K6B961TDQLX-2', 'Hikvision DS-K6B961TDQLX-2 - M/Dp90-65 Lado Centro 90 cm', 'Domótica', 9499.00, '- M/Dp90-65 Lado Centro 90 cm / 65 cm TO', 'DISPONIBLE'),
  ('Hikvision', 'DS-K7R83X', 'Hikvision DS-K7R83X PANEL DE CONTROL REMOTO PARA TORNIQU', 'Domótica', 275.00, 'PANEL DE CONTROL REMOTO PARA TORNIQUETES', 'DISPONIBLE'),
  ('Hikvision', 'Q340-HK', 'Hikvision Q340-HK Lector de código qr - especial para to', 'Domótica', 150.00, 'Lector de código qr - especial para torn', 'DISPONIBLE'),
  ('Hikvision', 'DS-KAB-COVER', 'Hikvision DS-KAB-COVER TAPA DE PLASTICO Tapa del orifici', 'Domótica', 20.00, 'TAPA DE PLASTICO Tapa del orificio de in', 'DISPONIBLE'),
  ('Hikvision', 'DS-KAB-601COVER', 'Hikvision DS-KAB-601COVER TAPA DE ACERO INOXIDABLE Tapa', 'Domótica', 45.00, 'TAPA DE ACERO INOXIDABLE Tapa del orific', 'DISPONIBLE'),
  ('Hikvision', 'DS-KAB6-ZU1', 'Hikvision DS-KAB6-ZU1 SOPORTE PARA TERMINALES DE RECONOC', 'Domótica', 365.00, 'SOPORTE PARA TERMINALES DE RECONOCIMIENT', 'DISPONIBLE'),
  ('Hikvision', 'DS-TMG300-DR/A', 'Hikvision DS-TMG300-DR/A Brazo iluminado de 3m BARRERA V', 'Domótica', 895.00, 'Brazo iluminado de 3m BARRERA VEHICULAR', 'DISPONIBLE'),
  ('Hikvision', 'DS-TMG301-DR(2+2)', 'Hikvision DS-TMG301-DR(2+2) Brazo articulado de 4m BARRE', 'Domótica', 750.00, 'Brazo articulado de 4m BARRERA VEHICULAR', 'DISPONIBLE'),
  ('Hikvision', 'DS-TMG001-5', 'Hikvision DS-TMG001-5 3m octagonal) BRAZO RECTO DE REPUE', 'Insumos', 175.00, '3m octagonal) BRAZO RECTO DE REPUESTO PA', 'DISPONIBLE'),
  ('Hikvision', 'DS-TMG004-5', 'Hikvision DS-TMG004-5 4m) BRAZO TIPO CERCA DE REPUESTO P', 'Insumos', 345.00, '4m) BRAZO TIPO CERCA DE REPUESTO PARA BA', 'DISPONIBLE'),
  ('Hikvision', 'DS-TMT201-D', 'Hikvision DS-TMT201-D ESTACIÓN DE TICKETS DE ENTRADA DE', 'Domótica', 2450.00, 'ESTACIÓN DE TICKETS DE ENTRADA DE ESTACI', 'DISPONIBLE'),
  ('Hikvision', 'DS-TMG035', 'Hikvision DS-TMG035 Anti Fall Radar', 'Domótica', 185.00, 'Anti Fall Radar', 'DISPONIBLE'),
  ('Hikvision', 'DS-TMG035-2', 'Hikvision DS-TMG035-2 Trigger Radar', 'Domótica', 210.00, 'Trigger Radar', 'DISPONIBLE'),
  ('Hikvision', 'DS-TPE104', 'Hikvision DS-TPE104 TERMINAL DE CONTROL DE GESTIÓN PARA', 'Domótica', 1250.00, 'TERMINAL DE CONTROL DE GESTIÓN PARA ENTR', 'DISPONIBLE'),
  ('Hikvision', 'DS-TCG405-E', 'Hikvision DS-TCG405-E Camara unidad de video de entrada', 'Cámaras IP', 675.00, 'Camara unidad de video de entrada inteli', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS202T', 'Hikvision DS-KIS202T Puerta DS-KB2411-IM Monitor DS-KH22', 'Domótica', 105.00, 'Puerta DS-KB2411-IM Monitor DS-KH2220 KI', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS203T', 'Hikvision DS-KIS203T Puerta DS-KB2421-IM Monitor DS-KH22', 'Domótica', 120.00, 'Puerta DS-KB2421-IM Monitor DS-KH2220 KI', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS302-P', 'Hikvision DS-KIS302-P Puerta DS-KB2421-IM Monitor DS-KH6', 'Domótica', 145.00, 'Puerta DS-KB2421-IM Monitor DS-KH6320-WT', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS103', 'Hikvision DS-KIS103 Puerta DS-KB2421-IM Monitor DS-KH632', 'Domótica', 35.00, 'Puerta DS-KB2421-IM Monitor DS-KH6320-WT', 'DISPONIBLE'),
  ('Hikvision', 'DS-KH2220', 'Hikvision DS-KH2220 MONITOR PARA VIDEO PORTERO ANALÓGICO', 'Domótica', 55.00, 'MONITOR PARA VIDEO PORTERO ANALÓGICO Pan', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS212', 'Hikvision DS-KIS212 Puerta DS-KB2412T-IM Monitor DS-KH22', 'Domótica', 105.00, 'Puerta DS-KB2412T-IM Monitor DS-KH2230T', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS213', 'Hikvision DS-KIS213 Puerta DS-KB2422T-IM Monitor DS-KH22', 'Domótica', 105.00, 'Puerta DS-KB2422T-IM Monitor DS-KH2230T', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS213-P', 'Hikvision DS-KIS213-P Puerta DS-KB2422T-IM Monitor DS-KH', 'Domótica', 140.00, 'Puerta DS-KB2422T-IM Monitor DS-KH2230T', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS312-P', 'Hikvision DS-KIS312-P Puerta DS-KB2412T-IM Monitor DS-KH', 'Domótica', 135.00, 'Puerta DS-KB2412T-IM Monitor DS-KH6352-', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS313-P', 'Hikvision DS-KIS313-P Puerta DS-KB2412T-IM Monitor DS-KH', 'Domótica', 150.00, 'Puerta DS-KB2412T-IM Monitor DS-KH2230T', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS602', 'Hikvision DS-KIS602 Puerta DS-KD8003-IME1 Monitor DS-KH6', 'Domótica', 235.00, 'Puerta DS-KD8003-IME1 Monitor DS-KH6320-', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS604-P(B)', 'Hikvision DS-KIS604-P(B) Puerta DS-KV8113-WME1 Monitor D', 'Domótica', 200.00, 'Puerta DS-KV8113-WME1 Monitor DS-KH6320-', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS603-P(B)', 'Hikvision DS-KIS603-P(B) Puerta DS-KV6113-WPE1 Monitor D', 'Domótica', 200.00, 'Puerta DS-KV6113-WPE1 Monitor DS-KH6320-', 'DISPONIBLE'),
  ('Hikvision', 'DS-KIS606-P', 'Hikvision DS-KIS606-P Puerta DS-KV6113-PE1(C) Monitor DS', 'Domótica', 195.00, 'Puerta DS-KV6113-PE1(C) Monitor DS-KH611', 'DISPONIBLE'),
  ('Hikvision', 'DS-KH6000-E1', 'Hikvision DS-KH6000-E1 ESTACIÓN INTERIOR IP DE BAJO COST', 'Domótica', 45.00, 'ESTACIÓN INTERIOR IP DE BAJO COSTO SIN P', 'DISPONIBLE'),
  ('Hikvision', 'DS-KH6100-E1', 'Hikvision DS-KH6100-E1 ESTACIÓN INTERIOR IP DE BAJO COST', 'Domótica', 60.00, 'ESTACIÓN INTERIOR IP DE BAJO COSTO CON P', 'DISPONIBLE'),
  ('Hikvision', 'DS-KH6110-WE1', 'Hikvision DS-KH6110-WE1 ESTACIÓN INTERIOR IP DE BAJO COS', 'Domótica', 80.00, 'ESTACIÓN INTERIOR IP DE BAJO COSTO CON P', 'DISPONIBLE'),
  ('Hikvision', 'DS-KH6220-LE1', 'Hikvision DS-KH6220-LE1 NO TOUCH) MONITOR PANTALLA 7" Pa', 'Domótica', 60.00, 'NO TOUCH) MONITOR PANTALLA 7" Pantalla N', 'DISPONIBLE'),
  ('Hikvision', 'DS-KH6320-WTE1', 'Hikvision DS-KH6320-WTE1 MONITOR PANTALLA TACTIL 7" Micr', 'Domótica', 110.00, 'MONITOR PANTALLA TACTIL 7" Micrófono y A', 'DISPONIBLE'),
  ('Hikvision', 'DS-KH6350-WTE1/White', 'Hikvision DS-KH6350-WTE1/White Color Blanco MONITOR PANT', 'Domótica', 110.00, 'Color Blanco MONITOR PANTALLA TACTIL 7"', 'DISPONIBLE'),
  ('Hikvision', 'DS-KH8350-WTE1', 'Hikvision DS-KH8350-WTE1 MONITOR PANTALLA TACTIL 7" Dise', 'Domótica', 215.00, 'MONITOR PANTALLA TACTIL 7" Diseño ultra', 'DISPONIBLE'),
  ('Hikvision', 'DS-KM9503', 'Hikvision DS-KM9503 ESTACIÓN PRINCIPAL IP ANDROID TACTIL', 'Domótica', 629.00, 'ESTACIÓN PRINCIPAL IP ANDROID TACTIL DE', 'DISPONIBLE'),
  ('Hikvision', 'DS-KB8113-IME1(B)', 'Hikvision DS-KB8113-IME1(B) ESTACIÓN DE PUERTA IP - FREN', 'Domótica', 85.00, 'ESTACIÓN DE PUERTA IP - FRENTE DE CALLE', 'DISPONIBLE'),
  ('Hikvision', 'DS-KV6113-WPE1(C)', 'Hikvision DS-KV6113-WPE1(C) ESTACIÓN DE PUERTA VILLA MET', 'Domótica', 99.00, 'ESTACIÓN DE PUERTA VILLA METALICO (PUNTO', 'DISPONIBLE'),
  ('Hikvision', 'DS-KV8113-WME1(C)', 'Hikvision DS-KV8113-WME1(C) ESTACIÓN DE PUERTA VILLA MET', 'Domótica', 120.00, 'ESTACIÓN DE PUERTA VILLA METALICO (PUNTO', 'DISPONIBLE'),
  ('Hikvision', 'DS-KD9633-WBE6', 'Hikvision DS-KD9633-WBE6 ESTACIÓN PUERTA FACIAL MULTI AP', 'Domótica', 775.00, 'ESTACIÓN PUERTA FACIAL MULTI APARTAMENTO', 'DISPONIBLE'),
  ('Hikvision', 'DS-KDM9633-FKP', 'Hikvision DS-KDM9633-FKP MODULO DE HUELLA Y TECLADO PARA', 'Domótica', 104.50, 'MODULO DE HUELLA Y TECLADO PARA ESTACIÓN', 'DISPONIBLE'),
  ('Hikvision', 'DS-KD-KK', 'Hikvision DS-KD-KK MODULO DE BOTONES PARA VIDEOPORTERO M', 'Domótica', 30.00, 'MODULO DE BOTONES PARA VIDEOPORTERO MODU', 'DISPONIBLE'),
  ('Hikvision', 'DS-KD-KP', 'Hikvision DS-KD-KP MODULO DE TECLADO PARA VIDEOPORTERO M', 'Domótica', 80.00, 'MODULO DE TECLADO PARA VIDEOPORTERO MODU', 'DISPONIBLE'),
  ('Hikvision', 'DS-KD-M', 'Hikvision DS-KD-M MODULO LECTOR TARJETA PARA VIDEOPORTER', 'Domótica', 50.00, 'MODULO LECTOR TARJETA PARA VIDEOPORTERO', 'DISPONIBLE'),
  ('Hikvision', 'DS-KD-DIS', 'Hikvision DS-KD-DIS MODULO PANTALLA PARA VIDEOPORTERO MO', 'Domótica', 70.00, 'MODULO PANTALLA PARA VIDEOPORTERO MODULA', 'DISPONIBLE'),
  ('Hikvision', 'DS-KD-TDM', 'Hikvision DS-KD-TDM MODULO PANTALLA TACTIL PARA VIDEOPOR', 'Domótica', 250.00, 'MODULO PANTALLA TACTIL PARA VIDEOPORTERO', 'DISPONIBLE'),
  ('Hikvision', 'DS-KD9203-ME6', 'Hikvision DS-KD9203-ME6 ESTACIÓN DE PUERTA METALICO (PUN', 'Domótica', 360.00, 'ESTACIÓN DE PUERTA METALICO (PUNTO DE CA', 'DISPONIBLE'),
  ('Hikvision', 'DS-KD-ACF1/Plastic', 'Hikvision DS-KD-ACF1/Plastic EMPOTRAR) BASE 2 ESPACIOES', 'Domótica', 20.00, 'EMPOTRAR) BASE 2 ESPACIOES PARA VIDEOPOR', 'DISPONIBLE'),
  ('Hikvision', 'DS-KD-ACF2/Plastic', 'Hikvision DS-KD-ACF2/Plastic EMPOTRAR) BASE 2 ESPACIOES', 'Domótica', 27.00, 'EMPOTRAR) BASE 2 ESPACIOES PARA VIDEOPOR', 'DISPONIBLE'),
  ('Hikvision', 'DS-KD-ACF3/Plastic', 'Hikvision DS-KD-ACF3/Plastic EMPOTRAR) BASE 3 ESPACIOES', 'Domótica', 35.00, 'EMPOTRAR) BASE 3 ESPACIOES PARA VIDEOPOR', 'DISPONIBLE'),
  ('Hikvision', 'DS-QAZ1120G1-B/EU', 'Hikvision DS-QAZ1120G1-B/EU ALTAVOZ DE GABINETE DE RED D', 'Domótica', 70.00, 'ALTAVOZ DE GABINETE DE RED DE 20W Chips', 'DISPONIBLE'),
  ('Hikvision', 'DS-QAE1A80G1-VB', 'Hikvision DS-QAE1A80G1-VB AMPLIFICADOR IP DE 2 ZONAS DE', 'Domótica', 195.00, 'AMPLIFICADOR IP DE 2 ZONAS DE 80W Tareas', 'DISPONIBLE'),
  ('Hikvision', 'DS-QAE0206G1-V', 'Hikvision DS-QAE0206G1-V ALTAVOZ DE TECHO ANALOGICO DE 6', 'Domótica', 15.00, 'ALTAVOZ DE TECHO ANALOGICO DE 6W Altavoz', 'DISPONIBLE'),
  ('Hikvision', 'DS-QAE0420G1-V', 'Hikvision DS-QAE0420G1-V ALTAVOZ DE COLUMNA ANALOGICO Re', 'Domótica', 75.00, 'ALTAVOZ DE COLUMNA ANALOGICO Revestimien', 'DISPONIBLE'),
  ('Hikvision', 'DS-QAE0206G1E-V', 'Hikvision DS-QAE0206G1E-V ALTAVOZ DE TECHO ANALOGICO Al', 'Domótica', 170.00, 'ALTAVOZ DE TECHO ANALOGICO Al adoptar un', 'DISPONIBLE'),
  ('Hikvision', 'DS-TDSB00-EKT', 'Hikvision DS-TDSB00-EKT RADAR DE DETECCIÓN DE CAIDAS Sin', 'Domótica', 190.00, 'RADAR DE DETECCIÓN DE CAIDAS Sin divulga', 'DISPONIBLE'),
  ('Hikfire', 'HF-S2', 'Hikfire HF-S2 DETECTOR DE HUMO AUTONOMO (STAND-ALONE) De', 'Domótica', 15.00, 'DETECTOR DE HUMO AUTONOMO (STAND-ALONE)', 'DISPONIBLE'),
  ('Hikfire', 'HF-GN110', 'Hikfire HF-GN110 DETECTOR DE GAS NATURAL METANO CH4 (STA', 'Domótica', 34.00, 'DETECTOR DE GAS NATURAL METANO CH4 (STAN', 'DISPONIBLE'),
  ('Hikfire', 'HF-GP110', 'Hikfire HF-GP110 DETECTOR DE GAS LP PROPANO C3H8 (STAND-', 'Domótica', 36.50, 'DETECTOR DE GAS LP PROPANO C3H8 (STAND-A', 'DISPONIBLE'),
  ('Hikfire', 'HF-CAB1', 'Hikfire HF-CAB1 TIMBRE DE ALARMA CONVENCIONAL Con una cu', 'Domótica', 15.00, 'TIMBRE DE ALARMA CONVENCIONAL Con una cu', 'DISPONIBLE'),
  ('Hikvision', 'DS-PHA20-W2P', 'Hikvision DS-PHA20-W2P Acceso a 2 camaras ip estandar 80', 'Domótica', 75.00, 'Acceso a 2 camaras ip estandar 802.11b/g', 'DISPONIBLE'),
  ('Hikvision', 'DS-PHA32-P/LA', 'Hikvision DS-PHA32-P/LA Central de alarma hibrida de 32', 'Domótica', 79.00, 'Central de alarma hibrida de 32 zonas (c', 'DISPONIBLE'),
  ('Hikvision', 'DS-PHA48-EP', 'Hikvision DS-PHA48-EP Central de alarma hibrida 48 zonas', 'Domótica', 89.00, 'Central de alarma hibrida 48 zonas (caja', 'DISPONIBLE'),
  ('Hikvision', 'DS-PHA64-LP', 'Hikvision DS-PHA64-LP Central de alarma hibrida 64zonas', 'Domótica', 99.00, 'Central de alarma hibrida 64zonas (caja', 'DISPONIBLE'),
  ('Hikvision', 'DS-PHA64-Kit-WB', 'Hikvision DS-PHA64-Kit-WB Kit alarma ax pro hibrido 64 z', 'Domótica', 124.00, 'Kit alarma ax pro hibrido 64 zonas conti', 'DISPONIBLE'),
  ('Hikvision', 'DS-PHA64-W4P2', 'Hikvision DS-PHA64-W4P2 Central de alarma hibrida caja m', 'Domótica', 99.00, 'Central de alarma hibrida caja metálica', 'DISPONIBLE'),
  ('Hikvision', 'DS-PA-Battery', 'Hikvision DS-PA-Battery Batería de respaldo para panel d', 'Domótica', 24.00, 'Batería de respaldo para panel de alarma', 'DISPONIBLE'),
  ('Hikvision', 'DS-PKG-H8L', 'Hikvision DS-PKG-H8L 8 zonas', 'Domótica', 30.00, '8 zonas', 'DISPONIBLE'),
  ('Hikvision', 'DS-PK-L', 'Hikvision DS-PK-L Blanco) teclado cableado lcd (color bl', 'Domótica', 29.00, 'Blanco) teclado cableado lcd (color blan', 'DISPONIBLE');

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
