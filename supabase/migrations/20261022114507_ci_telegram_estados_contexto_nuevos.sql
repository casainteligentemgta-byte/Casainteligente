-- Amplía la restricción de contexto del bot para los flujos nuevos del comprador y depositario:
-- nota_precarga (nota de entrega precargada), resolver_lineas (líneas sin material en factura
-- o nota) y agenda (agenda personal). Sin esto el bot falla al guardar esos pasos.

ALTER TABLE public.ci_telegram_estados DROP CONSTRAINT IF EXISTS ci_telegram_estados_contexto_check;

ALTER TABLE public.ci_telegram_estados
  ADD CONSTRAINT ci_telegram_estados_contexto_check
  CHECK (contexto = ANY (ARRAY[
    'menu'::text,
    'factura'::text,
    'obra'::text,
    'gasto_obra'::text,
    'esperando_audio_bitacora'::text,
    'entrada_obra'::text,
    'nota_precarga'::text,
    'resolver_lineas'::text,
    'salida_obra'::text,
    'avance_campo'::text,
    'avance_campo_cantidad'::text,
    'memoria_obra'::text,
    'memoria_obra_foto'::text,
    'depositario_recepcion'::text,
    'traspaso_inventario'::text,
    'consulta_stock'::text,
    'procura_solicitud'::text,
    'procura_departamento'::text,
    'esperando_motivo_rechazo'::text,
    'agenda'::text
  ]));

NOTIFY pgrst, 'reload schema';
