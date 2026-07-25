-- Deduplicación de alertas Telegram por vencimientos de permisología (IVSS / INCES / solvencia).

create table if not exists public.ci_permisologia_alertas_log (
  id uuid primary key default gen_random_uuid(),
  entidad_id uuid not null references public.ci_entidades (id) on delete cascade,
  campo text not null check (
    campo in ('ivss_vence', 'inces_vence', 'solvencia_laboral_vence')
  ),
  alert_days int not null check (alert_days in (0, 5, 15, 30)),
  sent_on date not null default ((now() at time zone 'America/Caracas')::date),
  canal text not null default 'telegram',
  mensaje text,
  created_at timestamptz not null default now(),
  unique (entidad_id, campo, alert_days, sent_on)
);

create index if not exists idx_ci_permisologia_alertas_log_sent
  on public.ci_permisologia_alertas_log (sent_on desc);

create index if not exists idx_ci_permisologia_alertas_log_entidad
  on public.ci_permisologia_alertas_log (entidad_id, campo);

comment on table public.ci_permisologia_alertas_log is
  'Alertas enviadas por vencimientos de permisología del patrono (Departamento Legal / Telegram).';

alter table public.ci_permisologia_alertas_log enable row level security;

grant select, insert, update, delete on public.ci_permisologia_alertas_log to service_role;
grant select on public.ci_permisologia_alertas_log to authenticated;

notify pgrst, 'reload schema';
