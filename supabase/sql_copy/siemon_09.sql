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
  ('Siemon', 'HCM-6-2U', 'Siemon HCM-6-2U Organizador de Cable Horizontal RouteIT, Sencillo, 4" de profundidad', 'Network', 75.00, 'Organizador de Cable Horizontal RouteIT, Sencillo, 4" de profundidad, Rackeable 19", 2U, Cubierta...', 'DISPONIBLE'),
  ('Siemon', 'PNL-BLNK-1', 'Siemon PNL-BLNK-1 Panel Ciego Horizontal para Rack estándar de 19", 1UR, Color Negro con', 'Network', 20.00, 'Panel Ciego Horizontal para Rack estándar de 19", 1UR, Color Negro con el logo de SIEMON, Instala...', 'DISPONIBLE'),
  ('Siemon', 'PNL-BLNK-2', 'Siemon PNL-BLNK-2 Panel Ciego Horizontal para Rack estándar de 19", 2UR, Color Negro con', 'Network', 26.00, 'Panel Ciego Horizontal para Rack estándar de 19", 2UR, Color Negro con el logo de SIEMON, Instala...', 'DISPONIBLE'),
  ('Siemon', 'PNL-BLNKA-2', 'Siemon PNL-BLNKA-2 Panel Ciego Horizontal Angulado para Rack estándar de 19", 2UR, Color', 'Network', 50.00, 'Panel Ciego Horizontal Angulado para Rack estándar de 19", 2UR, Color Negro con el logo de SIEMON...', 'DISPONIBLE'),
  ('Siemon', 'VCM-25-12-01', 'Siemon VCM-25-12-01 25 piezas Rollo de 25 cintos reusables de 12" (305 mm) de largo, color', 'Network', 28.50, '25 piezas Rollo de 25 cintos reusables de 12" (305 mm) de largo, color negro. Los cintos para org...', 'DISPONIBLE'),
  ('Siemon', 'MAX-TT', 'Siemon MAX-TT Herramienta de Terminación TurboTool para conectores UTP MAX', 'Network', 6.75, 'Herramienta de Terminación TurboTool para conectores UTP MAX, Compatible con Categoría 5e y 6 en...', 'DISPONIBLE'),
  ('Siemon', 'CPT-T', 'Siemon CPT-T Herramienta para Preparación de Cable S/FTP, Incluye dado Guía para', 'Network', 67.00, 'Herramienta para Preparación de Cable S/FTP, Incluye dado Guía para Conector TERA, CPT, TERA, Red...', 'DISPONIBLE'),
  ('Siemon', 'UMAX-PD', 'Siemon UMAX-PD Herramienta de Impacto dinamica UltraMAX de 4 pares (Para un ponchado', 'Network', 215.00, 'Herramienta de Impacto dinamica UltraMAX de 4 pares (Para un ponchado más rápido y eficiente). Di...', 'DISPONIBLE'),
  ('Siemon', 'UMAX-TT', 'Siemon UMAX-TT UltraMAX TurboTool. Proporciona una entrada de cable flexible', 'Network', 140.00, 'UltraMAX TurboTool. Proporciona una entrada de cable flexible, permitiendo la terminación a ambos...', 'DISPONIBLE'),
  ('Siemon', 'UMAX-TT-D', 'Siemon UMAX-TT-D Troquel de corte de repuesto UltraMAX TurboTool. Los usuarios pueden', 'Network', 20.00, 'Troquel de corte de repuesto UltraMAX TurboTool. Los usuarios pueden reemplazar fácilmente la mat...', 'DISPONIBLE'),
  ('Siemon', 'PG2', 'Siemon PG2 Protector de palma con inserto UltraMAX. La protección de palma absorbe', 'Network', 22.00, 'Protector de palma con inserto UltraMAX. La protección de palma absorbe el impacto de la terminac...', 'DISPONIBLE'),
  ('Siemon', 'PG2-U', 'Siemon PG2-U Inserto UltraMAX sin protector de palma. La protección de palma absorbe', 'Network', 6.00, 'Inserto UltraMAX sin protector de palma. La protección de palma absorbe el impacto de la terminac...', 'DISPONIBLE'),
  ('Siemon', 'Z-TOOL', 'Siemon Z-TOOL Herramienta de Terminación para conectores Z-MAX. Esta herramienta', 'Network', 10.00, 'Herramienta de Terminación para conectores Z-MAX. Esta herramienta fácil de usar de diseño ergonó...', 'DISPONIBLE'),
  ('Siemon', 'Z-TOOL-ZP', 'Siemon Z-TOOL-ZP Herramienta de terminación para conectores Z-PLUG de SIEMON, Color', 'Network', 7.50, 'Herramienta de terminación para conectores Z-PLUG de SIEMON, Color Negro. La línea Z-PLUG de Siem...', 'DISPONIBLE'),
  ('Siemon', 'FC1-LB-LC5-9AQ', 'Siemon FC1-LB-LC5-9AQ Conector de Fibra Óptica pre-pulido LightBow LC Simplex, 900um', 'Network', 13.50, 'Conector de Fibra Óptica pre-pulido LightBow LC Simplex, 900um Buffered, Multimodo 50/125 (OM3/OM...', 'DISPONIBLE');

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
