-- Alias de materiales por entidad (jerga de obra, typos aprendidos).
-- Ej.: kabilla → CABILLA, caviya → CABILLA

create table if not exists public.ci_material_aliases (
  id uuid primary key default gen_random_uuid(),
  entidad_id uuid not null references public.ci_entidades (id) on delete cascade,
  alias_norm text not null,
  material_id uuid not null references public.global_inventory (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint ci_material_aliases_entidad_alias_unique unique (entidad_id, alias_norm)
);

comment on table public.ci_material_aliases is
  'Alias normalizados de materiales por patrono (typos, jerga). Usado en búsqueda inteligente Telegram/app.';
comment on column public.ci_material_aliases.alias_norm is
  'Texto normalizado (minúsculas, sin tildes). Ej.: kabilla, caviya.';

create index if not exists idx_ci_material_aliases_lookup
  on public.ci_material_aliases (entidad_id, alias_norm);

create index if not exists idx_ci_material_aliases_material
  on public.ci_material_aliases (material_id);

alter table public.ci_material_aliases enable row level security;

drop policy if exists "ci_material_aliases_select_anon" on public.ci_material_aliases;
drop policy if exists "ci_material_aliases_select_auth" on public.ci_material_aliases;
drop policy if exists "ci_material_aliases_all_service" on public.ci_material_aliases;

create policy "ci_material_aliases_select_anon"
  on public.ci_material_aliases for select to anon using (true);

create policy "ci_material_aliases_select_auth"
  on public.ci_material_aliases for select to authenticated using (true);

create policy "ci_material_aliases_all_service"
  on public.ci_material_aliases for all to service_role using (true) with check (true);

-- Normalización alineada con lib/almacen/normalizarTextoMaterial.ts
create or replace function public.ci_normalizar_alias_material(p_text text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      lower(
        translate(
          coalesce(p_text, ''),
          'áàäâãéèëêíìïîóòöôõúùüûñÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑ',
          'aaaaaeeeeiiiiooooouuuunAAAAAEEEEIIIIOOOOOUUUUN'
        )
      ),
      '[^a-z0-9 ]',
      ' ',
      'g'
    )
  );
$$;

comment on function public.ci_normalizar_alias_material(text) is
  'Normaliza alias de material para búsqueda (minúsculas, sin tildes).';

notify pgrst, 'reload schema';
