-- =============================================================================
-- Siemon agosto 2026 · parte 3 de 3 (83 SKU de 253)
-- Copiar este archivo COMPLETO (GitHub Raw → Ctrl+A → Ctrl+C) → SQL Editor → Run.
-- Primero: VCM-25-12-01  ·  Último: RIC-F-LCU12-01C
-- costo = lista USD; precio = costo; utilidad = 0. Sin updated_at.
-- =============================================================================
begin;

drop table if exists cat_siemon_2026;
create temporary table cat_siemon_2026 (
  marca text not null,
  modelo text not null,
  nombre text not null,
  categoria text not null,
  costo numeric(14,2) not null,
  descripcion text,
  estatus text not null,
  primary key (marca, modelo)
);

insert into cat_siemon_2026 (marca, modelo, nombre, categoria, costo, descripcion, estatus)
values
  ('Siemon', 'VCM-25-12-01', 'Siemon VCM-25-12-01 25 piezas Rollo de 25 cintos reusables de 12" (305 mm) de largo, color', 'Network', 28.50, '25 piezas Rollo de 25 cintos reusables de 12" (305 mm) de largo, color negro. Los cintos para organización de cable son simples, pero extremadamente eficaces cuando se usan para agrupar cables. Pueden ser fácilmente aflojados y colocados nuevamente. Alternativa para las tirras o abrazaderas de plástico para la reducción de la diáfana exógena (Aliens Cosstalk) en instalaciones 10G.', 'DISPONIBLE'),
  ('Siemon', 'MAX-TT', 'Siemon MAX-TT Herramienta de Terminación TurboTool para conectores UTP MAX', 'Network', 6.75, 'Herramienta de Terminación TurboTool para conectores UTP MAX, Compatible con Categoría 5e y 6 en todas sus versiones, Planos, Angulados y Tipo Keystone. Construcción duradera: Acero Laminado en Frió (CRS) de calibre 13. Proporciona retroalimentación audible y táctil que indica que el proceso de terminación esta completo. Proporciona visibilidad óptima. Cartuchos reemplazables por uso. Clip de retención 165.00 DISPONIBLE SIEMON CPT Herramienta para Preparación de Cable UTP, Par Trenzado, proporci', 'DISPONIBLE'),
  ('Siemon', 'CPT-T', 'Siemon CPT-T Herramienta para Preparación de Cable S/FTP, Incluye dado Guía para', 'Network', 67.00, 'Herramienta para Preparación de Cable S/FTP, Incluye dado Guía para Conector TERA, CPT, TERA, Reduce significativamente el tiempo requerido para preparar el cable totalmente blindado (S/FTP). Incluye inserto con cuchilla, para despojar con precisión el forro del cable y el blindaje de aluminio de los 4 Pares sin dañar los conductores.', 'DISPONIBLE'),
  ('Siemon', 'UMAX-PD', 'Siemon UMAX-PD Herramienta de Impacto dinamica UltraMAX de 4 pares (Para un ponchado', 'Network', 215.00, 'Herramienta de Impacto dinamica UltraMAX de 4 pares (Para un ponchado más rápido y eficiente). Diseño versátil e intuitivo, ideal para necesidades de terminación. Diseño innovador admite la terminación de los 4 pares en una sola acción suave. Mínimo 30,000 ciclos y ofrece 50 kg de fuerza a través del mecanismo de impacto, lo que permite a los usuarios recortar los 8 conductores al ras con un movimiento rápido y repetible que permite terminar conexiones críticas de alto rendimiento', 'DISPONIBLE'),
  ('Siemon', 'UMAX-TT', 'Siemon UMAX-TT UltraMAX TurboTool. Proporciona una entrada de cable flexible', 'Network', 140.00, 'UltraMAX TurboTool. Proporciona una entrada de cable flexible, permitiendo la terminación a ambos lados de la toma, adaptándose a múltiples direcciones de cableado y cumpliendo con el radio de curvatura. Construcción duradera. Diseño ergonómico. Reduce el tiempo de terminación en un 15 % en comparación con el proceso de perforación con una sola herramienta. Pestillo de seguridad integrado. Los exclusivos canales de encordado lineal de UltraMAX permiten a los usuarios terminar sus conexiones desd', 'DISPONIBLE'),
  ('Siemon', 'UMAX-TT-D', 'Siemon UMAX-TT-D Troquel de corte de repuesto UltraMAX TurboTool. Los usuarios pueden', 'Network', 20.00, 'Troquel de corte de repuesto UltraMAX TurboTool. Los usuarios pueden reemplazar fácilmente la matriz de corte, lo que prolonga la vida útil de la herramienta y permite obtener acabados perfectos.', 'DISPONIBLE'),
  ('Siemon', 'PG2', 'Siemon PG2 Protector de palma con inserto UltraMAX. La protección de palma absorbe', 'Network', 22.00, 'Protector de palma con inserto UltraMAX. La protección de palma absorbe el impacto de la terminación mientras asegura el conector para evitar movimiento, e incluye una correa de velcro elástica ajustable y un inserto removible, que se puede usar para sujetar los módulos UltraMAX mientras se termina en superficies planas.', 'DISPONIBLE'),
  ('Siemon', 'PG2-U', 'Siemon PG2-U Inserto UltraMAX sin protector de palma. La protección de palma absorbe', 'Network', 6.00, 'Inserto UltraMAX sin protector de palma. La protección de palma absorbe el impacto de la terminación mientras asegura el conector para evitar movimiento, e incluye una correa de velcro elástica ajustable y un inserto removible, que se puede usar para sujetar los módulos UltraMAX mientras se termina en superficies planas.', 'DISPONIBLE'),
  ('Siemon', 'Z-TOOL', 'Siemon Z-TOOL Herramienta de Terminación para conectores Z-MAX. Esta herramienta', 'Network', 10.00, 'Herramienta de Terminación para conectores Z-MAX. Esta herramienta fácil de usar de diseño ergonómico se utiliza para fijar el clip de retención y de conexión a tierra del cable, y para acoplar completamente el módulo en la parte posterior de la toma', 'DISPONIBLE'),
  ('Siemon', 'Z-TOOL-ZP', 'Siemon Z-TOOL-ZP Herramienta de terminación para conectores Z-PLUG de SIEMON, Color', 'Network', 7.50, 'Herramienta de terminación para conectores Z-PLUG de SIEMON, Color Negro. La línea Z-PLUG de Siemon ofrece terminaciones en campo de conectores macho de alto rendimiento de manera rápida y flexible', 'DISPONIBLE'),
  ('Siemon', 'FC1-LB-LC5-9AQ', 'Siemon FC1-LB-LC5-9AQ Conector de Fibra Óptica pre-pulido LightBow LC Simplex, 900um', 'Network', 13.50, 'Conector de Fibra Óptica pre-pulido LightBow LC Simplex, 900um Buffered, Multimodo 50/125 (OM3/OM4), re-terminable, Conector Aqua, Bota Blanca, Mechanical Splice', 'DISPONIBLE'),
  ('Siemon', 'FC1-LC-SM-B02', 'Siemon FC1-LC-SM-B02 Conector de Fibra Óptica LC Simplex, Para Instalación en Campo', 'Network', 7.50, 'Conector de Fibra Óptica LC Simplex, Para Instalación en Campo, Monomodo, Fibra recubierta, Color Azul, LightSpeed, Monomodo, OS1/OS2, 8.3/125, LC, Simplex, Buffered, Bota Blanca, Azul Connector, Pulitura Epoxy', 'DISPONIBLE'),
  ('Siemon', 'FT-LB-TOOL', 'Siemon FT-LB-TOOL Herramienta de Terminación para conectores de Fibra Óptica LightBow', 'Network', 30.00, 'Herramienta de Terminación para conectores de Fibra Óptica LightBow. Empalme mecánico de fácil terminación reduce drásticamente el tiempo de terminación en campo. Con compatibilidad universal para conectores LC y SC. Alineamiento óptimo: Los canales de alineación simplifican la inserción de fibra para evitar daños. Proceso robusto: Combina la activación de empalme y crimpado significativo', 'DISPONIBLE'),
  ('Siemon', 'FT-MP-AT', 'Siemon FT-MP-AT Herramienta de Activación para MTP Pro', 'Network', 325.00, 'Herramienta de Activación para MTP Pro', 'DISPONIBLE'),
  ('Siemon', 'FT-MP-PE-MM', 'Siemon FT-MP-PE-MM Intercambiador de pines para MTP pro, Multimodo con Pines Elite', 'Network', 9.50, 'Intercambiador de pines para MTP pro, Multimodo con Pines Elite', 'DISPONIBLE'),
  ('Siemon', 'FJ1-SCASCAL-02', 'Siemon FJ1-SCASCAL-02 Fibra, Jumper, Simplex, XGLO, Monomodo, SC APC, SC APC, OS1/OS2', 'Network', 21.00, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC APC, SC APC, OS1/OS2, 8.3/125, Amarillo, OFNR, 02 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ1-SCASCAL-03', 'Siemon FJ1-SCASCAL-03 Fibra, Jumper, Simplex, XGLO, Monomodo, SC APC, SC APC, OS1/OS2', 'Network', 22.00, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC APC, SC APC, OS1/OS2, 8.3/125, Amarillo, OFNR, 03 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ1-SCASCAL-05', 'Siemon FJ1-SCASCAL-05 Fibra, Jumper, Simplex, XGLO, Monomodo, SC APC, SC APC, OS1/OS2', 'Network', 23.00, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC APC, SC APC, OS1/OS2, 8.3/125, Amarillo, OFNR, 05 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ1-SCUSCUL-03', 'Siemon FJ1-SCUSCUL-03 Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC, SC UPC, OS1/OS2', 'Network', 17.00, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC, SC UPC, OS1/OS2, 8.3/125, Amarillo, OFNR, 03 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ1-SCUSCUL-05', 'Siemon FJ1-SCUSCUL-05 Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC, SC UPC, OS1/OS2', 'Network', 18.50, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC, SC UPC, OS1/OS2, 8.3/125, Amarillo, OFNR, 05 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ1-SCUSCAL-03', 'Siemon FJ1-SCUSCAL-03 Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC, SC APC, OS1/OS2', 'Network', 21.50, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC, SC APC, OS1/OS2, 8.3/125, Amarillo, OFNR, 03 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ1-SCUSCAL-05', 'Siemon FJ1-SCUSCAL-05 Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC, SC APC, OS1/OS2', 'Network', 22.50, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC, SC APC, OS1/OS2, 8.3/125, Amarillo, OFNR, 05 Metros', 'DISPONIBLE'),
  ('Siemon', 'J2-LCULCUL-02H', 'Siemon J2-LCULCUL-02H Fibra, Jumper, Duplex, ValuLight, Monomodo, LC UPC, LC UPC, OS1/OS2', 'Network', 18.50, 'Fibra, Jumper, Duplex, ValuLight, Monomodo, LC UPC, LC UPC, OS1/OS2, 8.3/125, Amarillo, LSOH-1, 02 Metros', 'DISPONIBLE'),
  ('Siemon', 'J2-LCULCUL-03H', 'Siemon J2-LCULCUL-03H Fibra, Jumper, Duplex, ValuLight, Monomodo, LC UPC, LC UPC, OS1/OS2', 'Network', 19.00, 'Fibra, Jumper, Duplex, ValuLight, Monomodo, LC UPC, LC UPC, OS1/OS2, 8.3/125, Amarillo, LSOH-1, 03 Metros', 'DISPONIBLE'),
  ('Siemon', 'J2-LCULCUL-05H', 'Siemon J2-LCULCUL-05H Fibra, Jumper, Duplex, ValuLight, Monomodo, LC UPC, LC UPC, OS1/OS2', 'Network', 20.00, 'Fibra, Jumper, Duplex, ValuLight, Monomodo, LC UPC, LC UPC, OS1/OS2, 8.3/125, Amarillo, LSOH-1, 05 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCULCUL-02H', 'Siemon FJ2-LCULCUL-02H Fibra, Jumper, Duplex, XGLO, Monomodo, LC UPC, LC UPC, OS1/OS2', 'Network', 30.50, 'Fibra, Jumper, Duplex, XGLO, Monomodo, LC UPC, LC UPC, OS1/OS2, 8.3/125, Amarillo, LSOH-3C, 02 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCULCUL-03H', 'Siemon FJ2-LCULCUL-03H Fibra, Jumper, Duplex, XGLO, Monomodo, LC UPC, LC UPC, OS1/OS2', 'Network', 31.50, 'Fibra, Jumper, Duplex, XGLO, Monomodo, LC UPC, LC UPC, OS1/OS2, 8.3/125, Amarillo, LSOH-3C, 03 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-01AH', 'Siemon FJ2-LCLC5V-01AH Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color', 'Network', 26.50, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color Aqua, LSOH-3C, 01 Metro', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-02AH', 'Siemon FJ2-LCLC5V-02AH Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color', 'Network', 28.00, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color Aqua, LSOH-3C, 02 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-03AH', 'Siemon FJ2-LCLC5V-03AH Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color', 'Network', 30.00, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color Aqua, LSOH-3C, 03 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-02AQ', 'Siemon FJ2-LCLC5V-02AQ Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color', 'Network', 25.50, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color Aqua, OFNR, 02 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-03AQ', 'Siemon FJ2-LCLC5V-03AQ Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color', 'Network', 27.50, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color Aqua, OFNR, 03 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-05AQ', 'Siemon FJ2-LCLC5V-05AQ Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color', 'Network', 33.00, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color Aqua, OFNR, 05 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCLC5V-12AQ', 'Siemon FJ2-LCLC5V-12AQ Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color', 'Network', 42.00, 'Fibra, Jumper, Duplex, XGLO, Multimodo, LC, LC, OM4, 50/125, Color Aqua, OFNR, 12 Metros', 'DISPONIBLE'),
  ('Siemon', 'LBP-LCLC5V-01AQ', 'Siemon LBP-LCLC5V-01AQ 1 Metro', 'Network', 29.50, '1 Metro', 'DISPONIBLE'),
  ('Siemon', 'LBP-LCLC5V-02AQ', 'Siemon LBP-LCLC5V-02AQ 2 Metros', 'Network', 30.00, '2 Metros', 'DISPONIBLE'),
  ('Siemon', 'LBP-LCLC5V-02EH', 'Siemon LBP-LCLC5V-02EH 2 metros Fibra, Jumper, Conector Patentado BladePatch Duplex, Solución', 'Network', 25.00, '2 metros Fibra, Jumper, Conector Patentado BladePatch Duplex, Solución única para entornos de conexión de fibra óptica de alta densidad. Cuenta con un revolucionario e innovador diseño de bota, push-pull, para controlar el broche del seguro, posibilitando el fácil acceso y remoción en zonas muy estrecha. XGLO, Multimodo, LC LC Duplex, RFP, OM4, 50/125, Color Aqua, LSOH-3C, 02 Metros', 'DISPONIBLE'),
  ('Siemon', 'LBP-LCULCUL-03H', 'Siemon LBP-LCULCUL-03H 3 metros Fibra, Jumper, Conector Patentado BladePatch Duplex, Solución', 'Network', 32.50, '3 metros Fibra, Jumper, Conector Patentado BladePatch Duplex, Solución única para entornos de conexión de fibra óptica de alta densidad. Cuenta con un revolucionario e innovador diseño de bota, push-pull, para controlar el broche del seguro, posibilitando el fácil acceso y remoción en zonas muy estrecha. XGLO, Monomodo, LC UPC LC UPC Duplex, RFP, OS1/OS2, 8.3/125, Color Amarillo, LSOH-3C, 03 Metros', 'DISPONIBLE'),
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
  ('Siemon', 'SFPH10GB2.0M01L', 'Siemon SFPH10GB2.0M01L Cable de alta velocidad High Speed, DAC (conexión directa de cobre)', 'Network', 62.50, 'Cable de alta velocidad High Speed, DAC (conexión directa de cobre), Ethernet 10G NRZ, 30AWG, CR1 a CR1, SFP+ a SFP+, 30 AWG, 2 metros, chaqueta LSZH/CM, Color Negro, compatible con Cisco, IEEE- 802.3ba', 'DISPONIBLE'),
  ('Siemon', 'SFPH10GB3.0M01L', 'Siemon SFPH10GB3.0M01L Cable de alta velocidad High Speed, DAC (conexión directa de cobre)', 'Network', 65.00, 'Cable de alta velocidad High Speed, DAC (conexión directa de cobre), Ethernet 10G NRZ, 30AWG, CR1 a CR1, SFP+ a SFP+, 30 AWG, 3 metros, chaqueta LSZH/CM, Color Negro, compatible con Cisco, IEEE- 802.3ba', 'DISPONIBLE'),
  ('Siemon', 'SFPH10GB3.0M03L', 'Siemon SFPH10GB3.0M03L Cable de alta velocidad High Speed, DAC (conexión directa de cobre)', 'Network', 65.00, 'Cable de alta velocidad High Speed, DAC (conexión directa de cobre), Ethernet 10G NRZ, 30AWG, CR1 a CR1, SFP+ a SFP+, 30 AWG, 3 metros, chaqueta LSZH/CM, Color Rojo, compatible con Cisco, IEEE- 802.3ba', 'DISPONIBLE'),
  ('Siemon', '9F8LB1-12D-Metro', 'Siemon 9F8LB1-12D-Metro Cable, 12 Fibras, XGLO, Monomodo, OS1/OS2, 8.3/125, Indoor (interior)', 'Network', 0.95, 'Cable, 12 Fibras, XGLO, Monomodo, OS1/OS2, 8.3/125, Indoor (interior), Tight Buffered, Non-Armored, OFNR, Amarillo, Internacional', 'DISPONIBLE'),
  ('Siemon', '9F8LE4-12D-Metro', 'Siemon 9F8LE4-12D-Metro Cable, 12 Fibras, XGLO, Monomodo, OS1/OS2, 8.3/125, Outside Plant', 'Network', 1.40, 'Cable, 12 Fibras, XGLO, Monomodo, OS1/OS2, 8.3/125, Outside Plant (Exterior), Loose Tube, GEL, Armored, MDPE, Negro, Internacional', 'DISPONIBLE'),
  ('Siemon', '9F5LB1-6B-Metro', 'Siemon 9F5LB1-6B-Metro Cable, 6 Fibras, XGLO, Multimodo, OM3, 50/125, Indoor (interior), Tight', 'Network', 1.75, 'Cable, 6 Fibras, XGLO, Multimodo, OM3, 50/125, Indoor (interior), Tight Buffered ideal para campus y backbones de edificios, Non-Armored, Riser OFNR, Aqua, Internacional', 'DISPONIBLE'),
  ('Siemon', '9F5VB3-6B-Metro', 'Siemon 9F5VB3-6B-Metro Cable, 6 Fibras, XGLO, Multimodo, OM4, 50/125, Indoor (interior), Tight', 'Network', 2.75, 'Cable, 6 Fibras, XGLO, Multimodo, OM4, 50/125, Indoor (interior), Tight Buffered ideal para data centers, campus y backbones de edificios, Non- Armored, LSOH-3C, Aqua, Internacional', 'DISPONIBLE'),
  ('Siemon', '9GD5H006D-T501M', 'Siemon 9GD5H006D-T501M Cable, 6 Fibras, XGLO, Multimodo, OM4, 50/125, Indoor (interior) /', 'Network', 3.10, 'Cable, 6 Fibras, XGLO, Multimodo, OM4, 50/125, Indoor (interior) / Outdoor (Exterior), Tight Buffered, DWB Core, Non-Armored, LSOH-3C, Negro, Internacional', 'DISPONIBLE'),
  ('Siemon', '9F5LE4-6B-Metro', 'Siemon 9F5LE4-6B-Metro Cable, 6 Fibras, XGLO, Multimodo, OM3, 50/125, Outside Plant', 'Network', 2.75, 'Cable, 6 Fibras, XGLO, Multimodo, OM3, 50/125, Outside Plant (Exterior), Loose Tube, GEL, Armored, MDPE, Negro, Internacional', 'DISPONIBLE'),
  ('Siemon', '9F5LE4-12D-Metro', 'Siemon 9F5LE4-12D-Metro Cable, 12 Fibras, XGLO, Multimodo, OM3, 50/125, Outside Plant', 'Network', 4.50, 'Cable, 12 Fibras, XGLO, Multimodo, OM3, 50/125, Outside Plant (Exterior), Loose Tube, GEL, Armored, MDPE, Negro, Internacional', 'DISPONIBLE'),
  ('Siemon', '9F5LE4-24B-Metro', 'Siemon 9F5LE4-24B-Metro Cable, 24 Fibras, XGLO, Multimodo, OM3, 50/125, Outside Plant', 'Network', 7.50, 'Cable, 24 Fibras, XGLO, Multimodo, OM3, 50/125, Outside Plant (Exterior), Loose Tube, GEL, Armored, MDPE, Negro, Internacional', 'DISPONIBLE'),
  ('Siemon', 'HT-40', 'Siemon HT-40 Mangas de Protección, para Empalmes de Fibra Óptica, Encogimiento por', 'Network', 0.45, 'Mangas de Protección, para Empalmes de Fibra Óptica, Encogimiento por Calor, de 40 mm', 'DISPONIBLE'),
  ('Siemon', 'HT-60', 'Siemon HT-60 Mangas de Protección, para Empalmes de Fibra Óptica, Encogimiento por', 'Network', 0.50, 'Mangas de Protección, para Empalmes de Fibra Óptica, Encogimiento por Calor, de 60 mm', 'DISPONIBLE'),
  ('Siemon', 'LVE-1U-MD-T01A', 'Siemon LVE-1U-MD-T01A Distribuidor de Fibra Óptica de Alta Densidad LigthVerse *Plus* Para', 'Network', 245.00, 'Distribuidor de Fibra Óptica de Alta Densidad LigthVerse *Plus* Para Rack de 19in, Acepta 4 Placas Plug and Play, Hasta 96 Fibras, 1 UR 72 Fibras por Unidad de Rack. El sistema Siemon LightVerse incluye una gama de paneles de conexión elegantes disponibles, adecuados para una amplia variedad de necesidades de aplicación. Cada LightVerse tiene la capacidad de admitir hasta 96 fibras (hasta 72 fibras para Plus) dentro de 1U de espacio en rack para todos los métodos de terminación. Ya sea pre-termi', 'DISPONIBLE'),
  ('Siemon', 'LVE-1U-MD-P01A', 'Siemon LVE-1U-MD-P01A Distribuidor de Fibra Óptica de Alta Densidad LigthVerse *Pro* Para', 'Network', 370.00, 'Distribuidor de Fibra Óptica de Alta Densidad LigthVerse *Pro* Para Rack de 19in, Acepta 4 Placas Plug and Play, Hasta 96 Fibras, 1 UR. El sistema Siemon LightVerse incluye una gama de paneles de conexión elegantes disponibles, adecuados para una amplia variedad de necesidades de aplicación. Cada LightVerse tiene la capacidad de admitir hasta 96 fibras (hasta 72 fibras para Plus) dentro de 1U de espacio en rack para todos los métodos de terminación. Ya sea pre- terminado, terminado en campo o po', 'DISPONIBLE'),
  ('Siemon', 'LVE-2U-MD-P01A', 'Siemon LVE-2U-MD-P01A Distribuidor de Fibra Óptica de Alta Densidad LigthVerse *Pro* Para', 'Network', 525.00, 'Distribuidor de Fibra Óptica de Alta Densidad LigthVerse *Pro* Para Rack de 19 Pulgadas (48.26 cm), Acepta 8 Placas Plug and Play, Hasta 192 Fibras, 2 UR. El sistema Siemon LightVerse incluye una gama de paneles de conexión elegantes disponibles, adecuados para una amplia variedad de necesidades de aplicación. Cada LightVerse tiene la capacidad de admitir hasta 96 fibras (hasta 72 fibras para Plus) dentro de 1U de espacio en rack para todos los métodos de terminación. Ya sea pre-terminado, termi', 'DISPONIBLE'),
  ('Siemon', 'LVE-4U-MD-P01A', 'Siemon LVE-4U-MD-P01A Distribuidor de Fibra Óptica de Alta Densidad LigthVerse *Pro* Para', 'Network', 589.00, 'Distribuidor de Fibra Óptica de Alta Densidad LigthVerse *Pro* Para Rack de 48.26 cm (19 Pulgadas), Acepta 16 Placas Plug and Play, Hasta 384 Fibras, 4 UR. Cajón deslizante, Montaje modular, 16 aberturas para placas adaptadoras. Capacidad de 96 fibras por 1U de espacio. Bandeja deslizante blanca para mejor visibilidad. Cubierta superior removible, acceso fácil Administradores de cables frontales y clips traseros. Portaetiquetas integrado accesible con puerta cerrada. Opciones de acceso ampliadas', 'DISPONIBLE'),
  ('Siemon', 'LV-RSM-KIT-A', 'Siemon LV-RSM-KIT-A Kit de carretes de fibra para gestor de cables trasero. Parte del', 'Network', 26.00, 'Kit de carretes de fibra para gestor de cables trasero. Parte del sistema de conectividad para LightVerse', 'DISPONIBLE'),
  ('Siemon', 'LVPC-1UAS01A', 'Siemon LVPC-1UAS01A Panel de fibra, Combo Lightverse, Montaje en rack, 1U, Acceso fijo', 'Network', 66.00, 'Panel de fibra, Combo Lightverse, Montaje en rack, 1U, Acceso fijo, Vacío, 4 aberturas, Negro, Apantallado en ángulo, Sin gestor de cables. Instalación sin gestor de cables. Panel fijo para acceso permanente. Diseño acodado con blindaje. Color negro con blindaje electromagnético', 'DISPONIBLE'),
  ('Siemon', 'TRAYHD-1-A', 'Siemon TRAYHD-1-A Charola de empalme LightVerse para Fibra Óptica, 24 empalmes, Diseño', 'Network', 40.00, 'Charola de empalme LightVerse para Fibra Óptica, 24 empalmes, Diseño apilable Material Traslúcido, visibilidad mejorada, permite trabajo con VFL 4 Charolas por Unidad de Rack Hasta 96 empalmes por 1U Ruteo Independiente de las fibras del cable y de los pigtails Compatible con Paneles de Fibra óptica LightVerse Core, Plus y Pro', 'DISPONIBLE'),
  ('Siemon', 'LVA-BLANK-01A', 'Siemon LVA-BLANK-01A Placa Ciega, Color Negro, Compatible con Distribuidores de Fibra óptica', 'Network', 2.50, 'Placa Ciega, Color Negro, Compatible con Distribuidores de Fibra óptica LightVerse Core, Plus y Pro Compatible con Paneles de Fibra óptica LightVerse Core, Plus y Pro', 'DISPONIBLE'),
  ('Siemon', 'LVA12-LCQ-BC-A', 'Siemon LVA12-LCQ-BC-A Placa Acopladora Lightverse, 6 Conectores Dúplex LC/UPC "Shuttered"', 'Network', 45.00, 'Placa Acopladora Lightverse, 6 Conectores Dúplex LC/UPC "Shuttered", Acepta Hasta 12 Fibras Multimodo OM3 Y OM4. Las placas adaptadoras LightVerse proporcionan conexiones de fibra de paso de alto rendimiento en un espacio compacto. El pestillo integrado permite una fácil instalación y extracción con una sola mano, lo que permite a los usuarios trabajar de manera eficiente incluso en los entornos más densos. Tipo de conector: LC. Recuento de fibras: 12', 'DISPONIBLE'),
  ('Siemon', 'LVA24-LCQ-BC-A', 'Siemon LVA24-LCQ-BC-A Placa Acopladora Lightverse, 12 Conectores Dúplex LC/UPC "Shuttered"', 'Network', 90.00, 'Placa Acopladora Lightverse, 12 Conectores Dúplex LC/UPC "Shuttered", Acepta Hasta 24 Fibras Multimodo OM3 Y OM4. Las placas adaptadoras LightVerse proporcionan conexiones de fibra de paso de alto rendimiento en un espacio compacto. El pestillo integrado permite una fácil instalación y extracción con una sola mano, lo que permite a los usuarios trabajar de manera eficiente incluso en los entornos más densos. Tipo de conector: LC. Recuento de fibras: 24', 'DISPONIBLE'),
  ('Siemon', 'LVA24-LCU-BC-A', 'Siemon LVA24-LCU-BC-A Placa Acopladora LightVerse, 12 Conectores Dúplex LC/APC, Acepta hasta', 'Network', 110.00, 'Placa Acopladora LightVerse, 12 Conectores Dúplex LC/APC, Acepta hasta 24 fibras Monomodo (No Shuttered). Las placas adaptadoras LightVerse proporcionan conexiones de fibra de paso de alto rendimiento en un espacio compacto. El pestillo integrado permite una fácil instalación y extracción con una sola mano, lo que permite a los usuarios trabajar de manera eficiente incluso en los entornos más densos. Tipo de conector: LC. Recuento de fibras: 24', 'DISPONIBLE'),
  ('Siemon', 'LVCA-06-SA', 'Siemon LVCA-06-SA Placa adaptadora combinada LightVerse Combo, blindada', 'Network', 9.00, 'Placa adaptadora combinada LightVerse Combo, blindada', 'DISPONIBLE'),
  ('Siemon', 'LVCA-BLNK-A', 'Siemon LVCA-BLNK-A Placa adaptadora combinada LightVerse Combo, en blanco', 'Network', 7.50, 'Placa adaptadora combinada LightVerse Combo, en blanco', 'DISPONIBLE'),
  ('Siemon', 'LVM12TMLSV-BSCA', 'Siemon LVM12TMLSV-BSCA Módulo Plug & Play de alta densidad LightVerse. Fibra, LightVerse', 'Network', 205.00, 'Módulo Plug & Play de alta densidad LightVerse. Fibra, LightVerse, Módulo, Pérdida estándar, 12 fibras, Connector A LC Shutter color Aqua, Conector B MTP macho color Aqua, Carcasa negra, sistema XGLO, Multimodo, Polaridad C, OM4, 8.3/125, Base 12', 'DISPONIBLE'),
  ('Siemon', 'LVM12TMLSU-BSCA', 'Siemon LVM12TMLSU-BSCA Módulo Plug & Play de alta densidad LightVerse. Fibra, LightVerse', 'Network', 215.00, 'Módulo Plug & Play de alta densidad LightVerse. Fibra, LightVerse, Módulo, Pérdida estándar, 12 fibras, Connector A LCU Shutter color Azul, Conector B MTP macho color Negro, Carcasa negra, sistema XGLO, Monomodo, Polaridad C, OS2, 8.3/125, Base 12', 'DISPONIBLE'),
  ('Siemon', 'LVS24-LCPVRAB1A', 'Siemon LVS24-LCPVRAB1A Cassette para Empalme (Fusión) LightVerse de fibra óptica de 24 puertos', 'Network', 375.00, 'Cassette para Empalme (Fusión) LightVerse de fibra óptica de 24 puertos LC OM4, Adaptodres color Aqua, tipo Cassette de empalme, Cable Riser tipo Riser de 900 μm de 1 metro (3.28 Pies), carcasa negra. Capacidad de 96 empalmes por 1U con gabinetes LightVerse. Diseño de dos capas con bandeja de separación extraíble. Chip apilable para fusión masiva e individual. Material translúcido para fácil verificación y pruebas, correa de tracción integrada para una extracción trasera rápida', 'DISPONIBLE'),
  ('Siemon', 'TRAY-3', 'Siemon TRAY-3 Bandeja de Empalme para Fibra Óptica, Para 24 Empalmes por Fusión Con', 'Network', 31.00, 'Bandeja de Empalme para Fibra Óptica, Para 24 Empalmes por Fusión Con Manga Protectora', 'DISPONIBLE'),
  ('Siemon', 'RIC-F-BLNK-01', 'Siemon RIC-F-BLNK-01 Placa adaptadora Quick-Pack, Ciega, Plana, RIC, Housing Color Negro', 'Network', 3.00, 'Placa adaptadora Quick-Pack, Ciega, Plana, RIC, Housing Color Negro', 'DISPONIBLE'),
  ('Siemon', 'RIC-F-LCQ12-01C', 'Siemon RIC-F-LCQ12-01C Placa acopladora de Fibra Óptica Quick-Pack, Con 6 Conectores LC Duplex', 'Network', 41.00, 'Placa acopladora de Fibra Óptica Quick-Pack, Con 6 Conectores LC Duplex (12 Fibras), RIC, Para Fibra Multimodo, Plano, Adaptador Aqua, Housing Negro, Manga Ceramica', 'DISPONIBLE'),
  ('Siemon', 'RIC-F-LCU12-01C', 'Siemon RIC-F-LCU12-01C Placa acopladora de Fibra Óptica Quick-Pack, Con 6 Conectores LC/UPC', 'Network', 52.50, 'Placa acopladora de Fibra Óptica Quick-Pack, Con 6 Conectores LC/UPC Duplex (12 Fibras), RIC, Para Fibra Monomodo, Adaptador Azul, Housing Negro, Manga Ceramica', 'DISPONIBLE');

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
from cat_siemon_2026 e
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
from cat_siemon_2026 e
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
where lower(btrim(coalesce(marca, ''))) in ('siemon')
group by 1
order by 1;

