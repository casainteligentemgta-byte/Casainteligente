-- Postulación pública Gaceta: columnas normalizadas en ci_empleados, contador en recruitment_needs, bucket talento-public.

-- ── Contador de postulaciones por vacante ─────────────────────────
alter table public.recruitment_needs
  add column if not exists conteo_postulaciones integer not null default 0;

comment on column public.recruitment_needs.conteo_postulaciones is
  'Número de postulaciones recibidas (registro público / hoja de vida Gaceta).';

-- ── Vínculo vacante → empleado ───────────────────────────────────
alter table public.ci_empleados
  add column if not exists recruitment_need_id uuid references public.recruitment_needs (id) on delete set null;

create index if not exists idx_ci_empleados_recruitment_need on public.ci_empleados (recruitment_need_id);

comment on column public.ci_empleados.recruitment_need_id is
  'Vacante (recruitment_needs) desde la cual se envió la postulación pública (?need=).';

-- ── Identificación (Gaceta) ─────────────────────────────────────
alter table public.ci_empleados
  add column if not exists primer_nombre text,
  add column if not exists segundo_nombre text,
  add column if not exists primer_apellido text,
  add column if not exists segundo_apellido text,
  add column if not exists edad integer,
  add column if not exists estado_civil text,
  add column if not exists lugar_nacimiento text,
  add column if not exists fecha_nacimiento_date date,
  add column if not exists nacionalidad text,
  add column if not exists celular text,
  add column if not exists domicilio_declarado text,
  add column if not exists zurdo boolean,
  add column if not exists ivss_inscrito boolean;

-- ── Educación ────────────────────────────────────────────────────
alter table public.ci_empleados
  add column if not exists educacion_sabe_leer boolean,
  add column if not exists educacion_primaria boolean,
  add column if not exists educacion_secundaria boolean,
  add column if not exists educacion_tecnica boolean,
  add column if not exists educacion_superior boolean,
  add column if not exists profesion_actual text;

-- ── Salud / medidas ──────────────────────────────────────────────
alter table public.ci_empleados
  add column if not exists antecedentes_penales jsonb not null default '{}'::jsonb,
  add column if not exists examen_medico boolean,
  add column if not exists salud_tipo_sangre text,
  add column if not exists salud_enfermedades text,
  add column if not exists salud_incapacidades text,
  add column if not exists peso_kg numeric(6,2),
  add column if not exists estatura_m numeric(5,3),
  add column if not exists talla_pantalon text,
  add column if not exists talla_bragas text;

comment on column public.ci_empleados.antecedentes_penales is
  'JSON: certificado / declaración de antecedentes (planilla Gaceta).';

-- ── Listas dinámicas ─────────────────────────────────────────────
alter table public.ci_empleados
  add column if not exists familiares jsonb not null default '[]'::jsonb,
  add column if not exists experiencia_previa jsonb not null default '[]'::jsonb;

comment on column public.ci_empleados.familiares is
  'Dependientes a cargo (arreglo de objetos).';
comment on column public.ci_empleados.experiencia_previa is
  'Experiencia laboral previa (arreglo de objetos).';

-- ── Fotos postulación ────────────────────────────────────────────
alter table public.ci_empleados
  add column if not exists foto_perfil_url text;

comment on column public.ci_empleados.foto_perfil_url is
  'URL pública (Storage) — foto tipo carnet del postulado.';

-- cedula_foto_url ya existe en 039; se usa para foto de cédula.

-- ── Bucket público talento-public ────────────────────────────────
insert into storage.buckets (id, name, public)
values ('talento-public', 'talento-public', true)
on conflict (id) do nothing;

drop policy if exists "talento_public_select_anon" on storage.objects;
drop policy if exists "talento_public_insert_anon" on storage.objects;
drop policy if exists "talento_public_update_anon" on storage.objects;
drop policy if exists "talento_public_delete_anon" on storage.objects;
drop policy if exists "talento_public_select_auth" on storage.objects;
drop policy if exists "talento_public_insert_auth" on storage.objects;
drop policy if exists "talento_public_update_auth" on storage.objects;
drop policy if exists "talento_public_delete_auth" on storage.objects;

create policy "talento_public_select_anon"
on storage.objects for select to anon
using (bucket_id = 'talento-public');

create policy "talento_public_insert_anon"
on storage.objects for insert to anon
with check (bucket_id = 'talento-public');

create policy "talento_public_update_anon"
on storage.objects for update to anon
using (bucket_id = 'talento-public')
with check (bucket_id = 'talento-public');

create policy "talento_public_delete_anon"
on storage.objects for delete to anon
using (bucket_id = 'talento-public');

create policy "talento_public_select_auth"
on storage.objects for select to authenticated
using (bucket_id = 'talento-public');

create policy "talento_public_insert_auth"
on storage.objects for insert to authenticated
with check (bucket_id = 'talento-public');

create policy "talento_public_update_auth"
on storage.objects for update to authenticated
using (bucket_id = 'talento-public')
with check (bucket_id = 'talento-public');

create policy "talento_public_delete_auth"
on storage.objects for delete to authenticated
using (bucket_id = 'talento-public');

-- Alinear tipo_vacante con recruitment_needs (empleado administrativo).
alter table public.ci_empleados
  drop constraint if exists ci_empleados_tipo_vacante_check;

alter table public.ci_empleados
  add constraint ci_empleados_tipo_vacante_check
  check (
    tipo_vacante is null
    or tipo_vacante in ('obrero_basico', 'obrero_especializado', 'empleado')
  );

notify pgrst, 'reload schema';
