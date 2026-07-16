-- Evidencia visual en partidas (URLs de Supabase Storage).
-- Legacy ci_presupuesto_partidas + esquema normalizado partidas (Lulo cascada).

alter table public.ci_presupuesto_partidas
  add column if not exists evidencias_fotos text[] not null default '{}'::text[];

alter table public.ci_presupuesto_partidas
  add column if not exists evidencias_videos text[] not null default '{}'::text[];

comment on column public.ci_presupuesto_partidas.evidencias_fotos is
  'URLs públicas de fotos de avance vinculadas a la partida (Telegram, visitas, etc.).';

comment on column public.ci_presupuesto_partidas.evidencias_videos is
  'URLs públicas de videos de avance vinculados a la partida.';

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'partidas'
  ) then
    alter table public.partidas
      add column if not exists evidencias_fotos text[] not null default '{}'::text[];
    alter table public.partidas
      add column if not exists evidencias_videos text[] not null default '{}'::text[];

    comment on column public.partidas.evidencias_fotos is
      'URLs de Supabase Storage — fotos de evidencia de avance.';
    comment on column public.partidas.evidencias_videos is
      'URLs de Supabase Storage — videos de evidencia de avance.';
  end if;
end $$;

notify pgrst, 'reload schema';
