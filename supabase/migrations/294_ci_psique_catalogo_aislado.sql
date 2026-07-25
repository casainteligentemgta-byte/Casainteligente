-- Psique: catálogo propio (ci_psique_*), sin tocar tablas legacy `pruebas` / `categorias_test`.
-- La RPC ci_recomendar_pruebas_psique lee SOLO estas tablas.

create table if not exists public.ci_psique_categorias (
  id_categoria serial primary key,
  nombre text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.ci_psique_pruebas (
  id_prueba serial primary key,
  nombre_prueba text not null unique,
  id_categoria integer not null
    references public.ci_psique_categorias (id_categoria) on delete restrict,
  descripcion text not null default '',
  objetivo_evaluacion text not null default '',
  es_clinico boolean not null default false,
  rol_examen_sugerido text null
    check (
      rol_examen_sugerido is null
      or rol_examen_sugerido in ('programador', 'tecnico', 'obrero', 'vigilante')
    ),
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_ci_psique_pruebas_categoria
  on public.ci_psique_pruebas (id_categoria);
create index if not exists idx_ci_psique_pruebas_rol
  on public.ci_psique_pruebas (rol_examen_sugerido)
  where rol_examen_sugerido is not null;

create table if not exists public.ci_psique_triggers (
  id serial primary key,
  id_prueba integer not null
    references public.ci_psique_pruebas (id_prueba) on delete cascade,
  palabra_clave text not null,
  created_at timestamptz not null default now(),
  constraint ci_psique_triggers_palabra_chk check (palabra_clave = lower(btrim(palabra_clave))),
  constraint ci_psique_triggers_unica unique (id_prueba, palabra_clave)
);

create index if not exists idx_ci_psique_triggers_palabra
  on public.ci_psique_triggers (palabra_clave);

comment on table public.ci_psique_categorias is 'Categorías del catálogo Psique.';
comment on table public.ci_psique_pruebas is 'Pruebas recomendables por cargo (agente Psique).';
comment on table public.ci_psique_triggers is 'Palabras clave → prueba Psique.';

alter table public.ci_psique_categorias enable row level security;
alter table public.ci_psique_pruebas enable row level security;
alter table public.ci_psique_triggers enable row level security;

drop policy if exists "ci_psique_cat_select_auth" on public.ci_psique_categorias;
drop policy if exists "ci_psique_pru_select_auth" on public.ci_psique_pruebas;
drop policy if exists "ci_psique_trg_select_auth" on public.ci_psique_triggers;
drop policy if exists "ci_psique_cat_select_anon" on public.ci_psique_categorias;
drop policy if exists "ci_psique_pru_select_anon" on public.ci_psique_pruebas;
drop policy if exists "ci_psique_trg_select_anon" on public.ci_psique_triggers;

create policy "ci_psique_cat_select_auth" on public.ci_psique_categorias
  for select to authenticated using (true);
create policy "ci_psique_pru_select_auth" on public.ci_psique_pruebas
  for select to authenticated using (true);
create policy "ci_psique_trg_select_auth" on public.ci_psique_triggers
  for select to authenticated using (true);
create policy "ci_psique_cat_select_anon" on public.ci_psique_categorias
  for select to anon using (true);
create policy "ci_psique_pru_select_anon" on public.ci_psique_pruebas
  for select to anon using (true);
create policy "ci_psique_trg_select_anon" on public.ci_psique_triggers
  for select to anon using (true);

insert into public.ci_psique_categorias (nombre) values
  ('Cognitiva / GMA'),
  ('Integridad'),
  ('Personalidad'),
  ('Técnica / oficio'),
  ('Seguridad ocupacional'),
  ('Atención y vigilancia')
on conflict (nombre) do nothing;

insert into public.ci_psique_pruebas (
  nombre_prueba, id_categoria, descripcion, objetivo_evaluacion, es_clinico, rol_examen_sugerido
)
select v.nombre_prueba, c.id_categoria, v.descripcion, v.objetivo_evaluacion, v.es_clinico, v.rol_examen_sugerido
from (
  values
    (
      'Razonamiento lógico (GMA)',
      'Cognitiva / GMA',
      'Ítems de lógica y resolución de problemas alineados al banco CI.',
      'Estimar capacidad de razonamiento para roles técnicos y de oficina.',
      false,
      'tecnico'
    ),
    (
      'Razonamiento lógico programador',
      'Cognitiva / GMA',
      'Banco de lógica orientado a perfiles de desarrollo / TI.',
      'Evaluar pensamiento analítico en candidatos de software.',
      false,
      'programador'
    ),
    (
      'Integridad y honestidad',
      'Integridad',
      'Situaciones de ética, material de obra y manejo de información.',
      'Detectar riesgo de deshonestidad o tolerancia a irregularidades.',
      false,
      'tecnico'
    ),
    (
      'DISC / perfil conductual',
      'Personalidad',
      'Perfil de estilo de trabajo y comunicación (no clínico).',
      'Orientar encaje de equipo y supervisión.',
      false,
      'programador'
    ),
    (
      'Situacional de obra (obrero)',
      'Seguridad ocupacional',
      '20 ítems ABC / situacionales de obra Casa Inteligente.',
      'Evaluar seguridad, responsabilidad y convivencia en campo.',
      false,
      'obrero'
    ),
    (
      'Aptitud técnica CCTV / redes',
      'Técnica / oficio',
      'Conocimientos y criterio para instalación y operación de CCTV.',
      'Validar base técnica de técnico de seguridad electrónica.',
      false,
      'tecnico'
    ),
    (
      'Atención sostenida / vigilancia',
      'Atención y vigilancia',
      'Monitoreo, fatiga y respuesta ante eventos en puestos de vigilancia.',
      'Evaluar idoneidad para monitoreo CCTV o vigilancia física.',
      false,
      'vigilante'
    ),
    (
      'Seguridad en altura y EPP',
      'Seguridad ocupacional',
      'Uso de EPP, trabajo en altura y reporte de riesgos.',
      'Reducir riesgo operativo en oficios de obra.',
      false,
      'obrero'
    )
) as v(nombre_prueba, categoria, descripcion, objetivo_evaluacion, es_clinico, rol_examen_sugerido)
join public.ci_psique_categorias c on c.nombre = v.categoria
where not exists (
  select 1 from public.ci_psique_pruebas p where p.nombre_prueba = v.nombre_prueba
);

insert into public.ci_psique_triggers (id_prueba, palabra_clave)
select p.id_prueba, lower(btrim(t.palabra_clave))
from (
  values
    ('Razonamiento lógico (GMA)', 'tecnico'),
    ('Razonamiento lógico (GMA)', 'empleado'),
    ('Razonamiento lógico (GMA)', 'oficina'),
    ('Razonamiento lógico programador', 'programador'),
    ('Razonamiento lógico programador', 'desarrollador'),
    ('Razonamiento lógico programador', 'software'),
    ('Razonamiento lógico programador', 'ti'),
    ('Integridad y honestidad', 'tecnico'),
    ('Integridad y honestidad', 'obrero'),
    ('Integridad y honestidad', 'vigilante'),
    ('Integridad y honestidad', 'cctv'),
    ('Integridad y honestidad', 'seguridad'),
    ('Integridad y honestidad', 'almacen'),
    ('DISC / perfil conductual', 'programador'),
    ('DISC / perfil conductual', 'empleado'),
    ('DISC / perfil conductual', 'supervisor'),
    ('DISC / perfil conductual', 'coordinador'),
    ('Situacional de obra (obrero)', 'obrero'),
    ('Situacional de obra (obrero)', 'ayudante'),
    ('Situacional de obra (obrero)', 'oficial'),
    ('Situacional de obra (obrero)', 'maestro'),
    ('Situacional de obra (obrero)', 'construccion'),
    ('Aptitud técnica CCTV / redes', 'cctv'),
    ('Aptitud técnica CCTV / redes', 'camara'),
    ('Aptitud técnica CCTV / redes', 'camaras'),
    ('Aptitud técnica CCTV / redes', 'dvr'),
    ('Aptitud técnica CCTV / redes', 'nvr'),
    ('Aptitud técnica CCTV / redes', 'videovigilancia'),
    ('Atención sostenida / vigilancia', 'cctv'),
    ('Atención sostenida / vigilancia', 'vigilante'),
    ('Atención sostenida / vigilancia', 'vigilancia'),
    ('Atención sostenida / vigilancia', 'portero'),
    ('Atención sostenida / vigilancia', 'monitorista'),
    ('Seguridad en altura y EPP', 'obrero'),
    ('Seguridad en altura y EPP', 'altura'),
    ('Seguridad en altura y EPP', 'andamio'),
    ('Seguridad en altura y EPP', 'epp'),
    ('Seguridad en altura y EPP', 'tecnico')
) as t(nombre_prueba, palabra_clave)
join public.ci_psique_pruebas p on p.nombre_prueba = t.nombre_prueba
where not exists (
  select 1
  from public.ci_psique_triggers tr
  where tr.id_prueba = p.id_prueba
    and tr.palabra_clave = lower(btrim(t.palabra_clave))
);

create or replace function public.ci_recomendar_pruebas_psique(palabras_clave text[])
returns table (
  id_prueba integer,
  nombre_prueba text,
  categoria text,
  descripcion text,
  objetivo_evaluacion text,
  es_clinico boolean,
  rol_examen_sugerido text
)
language sql
stable
security invoker
set search_path = public
as $psique$
  select distinct
    p.id_prueba,
    p.nombre_prueba,
    c.nombre as categoria,
    p.descripcion,
    p.objetivo_evaluacion,
    p.es_clinico,
    p.rol_examen_sugerido
  from public.ci_psique_pruebas p
  join public.ci_psique_categorias c on p.id_categoria = c.id_categoria
  join public.ci_psique_triggers t on p.id_prueba = t.id_prueba
  where p.activa = true
    and t.palabra_clave = any (
      select lower(btrim(x)) from unnest(coalesce(palabras_clave, array[]::text[])) as x
      where btrim(coalesce(x, '')) <> ''
    )
  order by p.nombre_prueba;
$psique$;

comment on function public.ci_recomendar_pruebas_psique(text[]) is
  'Recomienda pruebas Psique (catálogo ci_psique_*) según palabras clave del cargo.';

grant execute on function public.ci_recomendar_pruebas_psique(text[]) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
