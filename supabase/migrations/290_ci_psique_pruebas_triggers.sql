-- Psique: catálogo de pruebas psicológicas / técnicas y triggers por palabra clave.
-- Usado por POST /api/talento/psique/recomendar y scripts/recomendar_pruebas_psique.py

create table if not exists public.categorias_test (
  id_categoria serial primary key,
  nombre text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.pruebas (
  id_prueba serial primary key,
  nombre_prueba text not null,
  id_categoria integer not null references public.categorias_test (id_categoria) on delete restrict,
  descripcion text not null default '',
  objetivo_evaluacion text not null default '',
  es_clinico boolean not null default false,
  -- Banco de examen Casa Inteligente asociado (opcional).
  rol_examen_sugerido text null,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

-- Si `pruebas` ya existía (CREATE TABLE IF NOT EXISTS no añade columnas), completar schema.
alter table public.pruebas
  add column if not exists descripcion text not null default '';
alter table public.pruebas
  add column if not exists objetivo_evaluacion text not null default '';
alter table public.pruebas
  add column if not exists es_clinico boolean not null default false;
alter table public.pruebas
  add column if not exists rol_examen_sugerido text null;
alter table public.pruebas
  add column if not exists activa boolean not null default true;
alter table public.pruebas
  add column if not exists created_at timestamptz not null default now();

alter table public.pruebas drop constraint if exists pruebas_rol_examen_sugerido_check;
alter table public.pruebas
  add constraint pruebas_rol_examen_sugerido_check
  check (
    rol_examen_sugerido is null
    or rol_examen_sugerido in ('programador', 'tecnico', 'obrero', 'vigilante')
  );

create index if not exists idx_pruebas_categoria on public.pruebas (id_categoria);
create index if not exists idx_pruebas_rol_examen on public.pruebas (rol_examen_sugerido)
  where rol_examen_sugerido is not null;

create table if not exists public.triggers_prueba (
  id serial primary key,
  id_prueba integer not null references public.pruebas (id_prueba) on delete cascade,
  palabra_clave text not null,
  created_at timestamptz not null default now(),
  constraint triggers_prueba_palabra_clave_chk check (palabra_clave = lower(btrim(palabra_clave))),
  constraint triggers_prueba_unica unique (id_prueba, palabra_clave)
);

create index if not exists idx_triggers_prueba_palabra on public.triggers_prueba (palabra_clave);

comment on table public.categorias_test is 'Categorías del catálogo Psique (cognitiva, integridad, técnica, etc.).';
comment on table public.pruebas is 'Batería de pruebas recomendables por cargo/solicitud (Psique).';
comment on table public.triggers_prueba is 'Palabras clave que disparan la recomendación de una prueba Psique.';
comment on column public.pruebas.rol_examen_sugerido is
  'Rol de examen CI (programador|tecnico|obrero|vigilante) sugerido al asignar esta prueba.';

alter table public.categorias_test enable row level security;
alter table public.pruebas enable row level security;
alter table public.triggers_prueba enable row level security;

drop policy if exists "psique_cat_select_auth" on public.categorias_test;
drop policy if exists "psique_pru_select_auth" on public.pruebas;
drop policy if exists "psique_trg_select_auth" on public.triggers_prueba;
drop policy if exists "psique_cat_select_anon" on public.categorias_test;
drop policy if exists "psique_pru_select_anon" on public.pruebas;
drop policy if exists "psique_trg_select_anon" on public.triggers_prueba;

create policy "psique_cat_select_auth" on public.categorias_test
  for select to authenticated using (true);
create policy "psique_pru_select_auth" on public.pruebas
  for select to authenticated using (true);
create policy "psique_trg_select_auth" on public.triggers_prueba
  for select to authenticated using (true);

-- Lectura anónima del catálogo (CRM/preview sin sesión); escritura solo service_role / SQL.
create policy "psique_cat_select_anon" on public.categorias_test
  for select to anon using (true);
create policy "psique_pru_select_anon" on public.pruebas
  for select to anon using (true);
create policy "psique_trg_select_anon" on public.triggers_prueba
  for select to anon using (true);

-- Alinear secuencias serial (solo si la columna es entera; evita error text/integer).
do $$
declare
  seq text;
  col_type text;
  mx bigint;
begin
  -- categorias_test.id_categoria
  seq := pg_get_serial_sequence('public.categorias_test', 'id_categoria');
  if seq is not null then
    select coalesce(max(id_categoria), 0) into mx from public.categorias_test;
    perform setval(seq, greatest(mx, 1));
  end if;

  -- pruebas.id_prueba (omitir si la tabla legacy tiene id text/uuid)
  select data_type into col_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'pruebas' and column_name = 'id_prueba';
  seq := pg_get_serial_sequence('public.pruebas', 'id_prueba');
  if seq is not null and col_type in ('integer', 'bigint', 'smallint') then
    execute 'select coalesce(max(id_prueba), 0) from public.pruebas' into mx;
    perform setval(seq, greatest(mx, 1));
  end if;

  -- triggers_prueba.id
  seq := pg_get_serial_sequence('public.triggers_prueba', 'id');
  if seq is not null then
    select coalesce(max(id), 0) into mx from public.triggers_prueba;
    perform setval(seq, greatest(mx, 1));
  end if;
end $$;

-- Seed categorías (idempotente; no choca con filas previas)
insert into public.categorias_test (nombre) values
  ('Cognitiva / GMA'),
  ('Integridad'),
  ('Personalidad'),
  ('Técnica / oficio'),
  ('Seguridad ocupacional'),
  ('Atención y vigilancia')
on conflict (nombre) do nothing;

-- Re-sincronizar tras posibles inserts
select setval(
  pg_get_serial_sequence('public.categorias_test', 'id_categoria'),
  greatest(coalesce((select max(id_categoria) from public.categorias_test), 1), 1)
);

-- Seed pruebas (idempotente por nombre)
insert into public.pruebas (
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
join public.categorias_test c on c.nombre = v.categoria
where not exists (
  select 1 from public.pruebas p where p.nombre_prueba = v.nombre_prueba
);

-- Seed triggers (palabra_clave → prueba)
-- Palabras clave sin tildes (normalizar en app con quitarAcentos).
insert into public.triggers_prueba (id_prueba, palabra_clave)
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
join public.pruebas p on p.nombre_prueba = t.nombre_prueba
where not exists (
  select 1
  from public.triggers_prueba tr
  where tr.id_prueba = p.id_prueba
    and tr.palabra_clave = lower(btrim(t.palabra_clave))
);

-- RPC alineada al prototipo Python (ANY de palabras clave).
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
as $$
  select distinct
    p.id_prueba,
    p.nombre_prueba,
    c.nombre as categoria,
    p.descripcion,
    p.objetivo_evaluacion,
    p.es_clinico,
    p.rol_examen_sugerido
  from public.pruebas p
  join public.categorias_test c on p.id_categoria = c.id_categoria
  join public.triggers_prueba t on p.id_prueba = t.id_prueba
  where p.activa = true
    and t.palabra_clave = any (
      select lower(btrim(x)) from unnest(coalesce(palabras_clave, array[]::text[])) as x
      where btrim(coalesce(x, '')) <> ''
    )
  order by p.nombre_prueba;
$$;

comment on function public.ci_recomendar_pruebas_psique(text[]) is
  'Recomienda pruebas Psique según palabras clave detectadas en la solicitud de cargo.';

grant execute on function public.ci_recomendar_pruebas_psique(text[]) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
