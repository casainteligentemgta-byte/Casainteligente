-- Permite crear proyectos del módulo sin cliente vinculado (formulario simplificado).
alter table public.ci_proyectos alter column customer_id drop not null;
