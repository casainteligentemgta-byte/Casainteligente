-- Nota de entrega unificada bajo contexto Telegram `entrada_obra` (migración 174).
-- No requiere cambios de esquema; ver lib/telegram/notaEntregaRegistro.ts.

notify pgrst, 'reload schema';
