-- Insertar plantilla global de Contrato de Diseño de Interiores y Administración Delegada

insert into public.ci_legal_plantillas (
  org_id, codigo, titulo, tipo, jurisdiccion, categoria, descripcion, cuerpo_markdown, variables
)
select v.org_id, v.codigo, v.titulo, v.tipo, v.jurisdiccion, v.categoria, v.descripcion, v.cuerpo_markdown, v.variables
from (
  values
  (
    null::uuid,
    'contrato_diseno_admin_delegada_ve',
    'Contrato de Diseño de Interiores y Administración Delegada',
    'contrato',
    'venezuela',
    'mercantil',
    'Contrato para servicios de diseño de interiores y posterior administración delegada de obra.',
    E'# CONTRATO DE DISEÑO DE INTERIORES Y ADMINISTRACIÓN DELEGADA\n\nEntre **{{contratista_empresa}}**, sociedad mercantil domiciliada en {{contratista_domicilio}}, inscrita por ante el {{contratista_registro}}, provista del Registro de Información Fiscal (RIF) N° {{contratista_rif}}, debidamente representada en este acto por su representante legal, ciudadano(a) **{{contratista_rep_nombre}}**, venezolano(a), mayor de edad, {{contratista_rep_estado_civil}}, de profesión {{contratista_rep_profesion}}, titular de la cédula de identidad N° {{contratista_rep_cedula}}, quien en lo sucesivo y a los efectos del presente contrato se denominará **LA CONTRATISTA**, por una parte; y por la otra, el ciudadano(a) **{{cliente_nombre}}**, venezolano(a), mayor de edad, {{cliente_estado_civil}}, de profesión {{cliente_profesion}}, titular de la cédula de identidad N° {{cliente_cedula}} y RIF {{cliente_rif}}, domiciliado(a) en {{cliente_domicilio}}, quien en lo sucesivo se denominará **EL CLIENTE**; se ha convenido en celebrar el presente Contrato de Diseño de Interiores y Administración Delegada, el cual se regirá por las siguientes cláusulas:\n\n**CLÁUSULA PRIMERA: OBJETO DEL CONTRATO**\n**LA CONTRATISTA** se obliga a prestar a **EL CLIENTE** los servicios profesionales de diseño de interiores y la posterior administración delegada de la obra. El alcance inicial de los servicios de diseño (Fase 1) comprenderá las siguientes áreas: **{{alcance_fase1}}**.\n\n**CLÁUSULA SEGUNDA: CONDICIONES ECONÓMICAS DE LA FASE 1 (DISEÑO)**\nLas partes acuerdan que los honorarios profesionales correspondientes a la Fase 1 (Diseño de Interiores) tienen un costo original de **{{costo_original_fase1}}**. No obstante, **LA CONTRATISTA** otorga a **EL CLIENTE** un descuento especial por la cantidad de **{{descuento_fase1}}**, quedando el costo neto de la Fase 1 establecido en la cantidad de **{{costo_neto_fase1}}**.\nLa forma de pago de este monto neto se realizará de la siguiente manera:\n- Un **{{porcentaje_inicial_fase1}}** en calidad de anticipo o inicial, pagadero a la firma del presente instrumento.\n- El **{{porcentaje_entrega_fase1}}** restante, pagadero contra la entrega final de los entregables de diseño correspondientes a la Fase 1.\n\n**CLÁUSULA TERCERA: FASE 2 (ADMINISTRACIÓN DELEGADA)**\nUna vez culminada y aprobada la Fase 1, las partes procederán a la ejecución de la obra bajo la modalidad de Administración Delegada (Fase 2). Por estos servicios, **LA CONTRATISTA** percibirá un honorario (fee) de administración equivalente al **{{fee_administracion_fase2}}** sobre el costo total y directo de la obra, sus materiales y mano de obra.\nAsimismo, en caso de que la ejecución del proyecto requiera el traslado y pernocta del personal de **LA CONTRATISTA**, **EL CLIENTE** asumirá los gastos de viáticos, garantizando alojamiento en instalaciones de categoría **{{categoria_hotel_viaticos}}**.\n\n**CLÁUSULA CUARTA: PLAZOS Y CONDICIÓN RESOLUTORIA**\nSe establece un plazo de condición resolutoria de **{{plazo_condicion_resolutoria}}** para el cumplimiento de los hitos principales acordados por las partes.\nEn caso de discrepancias, modificaciones al alcance o situaciones imprevistas, las partes acuerdan un plazo de negociación de **{{plazo_negociacion_dias}}** para llegar a un acuerdo por escrito antes de recurrir a otras vías de resolución.\n\n**CLÁUSULA QUINTA: JURISDICCIÓN Y DOMICILIO**\nPara todos los efectos derivados y consecuencias del presente contrato, las partes eligen como domicilio especial, exclusivo y excluyente a la ciudad de **{{jurisdiccion_tribunales}}**, a la jurisdicción de cuyos tribunales declaran someterse expresamente.\n\nSe hacen dos (2) ejemplares de un mismo tenor y a un solo efecto, en la ciudad de **{{ciudad_firma}}**, a los **{{fecha_firma_dia}}** días del mes de **{{fecha_firma_mes}}** del año **{{fecha_firma_anio}}**.\n\n**POR LA CONTRATISTA:**\n\n_________________________________\n**{{contratista_rep_nombre}}**\nC.I. {{contratista_rep_cedula}}\n{{contratista_empresa}}\n\n**POR EL CLIENTE:**\n\n_________________________________\n**{{cliente_nombre}}**\nC.I. {{cliente_cedula}}\n\n**TESTIGOS:**\n\n_________________________________\n**{{testigo1_nombre}}**\nC.I. {{testigo1_cedula}}\n\n_________________________________\n**{{testigo2_nombre}}**\nC.I. {{testigo2_cedula}}\n',
    '[
      {"key":"contratista_empresa","label":"Empresa Contratista"},
      {"key":"contratista_domicilio","label":"Domicilio Contratista"},
      {"key":"contratista_registro","label":"Registro Mercantil Contratista"},
      {"key":"contratista_rif","label":"RIF Contratista"},
      {"key":"contratista_rep_nombre","label":"Nombre Representante Contratista"},
      {"key":"contratista_rep_estado_civil","label":"Estado Civil Representante Contratista"},
      {"key":"contratista_rep_profesion","label":"Profesión Representante Contratista"},
      {"key":"contratista_rep_cedula","label":"Cédula Representante Contratista"},
      {"key":"cliente_nombre","label":"Nombre Cliente"},
      {"key":"cliente_estado_civil","label":"Estado Civil Cliente"},
      {"key":"cliente_profesion","label":"Profesión Cliente"},
      {"key":"cliente_cedula","label":"Cédula Cliente"},
      {"key":"cliente_rif","label":"RIF Cliente"},
      {"key":"cliente_domicilio","label":"Domicilio Cliente"},
      {"key":"alcance_fase1","label":"Alcance Fase 1 (Diseño)"},
      {"key":"costo_original_fase1","label":"Costo Original Fase 1"},
      {"key":"descuento_fase1","label":"Descuento Fase 1"},
      {"key":"costo_neto_fase1","label":"Costo Neto Fase 1"},
      {"key":"porcentaje_inicial_fase1","label":"% Inicial Fase 1"},
      {"key":"porcentaje_entrega_fase1","label":"% Entrega Fase 1"},
      {"key":"fee_administracion_fase2","label":"Fee Administración Fase 2"},
      {"key":"categoria_hotel_viaticos","label":"Categoría Hotel Viáticos"},
      {"key":"plazo_condicion_resolutoria","label":"Plazo Condición Resolutoria"},
      {"key":"plazo_negociacion_dias","label":"Plazo Negociación (Días)"},
      {"key":"jurisdiccion_tribunales","label":"Jurisdicción Tribunales"},
      {"key":"ciudad_firma","label":"Ciudad de Firma"},
      {"key":"fecha_firma_dia","label":"Día de Firma"},
      {"key":"fecha_firma_mes","label":"Mes de Firma"},
      {"key":"fecha_firma_anio","label":"Año de Firma"},
      {"key":"testigo1_nombre","label":"Nombre Testigo 1"},
      {"key":"testigo1_cedula","label":"Cédula Testigo 1"},
      {"key":"testigo2_nombre","label":"Nombre Testigo 2"},
      {"key":"testigo2_cedula","label":"Cédula Testigo 2"}
    ]'::jsonb
  )
) as v(org_id, codigo, titulo, tipo, jurisdiccion, categoria, descripcion, cuerpo_markdown, variables)
where not exists (
  select 1 from public.ci_legal_plantillas p
  where p.org_id is null and p.codigo = v.codigo
);

notify pgrst, 'reload schema';
