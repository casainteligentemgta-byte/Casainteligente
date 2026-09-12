-- 296: Formato Legal — Contrato individual de trabajo por obra determinada
-- Inserta/actualiza plantilla global completa (código canónico nuevo).
-- Actualiza y desactiva el stub corto contrato_laboral_obra_ve (semilla 271) para no duplicar.

do $$
declare
  v_cuerpo text := $cuerpo_md$CONTRATO INDIVIDUAL DE TRABAJO POR OBRA DETERMINADA

Entre {{PATRON_RAZON_SOCIAL}}, sociedad mercantil domiciliada en {{PATRON_DOMICILIO}}, Municipio {{PATRON_MUNICIPIO}} del estado {{PATRON_ESTADO}}, {{PATRON_INSCRIPCION_RM}} representada en este acto por su {{REP_LEGAL_CARGO}} {{REP_LEGAL_ARTICULO_CIUDADANO}} {{REP_LEGAL_NOMBRE}}, {{REP_LEGAL_NACIONALIDAD}}, mayor de edad, hábil en derecho, {{REP_LEGAL_ESTADO_CIVIL}}, de este domicilio, titular de la cédula de Identidad número {{REP_LEGAL_CEDULA}}, quien a los efectos de este contrato se denominará LA ENTIDAD DE TRABAJO, por una parte y por la otra el ciudadano {{EMPLEADO_NOMBRE_COMPLETO}}, {{EMPLEADO_NACIONALIDAD}}, mayor de edad, hábil en derecho, {{EMPLEADO_ESTADO_CIVIL}}, titular de la cédula de identidad número {{EMPLEADO_CEDULA}}, de este domicilio; quien en lo sucesivo se denominará EL TRABAJADOR, se ha convenido en celebrar, como en efecto se celebra, el presente Contrato de Trabajo para una Obra Determinada, conforme a lo establecido en el Artículo 63 de la Ley Orgánica de Trabajo de los Trabajadores y Trabajadoras, y las cláusulas 18 y 19 de la vigente Convención Colectiva de Trabajo para la Rama de la Industria de la Construcción, conexos, afines y similares de la República Bolivariana de Venezuela, el cual se regirá por las Cláusulas que se estipulan a continuación:

PRIMERA: OBJETO Y MODALIDAD. Este contrato se celebra bajo la modalidad de OBRA DETERMINADA (Arts. 63, 75 y 77 literal "a" de la LOTTT), específicamente para la ejecución de la fase técnica de: {{CONTRATO_FASE_TECNICA}}, dentro de la obra denominada: {{OBRA_NOMBRE}}. LA ENTIDAD DE TRABAJO tiene como objeto la explotación de actividades comerciales y de la industria de la construcción, y a tales efectos contrata a EL TRABAJADOR para que desempeñe el cargo de: {{CONTRATO_CARGO_OFICIO}}, cargo establecido en el Tabulador de Oficios y Salarios Básicos de la Convención Colectiva vigente. EL TRABAJADOR se obliga a: 1.- Poner a disposición su capacidad normal de trabajo en forma exclusiva y en las labores anexas complementarias. 2.- Ejecutar las actividades inherentes al cargo, incluyendo recibir, procesar y pesar materia prima cuando sea requerido. 3.- Usar obligatoriamente el uniforme y equipos de protección (guantes, lentes, botas, etc.) según la LOPCYMAT. 4.- Mantener el orden del área asignada y el buen estado de maquinarias y herramientas. 5.- No prestar servicios a otros empleadores ni trabajar por cuenta propia en funciones inherentes al cargo.

SEGUNDA: PERIODO DE PRUEBA. Conforme al Art. 25 del Reglamento de la LOTTT, se acuerda un PERIODO DE PRUEBA DE NOVENTA (90) DÍAS. Durante este lapso, LA ENTIDAD DE TRABAJO apreciará los conocimientos y aptitudes de EL TRABAJADOR. Cualquiera de las partes podrá dar por extinguida la relación sin lugar a indemnización alguna.

TERCERA: DURACIÓN Y TERMINACIÓN. La relación de trabajo está sujeta exclusivamente a la culminación física de la fase técnica descrita en la Cláusula Primera. El vínculo se extinguirá de pleno derecho y sin necesidad de preaviso (Art. 75 LOTTT) una vez firmada el Acta de Culminación en el Libro de Obra por el Supervisor. La terminación es independiente de la entrega formal del inmueble al propietario.

CUARTA: JORNADA, HORARIO Y RENDIMIENTO. La jornada semanal será de cuarenta (40) horas de trabajo efectivo: {{CONTRATO_HORARIO_CUARTA}} CONTROL: EL TRABAJADOR debe firmar diariamente su registro de avance en el Libro de Obra. La inobservancia del horario en 4 oportunidades en un mes o la negativa a firmar el registro constituirá falta grave (Art. 102 literal "i" LOTTT).

QUINTA: LUGAR DE TRABAJO Y DIRECCIÓN. Los servicios se prestarán en: {{CONTRATO_LUGAR_QUINTA}}. LA ENTIDAD DE TRABAJO ejercerá su facultad de dirección para el mejor desempeño de la obra; dichas exigencias técnicas y de rendimiento no se considerarán acoso laboral.

SEXTA: INGRESO INTEGRAL INDEXADO. EL TRABAJADOR devengará los siguientes conceptos pagaderos en Bolívares.
a.- {{CONTRATO_SALARIO_SEMANAL_VES}} (Bs.) por concepto de Salario Semanal según Tabulador;
b.- Cesta Ticket (Indexado): Equivalente a {{CONTRATO_CESTA_TICKET_USD_SEMANAL}} semanales; y
c.- BONO ESPECIAL: (NO Salarial): Según Art. 105 LOTTT y Sentencia 218 del TSJ, para elevar el Ingreso Semanal a un total equivalente a: {{CONTRATO_INGRESO_SEMANAL_USD_TOTAL}}.
Todos los pagos se realizarán en Bolívares calculados a la tasa oficial del Banco Central de Venezuela (BCV) del día del pago.

SÉPTIMA: COMPENSACIÓN POR CULMINACIÓN. PARÁGRAFO ÚNICO: Al cierre de obra o finiquito, se recibirá una compensación de: {{CONTRATO_COMPENSACION_CULMINACION_USD}} USD (a tasa BCV) por cada mes trabajado o fracción. Este monto liquida de forma integral: prestaciones sociales, utilidades, vacaciones y cualquier otro beneficio derivado de este contrato especial y de la Convención Colectiva.

OCTAVA: ÉTICA, CONFIDENCIALIDAD Y JURISDICCIÓN. EL TRABAJADOR, guardará reserva absoluta sobre información técnica y se abstendrá de prácticas desleales.

NOVENA (TRANSPORTE GRATUITO - BENEFICIO SOCIAL NO REMUNERATIVO). Con el firme propósito de facilitar la asistencia, puntualidad y resguardar la seguridad de EL TRABAJADOR, LA ENTIDAD DE TRABAJO brindará de manera gratuita un servicio de transporte diario, de ida y vuelta, desde el punto de encuentro establecido {{OBRA_PUNTO_ENC_TRANSPORTE}} hasta el sitio donde se ejecute la obra determinada. NATURALEZA JURÍDICA: De conformidad con lo establecido en el Artículo 105 de la LOTTT, las partes acuerdan expresamente que este servicio de transporte constituye un beneficio social de carácter no remunerativo. En consecuencia, ambas partes reconocen que: No forma parte del salario bajo ninguna circunstancia. No tiene carácter de salario en especie. No será considerado ni computado para el cálculo de prestaciones sociales, vacaciones, utilidades, bonos ni ningún otro pasivo o derecho laboral derivado de la relación de trabajo. CONDICIONES: El uso de este servicio es opcional para el trabajador y está sujeto al cumplimiento de las normas de conducta y seguridad dictadas por la empresa durante el trayecto.

DECIMA (DOMICILIO PROCESAL). Las partes eligen como domicilio especial la ciudad de {{CONTRATO_DOMICILIO_PROCESAL}}, Estado Nueva Esparta, sometiéndose a sus Tribunales del Trabajo. Se firman dos (2) ejemplares de un mismo tenor y a un solo efecto en la ciudad de Pampatar, a los {{CONTRATO_DIA_FIRMA}} días del mes de {{CONTRATO_MES_FIRMA}} del año {{CONTRATO_ANIO_FIRMA}}.

POR LA ENTIDAD DE TRABAJO                          POR EL TRABAJADOR

_________________                                  ___________________

C.I.: {{REP_LEGAL_CEDULA}}

{{CONTRATO_CARGO_OFICIO}}

_______________________________

C.I.: {{EMPLEADO_CEDULA}}

(Huella Dactilar)$cuerpo_md$;
  v_vars jsonb := '[{"key":"PATRON_RAZON_SOCIAL","label":"PATRON RAZON SOCIAL"},{"key":"PATRON_DOMICILIO","label":"PATRON DOMICILIO"},{"key":"PATRON_MUNICIPIO","label":"PATRON MUNICIPIO"},{"key":"PATRON_ESTADO","label":"PATRON ESTADO"},{"key":"PATRON_INSCRIPCION_RM","label":"PATRON INSCRIPCION RM"},{"key":"REP_LEGAL_CARGO","label":"REP LEGAL CARGO"},{"key":"REP_LEGAL_ARTICULO_CIUDADANO","label":"REP LEGAL ARTICULO CIUDADANO"},{"key":"REP_LEGAL_NOMBRE","label":"REP LEGAL NOMBRE"},{"key":"REP_LEGAL_NACIONALIDAD","label":"REP LEGAL NACIONALIDAD"},{"key":"REP_LEGAL_ESTADO_CIVIL","label":"REP LEGAL ESTADO CIVIL"},{"key":"REP_LEGAL_CEDULA","label":"REP LEGAL CEDULA"},{"key":"EMPLEADO_NOMBRE_COMPLETO","label":"EMPLEADO NOMBRE COMPLETO"},{"key":"EMPLEADO_NACIONALIDAD","label":"EMPLEADO NACIONALIDAD"},{"key":"EMPLEADO_ESTADO_CIVIL","label":"EMPLEADO ESTADO CIVIL"},{"key":"EMPLEADO_CEDULA","label":"EMPLEADO CEDULA"},{"key":"CONTRATO_FASE_TECNICA","label":"CONTRATO FASE TECNICA"},{"key":"OBRA_NOMBRE","label":"OBRA NOMBRE"},{"key":"CONTRATO_CARGO_OFICIO","label":"CONTRATO CARGO OFICIO"},{"key":"CONTRATO_HORARIO_CUARTA","label":"CONTRATO HORARIO CUARTA"},{"key":"CONTRATO_LUGAR_QUINTA","label":"CONTRATO LUGAR QUINTA"},{"key":"CONTRATO_SALARIO_SEMANAL_VES","label":"CONTRATO SALARIO SEMANAL VES"},{"key":"CONTRATO_CESTA_TICKET_USD_SEMANAL","label":"CONTRATO CESTA TICKET USD SEMANAL"},{"key":"CONTRATO_INGRESO_SEMANAL_USD_TOTAL","label":"CONTRATO INGRESO SEMANAL USD TOTAL"},{"key":"CONTRATO_COMPENSACION_CULMINACION_USD","label":"CONTRATO COMPENSACION CULMINACION USD"},{"key":"OBRA_PUNTO_ENC_TRANSPORTE","label":"OBRA PUNTO ENC TRANSPORTE"},{"key":"CONTRATO_DOMICILIO_PROCESAL","label":"CONTRATO DOMICILIO PROCESAL"},{"key":"CONTRATO_DIA_FIRMA","label":"CONTRATO DIA FIRMA"},{"key":"CONTRATO_MES_FIRMA","label":"CONTRATO MES FIRMA"},{"key":"CONTRATO_ANIO_FIRMA","label":"CONTRATO ANIO FIRMA"}]'::jsonb;
  v_titulo text := 'Contrato individual de trabajo por obra determinada';
  v_desc text := 'Formato LOTTT / CCT construcción — contrato individual de trabajo por obra determinada (Venezuela). Revisar con asesoría legal antes de firmar.';
begin
  if to_regclass('public.ci_legal_plantillas') is null then
    raise notice 'ci_legal_plantillas no existe; ejecute migraciones 271/273 primero';
    return;
  end if;

  -- Plantilla canónica nueva
  insert into public.ci_legal_plantillas (
    org_id, codigo, titulo, tipo, jurisdiccion, categoria, descripcion, cuerpo_markdown, variables, activo
  )
  select
    null,
    'contrato_individual_obra_determinada_ve',
    v_titulo,
    'contrato',
    'venezuela',
    'laboral',
    v_desc,
    v_cuerpo,
    v_vars,
    true
  where not exists (
    select 1 from public.ci_legal_plantillas p
    where p.org_id is null and p.codigo = 'contrato_individual_obra_determinada_ve'
  );

  update public.ci_legal_plantillas
  set
    titulo = v_titulo,
    tipo = 'contrato',
    jurisdiccion = 'venezuela',
    categoria = 'laboral',
    descripcion = v_desc,
    cuerpo_markdown = v_cuerpo,
    variables = v_vars,
    activo = true,
    updated_at = now()
  where org_id is null
    and codigo = 'contrato_individual_obra_determinada_ve'
    and (
      coalesce(length(trim(cuerpo_markdown)), 0) < 800
      or cuerpo_markdown not ilike '%PERIODO DE PRUEBA%'
    );

  -- Stub 271: pasar a cuerpo completo y desactivar si ya existe la plantilla canónica
  update public.ci_legal_plantillas
  set
    titulo = v_titulo,
    tipo = 'contrato',
    jurisdiccion = 'venezuela',
    categoria = 'laboral',
    descripcion = v_desc,
    cuerpo_markdown = v_cuerpo,
    variables = v_vars,
    activo = false,
    updated_at = now()
  where org_id is null
    and codigo = 'contrato_laboral_obra_ve';
end $$;

notify pgrst, 'reload schema';

-- --- ci_obra_tours (antes 296_ci_obra_tours_video_reconstruccion.sql) ---

-- Tours de obra: video (celular/dron) → reconstrucción 3D → tour DJI + modo piloto.
-- Worker GPU externo actualiza jobs; la app orquesta subida, preview y export.

create table if not exists public.ci_obra_tour_jobs (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  fuente_captura text not null
    check (fuente_captura in ('celular', 'dron')),
  calidad text not null default 'rapida'
    check (calidad in ('rapida', 'detallada')),
  estado text not null default 'pendiente'
    check (
      estado in (
        'pendiente',
        'subiendo',
        'encolado',
        'procesando',
        'modelo_listo',
        'renderizando_tour',
        'listo',
        'error',
        'cancelado'
      )
    ),
  progreso_pct numeric(5, 2) not null default 0
    check (progreso_pct >= 0 and progreso_pct <= 100),
  mensaje_estado text,
  error_codigo text,
  error_detalle text,
  video_storage_bucket text,
  video_storage_path text,
  video_public_url text,
  video_duracion_s numeric(10, 2),
  video_bytes bigint,
  modelo_formato text
    check (modelo_formato is null or modelo_formato in ('glb', 'gltf', 'splat', 'ply')),
  modelo_storage_bucket text,
  modelo_storage_path text,
  modelo_public_url text,
  worker_payload jsonb not null default '{}'::jsonb,
  worker_result jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ci_obra_tour_jobs is
  'Jobs de reconstrucción 3D desde video de obra (opción B: video → modelo → tour).';

comment on column public.ci_obra_tour_jobs.worker_payload is
  'Contrato hacia el worker GPU (URL firmada, calidad, callbacks, etc.).';

comment on column public.ci_obra_tour_jobs.worker_result is
  'Metadatos devueltos por el worker (bbox, frames usados, calidad estimada).';

create index if not exists idx_ci_obra_tour_jobs_proyecto_created
  on public.ci_obra_tour_jobs (proyecto_id, created_at desc);

create index if not exists idx_ci_obra_tour_jobs_estado
  on public.ci_obra_tour_jobs (estado)
  where estado not in ('listo', 'error', 'cancelado');

create table if not exists public.ci_obra_tours (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.ci_proyectos (id) on delete cascade,
  job_id uuid references public.ci_obra_tour_jobs (id) on delete set null,
  nombre text not null default 'Tour de obra',
  modo text not null default 'automatico'
    check (modo in ('automatico', 'piloto')),
  estado text not null default 'borrador'
    check (estado in ('borrador', 'generando', 'listo', 'error')),
  camera_path jsonb not null default '[]'::jsonb,
  export_formato text
    check (
      export_formato is null
      or export_formato in ('mp4_h264', 'mp4_h265', 'mov_h264', 'mov_h265')
    ),
  export_layout text
    check (
      export_layout is null
      or export_layout in ('2d', 'hsbs', 'fsbs', 'hou', 'fou', 'panorama_2d')
    ),
  export_storage_bucket text,
  export_storage_path text,
  export_public_url text,
  export_duracion_s numeric(10, 2),
  dji_ready boolean not null default false,
  notas text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ci_obra_tours is
  'Tours generados por obra: automático (MP4 DJI) o piloto (joystick en web).';

comment on column public.ci_obra_tours.camera_path is
  'Waypoints de cámara [{t,x,y,z,yaw,pitch,fov}, ...] para tour automático.';

comment on column public.ci_obra_tours.export_layout is
  'Layout de video para DJI Goggles: 2d | hsbs | fsbs | hou | fou | panorama_2d.';

create index if not exists idx_ci_obra_tours_proyecto_created
  on public.ci_obra_tours (proyecto_id, created_at desc);

create index if not exists idx_ci_obra_tours_job
  on public.ci_obra_tours (job_id)
  where job_id is not null;

create or replace function public.ci_obra_tours_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ci_obra_tour_jobs_updated_at on public.ci_obra_tour_jobs;
create trigger trg_ci_obra_tour_jobs_updated_at
  before update on public.ci_obra_tour_jobs
  for each row
  execute function public.ci_obra_tours_set_updated_at();

drop trigger if exists trg_ci_obra_tours_updated_at on public.ci_obra_tours;
create trigger trg_ci_obra_tours_updated_at
  before update on public.ci_obra_tours
  for each row
  execute function public.ci_obra_tours_set_updated_at();

alter table public.ci_obra_tour_jobs enable row level security;
alter table public.ci_obra_tours enable row level security;

drop policy if exists "ci_obra_tour_jobs_select_anon" on public.ci_obra_tour_jobs;
drop policy if exists "ci_obra_tour_jobs_insert_anon" on public.ci_obra_tour_jobs;
drop policy if exists "ci_obra_tour_jobs_update_anon" on public.ci_obra_tour_jobs;
drop policy if exists "ci_obra_tour_jobs_delete_anon" on public.ci_obra_tour_jobs;
drop policy if exists "ci_obra_tour_jobs_select_auth" on public.ci_obra_tour_jobs;
drop policy if exists "ci_obra_tour_jobs_insert_auth" on public.ci_obra_tour_jobs;
drop policy if exists "ci_obra_tour_jobs_update_auth" on public.ci_obra_tour_jobs;
drop policy if exists "ci_obra_tour_jobs_delete_auth" on public.ci_obra_tour_jobs;

create policy "ci_obra_tour_jobs_select_anon" on public.ci_obra_tour_jobs
  for select to anon using (true);
create policy "ci_obra_tour_jobs_insert_anon" on public.ci_obra_tour_jobs
  for insert to anon with check (true);
create policy "ci_obra_tour_jobs_update_anon" on public.ci_obra_tour_jobs
  for update to anon using (true) with check (true);
create policy "ci_obra_tour_jobs_delete_anon" on public.ci_obra_tour_jobs
  for delete to anon using (true);

create policy "ci_obra_tour_jobs_select_auth" on public.ci_obra_tour_jobs
  for select to authenticated using (true);
create policy "ci_obra_tour_jobs_insert_auth" on public.ci_obra_tour_jobs
  for insert to authenticated with check (true);
create policy "ci_obra_tour_jobs_update_auth" on public.ci_obra_tour_jobs
  for update to authenticated using (true) with check (true);
create policy "ci_obra_tour_jobs_delete_auth" on public.ci_obra_tour_jobs
  for delete to authenticated using (true);

drop policy if exists "ci_obra_tours_select_anon" on public.ci_obra_tours;
drop policy if exists "ci_obra_tours_insert_anon" on public.ci_obra_tours;
drop policy if exists "ci_obra_tours_update_anon" on public.ci_obra_tours;
drop policy if exists "ci_obra_tours_delete_anon" on public.ci_obra_tours;
drop policy if exists "ci_obra_tours_select_auth" on public.ci_obra_tours;
drop policy if exists "ci_obra_tours_insert_auth" on public.ci_obra_tours;
drop policy if exists "ci_obra_tours_update_auth" on public.ci_obra_tours;
drop policy if exists "ci_obra_tours_delete_auth" on public.ci_obra_tours;

create policy "ci_obra_tours_select_anon" on public.ci_obra_tours
  for select to anon using (true);
create policy "ci_obra_tours_insert_anon" on public.ci_obra_tours
  for insert to anon with check (true);
create policy "ci_obra_tours_update_anon" on public.ci_obra_tours
  for update to anon using (true) with check (true);
create policy "ci_obra_tours_delete_anon" on public.ci_obra_tours
  for delete to anon using (true);

create policy "ci_obra_tours_select_auth" on public.ci_obra_tours
  for select to authenticated using (true);
create policy "ci_obra_tours_insert_auth" on public.ci_obra_tours
  for insert to authenticated with check (true);
create policy "ci_obra_tours_update_auth" on public.ci_obra_tours
  for update to authenticated using (true) with check (true);
create policy "ci_obra_tours_delete_auth" on public.ci_obra_tours
  for delete to authenticated using (true);

grant select, insert, update, delete on table public.ci_obra_tour_jobs
  to anon, authenticated, service_role;
grant select, insert, update, delete on table public.ci_obra_tours
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
