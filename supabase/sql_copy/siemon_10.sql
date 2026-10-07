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
  ('Siemon', 'FC1-LC-SM-B02', 'Siemon FC1-LC-SM-B02 Conector de Fibra Óptica LC Simplex, Para Instalación en Campo', 'Network', 7.50, 'Conector de Fibra Óptica LC Simplex, Para Instalación en Campo, Monomodo, Fibra recubierta, Color...', 'DISPONIBLE'),
  ('Siemon', 'FT-LB-TOOL', 'Siemon FT-LB-TOOL Herramienta de Terminación para conectores de Fibra Óptica LightBow', 'Network', 30.00, 'Herramienta de Terminación para conectores de Fibra Óptica LightBow. Empalme mecánico de fácil te...', 'DISPONIBLE'),
  ('Siemon', 'FT-MP-AT', 'Siemon FT-MP-AT Herramienta de Activación para MTP Pro', 'Network', 325.00, 'Herramienta de Activación para MTP Pro', 'DISPONIBLE'),
  ('Siemon', 'FT-MP-PE-MM', 'Siemon FT-MP-PE-MM Intercambiador de pines para MTP pro, Multimodo con Pines Elite', 'Network', 9.50, 'Intercambiador de pines para MTP pro, Multimodo con Pines Elite', 'DISPONIBLE'),
  ('Siemon', 'FJ1-SCASCAL-02', 'Siemon FJ1-SCASCAL-02 Fibra, Jumper, Simplex, XGLO, Monomodo, SC APC, SC APC, OS1/OS2', 'Network', 21.00, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC APC, SC APC, OS1/OS2, 8.3/125, Amarillo, OFNR, 02 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ1-SCASCAL-03', 'Siemon FJ1-SCASCAL-03 Fibra, Jumper, Simplex, XGLO, Monomodo, SC APC, SC APC, OS1/OS2', 'Network', 22.00, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC APC, SC APC, OS1/OS2, 8.3/125, Amarillo, OFNR, 03 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ1-SCASCAL-05', 'Siemon FJ1-SCASCAL-05 Fibra, Jumper, Simplex, XGLO, Monomodo, SC APC, SC APC, OS1/OS2', 'Network', 23.00, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC APC, SC APC, OS1/OS2, 8.3/125, Amarillo, OFNR, 05 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ1-SCUSCUL-03', 'Siemon FJ1-SCUSCUL-03 Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC, SC UPC, OS1/OS2', 'Network', 17.00, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC, SC UPC, OS1/OS2, 8.3/125, Amarillo, OFNR, 03 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ1-SCUSCUL-05', 'Siemon FJ1-SCUSCUL-05 Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC, SC UPC, OS1/OS2', 'Network', 18.50, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC, SC UPC, OS1/OS2, 8.3/125, Amarillo, OFNR, 05 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ1-SCUSCAL-03', 'Siemon FJ1-SCUSCAL-03 Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC, SC APC, OS1/OS2', 'Network', 21.50, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC, SC APC, OS1/OS2, 8.3/125, Amarillo, OFNR, 03 Metros', 'DISPONIBLE'),
  ('Siemon', 'FJ1-SCUSCAL-05', 'Siemon FJ1-SCUSCAL-05 Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC, SC APC, OS1/OS2', 'Network', 22.50, 'Fibra, Jumper, Simplex, XGLO, Monomodo, SC UPC, SC APC, OS1/OS2, 8.3/125, Amarillo, OFNR, 05 Metros', 'DISPONIBLE'),
  ('Siemon', 'J2-LCULCUL-02H', 'Siemon J2-LCULCUL-02H Fibra, Jumper, Duplex, ValuLight, Monomodo, LC UPC, LC UPC, OS1/OS2', 'Network', 18.50, 'Fibra, Jumper, Duplex, ValuLight, Monomodo, LC UPC, LC UPC, OS1/OS2, 8.3/125, Amarillo, LSOH-1, 0...', 'DISPONIBLE'),
  ('Siemon', 'J2-LCULCUL-03H', 'Siemon J2-LCULCUL-03H Fibra, Jumper, Duplex, ValuLight, Monomodo, LC UPC, LC UPC, OS1/OS2', 'Network', 19.00, 'Fibra, Jumper, Duplex, ValuLight, Monomodo, LC UPC, LC UPC, OS1/OS2, 8.3/125, Amarillo, LSOH-1, 0...', 'DISPONIBLE'),
  ('Siemon', 'J2-LCULCUL-05H', 'Siemon J2-LCULCUL-05H Fibra, Jumper, Duplex, ValuLight, Monomodo, LC UPC, LC UPC, OS1/OS2', 'Network', 20.00, 'Fibra, Jumper, Duplex, ValuLight, Monomodo, LC UPC, LC UPC, OS1/OS2, 8.3/125, Amarillo, LSOH-1, 0...', 'DISPONIBLE'),
  ('Siemon', 'FJ2-LCULCUL-02H', 'Siemon FJ2-LCULCUL-02H Fibra, Jumper, Duplex, XGLO, Monomodo, LC UPC, LC UPC, OS1/OS2', 'Network', 30.50, 'Fibra, Jumper, Duplex, XGLO, Monomodo, LC UPC, LC UPC, OS1/OS2, 8.3/125, Amarillo, LSOH-3C, 02 Me...', 'DISPONIBLE');

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
