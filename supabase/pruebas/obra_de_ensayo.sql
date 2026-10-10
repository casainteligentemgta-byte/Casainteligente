-- Obra ficticia para los ensayos del bot de Telegram (lib/telegram/simulacion).
--
-- No es una migración: son datos. Todo lleva el prefijo «ZZ ·» para quedar al final de
-- las listas, y los chats de Telegram son números que no pueden existir.
-- Idempotente: se puede ejecutar varias veces. Ya aplicado en producción (2026-10-10).
--
-- No contiene precios ni datos reales de clientes o proveedores.

insert into public.customers (id, nombre)
select '00000000-0000-4000-a000-0000000000c1', 'ZZ · PRUEBAS DEL BOT (no usar)'
where not exists (select 1 from public.customers where id = '00000000-0000-4000-a000-0000000000c1');

-- Dos obras: la segunda solo existe para ensayar traspasos entre obras.
-- (Al insertar, un trigger crea la ubicación tipo «obra» de cada una.)
-- entidad_id: la de la empresa, para que los flujos se comporten como en una obra real.
insert into public.ci_proyectos (id, nombre, nombre_proyecto, customer_id, entidad_id, estado, moneda, tipo_proyecto, naturaleza_proyecto, observaciones)
select v.id::uuid, v.nombre, v.nombre, '00000000-0000-4000-a000-0000000000c1',
       'ec808c0e-a3d7-41ff-8ad3-bbb55dcc6179',
       'nuevo', 'USD', 'integral', 'obra_construccion',
       'Obra ficticia para los ensayos automáticos del bot de Telegram. No es una obra real: no cargar datos aquí.'
from (values
  ('00000000-0000-4000-a000-0000000000a1', 'ZZ · PRUEBAS DEL BOT'),
  ('00000000-0000-4000-a000-0000000000a2', 'ZZ · PRUEBAS DEL BOT 2')
) as v(id, nombre)
where not exists (select 1 from public.ci_proyectos p where p.id = v.id::uuid);

insert into public.inv_ubicaciones (id, codigo, nombre, tipo, ci_proyecto_id, activo, descripcion)
select '00000000-0000-4000-a000-0000000000b1', 'ZZ-ALM-PRUEBAS', 'ZZ · Almacén de pruebas', 'almacen_central',
       '00000000-0000-4000-a000-0000000000a1', true, 'Almacén ficticio de los ensayos del bot.'
where not exists (select 1 from public.inv_ubicaciones where id = '00000000-0000-4000-a000-0000000000b1');

-- alert_threshold = 0: no genera alertas de stock bajo. sap_code fijo: no consume la secuencia.
insert into public.global_inventory (id, name, unit, sap_code, alert_threshold, reorder_point, stock_available, is_active, proyecto_id, entidad_id, category_name, observations)
select v.id::uuid, v.nombre, 'UND', v.sap, 0, 0, 0, true, '00000000-0000-4000-a000-0000000000a1',
       (select entidad_id from public.ci_proyectos where id = '00000000-0000-4000-a000-0000000000a1'),
       'General', 'Material ficticio de los ensayos del bot.'
from (values
  ('00000000-0000-4000-a000-0000000000d1', 'ZZ · MATERIAL DE PRUEBA 1', 'ZZ-PRUEBA-001'),
  ('00000000-0000-4000-a000-0000000000d2', 'ZZ · MATERIAL DE PRUEBA 2', 'ZZ-PRUEBA-002')
) as v(id, nombre, sap)
where not exists (select 1 from public.global_inventory g where g.id = v.id::uuid);

-- Personas del ensayo, solo en la nómina de la obra ficticia.
insert into public.ci_proyecto_nomina (id, proyecto_id, categoria, rol, nombre, telegram_chat_id, activo, notas)
select v.id::uuid, '00000000-0000-4000-a000-0000000000a1', 'empleado', v.rol, v.nombre, v.chat, true,
       'Persona ficticia de los ensayos del bot.'
from (values
  ('00000000-0000-4000-a000-0000000000e1', 'ingeniero_residente', 'Ing. Ensayo', 9990000000001::bigint),
  ('00000000-0000-4000-a000-0000000000e2', 'depositario', 'Depo Ensayo', 9990000000002::bigint),
  ('00000000-0000-4000-a000-0000000000e3', 'admin', 'Admin Ensayo', 9990000000003::bigint)
) as v(id, rol, nombre, chat)
where not exists (select 1 from public.ci_proyecto_nomina n where n.id = v.id::uuid);

-- Stock inicial (cada ensayo lo repone).
insert into public.inventario_stock (ubicacion_id, material_id, cantidad_disponible)
select '00000000-0000-4000-a000-0000000000b1', v.id::uuid, v.cant
from (values
  ('00000000-0000-4000-a000-0000000000d1', 100),
  ('00000000-0000-4000-a000-0000000000d2', 50)
) as v(id, cant)
on conflict (ubicacion_id, material_id) do nothing;
