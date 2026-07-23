-- Insertar plantilla global de Solicitud y Recibo de Anticipo de Prestaciones Sociales

insert into public.ci_legal_plantillas (
  org_id, codigo, titulo, tipo, jurisdiccion, categoria, descripcion, cuerpo_markdown, variables
)
select v.org_id, v.codigo, v.titulo, v.tipo, v.jurisdiccion, v.categoria, v.descripcion, v.cuerpo_markdown, v.variables
from (
  values
  (
    null::uuid,
    'anticipo_prestaciones_sociales',
    'Solicitud y Recibo de Anticipo de Prestaciones Sociales',
    'acta',
    'venezuela',
    'laboral',
    'Formato estándar para solicitar y dar recibo de un anticipo de garantía de prestaciones sociales (Art. 144 LOTTT).',
    E'**SOLICITUD Y RECIBO DE ANTICIPO DE PRESTACIONES SOCIALES**\n\n**Fecha de solicitud:** {{fecha_solicitud}}\n\n**Señores:**\n**{{entidad_nombre}}**\nPresente.-\n\nQuien suscribe, **{{nombre_trabajador}}**, titular de la cédula de identidad N° **{{cedula_trabajador}}**, desempeñando el cargo de **{{cargo_trabajador}}** desde el **{{fecha_ingreso}}**, me dirijo a ustedes en esta oportunidad para solicitar, de conformidad con lo establecido en la Ley Orgánica del Trabajo, los Trabajadores y las Trabajadoras (LOTTT) vigente, un anticipo a cuenta de mi garantía de prestaciones sociales.\n\nEl monto solicitado es de **Bs. {{monto_numeros}}** (**{{monto_letras}}**), el cual declaro formalmente que será destinado a cubrir gastos derivados de la vivienda, salud o educación de mi persona o mi grupo familiar, según lo contemplado en la ley.\n\nAtentamente,\n\n__________________________________\n**{{nombre_trabajador}}**\nC.I.: {{cedula_trabajador}}\n*(Firma y Huella del Trabajador)*\n\n---\n\n**CONSTANCIA DE RECIBO DE PAGO**\n\nPor medio de la presente, confirmo que he recibido a mi entera satisfacción de mi patrono **{{entidad_nombre}}** la cantidad de **Bs. {{monto_numeros}}** (**{{monto_letras}}**), por concepto de anticipo de mi garantía de prestaciones sociales.\n\nDicho pago fue efectuado el día **{{fecha_pago}}** a través del banco **{{banco_origen}}** bajo el comprobante o número de referencia **{{numero_referencia}}**.\n\nCon la recepción de este importe, autorizo expresamente a la empresa para que el mismo sea deducido y descontado de mi saldo acumulado por concepto de garantía de prestaciones sociales e intereses, de acuerdo con la legislación laboral vigente, a fin de que se proceda a los ajustes contables a los que haya lugar en mis pasivos laborales.\n\nEn señal de conformidad y recibo conforme, firmo y estampo mis huellas dactilares:\n\n__________________________________\n**{{nombre_trabajador}}**\nC.I.: {{cedula_trabajador}}\n*(Firma y Huella del Trabajador)*\n',
    '[
      {"key":"entidad_nombre","label":"Empresa (Patrono)"},
      {"key":"nombre_trabajador","label":"Nombre del Trabajador"},
      {"key":"cedula_trabajador","label":"Cédula del Trabajador"},
      {"key":"cargo_trabajador","label":"Cargo que Desempeña"},
      {"key":"fecha_ingreso","label":"Fecha de Ingreso"},
      {"key":"monto_numeros","label":"Monto Solicitado (Bs.)"},
      {"key":"monto_letras","label":"Monto en Letras"},
      {"key":"fecha_solicitud","label":"Fecha de Solicitud"},
      {"key":"fecha_pago","label":"Fecha de Pago"},
      {"key":"banco_origen","label":"Banco Emisor"},
      {"key":"numero_referencia","label":"N° de Referencia"}
    ]'::jsonb
  )
) as v(org_id, codigo, titulo, tipo, jurisdiccion, categoria, descripcion, cuerpo_markdown, variables)
where not exists (
  select 1 from public.ci_legal_plantillas p where p.codigo = v.codigo
);

notify pgrst, 'reload schema';
