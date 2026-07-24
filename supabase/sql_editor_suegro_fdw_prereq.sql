-- Prerrequisito FDW: conectar la BD del suegro como schema remoto `suegro_db`.
-- Ejecutar en SQL Editor de Supabase (proyecto Casa Inteligente) ANTES de usar
-- «Sincronizar BD» en CCO. Ajuste host/db/user/password a las credenciales reales.

CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- Ejemplo (rellenar con datos reales del Supabase del suegro):
-- DROP SERVER IF EXISTS suegro_server CASCADE;
-- CREATE SERVER suegro_server
--   FOREIGN DATA WRAPPER postgres_fdw
--   OPTIONS (host 'db.XXXX.supabase.co', port '5432', dbname 'postgres');
--
-- CREATE USER MAPPING IF NOT EXISTS FOR postgres
--   SERVER suegro_server
--   OPTIONS (user 'postgres', password 'SERVICE_OR_DB_PASSWORD');
-- CREATE USER MAPPING IF NOT EXISTS FOR authenticator
--   SERVER suegro_server
--   OPTIONS (user 'postgres', password 'SERVICE_OR_DB_PASSWORD');
-- CREATE USER MAPPING IF NOT EXISTS FOR service_role
--   SERVER suegro_server
--   OPTIONS (user 'postgres', password 'SERVICE_OR_DB_PASSWORD');
--
-- CREATE SCHEMA IF NOT EXISTS suegro_db;
-- IMPORT FOREIGN SCHEMA public
--   LIMIT TO (transacciones, proveedores, tipos_gasto, estructura_costos, formas_pago)
--   FROM SERVER suegro_server INTO suegro_db;
--
-- Luego: notify pgrst, 'reload schema';
-- y aplicar migración 282_ci_sincronizar_desde_suegro_fdw.sql (o el SQL Editor equivalente).

SELECT to_regnamespace('suegro_db') AS schema_suegro_db,
       to_regclass('suegro_db.transacciones') AS transacciones;
