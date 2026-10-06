-- =============================================================================
-- Catálogo Ezviz — lista instalador octubre 2026
-- Supabase → SQL Editor → Run (una sola vez; es idempotente por marca+modelo)
--
-- Fuente: Lista de Precios Ezviz Instalador Octubre 2026 v1
-- Moneda: USD
-- 83 SKU (se omitió CS-BC2-A0-2C2WPFB: en tránsito sin precio;
-- duplicados LC1C y BC1-B1 del PDF se cargan una sola vez).
--
-- costo  = precio instalador del PDF
-- precio = mismo valor (sin margen de reventa inventado)
-- utilidad = 0
-- cantidad de filas NUEVAS = 0 (no toca stock de filas ya existentes)
--
-- Si ya existe Ezviz con el mismo modelo: actualiza nombre, categoría,
-- descripción, costo, precio y utilidad. No pisa foto, cantidad ni manual.
-- No usa updated_at: esa columna no está en products de producción.
-- =============================================================================

begin;

create temporary table ezviz_oct2026 (
  modelo text primary key,
  nombre text not null,
  categoria text not null,
  costo numeric(14,2) not null,
  descripcion text,
  estatus text not null
);

insert into ezviz_oct2026 (modelo, nombre, categoria, costo, descripcion, estatus)
values
  ('CS-CB1-R100-1K2WF', 'Ezviz CB1 interior 1080P WiFi con batería', 'Cámaras IP', 56.39, 'Cámara interior IP HD 1080P WiFi, incluye batería. IR 5 m, 3D DNR, WDR digital, microSD hasta 512 GB y Ezviz Cloud, micrófono y altavoz, audio 2 vías, detección de humano, modo sleep, H.265, ángulo 108°, base magnética. Batería 1600 mAh hasta 40 días.', 'DISPONIBLE'),
  ('CS-CB2-R100-2D2WF-BK', 'Ezviz CB2 interior WiFi con batería', 'Cámaras IP', 83.73, 'Cámara interior WiFi + batería, visión nocturna IR, detección inteligente de personas, audio bidireccional, base magnética, Google y Alexa, microSD hasta 512 GB y Ezviz CloudPlay.', 'TRANSITO'),
  ('CS-H1c-R101-1G2WR', 'Ezviz H1c interior 1080P WiFi', 'Cámaras IP', 29.90, 'Cámara interior IP 1080P WiFi, IR 10 m, 3D DNR, WDR digital, microSD hasta 512 GB, micrófono y altavoz, audio 2 vías, detección de movimiento, modo sleep, H.265, ángulo 108°, base magnética.', 'DISPONIBLE'),
  ('CS-H5-R201-1H3EKFL', 'Ezviz H5 PoE 4G 2K doble lente', 'Cámaras IP', 51.60, 'H5 PoE 4G 2K con doble lente 4 mm y 6 mm. Visión nocturna IR hasta 30 m, audio 2 vías, IP67, 3D DNR, WDR digital, H.265/H.264, microSD 512 GB, detección de forma humana y movimiento.', 'DISPONIBLE'),
  ('CS-H6c-R105-1L3WF', 'Ezviz H6c 3MP 2K interior WiFi PT', 'Cámaras IP', 36.74, 'H6c HD 1080P WiFi 2K 3MP, IR 10 m, 3D DNR, WDR digital, microSD 256 GB, audio 2 vías, rastreo automático, ángulo 90° diagonal / 80° horizontal / 43° vertical, modo privacidad, detección de movimiento.', 'DISPONIBLE'),
  ('CS-H6c-R105-1J5WF', 'Ezviz H6c 5MP 3K interior WiFi PT', 'Cámaras IP', 44.43, 'H6c 5MP interior WiFi giratoria 3K, doble banda 2.4/5 GHz, IR 10 m, microSD 256 GB, audio 2 vías, rastreo con zoom, rotación H 87° V 53°, modo patrulla, detección de forma humana y ruido, lente 4 mm.', 'DISPONIBLE'),
  ('CS-H6C-R105-8H8WF', 'Ezviz H6c Pro 4K 8MP interior PTZ', 'Cámaras IP', 57.41, 'H6c Pro 4K 8MP motorizada PTZ 360° WiFi, zoom, visión a color Starlight, detección mascota/humano por IA, rastreo auto zoom, llamada 2 vías, doble banda, modo privacidad, microSD 512 GB y nube. IR 10 m, Type-C.', 'TRANSITO'),
  ('CS-H6c-R200-8H8WFL', 'Ezviz H6c 4K 8MP PT WiFi + LAN', 'Cámaras IP', 63.22, '4K Ultra HD 8 MP, pan 350° e inclinación 85°, audio bidireccional, detección humana, mascotas y ruido, seguimiento con zoom y patrulla, WiFi doble banda y puerto Ethernet, microSD 512 GB y CloudPlay.', 'DISPONIBLE'),
  ('CS-H7c-R100-8G44WF', 'Ezviz H7c 2K+ dual lente WiFi 6', 'Cámaras IP', 70.06, 'H7c 2K+ motorizada PT WiFi doble lente, vista panorámica, llamadas bidireccionales con botón táctil, visión nocturna en color, IA humana, detección de ruido, WiFi 6 2.4/5 GHz, Google y Alexa, microSD 512 GB, H.265.', 'DISPONIBLE'),
  ('CS-H7c-R101-8H44WF', 'Ezviz H7c 2K+ dual lente (R101)', 'Cámaras IP', 70.06, 'H7c 2K+ motorizada PT WiFi doble lente, vista panorámica, llamadas bidireccionales, visión nocturna en color, IA humana, WiFi 6 2.4/5 GHz, Google y Alexa, microSD 512 GB, H.265.', 'DISPONIBLE'),
  ('CS-C8PF-A0-6E22WFR', 'Ezviz C8PF exterior PT 1080P dual lente', 'Cámaras IP', 120.29, 'Exterior IP65 PT WiFi HD 1080P 2MP, H.265, lente dual, PiP, zoom 8x mixto, detección de movimiento y luz estroboscópica, visión nocturna a color 24/7, IR 30 m, IA de figura humana, microSD 512 GB.', 'DISPONIBLE'),
  ('CS-H8C-R100-1K2WKFL(4mm)', 'Ezviz H8c 2MP exterior PT 4 mm', 'Cámaras IP', 66.63, 'H8c 2MP exterior PT panorámica 360°. Cloud Ezviz, IA de silueta humana, auto rastreo, visión nocturna a color 24/7, audio 2 vías, Alexa y Google, microSD 512 GB, sirena y luz estroboscópica, H.265.', 'DISPONIBLE'),
  ('CS-H8c-R100-1J4WKFL(4mm)(US-STD)(Mu)', 'Ezviz H8c 4MP exterior PT 4 mm', 'Cámaras IP', 66.13, 'H8c HD 4MP exterior PT panorámica 360°. Cloud Ezviz, IA humana, auto rastreo, visión nocturna a color 24/7, audio 2 vías, Alexa y Google, microSD 512 GB, sirena y luz estroboscópica, H.265.', 'TRANSITO'),
  ('CS-H8c-R200-1J4WKFL', 'Ezviz H8c 2MP 4 mm exterior PT (R200)', 'Cámaras IP', 75.18, 'H8c HD 2MP 4 mm panorámica 360° exterior PT. Cloud Ezviz, IA humana, auto rastreo, visión nocturna a color, audio 2 vías, microSD 512 GB, sirena, H.265, IR hasta 30 m.', 'DISPONIBLE'),
  ('CS-H8c-R200-1K3EKFL(4mm)(US-STD)(Mu)', 'Ezviz H8c PoE 2K exterior PT 4 mm', 'Cámaras IP', 70.06, 'H8c PoE 2K exterior PT panorámica. Cloud Ezviz, IA humana, auto rastreo, visión nocturna a color 24/7, audio 2 vías, Alexa y Google, microSD 512 GB, sirena y luz estroboscópica, H.265.', 'DISPONIBLE'),
  ('CS-H8c-R200-1K3WKFL(4mm)', 'Ezviz H8c 3MP 2K exterior PT 4 mm', 'Cámaras IP', 70.06, 'H8c 3MP 2K, movimiento horizontal y vertical, panorámica 360°, IA de personas, seguimiento automático, sirena y luz estroboscópica, visión nocturna a color, audio bidireccional, H.265, microSD 512 GB.', 'DISPONIBLE'),
  ('CS-H8-R100-1J5WKFL-4mm', 'Ezviz H8 Pro 3K 6MP exterior PT 4 mm', 'Cámaras IP', 94.25, 'H8 Pro 3K 6MP exterior PT 360°. Cloud Ezviz, IA humana y vehicular, auto rastreo, visión nocturna a color 24/7, audio 2 vías, gesto para llamada, Alexa y Google, microSD 512 GB, sirena y estrobo, H.265.', 'DISPONIBLE'),
  ('CS-H8c-R200-1J5WKFL', 'Ezviz H8c Pro 3K 6MP exterior PT', 'Cámaras IP', 76.89, 'H8 Pro 3K 6MP exterior PT 360°. Cloud Ezviz, IA humana y vehicular, auto rastreo, visión nocturna a color, audio 2 vías, Alexa y Google, microSD 512 GB, sirena y estrobo, H.265.', 'DISPONIBLE'),
  ('CS-H8c-R200-8H8WKFL', 'Ezviz H8c Pro 4K 8MP exterior PT', 'Cámaras IP', 85.44, 'H8c Pro 4K 8MP exterior PT panorámica 360°. Cloud Ezviz, IA humana y vehicular, auto rastreo, visión nocturna a color 24/7, audio 2 vías, Alexa y Google, microSD 512 GB, sirena y estrobo, H.265.', 'DISPONIBLE'),
  ('CS-H80x-R100-8G82WKFL', 'Ezviz H80x Dual 4K exterior PT', 'Cámaras IP', 114.49, 'H80x Dual 4K exterior PT. Panorámica 360°, Cloud Ezviz, IA humana y vehicular, auto rastreo, visión nocturna a color, audio 2 vías, Alexa y Google, microSD 512 GB, sirena y estrobo, H.265.', 'DISPONIBLE'),
  ('CS-H80f-R100-8G444WKFL', 'Ezviz H80f 2K+ triple lente exterior PT', 'Cámaras IP', 109.36, 'H80f 2K+ triple lente 2.8 + 6 + 12 mm, HD 4MP exterior PT, zoom 12x, panorámica 360°. Cloud Ezviz, IA humana y vehicular, auto rastreo, visión nocturna a color, audio 2 vías, microSD 512 GB, sirena y estrobo.', 'DISPONIBLE'),
  ('CS-HB8c/SP-R100', 'Ezviz HB8 Lite 2K+ kit con panel solar 5W', 'Cámaras IP', 182.84, 'Kit HB8 Lite 2K+ (4MP) con panel solar 5 W. 360° con giro H/V, visión nocturna, WiFi 6 2.4 GHz, Alexa y Google, IP65, microSD 512 GB.', 'TRANSITO'),
  ('CS-EB8/SP-R100(3MP Type-C)', 'Ezviz EB8 4G 2K exterior PT (Type-C)', 'Cámaras IP', 186.00, 'EB8 4G 2K exterior PT, LTE, GPS, panorámica, batería 10400 mAh, IA humana, audio bidireccional, visión nocturna a color, sirena y estrobo, intemperie. Panel solar Type-C, microSD 512 GB y Cloud. No incluye SIM.', 'DISPONIBLE'),
  ('CS-EB8-R100-1K3FL4GA-LA(AM-STD)', 'Ezviz EB8 4G 2K con batería (sin SIM)', 'Cámaras IP', 161.00, 'EB8 4G exterior PT con batería, 4MP 2K, 360°, hasta 210 días (10400 mAh), GPS, microSD 512 GB y Cloud, IA humana, auto rastreo, visión nocturna a color, audio 2 vías, panel solar, Alexa y Google. No incluye SIM.', 'DISPONIBLE'),
  ('CS-CB8c/SP-R100', 'Ezviz CB8 Lite 2K+ kit con panel solar', 'Cámaras IP', 136.70, 'CB8 Lite kit 4MP 2K+ exterior PT, WiFi, panel solar incluido, 2560×1440, IR hasta 15 m, H.265/H.264, color blanco.', 'DISPONIBLE'),
  ('CS-CB8/SP-R105(3MP Type-C)', 'Ezviz CB8 2K exterior PT con panel Type-C', 'Cámaras IP', 145.00, 'CB8 2K exterior PT WiFi, 360°, batería 10400 mAh (210 días), IA humana, audio bidireccional, rastreo, visión nocturna a color, sirena y estrobo, intemperie, panel solar Type-C, microSD 256 GB.', 'TRANSITO'),
  ('CS-CB8/SP-R200', 'Ezviz CB8 Pro 4K kit con panel solar', 'Cámaras IP', 187.96, 'CB8 Pro kit 8MP 4K, vídeo siempre activo 2.0, panorámica 360°, batería 10400 mAh, IA humana/vehículo, paneles solares Type-C incluidos, audio bidireccional, IR 15 m, microSD 512 GB y CloudPlay.', 'DISPONIBLE'),
  ('CS-HB90/SP-R100', 'Ezviz HB90 dual 2K kit con panel solar', 'Cámaras IP', 210.18, 'Kit WiFi dual 2K + panel solar, 360°, WiFi 6 2.4 GHz, visión nocturna a color, doble rotación, audio bidireccional, sirena y estrobo, IP65, microSD 512 GB y CloudPlay.', 'TRANSITO'),
  ('CS-H9c-R100-8H33WKFL', 'Ezviz H9c Dual 2K 4MP exterior PT', 'Cámaras IP', 90.56, 'H9c Dual 2K 4MP, lentes 2K+2K, exterior PT, dos modos de patrulla, IA humana/vehicular, 360°, visión nocturna en color, audio bidireccional, sirena y estrobo, intemperie, H.265, Alexa y Google, microSD 512 GB.', 'TRANSITO'),
  ('CS-H9c-R100-8G55WKFL', 'Ezviz H9c Dual 3K 6MP exterior PT', 'Cámaras IP', 99.11, 'H9c Dual 3K 6MP, lentes 3K+3K, exterior PT WiFi, 360°, audio bidireccional, visión nocturna a color 24/7, patrulla, sirena y estrobo, intemperie, H.265, Alexa y Google, microSD 512 GB.', 'TRANSITO'),
  ('CS-H9c-R105-8H55WFL4GA', 'Ezviz H9c Dual 3K WiFi 6', 'Cámaras IP', 114.49, 'H9c Dual 3K, WiFi 6 2.4/5 GHz, PT, seguimiento inteligente, dos modos de patrulla, IA humana/vehículo, 360°, visión nocturna en color, audio bidireccional, sirena y estrobo, intemperie.', 'DISPONIBLE'),
  ('CS-H90-R100-8H44WKFL', 'Ezviz H90 Dual 2K+ 8MP exterior PT', 'Cámaras IP', 107.65, 'Dual 2K+ y 2K+ 8MP, lentes 2.8+6 mm, exterior PT 360°, audio bidireccional, visión nocturna a color, patrulla, sirena y estrobo, intemperie, H.265, Alexa y Google, microSD 512 GB.', 'TRANSITO'),
  ('CS-HB90x/SP-R100(4MP+4MP W4GA)', 'Ezviz HB90x dual 2K+ 4G/WiFi 6 con solar 8W', 'Cámaras IP', 232.39, '4MP+4MP (2K+) solar, 4G LTE y WiFi 6, grabación continua de bajo consumo, panel solar 8 W, batería 10400 mAh, IA humana/vehículo, seguimiento, visión nocturna color, sirena y estrobo.', 'TRANSITO'),
  ('CS-H4-R201-1H3EKFL', 'Ezviz H4 2K PoE domo turret', 'Cámaras IP', 58.10, 'H4 2K PoE domo turret. IA humana/vehicular, sirena y estrobo, visión color 24/7, audio hasta 15 m, llamadas bidireccionales, IP67, H.265, Alexa y Google, microSD 512 GB y CloudPlay.', 'DISPONIBLE'),
  ('CS-H4-R201-1H3WKFL', 'Ezviz H4 2K WiFi domo turret', 'Cámaras IP', 66.64, 'H4 2K WiFi domo turret. IA humana/vehicular, sirena y estrobo, visión color 24/7, audio hasta 15 m, llamadas bidireccionales, IP67, H.265, Alexa y Google, microSD 512 GB y CloudPlay.', 'DISPONIBLE'),
  ('CS-H3c-R100-1K2WFL(2.8mm)(AM-STD)', 'Ezviz H3c Color bullet 2MP WiFi 2.8 mm', 'Cámaras IP', 46.14, 'H3c Color bullet intemperie 1080P 2MP WiFi, IR 30 m, 3D DNR, WDR, audio pick-up, microSD 512 GB, IP67, H.265, visión a color.', 'DISPONIBLE'),
  ('CS-H3c-R100-1K3WKFL', 'Ezviz H3c 2K bullet 3MP WiFi', 'Cámaras IP', 56.39, 'H3c 2K bullet intemperie 3MP WiFi, visión nocturna a color, IA de personas, IP67, H.265, captura de audio, luz estroboscópica, microSD 512 GB.', 'DISPONIBLE'),
  ('CS-H3-R100-1J5WKFL', 'Ezviz H3 3K bullet 5MP WiFi', 'Cámaras IP', 78.60, 'H3 3K bullet intemperie 5MP WiFi, IR 30 m, microSD 512 GB, micrófono y altavoz, luz estroboscópica y sirena, visión a color 24/7, detección de vehículos y humanos, alertas de voz.', 'DISPONIBLE'),
  ('CS-BW3844-A0E60', 'Ezviz kit NVR X5S + 4 cámaras H3c 2K', 'C.C.T.V', 281.94, 'Kit NVR X5S con 4 cámaras H3c 2K. Detección inteligente de humanos y vehículos, activación de alarmas, voz de alerta y audio, visión nocturna a color.', 'DISPONIBLE'),
  ('CS-C3W-A0-1F4WFL 2.8mm', 'Ezviz C3W bullet 4MP 2K WiFi 2.8 mm', 'Cámaras IP', 92.18, 'Bullet intemperie 4MP 2K WiFi, IR 30 m, 3D DNR, WDR, microSD 256 GB, micrófono y altavoz, sensor PIR con luz estroboscópica y alarma sonora.', 'DISPONIBLE'),
  ('CS-CV310-C1-6B22WFR (2.8MM)', 'Ezviz CV310 dual lente 1080P WiFi 2.8 mm', 'Cámaras IP', 116.79, 'Bullet intemperie 1080P WiFi, doble lente, IR 30 m, PIR, estrobo y sirena, visión a color 24/7, IP67, H.265, IA de vehículos y personas, microSD 256 GB.', 'DISPONIBLE'),
  ('CS-CV310-C1-6B22WF-D1Y0(2.8mm)', 'Ezviz CV310 dual lente 1080P (D1Y0)', 'Cámaras IP', 100.69, 'Bullet intemperie 1080P WiFi, doble lente, IR 30 m, PIR, estrobo y sirena, visión a color 24/7, IP67, H.265, IA de vehículos y personas, microSD 128 GB.', 'DISPONIBLE'),
  ('CS-LC3-A0-8B4WDL 2.0MM', 'Ezviz LC3 cámara con luz 4MP 2K', 'Cámaras IP', 121.44, 'Cámara con luz de seguridad, 4MP 2K WiFi, LED 700 lúmenes, visión nocturna a color 24/7, eMMC 32 GB, H.265, ángulo diagonal 157°, audio 2 vías, IP65, IA humana.', 'DISPONIBLE'),
  ('CS-LC1C-A0-1F2WPFRL 2.8MM', 'Ezviz LC1C cámara con reflector 1080P', 'Cámaras IP', 154.89, 'Cámara con luz 2000 lúmenes, 1080P 2MP WiFi, Starlight, IR 25 m, H.265, PIR, sirena 100 dB, audio 2 vías, microSD 256 GB, IP65.', 'DISPONIBLE'),
  ('CS-BM1-R100-2D2WF-Ra', 'Ezviz BM1 monitor bebé (rosa)', 'Cámaras IP', 98.82, 'Cámara WiFi 1080P 2MP. Monitor para bebé, diseño de conejo rosa. Detección de llanto y actividad, bebé fuera de la cuna, música, visión nocturna 5 m sin LED rojo, audio 2 vías, Alexa y Google, microSD 256 GB y Cloud.', 'DISPONIBLE'),
  ('CS-BM1-R100-2D2WF-Be', 'Ezviz BM1 monitor bebé (azul)', 'Cámaras IP', 98.82, 'Cámara WiFi 1080P 2MP. Monitor para bebé, diseño de conejo azul. Detección de llanto y actividad, bebé fuera de la cuna, música, visión nocturna 5 m, audio 2 vías, Alexa y Google, microSD 256 GB y Cloud.', 'DISPONIBLE'),
  ('CS-EB3-R200-1K3FL4GA', 'Ezviz EB3 2K 4G bullet con batería', 'Cámaras IP', 109.36, 'EB3 2K 4G 3MP ultra-HD bullet, lente 2.8 mm, microSD 512 GB, batería recargable hasta 120 días, visión nocturna a color, H.265, ángulo 125°, inalámbrica, estrobo y sirena.', 'DISPONIBLE'),
  ('CS-EB3-R200-1K3WFL', 'Ezviz EB3 2K 4MP WiFi con batería', 'Cámaras IP', 115.00, 'EB3 2K bullet 4MP WiFi, batería 5200 mAh hasta 120 días, IR 10 m, IP66, visión nocturna a color, H.265, ángulo 125°, inalámbrica, estrobo y sirena.', 'DISPONIBLE'),
  ('CS-EB3/SP-R200(3MP)', 'Ezviz EB3 2K 3MP WiFi con panel', 'Cámaras IP', 119.61, 'EB3 2K 3MP WiFi bullet, batería 5200 mAh hasta 120 días, IR 15 m, IP65, visión nocturna a color, H.265, ángulo 125°, estrobo y sirena, panel integrado.', 'TRANSITO'),
  ('CS-EB3/SP-R200(2K 4GA)', 'Ezviz EB3 2K 4G kit Type-C', 'Cámaras IP', 136.70, 'EB3 2K 4G kit 3MP, conector Type-C, H.265, ángulo 125°, estrobo y sirena, audio bidireccional, IA humana, visión nocturna a color, Alexa y Google, microSD 512 GB y CloudPlay.', 'DISPONIBLE'),
  ('CS-CMT-SolarPanel-E(AM-STD)', 'Ezviz panel solar Type-C para cámara a batería', 'Insumos', 32.47, 'Panel solar para cámara a batería CS-BC1C. Celdas monocristalinas, hasta 6.18 W, cable 4 m, IP66, conector Type-C.', 'DISPONIBLE'),
  ('CS-PBC12-R100-10AH', 'Ezviz panel solar con batería 37,23 Wh', 'Insumos', 85.44, 'Panel solar con batería recargable 37,23 Wh. Entrada Type-C, salidas USB-A dobles, IP65.', 'DISPONIBLE'),
  ('CS-BC1-B1', 'Ezviz kit base + 1 cámara BC1C', 'Cámaras IP', 178.06, 'Kit estación base y 1 cámara BC1C 2MP. Hasta 1 año con una carga, batería 12900 mAh, visión nocturna a color, IA de movimiento y humanos, estrobo, IR 10 m, IP66, H.265. Base con microSD hasta 256 GB.', 'DISPONIBLE'),
  ('CS-BC1-B2-B0', 'Ezviz kit base + 2 cámaras BC1C', 'Cámaras IP', 299.77, 'Kit estación base y 2 cámaras BC1C. Hasta 1 año con una carga, batería 12900 mAh, visión nocturna a color, IA, estrobo, IR 10 m, IP66, H.265. Base con microSD hasta 256 GB.', 'DISPONIBLE'),
  ('CS-BC1-A0-2C2WPBL', 'Ezviz BC1C cámara adicional para kit BC1', 'Cámaras IP', 105.00, 'Cámara bullet adicional 1080P 2MP WiFi para kit CS-BC1. Batería 12900 mAh recargable, 210 días.', 'DISPONIBLE'),
  ('CS-RT1-R100-3G0G', 'Ezviz RT1 AX3000 router mesh WiFi 6', 'Network', 58.10, 'Router RT1 AX3000 mesh smart home, WiFi 6 dual band 2.4/5 GHz hasta 3000 Mbps, WAN/LAN auto, puerto Gigabit, cobertura hasta 200 m².', 'DISPONIBLE'),
  ('CS-PB18-R100-WH(O-STD)', 'Ezviz batería recargable 5200 mAh blanca', 'Insumos', 19.00, 'Batería recargable blanca 5200 mAh, Type-C, 5V 2A USB-A. No incluye cámara.', 'TRANSITO'),
  ('CS-PB18-R100-BK(O-STD)', 'Ezviz batería recargable 5200 mAh negra', 'Insumos', 19.00, 'Batería recargable negra 5200 mAh, Type-C, 5V 2A USB-A. No incluye cámara.', 'TRANSITO'),
  ('CS-W2D-APC', 'Ezviz estación base W2D para C3A', 'C.C.T.V', 147.44, 'Estación base para CS-C3A. Hasta 6 cámaras a batería, extiende WiFi, sirena 100 dB, conexión cableada al router, fuente DC 5V 2A.', 'DISPONIBLE'),
  ('BL-BC-01', 'Ezviz batería Li-ion 5500 mAh para C3A', 'Insumos', 15.33, 'Batería recargable Li-ion para CS-C3A. 5500 mAh, 20.9 Wh, 3.8 V.', 'DISPONIBLE'),
  ('DDC-09FC-BATBK', 'Ezviz cargador doble ranura para C3A', 'Insumos', 10.40, 'Cargador de batería de doble ranura para C3A.', 'DISPONIBLE'),
  ('CS-HP4-R100-6E2WPFBS', 'Ezviz HP4 videoportero mirilla 1080P', 'Domótica', 80.69, 'Videoportero / timbre con mirilla, cámara 1080P con batería, ángulo vertical 155°, PIR, pantalla 4.3", batería 4600 mAh, IR 3 m, H.265, microSD hasta 512 GB, audio 2 vías.', 'NO DISPONIBLE'),
  ('CS-HP7-R101-1W2TFC', 'Ezviz HP7 videoportero 2K pantalla 7"', 'Domótica', 181.13, 'Videoportero 2K, pantalla táctil 7", desbloqueo remoto, 2 hilos, IA humana, audio bidireccional, RFID (3 etiquetas), intemperie, WiFi 2.4/5 GHz, microSD 512 GB y CloudPlay.', 'DISPONIBLE'),
  ('CS-DP2C-A0-6E2WPFBS', 'Ezviz DP2C videoportero mirilla 1080P', 'Domótica', 112.78, 'Videoportero / timbre con mirilla, 1080P con batería, ángulo 155°, PIR, pantalla 4.3", batería 4600 mAh, IR 5 m, H.265, microSD 256 GB, audio 2 vías.', 'DISPONIBLE'),
  ('CS-SD7-R100-1WTC(AM-STD)', 'Ezviz SD7 monitor táctil 7"', 'Domótica', 119.61, 'Monitor táctil SD7, IPS 7", 1024×600, audio bidireccional, batería 4600 mAh, hasta 30 dispositivos Ezviz, WiFi 2.4 GHz. Soporte empotrable no incluido.', 'DISPONIBLE'),
  ('CS-DL03-R100-WBCP-GR', 'Ezviz DL03 cerradura inteligente WiFi', 'Domótica', 95.69, 'Cerradura inteligente, desbloqueo remoto por app, varios métodos, integración con cámaras Ezviz, WiFi 2.4 GHz sin hub, alarma antimanipulación, alimentación de emergencia Type-C.', 'DISPONIBLE'),
  ('CS-DL04-R100-WBCP-GR', 'Ezviz DL04 Smart Pro teclado/huella', 'Domótica', 121.32, 'Cerradura Smart Pro con teclado, WiFi, Bluetooth y proximidad, huella, control por app, integración con cámaras, emergencia Type-C, alarma antimanipulación.', 'DISPONIBLE'),
  ('CS-DL05-R101-WBCP-GR', 'Ezviz DL05 cerradura huella/tarjeta/PIN (R101)', 'Domótica', 143.53, 'Cerradura de huella, tarjeta, PIN y llave. App Ezviz, códigos temporales, bloqueo infantil, timbre, alarma antimanipulación, intemperie, emergencia, integración con cámaras.', 'DISPONIBLE'),
  ('CS-DL05-R100-WBCP-GR', 'Ezviz DL05 cerradura huella/tarjeta/PIN (R100)', 'Domótica', 143.53, 'Cerradura de huella, tarjeta, PIN y llave. App Ezviz, códigos temporales, bloqueo infantil, timbre, alarma antimanipulación, intemperie, emergencia, integración con cámaras.', 'DISPONIBLE'),
  ('CS-L2S-11FCP', 'Ezviz L2S cerradura WiFi con manilla', 'Domótica', 136.70, 'Cerradura de huella y panel táctil WiFi. Huella (50), tarjeta (50), contraseña y llave. Timbre 65 dB, alarma antisabotaje, manilla, alerta de batería baja, bloqueo automático.', 'DISPONIBLE'),
  ('CS-RE4-PWT2', 'Ezviz RE4 robot aspirador y trapeador', 'Domótica', 341.75, 'Robot combo aspirador y trapeador, succión 4000 Pa, Lidar LDS, evitación de obstáculos, detección de caídas y alfombras, 3 modos, autorretorno, app, Google y Alexa.', 'DISPONIBLE'),
  ('CS-RC3-TWT5', 'Ezviz RC3 robot aspirador', 'Domótica', 205.05, 'Robot aspirador, succión 2700 Pa, Lidar LDS, evitación de obstáculos, detección de caídas y alfombras, 3 modos de limpieza.', 'DISPONIBLE'),
  ('CS-RA-KIT13', 'Ezviz kit accesorios robot RE4/RE5', 'Insumos', 16.14, 'Paquete de accesorios para aspiradoras robot Ezviz series RE4C, RE4 y RE5.', 'DISPONIBLE'),
  ('CS-A3-A0-W', 'Ezviz A3 gateway hogar', 'Domótica', 49.28, 'Gateway para sensores de alarma. App, RJ45 y WiFi, 20 sonidos, alertas móviles, hasta 64 dispositivos Ezviz. Incluye adaptador USB.', 'DISPONIBLE'),
  ('CS-B1-A0-A34', 'Ezviz kit alarma A3 + T1C + T2C + T3C', 'Domótica', 76.65, 'Kit de alarma: gateway CS-A3 + 1 sensor CS-T1C + 1 sensor CS-T2C + 1 sensor CS-T3C.', 'DISPONIBLE'),
  ('CS-T2C-A0-BG', 'Ezviz T2C sensor magnético puerta/ventana', 'Domótica', 17.60, 'Contacto magnético inalámbrico de apertura/cierre. Alarma antivandalismo, alertas por app, ahorro de batería, integración con cámaras Ezviz.', 'DISPONIBLE'),
  ('CS-T3C-A0-BG', 'Ezviz T3C botón de pánico inalámbrico', 'Domótica', 16.40, 'Control botón de pánico 2 en 1 inalámbrico. Emparejamiento fácil, antivandalismo, alertas por app, integración con cámaras Ezviz.', 'DISPONIBLE'),
  ('CS-T9C-A0-BG(EU-STD)', 'Ezviz T9C sirena inteligente', 'Domótica', 44.00, 'Sirena inteligente (requiere gateway A3). 90–105 dB, duración 5–180 s, antimanipulación, intemperie, alertas por app, batería de larga duración.', 'DISPONIBLE'),
  ('CS-E4p-R100-8C6WKF', 'Ezviz E4 3K+ 6MP panorámica 360', 'Cámaras IP', 124.74, 'Vista panorámica 360 3K+ 6MP, WiFi 2.4/5 GHz, detección humana y reconocimiento de sonidos, 4 micrófonos y altavoz, IR hasta 10 m, microSD 512 GB y CloudPlay.', 'DISPONIBLE'),
  ('CS-CMT-CARDT64G', 'Ezviz microSD CCTV 64 GB', 'Insumos', 33.82, 'Tarjeta microSD especial para CCTV 64 GB.', 'DISPONIBLE'),
  ('CS-CMT-Battery Camera Mount', 'Ezviz soporte para cámara a batería', 'Insumos', 6.00, 'Soporte Ezviz para cámara a batería.', 'DISPONIBLE'),
  ('CS-T30-10B-US', 'Ezviz T30 enchufe inteligente WiFi', 'Domótica', 12.91, 'Enchufe inteligente, control por app, WiFi 2.4 GHz, horarios y temporizador, resistencia al fuego 750 °C, Google y Alexa.', 'TRANSITO'),
  ('CS-X5S-R100-8W', 'Ezviz X5S NVR WiFi 8 canales', 'C.C.T.V', 63.22, 'X5S WiFi para 8 cámaras, resolución 5 MP, HDMI, USB, VGA, LAN, SATA hasta 8 TB.', 'DISPONIBLE');

update public.products p
set
  nombre = e.nombre,
  categoria = e.categoria,
  marca = coalesce(nullif(btrim(p.marca), ''), 'Ezviz'),
  descripcion = e.descripcion,
  descripcion2 = 'Lista instalador Ezviz Octubre 2026 · ' || e.estatus,
  costo = e.costo,
  precio = e.costo,
  utilidad = 0
from ezviz_oct2026 e
where lower(btrim(p.modelo)) = lower(btrim(e.modelo))
  and (
    p.marca is null
    or btrim(p.marca) = ''
    or lower(btrim(p.marca)) = 'ezviz'
  );

insert into public.products (
  nombre,
  categoria,
  marca,
  modelo,
  descripcion,
  descripcion2,
  costo,
  precio,
  utilidad,
  cantidad
)
select
  e.nombre,
  e.categoria,
  'Ezviz',
  e.modelo,
  e.descripcion,
  'Lista instalador Ezviz Octubre 2026 · ' || e.estatus,
  e.costo,
  e.costo,
  0,
  0
from ezviz_oct2026 e
where not exists (
  select 1
  from public.products p
  where lower(btrim(p.modelo)) = lower(btrim(e.modelo))
    and (
      p.marca is null
      or btrim(p.marca) = ''
      or lower(btrim(p.marca)) = 'ezviz'
    )
);

commit;

select
  count(*) as total_ezviz,
  count(*) filter (
    where descripcion2 like 'Lista instalador Ezviz Octubre 2026%'
  ) as de_esta_lista
from public.products
where lower(btrim(coalesce(marca, ''))) = 'ezviz';

select categoria, count(*) as n
from public.products
where lower(btrim(coalesce(marca, ''))) = 'ezviz'
group by 1
order by 1;
