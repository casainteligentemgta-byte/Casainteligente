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
  ('Siemon', 'LVA24-LCQ-BC-A', 'Siemon LVA24-LCQ-BC-A Placa Acopladora Lightverse, 12 Conectores Dúplex LC/UPC "Shuttered"', 'Network', 90.00, 'Placa Acopladora Lightverse, 12 Conectores Dúplex LC/UPC "Shuttered", Acepta Hasta 24 Fibras Multimodo OM3 Y OM4. Las placas adaptadoras LightVerse proporcionan conexiones de fibra de paso de alto rendimiento en un espacio compacto. El pestillo integrado permite una fácil instalación y extracción con una sola mano, lo que permite a los usuarios trabajar de manera eficiente incluso en los entornos más densos. Tipo de conector: LC. Recuento de fibras: 24', 'DISPONIBLE');

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
