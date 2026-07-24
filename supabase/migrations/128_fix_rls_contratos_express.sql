-- Migration 128: Desactivar RLS para ci_contratos_express para asegurar visibilidad administrativa.
-- Esto resuelve el problema de que los registros no se visualizan a pesar de existir.

ALTER TABLE public.ci_contratos_express DISABLE ROW LEVEL SECURITY;

-- Notificar a PostgREST para recargar el esquema
NOTIFY pgrst, 'reload schema';
