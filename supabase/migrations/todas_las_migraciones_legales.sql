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
    E'# CONTRATO DE TRABAJO POR OBRA DETERMINADA\n\nEntre **{{empleador_razon_social}}**, inscrita en el Registro Mercantil bajo el NÂ° {{empleador_registro}}, RIF {{empleador_rif}}, (en adelante, **EL EMPLEADOR**), y el ciudadano(a) **{{trabajador_nombre}}**, titular de la cÃ©dula de identidad NÂ° {{trabajador_cedula}}, (en adelante, **EL TRABAJADOR**), se celebra el presente contrato al tenor de las siguientes clÃ¡usulas:\n\n## CLÃUSULA PRIMERA â€” OBJETO\nEL TRABAJADOR se obliga a prestar servicios personales como **{{cargo}}** en la obra/proyecto **{{obra_nombre}}**, ubicada en {{obra_ubicacion}}.\n\n## CLÃUSULA SEGUNDA â€” DURACIÃ“N\nEl presente contrato es por **obra determinada**, conforme a la LOTTT, con fecha de inicio {{fecha_inicio}}.\n\n## CLÃUSULA TERCERA â€” JORNADA Y LUGAR\nLa jornada serÃ¡ {{jornada}} y el lugar de prestaciÃ³n {{obra_ubicacion}}.\n\n## CLÃUSULA CUARTA â€” REMUNERACIÃ“N\nEL EMPLEADOR pagarÃ¡ a EL TRABAJADOR un salario de **{{salario}}** {{moneda}}, con la periodicidad {{forma_pago}}.\n\n## CLÃUSULA QUINTA â€” PRESTACIONES Y BENEFICIOS\nSe aplicarÃ¡n las disposiciones de la LOTTT en materia de prestaciones sociales, utilidades y vacaciones, sin perjuicio de beneficios superiores convenidos.\n\n## CLÃUSULA SEXTA â€” OBLIGACIONES\nEL TRABAJADOR cumplirÃ¡ las normas de seguridad y salud en el trabajo y las instrucciones legÃ­timas del empleador.\n\nEn {{ciudad_firma}}, a los {{fecha_firma}}.\n\n______________________________  \nEL EMPLEADOR\n\n______________________________  \nEL TRABAJADOR\n',
    '[
      {"key":"empleador_razon_social","label":"RazÃ³n social empleador"},
      {"key":"empleador_registro","label":"Registro mercantil"},
      {"key":"empleador_rif","label":"RIF empleador"},
      {"key":"trabajador_nombre","label":"Nombre trabajador"},
      {"key":"trabajador_cedula","label":"CÃ©dula"},
      {"key":"cargo","label":"Cargo / oficio"},
      {"key":"obra_nombre","label":"Obra / proyecto"},
      {"key":"obra_ubicacion","label":"UbicaciÃ³n"},
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
    E'# FINIQUITO LABORAL\n\nYo, **{{trabajador_nombre}}**, cÃ©dula {{trabajador_cedula}}, declaro haber recibido de **{{empleador_razon_social}}** (RIF {{empleador_rif}}) la cantidad de **{{monto_total}}** {{moneda}}, por concepto de liquidaciÃ³n de prestaciones sociales y demÃ¡s conceptos derivados de la relaciÃ³n laboral iniciada el {{fecha_inicio}} y culminada el {{fecha_egreso}}.\n\nDesglose referencial:\n- GarantÃ­a / prestaciones: {{monto_prestaciones}}\n- Utilidades: {{monto_utilidades}}\n- Vacaciones / bono: {{monto_vacaciones}}\n- Otros: {{monto_otros}}\n\nDeclaro no tener nada mÃ¡s que reclamar por estos conceptos, sin perjuicio de derechos irrenunciables conforme a la LOTTT.\n\nEn {{ciudad_firma}}, {{fecha_firma}}.\n\n______________________________  \nEL TRABAJADOR\n\n______________________________  \nEL EMPLEADOR\n',
    '[
      {"key":"trabajador_nombre","label":"Nombre trabajador"},
      {"key":"trabajador_cedula","label":"CÃ©dula"},
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
    E'# REQUERIMIENTO DE PAGO\n\n{{ciudad}}, {{fecha}}\n\nSeÃ±or(es):  \n**{{contraparte_nombre}}**  \nRIF/CI: {{contraparte_rif}}  \n{{contraparte_direccion}}\n\nPresente.â€”\n\nPor medio de la presente, **{{cliente_nombre}}** le requiere formalmente el pago de la cantidad de **{{monto}}** {{moneda}}, correspondiente a {{concepto}}, documentado en {{documento_soporte}}, con vencimiento {{fecha_vencimiento}}.\n\nSe le otorga un plazo de {{plazo_dias}} dÃ­as hÃ¡biles contados a partir de la recepciÃ³n de esta comunicaciÃ³n para efectuar el pago o formular observaciones fundadas. Vencido dicho lapso sin respuesta satisfactoria, se procederÃ¡n las acciones legales pertinentes.\n\nSin mÃ¡s,\n\n______________________________  \n{{firmante_nombre}}  \n{{firmante_cargo}}\n',
    '[
      {"key":"ciudad","label":"Ciudad"},
      {"key":"fecha","label":"Fecha"},
      {"key":"contraparte_nombre","label":"Contraparte"},
      {"key":"contraparte_rif","label":"RIF/CI contraparte"},
      {"key":"contraparte_direccion","label":"DirecciÃ³n"},
      {"key":"cliente_nombre","label":"Cliente / acreedor"},
      {"key":"monto","label":"Monto"},
      {"key":"moneda","label":"Moneda"},
      {"key":"concepto","label":"Concepto"},
      {"key":"documento_soporte","label":"Documento soporte"},
      {"key":"fecha_vencimiento","label":"Vencimiento"},
      {"key":"plazo_dias","label":"Plazo (dÃ­as)"},
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
    E'# PODER ESPECIAL\n\nYo, **{{poderdante_nombre}}**, cÃ©dula {{poderdante_cedula}}, otorgo poder especial bastante a **{{apoderado_nombre}}**, cÃ©dula {{apoderado_cedula}}, para que en mi nombre y representaciÃ³n realice: {{facultades}}.\n\nEste poder es vÃ¡lido hasta {{vigencia}} o hasta su revocatoria escrita.\n\nEn {{ciudad}}, {{fecha}}.\n\n______________________________  \nEL PODERDANTE\n',
    '[{"key":"poderdante_nombre","label":"Poderdante"},{"key":"poderdante_cedula","label":"CÃ©dula poderdante"},{"key":"apoderado_nombre","label":"Apoderado"},{"key":"apoderado_cedula","label":"CÃ©dula apoderado"},{"key":"facultades","label":"Facultades"},{"key":"vigencia","label":"Vigencia"},{"key":"ciudad","label":"Ciudad"},{"key":"fecha","label":"Fecha"}]'::jsonb
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
-- Cuerpo estructurado (bloques tipados) para contratos / documentos legales.

alter table public.ci_legal_documentos
  add column if not exists cuerpo_estructurado jsonb;

comment on column public.ci_legal_documentos.cuerpo_estructurado is
  'JSON { document_title, blocks: [{ type, content }] } â€” title|paragraph|clause|table|...';

notify pgrst, 'reload schema';
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
-- Insertar plantilla global de Contrato de DiseÃ±o de Interiores y AdministraciÃ³n Delegada

insert into public.ci_legal_plantillas (
  org_id, codigo, titulo, tipo, jurisdiccion, categoria, descripcion, cuerpo_markdown, variables
)
select v.org_id, v.codigo, v.titulo, v.tipo, v.jurisdiccion, v.categoria, v.descripcion, v.cuerpo_markdown, v.variables
from (
  values
  (
    null::uuid,
    'contrato_diseno_admin_delegada_ve',
    'Contrato de DiseÃ±o de Interiores y AdministraciÃ³n Delegada',
    'contrato',
    'venezuela',
    'mercantil',
    'Contrato para servicios de diseÃ±o de interiores y posterior administraciÃ³n delegada de obra.',
    E'# CONTRATO DE DISEÃ‘O DE INTERIORES Y ADMINISTRACIÃ“N DELEGADA\n\nEntre **{{contratista_empresa}}**, sociedad mercantil domiciliada en {{contratista_domicilio}}, inscrita por ante el {{contratista_registro}}, provista del Registro de InformaciÃ³n Fiscal (RIF) NÂ° {{contratista_rif}}, debidamente representada en este acto por su representante legal, ciudadano(a) **{{contratista_rep_nombre}}**, venezolano(a), mayor de edad, {{contratista_rep_estado_civil}}, de profesiÃ³n {{contratista_rep_profesion}}, titular de la cÃ©dula de identidad NÂ° {{contratista_rep_cedula}}, quien en lo sucesivo y a los efectos del presente contrato se denominarÃ¡ **LA CONTRATISTA**, por una parte; y por la otra, el ciudadano(a) **{{cliente_nombre}}**, venezolano(a), mayor de edad, {{cliente_estado_civil}}, de profesiÃ³n {{cliente_profesion}}, titular de la cÃ©dula de identidad NÂ° {{cliente_cedula}} y RIF {{cliente_rif}}, domiciliado(a) en {{cliente_domicilio}}, quien en lo sucesivo se denominarÃ¡ **EL CLIENTE**; se ha convenido en celebrar el presente Contrato de DiseÃ±o de Interiores y AdministraciÃ³n Delegada, el cual se regirÃ¡ por las siguientes clÃ¡usulas:\n\n**CLÃUSULA PRIMERA: OBJETO DEL CONTRATO**\n**LA CONTRATISTA** se obliga a prestar a **EL CLIENTE** los servicios profesionales de diseÃ±o de interiores y la posterior administraciÃ³n delegada de la obra. El alcance inicial de los servicios de diseÃ±o (Fase 1) comprenderÃ¡ las siguientes Ã¡reas: **{{alcance_fase1}}**.\n\n**CLÃUSULA SEGUNDA: CONDICIONES ECONÃ“MICAS DE LA FASE 1 (DISEÃ‘O)**\nLas partes acuerdan que los honorarios profesionales correspondientes a la Fase 1 (DiseÃ±o de Interiores) tienen un costo original de **{{costo_original_fase1}}**. No obstante, **LA CONTRATISTA** otorga a **EL CLIENTE** un descuento especial por la cantidad de **{{descuento_fase1}}**, quedando el costo neto de la Fase 1 establecido en la cantidad de **{{costo_neto_fase1}}**.\nLa forma de pago de este monto neto se realizarÃ¡ de la siguiente manera:\n- Un **{{porcentaje_inicial_fase1}}** en calidad de anticipo o inicial, pagadero a la firma del presente instrumento.\n- El **{{porcentaje_entrega_fase1}}** restante, pagadero contra la entrega final de los entregables de diseÃ±o correspondientes a la Fase 1.\n\n**CLÃUSULA TERCERA: FASE 2 (ADMINISTRACIÃ“N DELEGADA)**\nUna vez culminada y aprobada la Fase 1, las partes procederÃ¡n a la ejecuciÃ³n de la obra bajo la modalidad de AdministraciÃ³n Delegada (Fase 2). Por estos servicios, **LA CONTRATISTA** percibirÃ¡ un honorario (fee) de administraciÃ³n equivalente al **{{fee_administracion_fase2}}** sobre el costo total y directo de la obra, sus materiales y mano de obra.\nAsimismo, en caso de que la ejecuciÃ³n del proyecto requiera el traslado y pernocta del personal de **LA CONTRATISTA**, **EL CLIENTE** asumirÃ¡ los gastos de viÃ¡ticos, garantizando alojamiento en instalaciones de categorÃ­a **{{categoria_hotel_viaticos}}**.\n\n**CLÃUSULA CUARTA: PLAZOS Y CONDICIÃ“N RESOLUTORIA**\nSe establece un plazo de condiciÃ³n resolutoria de **{{plazo_condicion_resolutoria}}** para el cumplimiento de los hitos principales acordados por las partes.\nEn caso de discrepancias, modificaciones al alcance o situaciones imprevistas, las partes acuerdan un plazo de negociaciÃ³n de **{{plazo_negociacion_dias}}** para llegar a un acuerdo por escrito antes de recurrir a otras vÃ­as de resoluciÃ³n.\n\n**CLÃUSULA QUINTA: JURISDICCIÃ“N Y DOMICILIO**\nPara todos los efectos derivados y consecuencias del presente contrato, las partes eligen como domicilio especial, exclusivo y excluyente a la ciudad de **{{jurisdiccion_tribunales}}**, a la jurisdicciÃ³n de cuyos tribunales declaran someterse expresamente.\n\nSe hacen dos (2) ejemplares de un mismo tenor y a un solo efecto, en la ciudad de **{{ciudad_firma}}**, a los **{{fecha_firma_dia}}** dÃ­as del mes de **{{fecha_firma_mes}}** del aÃ±o **{{fecha_firma_anio}}**.\n\n**POR LA CONTRATISTA:**\n\n_________________________________\n**{{contratista_rep_nombre}}**\nC.I. {{contratista_rep_cedula}}\n{{contratista_empresa}}\n\n**POR EL CLIENTE:**\n\n_________________________________\n**{{cliente_nombre}}**\nC.I. {{cliente_cedula}}\n\n**TESTIGOS:**\n\n_________________________________\n**{{testigo1_nombre}}**\nC.I. {{testigo1_cedula}}\n\n_________________________________\n**{{testigo2_nombre}}**\nC.I. {{testigo2_cedula}}\n',
    '[
      {"key":"contratista_empresa","label":"Empresa Contratista"},
      {"key":"contratista_domicilio","label":"Domicilio Contratista"},
      {"key":"contratista_registro","label":"Registro Mercantil Contratista"},
      {"key":"contratista_rif","label":"RIF Contratista"},
      {"key":"contratista_rep_nombre","label":"Nombre Representante Contratista"},
      {"key":"contratista_rep_estado_civil","label":"Estado Civil Representante Contratista"},
      {"key":"contratista_rep_profesion","label":"ProfesiÃ³n Representante Contratista"},
      {"key":"contratista_rep_cedula","label":"CÃ©dula Representante Contratista"},
      {"key":"cliente_nombre","label":"Nombre Cliente"},
      {"key":"cliente_estado_civil","label":"Estado Civil Cliente"},
      {"key":"cliente_profesion","label":"ProfesiÃ³n Cliente"},
      {"key":"cliente_cedula","label":"CÃ©dula Cliente"},
      {"key":"cliente_rif","label":"RIF Cliente"},
      {"key":"cliente_domicilio","label":"Domicilio Cliente"},
      {"key":"alcance_fase1","label":"Alcance Fase 1 (DiseÃ±o)"},
      {"key":"costo_original_fase1","label":"Costo Original Fase 1"},
      {"key":"descuento_fase1","label":"Descuento Fase 1"},
      {"key":"costo_neto_fase1","label":"Costo Neto Fase 1"},
      {"key":"porcentaje_inicial_fase1","label":"% Inicial Fase 1"},
      {"key":"porcentaje_entrega_fase1","label":"% Entrega Fase 1"},
      {"key":"fee_administracion_fase2","label":"Fee AdministraciÃ³n Fase 2"},
      {"key":"categoria_hotel_viaticos","label":"CategorÃ­a Hotel ViÃ¡ticos"},
      {"key":"plazo_condicion_resolutoria","label":"Plazo CondiciÃ³n Resolutoria"},
      {"key":"plazo_negociacion_dias","label":"Plazo NegociaciÃ³n (DÃ­as)"},
      {"key":"jurisdiccion_tribunales","label":"JurisdicciÃ³n Tribunales"},
      {"key":"ciudad_firma","label":"Ciudad de Firma"},
      {"key":"fecha_firma_dia","label":"DÃ­a de Firma"},
      {"key":"fecha_firma_mes","label":"Mes de Firma"},
      {"key":"fecha_firma_anio","label":"AÃ±o de Firma"},
      {"key":"testigo1_nombre","label":"Nombre Testigo 1"},
      {"key":"testigo1_cedula","label":"CÃ©dula Testigo 1"},
      {"key":"testigo2_nombre","label":"Nombre Testigo 2"},
      {"key":"testigo2_cedula","label":"CÃ©dula Testigo 2"}
    ]'::jsonb
  )
) as v(org_id, codigo, titulo, tipo, jurisdiccion, categoria, descripcion, cuerpo_markdown, variables)
where not exists (
  select 1 from public.ci_legal_plantillas p
  where p.org_id is null and p.codigo = v.codigo
);

notify pgrst, 'reload schema';
-- Actualizar plantilla global de Contrato de DiseÃ±o de Interiores y AdministraciÃ³n Delegada con el nuevo formato

update public.ci_legal_plantillas
set 
  cuerpo_markdown = E'# CONTRATO DE DISEÃ‘O DE INTERIORES Y ADMINISTRACIÃ“N DELEGADA\n\nEntre la sociedad mercantil **DIMAQUINAS, C.A.**, inscrita ante el Registro Mercantil Segundo del Estado Nueva Esparta, bajo el NÃºmero 19, Tomo 38-A del aÃ±o 2015, e inscrita en el Registro de InformaciÃ³n Fiscal (RIF) NÂ° J-405787007, representada en este acto por la Ciudadana **{{contratista_rep_nombre}}**, mayor de edad, {{contratista_rep_estado_civil}}, {{contratista_rep_profesion}}, titular de la cÃ©dula de identidad nÃºmero {{contratista_rep_cedula}} y domiciliada en el {{contratista_domicilio}}; quien en lo sucesivo se denominarÃ¡ **LA CONTRATISTA**; y por la otra, el ciudadano(a) **{{cliente_nombre}}**, mayor de edad, {{cliente_estado_civil}}, {{cliente_profesion}}, titular de la cÃ©dula de identidad nÃºmero {{cliente_cedula}} e inscrito en el Registro de InformaciÃ³n Fiscal (RIF) NÂ° {{cliente_rif}}; y domiciliado en {{cliente_domicilio}}, quien en lo sucesivo se denominarÃ¡ **EL CLIENTE**, se ha convenido de mutuo acuerdo y de conformidad con el CÃ³digo Civil y demÃ¡s leyes vigentes de la RepÃºblica Bolivariana de Venezuela, celebrar el presente contrato contenido en las siguientes clÃ¡usulas:\n\n**CLÃUSULA PRIMERA: MODALIDAD Y SECUENCIA DE CONTRATACIÃ“N.** \nLa prestaciÃ³n de los servicios profesionales se ejecutarÃ¡ en dos etapas sucesivas: \n1.1. Fase 1 (DiseÃ±o y Proyecto): Desarrollo de diseÃ±o de interiores, ADN estÃ©tico, visualizaciones 3D y Moodboards. Esta etapa es requisito obligatorio para la ejecuciÃ³n de la Fase 2. \n1.2. Fase 2 (AdministraciÃ³n Delegada - Procura y Montaje): Una vez concluida y aprobada formalmente la Fase 1, se procederÃ¡ a la gestiÃ³n de compra, logÃ­stica de recepciÃ³n de mobiliario y ambientaciÃ³n. **LA CONTRATISTA** actÃºa como administrador tÃ©cnico de las compras y supervisor de los montajes, manteniendo **EL CLIENTE** la titularidad y responsabilidad financiera sobre la inversiÃ³n.\n\n**CLÃUSULA SEGUNDA: ALCANCE Y DESCUENTO CONDICIONADO.** \n2.1. Fase 1 (Proyecto): El costo original del proyecto de diseÃ±o para **{{alcance_fase1}}** se estableciÃ³ en **{{costo_original_fase1}}**. No obstante, **LA CONTRATISTA** ha aplicado un descuento preferencial de **{{descuento_fase1}}**, resultando en un costo neto de **{{costo_neto_fase1}}**. Este descuento constituye un beneficio bajo condiciÃ³n resolutoria, supeditado estrictamente a que **EL CLIENTE** formalice la contrataciÃ³n de la Fase 2 (EjecuciÃ³n y Procura) con **LA CONTRATISTA** en un plazo mÃ¡ximo e improrrogable de **{{plazo_condicion_resolutoria}}** tras la entrega del diseÃ±o. En caso de no formalizarse la Fase 2, el monto descontado serÃ¡ exigible de pleno derecho a favor de **LA CONTRATISTA**. \n2.2. Fase 2 (AmbientaciÃ³n): Procura de mobiliario/piezas, coordinaciÃ³n logÃ­stica y supervisiÃ³n del montaje/styling final.\n\n**CLÃUSULA TERCERA: RÃ‰GIMEN ECONÃ“MICO Y PAGOS.** \n3.1. Honorarios Fase 1: **{{costo_neto_fase1}}** (**{{porcentaje_inicial_fase1}}** inicial, **{{porcentaje_entrega_fase1}}** a la entrega de visualizaciones). \n3.2. Fee de AdministraciÃ³n (Fase 2): **{{fee_administracion_fase2}}** sobre el costo total de los elementos adquiridos y servicios contratados bajo supervisiÃ³n. \n3.3. RÃ©gimen Cambiario: Los pagos en divisas se harÃ¡n en la moneda de origen o a la tasa de reposiciÃ³n sugerida por el proveedor para salvaguardar el valor real.\n\n**CLÃUSULA CUARTA: RESPONSABILIDAD Y GESTIÃ“N DEL PERSONAL DE INSTALACIÃ“N.** \n**LA CONTRATISTA** supervisarÃ¡ tÃ©cnicamente la correcta ejecuciÃ³n de los montajes. La contrataciÃ³n, honorarios y gastos derivados del personal de instalaciÃ³n (sean estos provistos por **EL CLIENTE** o seleccionados por **LA CONTRATISTA**) son de exclusiva responsabilidad econÃ³mica de **EL CLIENTE**. Dichos costos se integrarÃ¡n al presupuesto total de la Fase 2 y estarÃ¡n sujetos al **{{fee_administracion_fase2}}** de honorarios por concepto de gestiÃ³n, supervisiÃ³n y administraciÃ³n delegada. **LA CONTRATISTA** no asume responsabilidad laboral directa sobre instaladores provistos por terceros, actuando dicho personal bajo la exclusiva responsabilidad de sus empleadores.\n\n**CLÃUSULA QUINTA: FUERZA MAYOR.** \nNinguna de las partes serÃ¡ responsable por el incumplimiento de sus obligaciones cuando dicho incumplimiento se deba a causas de fuerza mayor o caso fortuito (tales como pandemias, catÃ¡strofes naturales, disturbios civiles, actos gubernamentales o fallas masivas de servicios pÃºblicos). En tales eventos, los plazos de ejecuciÃ³n se suspenderÃ¡n automÃ¡ticamente, sin que esto exima al **CLIENTE** de liquidar los costos ya devengados o facturados por **LA CONTRATISTA**.\n\n**CLÃUSULA SEXTA: PROPIEDAD INTELECTUAL.** \nLos diseÃ±os, conceptos y visualizaciones desarrollados por **LA CONTRATISTA** tienen como finalidad exclusiva la ejecuciÃ³n del proyecto acordado. La propiedad intelectual de dichos desarrollos pertenece a la autora, por lo que cualquier uso ajeno a este proyecto requiere autorizaciÃ³n previa por escrito.\n\n**CLÃUSULA SÃ‰PTIMA: CALIDAD Y CONFORMIDAD.** \nLa responsabilidad sobre defectos de fÃ¡brica de los muebles recae sobre el fabricante/proveedor. **LA CONTRATISTA** asistirÃ¡ al **CLIENTE** en la gestiÃ³n de reclamos. La firma del "Acta de RecepciÃ³n y Montaje" ratifica la conformidad del estado de los bienes.\n\n**CLÃUSULA OCTAVA: RESOLUCIÃ“N DE CONFLICTOS.** \nCualquier controversia serÃ¡ resuelta mediante negociaciÃ³n amistosa durante **{{plazo_negociacion_dias}}**. De no lograr acuerdo, las partes se someten a la jurisdicciÃ³n de los tribunales competentes en **{{jurisdiccion_tribunales}}**, y en caso necesario, a arbitraje comercial segÃºn la Ley vigente.\n\n**CLÃUSULA NOVENA: LOGÃSTICA DE MONTAJE.** \n**EL CLIENTE** garantiza las condiciones para el traslado y recepciÃ³n de mobiliario. Cualquier demora por restricciones de acceso o falta de espacio de acopio serÃ¡ responsabilidad de **EL CLIENTE**.\n\n**CLÃUSULA DÃ‰CIMA: LOGÃSTICA DE VIAJES, ALOJAMIENTO Y VIÃTICOS.** \nPara la ejecuciÃ³n de las visitas de obra y trabajos fuera de la sede principal de **LA CONTRATISTA**, **EL CLIENTE** se compromete a cubrir los siguientes gastos: (a) Pasajes de traslado aÃ©reo y terrestre, (b) Alojamiento en habitaciÃ³n individual en hoteles de categorÃ­a mÃ­nima **{{categoria_hotel_viaticos}}**, y (c) ViÃ¡ticos de alimentaciÃ³n y transporte interno. **LA CONTRATISTA** presentarÃ¡ un presupuesto estimado de estos gastos para aprobaciÃ³n previa del **CLIENTE** antes de cada viaje.\n\n**CLÃUSULA UNDÃ‰CIMA: VALIDEZ DIGITAL Y CONFIDENCIALIDAD.** \nSe otorga plena validez jurÃ­dica a firmas digitales y notificaciones por correo electrÃ³nico. Ambas partes mantendrÃ¡n estricta confidencialidad sobre la informaciÃ³n tÃ©cnica y financiera.\n\n**CLÃUSULA DÃ‰CIMA SEGUNDA: PROHIBICIÃ“N DE CESIÃ“N.** \nEste contrato es personal e intransferible.\n\nSe firman dos (2) ejemplares de un mismo tenor y a un solo efecto, en la ciudad de **{{ciudad_firma}}**, a los **{{fecha_firma_dia}}** dÃ­as del mes de **{{fecha_firma_mes}}** del aÃ±o **{{fecha_firma_anio}}**.\n\n\n________________________________________  \n**POR LA CONTRATISTA**  \nDIMAQUINAS, C.A.  \nArq. {{contratista_rep_nombre}}  \nC.I. {{contratista_rep_cedula}}  \n\n________________________________________  \n**POR EL CLIENTE**  \nSr. {{cliente_nombre}}  \n{{cliente_profesion}}  \nC.I. {{cliente_cedula}}  \n\n\n**TESTIGOS:**\n\n1. __________________________________  \nNombre: {{testigo1_nombre}}  \nC.I.: {{testigo1_cedula}}  \n\n2. __________________________________  \nNombre: {{testigo2_nombre}}  \nC.I.: {{testigo2_cedula}}  \n',
  variables = '[
    {"key":"contratista_domicilio","label":"Domicilio Contratista"},
    {"key":"contratista_rep_nombre","label":"Nombre Representante Contratista"},
    {"key":"contratista_rep_estado_civil","label":"Estado Civil Representante Contratista"},
    {"key":"contratista_rep_profesion","label":"ProfesiÃ³n Representante Contratista"},
    {"key":"contratista_rep_cedula","label":"CÃ©dula Representante Contratista"},
    {"key":"cliente_nombre","label":"Nombre Cliente"},
    {"key":"cliente_estado_civil","label":"Estado Civil Cliente"},
    {"key":"cliente_profesion","label":"ProfesiÃ³n Cliente"},
    {"key":"cliente_cedula","label":"CÃ©dula Cliente"},
    {"key":"cliente_rif","label":"RIF Cliente"},
    {"key":"cliente_domicilio","label":"Domicilio Cliente"},
    {"key":"alcance_fase1","label":"Alcance Fase 1 (DiseÃ±o)"},
    {"key":"costo_original_fase1","label":"Costo Original Fase 1"},
    {"key":"descuento_fase1","label":"Descuento Fase 1"},
    {"key":"costo_neto_fase1","label":"Costo Neto Fase 1"},
    {"key":"porcentaje_inicial_fase1","label":"% Inicial Fase 1"},
    {"key":"porcentaje_entrega_fase1","label":"% Entrega Fase 1"},
    {"key":"fee_administracion_fase2","label":"Fee AdministraciÃ³n Fase 2"},
    {"key":"categoria_hotel_viaticos","label":"CategorÃ­a Hotel ViÃ¡ticos"},
    {"key":"plazo_condicion_resolutoria","label":"Plazo CondiciÃ³n Resolutoria"},
    {"key":"plazo_negociacion_dias","label":"Plazo NegociaciÃ³n (DÃ­as)"},
    {"key":"jurisdiccion_tribunales","label":"JurisdicciÃ³n Tribunales"},
    {"key":"ciudad_firma","label":"Ciudad de Firma"},
    {"key":"fecha_firma_dia","label":"DÃ­a de Firma"},
    {"key":"fecha_firma_mes","label":"Mes de Firma"},
    {"key":"fecha_firma_anio","label":"AÃ±o de Firma"},
    {"key":"testigo1_nombre","label":"Nombre Testigo 1"},
    {"key":"testigo1_cedula","label":"CÃ©dula Testigo 1"},
    {"key":"testigo2_nombre","label":"Nombre Testigo 2"},
    {"key":"testigo2_cedula","label":"CÃ©dula Testigo 2"}
  ]'::jsonb
where codigo = 'contrato_diseno_admin_delegada_ve' and org_id is null;

notify pgrst, 'reload schema';
-- Agrega campos necesarios para documentos legales a la tabla customers (clientes)
-- Estos campos pueden ser rellenados desde /clientes/nuevo o en ediciÃ³n,
-- y se usarÃ¡n al redactar contratos, poderes u otros documentos.

alter table public.customers
  add column if not exists nacionalidad text,
  add column if not exists estado_civil text,
  add column if not exists profesion text;

comment on column public.customers.nacionalidad is
  'Nacionalidad del cliente (ej. Venezolano, Extranjero)';
comment on column public.customers.estado_civil is
  'Estado civil del cliente (ej. Soltero, Casado, Divorciado, Viudo)';
comment on column public.customers.profesion is
  'ProfesiÃ³n u oficio del cliente';

notify pgrst, 'reload schema';
-- Campos adicionales en ci_entidades para autocompletar documentos legales

alter table public.ci_entidades
  add column if not exists domicilio text,
  add column if not exists registro_mercantil text,
  add column if not exists representante_legal text,
  add column if not exists representante_cedula text,
  add column if not exists representante_estado_civil text,
  add column if not exists representante_profesion text;

notify pgrst, 'reload schema';
