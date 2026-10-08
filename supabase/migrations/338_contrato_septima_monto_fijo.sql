-- 338 · Cl. SÉPTIMA: quita el paréntesis del oficio y la frase «al sacar la cuenta».
-- Sin $old$/$new$ (el SQL Editor las corta al pegar). Se puede repetir sin daño.

update public.ci_legal_plantillas
set
  cuerpo_markdown = replace(
    replace(
      cuerpo_markdown,
      '{{CONTRATO_SEMANA_ADICIONAL_USD}} según el oficio (90,00 USD para ayudante y 115,00 USD para clasificado), pagadero',
      '{{CONTRATO_SEMANA_ADICIONAL_USD}}, pagadero'
    ),
    'Al sacar la cuenta, este beneficio es mayor que el que resultaría de pagar únicamente las alícuotas legales y convencionales de esos conceptos calculadas sobre el salario del Tabulador. ',
    ''
  ),
  updated_at = now()
where codigo in ('contrato_individual_obra_determinada_ve', 'contrato_laboral_obra_ve');

update public.ci_documento_plantillas
set
  cuerpo = replace(
    replace(
      cuerpo,
      '{{CONTRATO_SEMANA_ADICIONAL_USD}} según el oficio (90,00 USD para ayudante y 115,00 USD para clasificado), pagadero',
      '{{CONTRATO_SEMANA_ADICIONAL_USD}}, pagadero'
    ),
    'Al sacar la cuenta, este beneficio es mayor que el que resultaría de pagar únicamente las alícuotas legales y convencionales de esos conceptos calculadas sobre el salario del Tabulador. ',
    ''
  ),
  updated_at = now()
where codigo = 'contrato_obrero';

notify pgrst, 'reload schema';
