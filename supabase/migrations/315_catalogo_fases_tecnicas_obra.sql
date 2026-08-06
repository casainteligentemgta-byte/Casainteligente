-- Catálogo completo de fases técnicas (cláusula PRIMERA).
-- Idempotente: on conflict (clave_norm) do nothing.
-- Ejecutar en SQL Editor si la migración 315 aún no está aplicada.

alter table public.ci_fases_tecnicas_contrato
  add column if not exists categoria text;

comment on column public.ci_fases_tecnicas_contrato.categoria is
  'Rubro de obra (Preliminar, Fundaciones, Albañilería, etc.). Opcional.';

insert into public.ci_fases_tecnicas_contrato (texto, clave_norm, categoria, usos_count)
values
  -- Preliminar y Movimiento de Tierras
  ('Deforestación, limpieza y desmalezamiento del terreno', 'deforestacion, limpieza y desmalezamiento del terreno', 'Preliminar y Movimiento de Tierras', 0),
  ('Replanteo, topografía y nivelación', 'replanteo, topografia y nivelacion', 'Preliminar y Movimiento de Tierras', 0),
  ('Excavación en tierra/roca a cielo abierto', 'excavacion en tierra/roca a cielo abierto', 'Preliminar y Movimiento de Tierras', 0),
  ('Excavación de zanjas y zapatas', 'excavacion de zanjas y zapatas', 'Preliminar y Movimiento de Tierras', 0),
  ('Carga, transporte y bote de material sobrante', 'carga, transporte y bote de material sobrante', 'Preliminar y Movimiento de Tierras', 0),
  ('Relleno y compactación de terrenos', 'relleno y compactacion de terrenos', 'Preliminar y Movimiento de Tierras', 0),
  ('Demolición de estructuras o pavimentos existentes', 'demolicion de estructuras o pavimentos existentes', 'Preliminar y Movimiento de Tierras', 0),
  -- Fundaciones y Estructura
  ('Vaciado de concreto de limpieza (piedra picada/pobre)', 'vaciado de concreto de limpieza (piedra picada/pobre)', 'Fundaciones y Estructura (Edificaciones)', 0),
  ('Armado de acero de refuerzo para fundaciones y zapatas', 'armado de acero de refuerzo para fundaciones y zapatas', 'Fundaciones y Estructura (Edificaciones)', 0),
  ('Encofrado de fundaciones, vigas de riostra y pilotes', 'encofrado de fundaciones, vigas de riostra y pilotes', 'Fundaciones y Estructura (Edificaciones)', 0),
  ('Vaciado de concreto en pilotes o pantallas', 'vaciado de concreto en pilotes o pantallas', 'Fundaciones y Estructura (Edificaciones)', 0),
  ('Vaciado de concreto en zapatas y pedestales', 'vaciado de concreto en zapatas y pedestales', 'Fundaciones y Estructura (Edificaciones)', 0),
  ('Armado y encofrado de columnas y pantallas', 'armado y encofrado de columnas y pantallas', 'Fundaciones y Estructura (Edificaciones)', 0),
  ('Vaciado de concreto en columnas y losas de piso', 'vaciado de concreto en columnas y losas de piso', 'Fundaciones y Estructura (Edificaciones)', 0),
  ('Encofrado y armado de losas de entrepiso y techo', 'encofrado y armado de losas de entrepiso y techo', 'Fundaciones y Estructura (Edificaciones)', 0),
  ('Vaciado de concreto en losas (macizas, nervadas o losacero)', 'vaciado de concreto en losas (macizas, nervadas o losacero)', 'Fundaciones y Estructura (Edificaciones)', 0),
  ('Montaje e instalación de estructuras metálicas', 'montaje e instalacion de estructuras metalicas', 'Fundaciones y Estructura (Edificaciones)', 0),
  ('Desencofrado y curado de elementos de concreto', 'desencofrado y curado de elementos de concreto', 'Fundaciones y Estructura (Edificaciones)', 0),
  -- Albañilería, Cerramientos y Acabados
  ('Construcción de paredes de bloque (arcilla o concreto)', 'construccion de paredes de bloque (arcilla o concreto)', 'Albañilería, Cerramientos y Acabados', 0),
  ('Friso base, salpicado y encamisado de paredes', 'friso base, salpicado y encamisado de paredes', 'Albañilería, Cerramientos y Acabados', 0),
  ('Friso acabado (liso/texturizado) en interiores y exteriores', 'friso acabado (liso/texturizado) en interiores y exteriores', 'Albañilería, Cerramientos y Acabados', 0),
  ('Colocación de sobrepisos, carpetas y vaciado de granito', 'colocacion de sobrepisos, carpetas y vaciado de granito', 'Albañilería, Cerramientos y Acabados', 0),
  ('Colocación de revestimientos cerámicos, porcelanatos o piedras', 'colocacion de revestimientos ceramicos, porcelanatos o piedras', 'Albañilería, Cerramientos y Acabados', 0),
  ('Instalación de tabiquería liviana (Drywall / Superboard)', 'instalacion de tabiqueria liviana (drywall / superboard)', 'Albañilería, Cerramientos y Acabados', 0),
  ('Instalación de cielos rasos (suspendidos o fijos)', 'instalacion de cielos rasos (suspendidos o fijos)', 'Albañilería, Cerramientos y Acabados', 0),
  ('Pintura general en paredes, techos y fachadas', 'pintura general en paredes, techos y fachadas', 'Albañilería, Cerramientos y Acabados', 0),
  ('Impermeabilización de losas, techos y jardineras', 'impermeabilizacion de losas, techos y jardineras', 'Albañilería, Cerramientos y Acabados', 0),
  -- Instalaciones
  ('Tendido de tuberías de red de agua potable (blanca)', 'tendido de tuberias de red de agua potable (blanca)', 'Instalaciones Sanitaria, Eléctrica y Mecánica (Edificaciones)', 0),
  ('Tendido de tuberías de aguas servidas (negras) y de lluvia', 'tendido de tuberias de aguas servidas (negras) y de lluvia', 'Instalaciones Sanitaria, Eléctrica y Mecánica (Edificaciones)', 0),
  ('Instalación de piezas y artefactos sanitarios', 'instalacion de piezas y artefactos sanitarios', 'Instalaciones Sanitaria, Eléctrica y Mecánica (Edificaciones)', 0),
  ('Cableado, empotramiento y tubería eléctrica (IEM)', 'cableado, empotramiento y tuberia electrica (iem)', 'Instalaciones Sanitaria, Eléctrica y Mecánica (Edificaciones)', 0),
  ('Instalación de tableros, breakers e interruptores', 'instalacion de tableros, breakers e interruptores', 'Instalaciones Sanitaria, Eléctrica y Mecánica (Edificaciones)', 0),
  ('Instalación de sistemas contra incendios (mangueras/rociadores)', 'instalacion de sistemas contra incendios (mangueras/rociadores)', 'Instalaciones Sanitaria, Eléctrica y Mecánica (Edificaciones)', 0),
  ('Instalación de sistemas de aire acondicionado y ductería', 'instalacion de sistemas de aire acondicionado y ducteria', 'Instalaciones Sanitaria, Eléctrica y Mecánica (Edificaciones)', 0),
  -- Obras Viales y Asfaltado
  ('Preparación y conformación de la subrasante', 'preparacion y conformacion de la subrasante', 'Obras Viales y Asfaltado', 0),
  ('Suministro, tendido y compactación de sub-base', 'suministro, tendido y compactacion de sub-base', 'Obras Viales y Asfaltado', 0),
  ('Suministro, tendido y compactación de base granular', 'suministro, tendido y compactacion de base granular', 'Obras Viales y Asfaltado', 0),
  ('Riego de adherencia e imprimación asfáltica', 'riego de adherencia e imprimacion asfaltica', 'Obras Viales y Asfaltado', 0),
  ('Colocación y compactación de mezcla asfáltica en caliente', 'colocacion y compactacion de mezcla asfaltica en caliente', 'Obras Viales y Asfaltado', 0),
  ('Construcción de brocales, aceras y cunetas de concreto', 'construccion de brocales, aceras y cunetas de concreto', 'Obras Viales y Asfaltado', 0),
  ('Demarcación vial y señalización (horizontal y vertical)', 'demarcacion vial y senalizacion (horizontal y vertical)', 'Obras Viales y Asfaltado', 0),
  -- Hidráulica, Cloacas y Urbanismo
  ('Excavación de zanjas para tuberías de alcantarillado', 'excavacion de zanjas para tuberias de alcantarillado', 'Hidráulica, Cloacas y Urbanismo', 0),
  ('Colocación de tuberías para redes de cloacas (PVC/Concreto)', 'colocacion de tuberias para redes de cloacas (pvc/concreto)', 'Hidráulica, Cloacas y Urbanismo', 0),
  ('Construcción de bocas de visita y empotramientos domiciliarios', 'construccion de bocas de visita y empotramientos domiciliarios', 'Hidráulica, Cloacas y Urbanismo', 0),
  ('Construcción de sumideros de ventana y rejas', 'construccion de sumideros de ventana y rejas', 'Hidráulica, Cloacas y Urbanismo', 0),
  ('Construcción de gaviones y muros de contención', 'construccion de gaviones y muros de contencion', 'Hidráulica, Cloacas y Urbanismo', 0),
  -- Obras Finales y Auxiliares
  ('Instalación de carpintería metálica (puertas, rejas, ventanas)', 'instalacion de carpinteria metalica (puertas, rejas, ventanas)', 'Obras Finales y Auxiliares', 0),
  ('Instalación de carpintería de madera (clósets, puertas, cocinas)', 'instalacion de carpinteria de madera (closets, puertas, cocinas)', 'Obras Finales y Auxiliares', 0),
  ('Instalación de vidrios, ventanales y cristalería', 'instalacion de vidrios, ventanales y cristaleria', 'Obras Finales y Auxiliares', 0),
  ('Limpieza general de obra y retiro de escombros', 'limpieza general de obra y retiro de escombros', 'Obras Finales y Auxiliares', 0)
on conflict (clave_norm) do update
  set categoria = excluded.categoria,
      updated_at = now();

notify pgrst, 'reload schema';
