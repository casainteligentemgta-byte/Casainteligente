-- 339 · Contrato obrero: se omite ética/confidencialidad.
-- Transporte pasa a OCTAVA; domicilio procesal a NOVENA.

update public.ci_legal_plantillas
set
  cuerpo_markdown = replace(
    cuerpo_markdown,
    $old$OCTAVA: ÉTICA Y CONFIDENCIALIDAD. EL TRABAJADOR guardará reserva absoluta sobre la información técnica de la obra y se abstendrá de prácticas desleales.

NOVENA: TRANSPORTE GRATUITO (BENEFICIO SOCIAL NO REMUNERATIVO). LA ENTIDAD DE TRABAJO brindará de manera gratuita un servicio de transporte diario, de ida y vuelta, desde el punto de encuentro establecido {{OBRA_PUNTO_ENC_TRANSPORTE}} hasta el sitio de la obra. NATURALEZA JURÍDICA: conforme al artículo 105 de la LOTTT, este servicio es un beneficio social de carácter no remunerativo: no forma parte del salario, no es salario en especie y no se computará para prestaciones sociales, vacaciones, utilidades, bonos ni ningún otro concepto laboral. CONDICIONES: su uso es opcional para EL TRABAJADOR y está sujeto a las normas de conducta y seguridad dictadas por la empresa durante el trayecto.

DÉCIMA: DOMICILIO PROCESAL.$old$,
    $new$OCTAVA: TRANSPORTE GRATUITO (BENEFICIO SOCIAL NO REMUNERATIVO). LA ENTIDAD DE TRABAJO brindará de manera gratuita un servicio de transporte diario, de ida y vuelta, desde el punto de encuentro establecido {{OBRA_PUNTO_ENC_TRANSPORTE}} hasta el sitio de la obra. NATURALEZA JURÍDICA: conforme al artículo 105 de la LOTTT, este servicio es un beneficio social de carácter no remunerativo: no forma parte del salario, no es salario en especie y no se computará para prestaciones sociales, vacaciones, utilidades, bonos ni ningún otro concepto laboral. CONDICIONES: su uso es opcional para EL TRABAJADOR y está sujeto a las normas de conducta y seguridad dictadas por la empresa durante el trayecto.

NOVENA: DOMICILIO PROCESAL.$new$
  ),
  updated_at = now()
where codigo in ('contrato_individual_obra_determinada_ve', 'contrato_laboral_obra_ve');

update public.ci_documento_plantillas
set
  cuerpo = replace(
    cuerpo,
    $old$OCTAVA: ÉTICA Y CONFIDENCIALIDAD. EL TRABAJADOR guardará reserva absoluta sobre la información técnica de la obra y se abstendrá de prácticas desleales.

NOVENA: TRANSPORTE GRATUITO (BENEFICIO SOCIAL NO REMUNERATIVO). LA ENTIDAD DE TRABAJO brindará de manera gratuita un servicio de transporte diario, de ida y vuelta, desde el punto de encuentro establecido {{OBRA_PUNTO_ENC_TRANSPORTE}} hasta el sitio de la obra. NATURALEZA JURÍDICA: conforme al artículo 105 de la LOTTT, este servicio es un beneficio social de carácter no remunerativo: no forma parte del salario, no es salario en especie y no se computará para prestaciones sociales, vacaciones, utilidades, bonos ni ningún otro concepto laboral. CONDICIONES: su uso es opcional para EL TRABAJADOR y está sujeto a las normas de conducta y seguridad dictadas por la empresa durante el trayecto.

DÉCIMA: DOMICILIO PROCESAL.$old$,
    $new$OCTAVA: TRANSPORTE GRATUITO (BENEFICIO SOCIAL NO REMUNERATIVO). LA ENTIDAD DE TRABAJO brindará de manera gratuita un servicio de transporte diario, de ida y vuelta, desde el punto de encuentro establecido {{OBRA_PUNTO_ENC_TRANSPORTE}} hasta el sitio de la obra. NATURALEZA JURÍDICA: conforme al artículo 105 de la LOTTT, este servicio es un beneficio social de carácter no remunerativo: no forma parte del salario, no es salario en especie y no se computará para prestaciones sociales, vacaciones, utilidades, bonos ni ningún otro concepto laboral. CONDICIONES: su uso es opcional para EL TRABAJADOR y está sujeto a las normas de conducta y seguridad dictadas por la empresa durante el trayecto.

NOVENA: DOMICILIO PROCESAL.$new$
  ),
  updated_at = now()
where codigo = 'contrato_obrero';

notify pgrst, 'reload schema';
