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
  ('Siemon', 'FRP12VLFF-020MA', 'Siemon FRP12VLFF-020MA 20 metros', 'Network', 245.00, '20 metros', 'DISPONIBLE'),
  ('Siemon', 'FRP12VLFF-024MA', 'Siemon FRP12VLFF-024MA 24 metros', 'Network', 275.00, '24 metros', 'DISPONIBLE'),
  ('Siemon', 'FRP12VLFF-026MA', 'Siemon FRP12VLFF-026MA 26 metros', 'Network', 285.00, '26 metros', 'DISPONIBLE'),
  ('Siemon', 'SFPH10GB2.0M01L', 'Siemon SFPH10GB2.0M01L Cable de alta velocidad High Speed, DAC (conexión directa de cobre)', 'Network', 62.50, 'Cable de alta velocidad High Speed, DAC (conexión directa de cobre), Ethernet 10G NRZ, 30AWG, CR1...', 'DISPONIBLE'),
  ('Siemon', 'SFPH10GB3.0M01L', 'Siemon SFPH10GB3.0M01L Cable de alta velocidad High Speed, DAC (conexión directa de cobre)', 'Network', 65.00, 'Cable de alta velocidad High Speed, DAC (conexión directa de cobre), Ethernet 10G NRZ, 30AWG, CR1...', 'DISPONIBLE'),
  ('Siemon', 'SFPH10GB3.0M03L', 'Siemon SFPH10GB3.0M03L Cable de alta velocidad High Speed, DAC (conexión directa de cobre)', 'Network', 65.00, 'Cable de alta velocidad High Speed, DAC (conexión directa de cobre), Ethernet 10G NRZ, 30AWG, CR1...', 'DISPONIBLE'),
  ('Siemon', '9F8LB1-12D-Metro', 'Siemon 9F8LB1-12D-Metro Cable, 12 Fibras, XGLO, Monomodo, OS1/OS2, 8.3/125, Indoor (int...', 'Network', 0.95, 'Cable, 12 Fibras, XGLO, Monomodo, OS1/OS2, 8.3/125, Indoor (interior), Tight Buffered, Non-Armore...', 'DISPONIBLE'),
  ('Siemon', '9F8LE4-12D-Metro', 'Siemon 9F8LE4-12D-Metro Cable, 12 Fibras, XGLO, Monomodo, OS1/OS2, 8.3/125, Outside Plant', 'Network', 1.40, 'Cable, 12 Fibras, XGLO, Monomodo, OS1/OS2, 8.3/125, Outside Plant (Exterior), Loose Tube, GEL, Ar...', 'DISPONIBLE'),
  ('Siemon', '9F5LB1-6B-Metro', 'Siemon 9F5LB1-6B-Metro Cable, 6 Fibras, XGLO, Multimodo, OM3, 50/125, Indoor (interior)...', 'Network', 1.75, 'Cable, 6 Fibras, XGLO, Multimodo, OM3, 50/125, Indoor (interior), Tight Buffered ideal para campu...', 'DISPONIBLE'),
  ('Siemon', '9F5VB3-6B-Metro', 'Siemon 9F5VB3-6B-Metro Cable, 6 Fibras, XGLO, Multimodo, OM4, 50/125, Indoor (interior)...', 'Network', 2.75, 'Cable, 6 Fibras, XGLO, Multimodo, OM4, 50/125, Indoor (interior), Tight Buffered ideal para data...', 'DISPONIBLE'),
  ('Siemon', '9GD5H006D-T501M', 'Siemon 9GD5H006D-T501M Cable, 6 Fibras, XGLO, Multimodo, OM4, 50/125, Indoor (interior) /', 'Network', 3.10, 'Cable, 6 Fibras, XGLO, Multimodo, OM4, 50/125, Indoor (interior) / Outdoor (Exterior), Tight Buff...', 'DISPONIBLE'),
  ('Siemon', '9F5LE4-6B-Metro', 'Siemon 9F5LE4-6B-Metro Cable, 6 Fibras, XGLO, Multimodo, OM3, 50/125, Outside Plant', 'Network', 2.75, 'Cable, 6 Fibras, XGLO, Multimodo, OM3, 50/125, Outside Plant (Exterior), Loose Tube, GEL, Armored...', 'DISPONIBLE'),
  ('Siemon', '9F5LE4-12D-Metro', 'Siemon 9F5LE4-12D-Metro Cable, 12 Fibras, XGLO, Multimodo, OM3, 50/125, Outside Plant', 'Network', 4.50, 'Cable, 12 Fibras, XGLO, Multimodo, OM3, 50/125, Outside Plant (Exterior), Loose Tube, GEL, Armore...', 'DISPONIBLE'),
  ('Siemon', '9F5LE4-24B-Metro', 'Siemon 9F5LE4-24B-Metro Cable, 24 Fibras, XGLO, Multimodo, OM3, 50/125, Outside Plant', 'Network', 7.50, 'Cable, 24 Fibras, XGLO, Multimodo, OM3, 50/125, Outside Plant (Exterior), Loose Tube, GEL, Armore...', 'DISPONIBLE'),
  ('Siemon', 'HT-40', 'Siemon HT-40 Mangas de Protección, para Empalmes de Fibra Óptica, Encogimiento por', 'Network', 0.45, 'Mangas de Protección, para Empalmes de Fibra Óptica, Encogimiento por Calor, de 40 mm', 'DISPONIBLE'),
  ('Siemon', 'HT-60', 'Siemon HT-60 Mangas de Protección, para Empalmes de Fibra Óptica, Encogimiento por', 'Network', 0.50, 'Mangas de Protección, para Empalmes de Fibra Óptica, Encogimiento por Calor, de 60 mm', 'DISPONIBLE');

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
