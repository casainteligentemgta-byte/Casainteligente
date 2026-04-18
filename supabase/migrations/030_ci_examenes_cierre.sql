 -- Cierre de prueba por tiempo o registro de respuestas parciales en la invitación.

alter table public.ci_examenes
  add column if not exists fin_at timestamptz;

alter table public.ci_examenes
  add column if not exists respuestas_json jsonb;

alter table public.ci_examenes
  add column if not exists completado boolean not null default false;

comment on column public.ci_examenes.completado is 'true si se registró cierre (p. ej. tiempo agotado) vía /api/talento/examen/finalizar.';
comment on column public.ci_examenes.respuestas_json is 'Snapshot de respuestas al cierre (parcial o según negocio).';
