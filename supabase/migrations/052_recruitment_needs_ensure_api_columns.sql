-- Tablas remotas incompletas: PostgREST PGRST204 ("Could not find the '…' column").
-- Idempotente: solo añade columnas que falten (modelo 031 + 032 + 034 + 047).

alter table public.recruitment_needs
  add column if not exists title text not null default 'Vacante';

alter table public.recruitment_needs add column if not exists notes text;

alter table public.recruitment_needs
  add column if not exists protocol_active boolean not null default true;

alter table public.recruitment_needs add column if not exists cargo_codigo text;
alter table public.recruitment_needs add column if not exists cargo_nombre text;
alter table public.recruitment_needs add column if not exists cargo_nivel integer;
alter table public.recruitment_needs add column if not exists tipo_vacante text;

alter table public.recruitment_needs
  add column if not exists proyecto_id uuid references public.ci_obras (id) on delete restrict;

alter table public.recruitment_needs
  add column if not exists proyecto_modulo_id uuid references public.ci_proyectos (id) on delete set null;

alter table public.recruitment_needs
  add column if not exists alerta_presupuesto_ignorada boolean not null default false;

alter table public.recruitment_needs add column if not exists notas_autorizacion text;

alter table public.recruitment_needs
  add column if not exists created_at timestamptz not null default now();

notify pgrst, 'reload schema';
