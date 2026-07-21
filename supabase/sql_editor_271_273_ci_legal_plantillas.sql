-- =============================================================================
-- SQL Editor: migraciones 271 + 273 — ci_legal_plantillas (+ archivos / bucket)
-- =============================================================================
-- Prerrequisito: debe existir public.ci_legal_orgs (migración 266).
-- Si falla el FK a ci_legal_orgs, ejecute antes:
--   supabase/migrations/266_ci_departamento_legal.sql
--
-- Cómo aplicar:
-- 1) Supabase Dashboard → SQL Editor → New query
-- 2) Pegue TODO este archivo → Run
-- 3) Al final ya incluye: notify pgrst, 'reload schema';
-- =============================================================================

-- >>> INICIO 271_ci_legal_documentos.sql
-- Contratos y documentos del Departamento Legal (plantillas + instancias).

create table if not exists public.ci_legal_plantillas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.ci_legal_orgs (id) on delete cascade,
  codigo text not null,
  titulo text not null,
  tipo text not null default 'contrato'
    check (tipo in (
      'contrato',
      'finiquito',
      'poder',
      'carta',
      'escrito',
      'acta',
      'notificacion',
      'otro'
    )),
  jurisdiccion text not null default 'venezuela',
  categoria text not null default 'laboral',
  descripcion text,
  cuerpo_markdown text not null default '',
  variables jsonb not null default '[]'::jsonb,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ci_legal_plantillas_org_codigo unique (org_id, codigo)
);

create unique index if not exists idx_ci_legal_plantillas_global_codigo
  on public.ci_legal_plantillas (codigo)
  where org_id is null;

comment on table public.ci_legal_plantillas is
  'Plantillas de contratos y documentos legales (globales si org_id is null).';

create table if not exists public.ci_legal_documentos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.ci_legal_orgs (id) on delete cascade,
  caso_id uuid references public.ci_legal_casos (id) on delete set null,
  plantilla_id uuid references public.ci_legal_plantillas (id) on delete set null,
  titulo text not null,
  tipo text not null default 'contrato'
    check (tipo in (
      'contrato',
      'finiquito',
      'poder',
      'carta',
      'escrito',
      'acta',
      'notificacion',
      'otro'
    )),
  estado text not null default 'borrador'
    check (estado in (
      'borrador',
      'revision',
      'aprobado',
      'firmado',
      'archivado',
      'cancelado'
    )),
  contraparte text,
  cuerpo_markdown text not null default '',
  variables_valores jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  creado_por uuid,
  actualizado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ci_legal_documentos_org_estado
  on public.ci_legal_documentos (org_id, estado);

create index if not exists idx_ci_legal_documentos_caso
  on public.ci_legal_documentos (caso_id)
  where caso_id is not null;

comment on table public.ci_legal_documentos is
  'Instancias de contratos y documentos redactados por el Departamento Legal.';

alter table public.ci_legal_plantillas enable row level security;
alter table public.ci_legal_documentos enable row level security;

drop policy if exists ci_legal_plantillas_select on public.ci_legal_plantillas;
create policy ci_legal_plantillas_select
  on public.ci_legal_plantillas for select to authenticated
  using (
    org_id is null
    or exists (
      select 1 from public.ci_legal_entitlements e
      where e.user_id = auth.uid()
        and e.activo = true
        and e.org_id = ci_legal_plantillas.org_id
    )
  );

drop policy if exists ci_legal_documentos_select on public.ci_legal_documentos;
create policy ci_legal_documentos_select
  on public.ci_legal_documentos for select to authenticated
  using (
    exists (
      select 1 from public.ci_legal_entitlements e
      where e.user_id = auth.uid()
        and e.activo = true
        and e.org_id = ci_legal_documentos.org_id
    )
  );

-- Plantillas globales semilla (idempotente por codigo, org_id null)
insert into public.ci_legal_plantillas (
  org_id, codigo, titulo, tipo, jurisdiccion, categoria, descripcion, cuerpo_markdown, variables
)
select v.org_id, v.codigo, v.titulo, v.tipo, v.jurisdiccion, v.categoria, v.descripcion, v.cuerpo_markdown, v.variables
from (
  values
  (
    null::uuid,
    'contrato_laboral_obra_ve',
    'Contrato de trabajo por obra determinada',
    'contrato',
    'venezuela',
    'laboral',
    'Modelo base LOTTT para obra determinada. Revisar y adaptar antes de firmar.',
    E'# CONTRATO DE TRABAJO POR OBRA DETERMINADA\n\nEntre **{{empleador_razon_social}}**, inscrita en el Registro Mercantil bajo el N° {{empleador_registro}}, RIF {{empleador_rif}}, (en adelante, **EL EMPLEADOR**), y el ciudadano(a) **{{trabajador_nombre}}**, titular de la cédula de identidad N° {{trabajador_cedula}}, (en adelante, **EL TRABAJADOR**), se celebra el presente contrato al tenor de las siguientes cláusulas:\n\n## CLÁUSULA PRIMERA — OBJETO\nEL TRABAJADOR se obliga a prestar servicios personales como **{{cargo}}** en la obra/proyecto **{{obra_nombre}}**, ubicada en {{obra_ubicacion}}.\n\n## CLÁUSULA SEGUNDA — DURACIÓN\nEl presente contrato es por **obra determinada**, conforme a la LOTTT, con fecha de inicio {{fecha_inicio}}.\n\n## CLÁUSULA TERCERA — JORNADA Y LUGAR\nLa jornada será {{jornada}} y el lugar de prestación {{obra_ubicacion}}.\n\n## CLÁUSULA CUARTA — REMUNERACIÓN\nEL EMPLEADOR pagará a EL TRABAJADOR un salario de **{{salario}}** {{moneda}}, con la periodicidad {{forma_pago}}.\n\n## CLÁUSULA QUINTA — PRESTACIONES Y BENEFICIOS\nSe aplicarán las disposiciones de la LOTTT en materia de prestaciones sociales, utilidades y vacaciones, sin perjuicio de beneficios superiores convenidos.\n\n## CLÁUSULA SEXTA — OBLIGACIONES\nEL TRABAJADOR cumplirá las normas de seguridad y salud en el trabajo y las instrucciones legítimas del empleador.\n\nEn {{ciudad_firma}}, a los {{fecha_firma}}.\n\n______________________________  \nEL EMPLEADOR\n\n______________________________  \nEL TRABAJADOR\n',
    '[
      {"key":"empleador_razon_social","label":"Razón social empleador"},
      {"key":"empleador_registro","label":"Registro mercantil"},
      {"key":"empleador_rif","label":"RIF empleador"},
      {"key":"trabajador_nombre","label":"Nombre trabajador"},
      {"key":"trabajador_cedula","label":"Cédula"},
      {"key":"cargo","label":"Cargo / oficio"},
      {"key":"obra_nombre","label":"Obra / proyecto"},
      {"key":"obra_ubicacion","label":"Ubicación"},
      {"key":"fecha_inicio","label":"Fecha de inicio"},
      {"key":"jornada","label":"Jornada"},
      {"key":"salario","label":"Salario"},
      {"key":"moneda","label":"Moneda"},
      {"key":"forma_pago","label":"Forma de pago"},
      {"key":"ciudad_firma","label":"Ciudad de firma"},
      {"key":"fecha_firma","label":"Fecha de firma"}
    ]'::jsonb
  ),
  (
    null::uuid,
    'finiquito_laboral_ve',
    'Finiquito / recibo laboral',
    'finiquito',
    'venezuela',
    'laboral',
    'Constancia de pago y finiquito. Verificar montos de prestaciones Art. 142 LOTTT.',
    E'# FINIQUITO LABORAL\n\nYo, **{{trabajador_nombre}}**, cédula {{trabajador_cedula}}, declaro haber recibido de **{{empleador_razon_social}}** (RIF {{empleador_rif}}) la cantidad de **{{monto_total}}** {{moneda}}, por concepto de liquidación de prestaciones sociales y demás conceptos derivados de la relación laboral iniciada el {{fecha_inicio}} y culminada el {{fecha_egreso}}.\n\nDesglose referencial:\n- Garantía / prestaciones: {{monto_prestaciones}}\n- Utilidades: {{monto_utilidades}}\n- Vacaciones / bono: {{monto_vacaciones}}\n- Otros: {{monto_otros}}\n\nDeclaro no tener nada más que reclamar por estos conceptos, sin perjuicio de derechos irrenunciables conforme a la LOTTT.\n\nEn {{ciudad_firma}}, {{fecha_firma}}.\n\n______________________________  \nEL TRABAJADOR\n\n______________________________  \nEL EMPLEADOR\n',
    '[
      {"key":"trabajador_nombre","label":"Nombre trabajador"},
      {"key":"trabajador_cedula","label":"Cédula"},
      {"key":"empleador_razon_social","label":"Empleador"},
      {"key":"empleador_rif","label":"RIF"},
      {"key":"monto_total","label":"Monto total"},
      {"key":"moneda","label":"Moneda"},
      {"key":"fecha_inicio","label":"Fecha ingreso"},
      {"key":"fecha_egreso","label":"Fecha egreso"},
      {"key":"monto_prestaciones","label":"Prestaciones"},
      {"key":"monto_utilidades","label":"Utilidades"},
      {"key":"monto_vacaciones","label":"Vacaciones/bono"},
      {"key":"monto_otros","label":"Otros"},
      {"key":"ciudad_firma","label":"Ciudad"},
      {"key":"fecha_firma","label":"Fecha firma"}
    ]'::jsonb
  ),
  (
    null::uuid,
    'carta_requerimiento_pago_ve',
    'Carta de requerimiento de pago',
    'carta',
    'venezuela',
    'mercantil',
    'Requerimiento extrajudicial de pago a contraparte.',
    E'# REQUERIMIENTO DE PAGO\n\n{{ciudad}}, {{fecha}}\n\nSeñor(es):  \n**{{contraparte_nombre}}**  \nRIF/CI: {{contraparte_rif}}  \n{{contraparte_direccion}}\n\nPresente.—\n\nPor medio de la presente, **{{cliente_nombre}}** le requiere formalmente el pago de la cantidad de **{{monto}}** {{moneda}}, correspondiente a {{concepto}}, documentado en {{documento_soporte}}, con vencimiento {{fecha_vencimiento}}.\n\nSe le otorga un plazo de {{plazo_dias}} días hábiles contados a partir de la recepción de esta comunicación para efectuar el pago o formular observaciones fundadas. Vencido dicho lapso sin respuesta satisfactoria, se procederán las acciones legales pertinentes.\n\nSin más,\n\n______________________________  \n{{firmante_nombre}}  \n{{firmante_cargo}}\n',
    '[
      {"key":"ciudad","label":"Ciudad"},
      {"key":"fecha","label":"Fecha"},
      {"key":"contraparte_nombre","label":"Contraparte"},
      {"key":"contraparte_rif","label":"RIF/CI contraparte"},
      {"key":"contraparte_direccion","label":"Dirección"},
      {"key":"cliente_nombre","label":"Cliente / acreedor"},
      {"key":"monto","label":"Monto"},
      {"key":"moneda","label":"Moneda"},
      {"key":"concepto","label":"Concepto"},
      {"key":"documento_soporte","label":"Documento soporte"},
      {"key":"fecha_vencimiento","label":"Vencimiento"},
      {"key":"plazo_dias","label":"Plazo (días)"},
      {"key":"firmante_nombre","label":"Firmante"},
      {"key":"firmante_cargo","label":"Cargo firmante"}
    ]'::jsonb
  ),
  (
    null::uuid,
    'poder_especial_ve',
    'Poder especial',
    'poder',
    'venezuela',
    'civil',
    'Poder especial para gestiones puntuales.',
    E'# PODER ESPECIAL\n\nYo, **{{poderdante_nombre}}**, cédula {{poderdante_cedula}}, otorgo poder especial bastante a **{{apoderado_nombre}}**, cédula {{apoderado_cedula}}, para que en mi nombre y representación realice: {{facultades}}.\n\nEste poder es válido hasta {{vigencia}} o hasta su revocatoria escrita.\n\nEn {{ciudad}}, {{fecha}}.\n\n______________________________  \nEL PODERDANTE\n',
    '[{"key":"poderdante_nombre","label":"Poderdante"},{"key":"poderdante_cedula","label":"Cédula poderdante"},{"key":"apoderado_nombre","label":"Apoderado"},{"key":"apoderado_cedula","label":"Cédula apoderado"},{"key":"facultades","label":"Facultades"},{"key":"vigencia","label":"Vigencia"},{"key":"ciudad","label":"Ciudad"},{"key":"fecha","label":"Fecha"}]'::jsonb
  )
) as v(org_id, codigo, titulo, tipo, jurisdiccion, categoria, descripcion, cuerpo_markdown, variables)
where not exists (
  select 1 from public.ci_legal_plantillas p
  where p.org_id is null and p.codigo = v.codigo
);

grant select on public.ci_legal_plantillas to authenticated, service_role;
grant select, insert, update, delete on public.ci_legal_documentos to authenticated, service_role;
grant select, insert, update on public.ci_legal_plantillas to service_role;

notify pgrst, 'reload schema';

-- >>> INICIO 273_ci_legal_plantillas_archivos.sql
-- Formatos legales: archivo original adjunto + bucket de storage.

alter table public.ci_legal_plantillas
  add column if not exists archivo_storage_path text,
  add column if not exists archivo_nombre text,
  add column if not exists archivo_mime text;

comment on column public.ci_legal_plantillas.archivo_storage_path is
  'Ruta en bucket legal-plantillas del formato subido (PDF/DOCX/MD).';
comment on column public.ci_legal_plantillas.archivo_nombre is
  'Nombre original del archivo de formato.';
comment on column public.ci_legal_plantillas.archivo_mime is
  'MIME del archivo de formato.';

insert into storage.buckets (id, name, public)
values ('legal-plantillas', 'legal-plantillas', false)
on conflict (id) do nothing;

drop policy if exists legal_plantillas_storage_select on storage.objects;
create policy legal_plantillas_storage_select
  on storage.objects for select to authenticated
  using (bucket_id = 'legal-plantillas');

drop policy if exists legal_plantillas_storage_insert on storage.objects;
create policy legal_plantillas_storage_insert
  on storage.objects for insert to authenticated
  with check (bucket_id = 'legal-plantillas');

drop policy if exists legal_plantillas_storage_update on storage.objects;
create policy legal_plantillas_storage_update
  on storage.objects for update to authenticated
  using (bucket_id = 'legal-plantillas');

drop policy if exists legal_plantillas_storage_delete on storage.objects;
create policy legal_plantillas_storage_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'legal-plantillas');

grant select, insert, update, delete on public.ci_legal_plantillas to service_role;

notify pgrst, 'reload schema';


-- Verificación rápida
select
  to_regclass('public.ci_legal_plantillas') as plantillas,
  to_regclass('public.ci_legal_documentos') as documentos,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ci_legal_plantillas'
      and column_name = 'archivo_storage_path'
  ) as tiene_columna_archivo,
  exists (select 1 from storage.buckets where id = 'legal-plantillas') as bucket_ok;
