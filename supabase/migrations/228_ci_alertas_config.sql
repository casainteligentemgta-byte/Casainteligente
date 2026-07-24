-- Configuración centralizada de alertas (singleton id=1).

create table if not exists public.ci_alertas_config (
  id smallint primary key default 1 check (id = 1),
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.ci_alertas_config is
  'Umbrales y reglas globales de alertas (procuras, compras, fast-track, despacho, Telegram).';

create or replace function public.ci_alertas_config_set_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_ci_alertas_config_updated on public.ci_alertas_config;
create trigger tr_ci_alertas_config_updated
  before update on public.ci_alertas_config
  for each row execute function public.ci_alertas_config_set_updated();

alter table public.ci_alertas_config enable row level security;

drop policy if exists ci_alertas_config_select_anon on public.ci_alertas_config;
drop policy if exists ci_alertas_config_insert_anon on public.ci_alertas_config;
drop policy if exists ci_alertas_config_update_anon on public.ci_alertas_config;

create policy ci_alertas_config_select_anon
  on public.ci_alertas_config for select to anon using (true);
create policy ci_alertas_config_insert_anon
  on public.ci_alertas_config for insert to anon with check (true);
create policy ci_alertas_config_update_anon
  on public.ci_alertas_config for update to anon using (true) with check (true);

insert into public.ci_alertas_config (id, config)
values (
  1,
  '{
    "telegram": { "canal_admin_id": null },
    "procuras": {
      "estados_alertar": ["solicitada"],
      "palabras_prioridad_alta": ["urgent", "urgente", "crit", "critico", "crítico"],
      "palabras_prioridad_media": ["prioridad", "importante"]
    },
    "compras": {
      "umbral_advertencia_dias": 90,
      "umbral_critico_dias": 365,
      "umbral_futuro_critico_dias": 7
    },
    "fast_track": {
      "limite_usd_default": 100,
      "umbral_confianza_ocr_pct": 95
    },
    "despacho": {
      "exceso_advertencia_pct": 5,
      "exceso_critico_pct": 15,
      "saldo_informativo_pct": 10
    }
  }'::jsonb
)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
