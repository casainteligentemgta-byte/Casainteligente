-- Ingeniero residente desde RRHH (ci_empleados), no perfiles sueltos.

alter table public.ci_empleados
  add column if not exists telegram_chat_id bigint;

alter table public.ci_empleados
  add column if not exists telegram_username text;

create unique index if not exists idx_ci_empleados_telegram_chat_id
  on public.ci_empleados (telegram_chat_id)
  where telegram_chat_id is not null;

comment on column public.ci_empleados.telegram_chat_id is
  'Chat ID Telegram para alertas de avance de campo (vinculación vía bot).';

alter table public.ci_proyectos
  add column if not exists ingeniero_residente_id uuid
  references public.ci_empleados (id) on delete set null;

create index if not exists idx_ci_proyectos_ingeniero_residente
  on public.ci_proyectos (ingeniero_residente_id)
  where ingeniero_residente_id is not null;

comment on column public.ci_proyectos.ingeniero_residente_id is
  'Ingeniero residente de obra (RRHH / ci_empleados). Recibe alertas Telegram de avance.';

alter table public.telegram_vinculo_tokens
  add column if not exists empleado_id uuid
  references public.ci_empleados (id) on delete cascade;

alter table public.telegram_vinculo_tokens
  alter column perfil_id drop not null;

create index if not exists idx_telegram_vinculo_empleado
  on public.telegram_vinculo_tokens (empleado_id, expires_at desc);

alter table public.avance_diario_campo
  add column if not exists empleado_id uuid
  references public.ci_empleados (id) on delete set null;

create index if not exists idx_avance_diario_empleado
  on public.avance_diario_campo (empleado_id, fecha_reporte desc);

notify pgrst, 'reload schema';
