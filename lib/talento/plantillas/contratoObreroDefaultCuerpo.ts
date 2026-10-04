/**
 * Plantilla del contrato individual de trabajo (obrero) — obra determinada, CCT construcción.
 * Se inserta en `ci_documento_plantillas` si no existe (ver `ensurePlantillaContratoObrero`).
 * La entidad patrono (razón social, RM, representante) se sustituye desde `ci_entidades` del proyecto.
 * Revise con asesoría legal antes de uso en firma.
 */
export const CONTRATO_OBRERO_HORARIO_CUARTA_DEFAULT =
  'Lunes a Jueves: De 7:00 a.m. a 5:00 p.m. (1 hora de descanso de 12:00 p.m. a 1:00 p.m., no imputable a la jornada). Viernes: De 7:00 a.m. a 11:00 a.m. (Jornada continua).';

export const CONTRATO_OBRERO_CUERPO_DEFAULT = `CONTRATO INDIVIDUAL DE TRABAJO PARA UNA OBRA DETERMINADA

Entre {{PATRON_RAZON_SOCIAL}}, sociedad mercantil domiciliada en {{PATRON_DOMICILIO}}, Municipio {{PATRON_MUNICIPIO}} del estado {{PATRON_ESTADO}}, {{PATRON_INSCRIPCION_RM}} representada en este acto por su {{REP_LEGAL_CARGO}} {{REP_LEGAL_ARTICULO_CIUDADANO}} {{REP_LEGAL_NOMBRE}}, {{REP_LEGAL_NACIONALIDAD}}, mayor de edad, {{REP_LEGAL_ESTADO_CIVIL}}, titular de la cédula de identidad N° {{REP_LEGAL_CEDULA}}, quien en lo sucesivo se denominará LA ENTIDAD DE TRABAJO; y {{EMPLEADO_ARTICULO_CIUDADANO}} {{EMPLEADO_NOMBRE_COMPLETO}}, {{EMPLEADO_NACIONALIDAD}}, mayor de edad, {{EMPLEADO_ESTADO_CIVIL}}, titular de la cédula de identidad N° {{EMPLEADO_CEDULA}}, domiciliado en {{EMPLEADO_DIRECCION}}, quien en lo sucesivo se denominará EL TRABAJADOR; se ha convenido en celebrar el presente Contrato de Trabajo para una Obra Determinada, conforme al artículo 63 de la Ley Orgánica del Trabajo, los Trabajadores y las Trabajadoras (LOTTT), a las Cláusulas 18 y 19 de la Convención Colectiva de Trabajo de la Industria de la Construcción, Conexos y Similares (Gaceta Oficial Extraordinaria N° 6.752, en lo adelante «la Convención») y al acuerdo de la Comisión de Avenimiento del 17 de agosto de 2026, homologado por auto N° 2026-021 del 19 de agosto de 2026, que se regirá por las siguientes cláusulas:

PRIMERA. OBJETO. EL TRABAJADOR prestará sus servicios exclusivamente para la ejecución de la fase técnica {{CONTRATO_FASE_TECNICA}}, dentro de la obra {{OBRA_NOMBRE}}. EL TRABAJADOR desempeñará el oficio de {{CONTRATO_CARGO_OFICIO}} del Tabulador de Oficios y Salarios de la Convención y ejecutará las tareas propias de ese oficio descritas en el anexo «Denominación de Oficios y Descripción de Tareas». Conforme a la Cláusula 12, no estará obligado a ejecutar labores distintas a las de su oficio, salvo las que le sean conexas.

SEGUNDA. TIEMPO DE PRUEBA. Conforme a la Cláusula 10 de la Convención, las partes acuerdan un tiempo de prueba de treinta (30) días continuos contados desde la fecha de ingreso. Transcurrido ese lapso, EL TRABAJADOR se tendrá como fijo durante la vigencia de la obra.

TERCERA. DURACIÓN Y TERMINACIÓN. La relación de trabajo durará el tiempo requerido para ejecutar la fase descrita en la Cláusula Primera. Concluida la fase, la relación terminará conforme al artículo 63 de la LOTTT y a la Cláusula 19 de la Convención. LA ENTIDAD DE TRABAJO notificará la culminación por escrito, con la firma y la huella dactilar de EL TRABAJADOR, y en ese mismo acto le pagará todas las cantidades que le correspondan, conforme a la Cláusula 51. Si las partes acuerdan que EL TRABAJADOR preste servicios en otra fase u obra, celebrarán un nuevo contrato después de liquidado el presente.

CUARTA. JORNADA. Conforme a la Cláusula 6 de la Convención, la jornada ordinaria diurna será de cuarenta (40) horas semanales: {{CONTRATO_HORARIO_CUARTA}} EL TRABAJADOR disfrutará del descanso dentro de la jornada previsto en el artículo 168 de la LOTTT. Los sábados y domingos son días de descanso remunerados en los términos de la Cláusula 8. Las horas extraordinarias solo procederán en los casos y con los recargos previstos en la ley y en la Convención.

QUINTA. LUGAR DE TRABAJO. Los servicios se prestarán en {{CONTRATO_LUGAR_QUINTA}}. LA ENTIDAD DE TRABAJO ejercerá la dirección técnica de la obra dentro de los límites de la ley y respetando la dignidad de EL TRABAJADOR.

SEXTA. SALARIO. EL TRABAJADOR devengará un salario básico diario de Bs. {{CONTRATO_SALARIO_DIARIO_VES}}, correspondiente a su oficio en el Tabulador vigente según el acuerdo homologado antes citado, para un salario semanal de Bs. {{CONTRATO_SALARIO_SEMANAL_VES}}, que incluye los dos (2) días de descanso semanal. El salario se ajustará de pleno derecho cuando se homologue una modificación del Tabulador o se decrete un salario mínimo superior. Se pagará semanalmente en bolívares, con recibo que discrimine cada concepto, conforme al artículo 106 de la LOTTT y a las Cláusulas 45 y 46 de la Convención.

SÉPTIMA. ALIMENTACIÓN. LA ENTIDAD DE TRABAJO pagará a EL TRABAJADOR el beneficio de alimentación por Bs. {{CONTRATO_ALIMENTACION_MENSUAL_VES}} mensuales, fijado en el acuerdo homologado, pagadero semanalmente en proporción de Bs. {{CONTRATO_ALIMENTACION_SEMANAL_VES}}. Este beneficio no tiene carácter salarial, conforme al Decreto con Rango, Valor y Fuerza de Ley del Cestaticket Socialista y a la Cláusula 20 de la Convención. Cualquier bono que LA ENTIDAD DE TRABAJO pague se imputará a este beneficio hasta su monto concurrente, según lo previsto en dicho acuerdo.

OCTAVA. COMPLEMENTO VOLUNTARIO DE ALIMENTACIÓN. Por mera liberalidad, LA ENTIDAD DE TRABAJO podrá pagar semanalmente un complemento equivalente a la diferencia entre la suma del salario semanal y la alimentación semanal, y el equivalente en bolívares de {{CONTRATO_INGRESO_SEMANAL_USD_TOTAL}} a la tasa oficial del Banco Central de Venezuela del día del pago. El dólar se usa solo como moneda de cuenta y el pago se hará siempre en bolívares. El complemento tiene la misma naturaleza no salarial del beneficio de alimentación, y no modifica la Convención ni el acuerdo homologado ni crea un nuevo mínimo convencional.

NOVENA. BENEFICIOS LEGALES Y CONVENCIONALES. EL TRABAJADOR gozará de todos los derechos y beneficios previstos en la LOTTT y en la Convención, incluidos: vacaciones y bono vacacional (Cláusula 47), utilidades (Cláusula 48), garantía de prestaciones sociales (artículo 142 de la LOTTT y Cláusula 50), bono por asistencia puntual y perfecta (Cláusula 41) y contribución para útiles escolares (Cláusula 23), cuando correspondan. Al terminar la relación, estos conceptos se pagarán completos o fraccionados según el tiempo de servicio. Los anticipos de prestaciones sociales solo procederán a solicitud escrita de EL TRABAJADOR, conforme al artículo 144 de la LOTTT.

DÉCIMA. SEGURIDAD Y SALUD EN EL TRABAJO. LA ENTIDAD DE TRABAJO inscribirá a EL TRABAJADOR en el Instituto Venezolano de los Seguros Sociales desde su ingreso (Cláusula 53), le notificará por escrito los riesgos de su puesto conforme a la LOPCYMAT y le entregará los equipos de protección personal. EL TRABAJADOR se obliga a usar esos equipos y el uniforme, a cumplir las normas de seguridad de la obra, a cuidar las herramientas y equipos asignados y a declarar por escrito el trayecto habitual entre su domicilio y la obra.

DÉCIMA PRIMERA. CONFIDENCIALIDAD Y CONDUCTA. EL TRABAJADOR guardará reserva sobre la información técnica de la obra. Las faltas se regirán exclusivamente por las causas previstas en el artículo 79 de la LOTTT y por los procedimientos de ley.

DÉCIMA SEGUNDA. TRANSPORTE. LA ENTIDAD DE TRABAJO ofrecerá gratuitamente un servicio de transporte diario, de ida y vuelta, desde el punto de encuentro establecido {{OBRA_PUNTO_ENC_TRANSPORTE}} hasta la obra. Su uso es opcional para EL TRABAJADOR. Conforme al artículo 105 de la LOTTT, este servicio es un beneficio social de carácter no remunerativo y no forma parte del salario.

DÉCIMA TERCERA. NORMAS APLICABLES. En lo no previsto, este contrato se rige por la LOTTT, su Reglamento y la Convención. Cualquier estipulación que resulte contraria a derechos irrenunciables de EL TRABAJADOR se tendrá por no escrita, sin afectar la validez de las demás cláusulas, conforme al artículo 89 de la Constitución.

DÉCIMA CUARTA. DOMICILIO. Las partes eligen como domicilio especial la ciudad de {{CONTRATO_DOMICILIO_PROCESAL}}, y se someten a la jurisdicción de los Tribunales del Trabajo de la Circunscripción Judicial del estado Nueva Esparta. Se hacen dos (2) ejemplares de un mismo tenor y a un solo efecto, uno para cada parte, en la ciudad de {{CONTRATO_DOMICILIO_PROCESAL}}, a los {{CONTRATO_DIA_FIRMA}} días del mes de {{CONTRATO_MES_FIRMA}} del año {{CONTRATO_ANIO_FIRMA}}.

POR LA ENTIDAD DE TRABAJO                          POR EL TRABAJADOR

_______________________________                    _______________________________
{{REP_LEGAL_NOMBRE}}                               {{EMPLEADO_NOMBRE_COMPLETO}}
C.I.: {{REP_LEGAL_CEDULA}}                         C.I.: {{EMPLEADO_CEDULA}}
                                                   (Huella Dactilar)`;
