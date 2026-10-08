-- 339 · Omite ética/confidencialidad. Transporte = OCTAVA. Domicilio = NOVENA.
-- Sin $old$/$new$. Se puede repetir sin daño.

update public.ci_legal_plantillas
set
  cuerpo_markdown = replace(
    replace(
      replace(
        cuerpo_markdown,
        'OCTAVA: ÉTICA Y CONFIDENCIALIDAD. EL TRABAJADOR guardará reserva absoluta sobre la información técnica de la obra y se abstendrá de prácticas desleales.',
        ''
      ),
      'NOVENA: TRANSPORTE GRATUITO',
      'OCTAVA: TRANSPORTE GRATUITO'
    ),
    'DÉCIMA: DOMICILIO PROCESAL',
    'NOVENA: DOMICILIO PROCESAL'
  ),
  updated_at = now()
where codigo in ('contrato_individual_obra_determinada_ve', 'contrato_laboral_obra_ve');

update public.ci_documento_plantillas
set
  cuerpo = replace(
    replace(
      replace(
        cuerpo,
        'OCTAVA: ÉTICA Y CONFIDENCIALIDAD. EL TRABAJADOR guardará reserva absoluta sobre la información técnica de la obra y se abstendrá de prácticas desleales.',
        ''
      ),
      'NOVENA: TRANSPORTE GRATUITO',
      'OCTAVA: TRANSPORTE GRATUITO'
    ),
    'DÉCIMA: DOMICILIO PROCESAL',
    'NOVENA: DOMICILIO PROCESAL'
  ),
  updated_at = now()
where codigo = 'contrato_obrero';

notify pgrst, 'reload schema';
