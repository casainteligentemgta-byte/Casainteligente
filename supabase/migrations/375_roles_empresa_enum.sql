-- Paso 1 de 2: valores de rol de empresa en el enum ci_rol_sistema.
-- Va en archivo aparte: Postgres no permite usar un valor de enum recién agregado
-- dentro de la misma transacción. La migración 376 lo usa.

ALTER TYPE public.ci_rol_sistema ADD VALUE IF NOT EXISTS 'pm_obra';
ALTER TYPE public.ci_rol_sistema ADD VALUE IF NOT EXISTS 'contador';
ALTER TYPE public.ci_rol_sistema ADD VALUE IF NOT EXISTS 'comprador';
ALTER TYPE public.ci_rol_sistema ADD VALUE IF NOT EXISTS 'almacen_central';
ALTER TYPE public.ci_rol_sistema ADD VALUE IF NOT EXISTS 'solo_lectura';
ALTER TYPE public.ci_rol_sistema ADD VALUE IF NOT EXISTS 'cco_lectura';
