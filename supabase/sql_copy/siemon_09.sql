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
  ('Siemon', 'PNL-BLNKA-2', 'Siemon PNL-BLNKA-2 Panel Ciego Horizontal Angulado para Rack estándar de 19", 2UR, Color', 'Network', 50.00, 'Panel Ciego Horizontal Angulado para Rack estándar de 19", 2UR, Color Negro con el logo de SIEMON, Instalación fácil y rápida, mejora el rendimiento térmico al impedir el flujo de aire a través de espacios vacíos', 'DISPONIBLE'),
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
  ('Siemon', 'FC1-LC-SM-B02', 'Siemon FC1-LC-SM-B02 Conector de Fibra Óptica LC Simplex, Para Instalación en Campo', 'Network', 7.50, 'Conector de Fibra Óptica LC Simplex, Para Instalación en Campo, Monomodo, Fibra recubierta, Color Azul, LightSpeed, Monomodo, OS1/OS2, 8.3/125, LC, Simplex, Buffered, Bota Blanca, Azul Connector, Pulitura Epoxy', 'DISPONIBLE');

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
