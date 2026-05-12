/**
 * Plantilla inicial del contrato individual de trabajo (obrero).
 * Se inserta en `ci_documento_plantillas` si no existe (ver `ensurePlantillaContratoObrero`).
 * Comparecencia alineada al PDF estructurado (LOTTT Art. 63, CCT construcción cláusulas 18 y 19).
 * Revise con asesoría legal antes de uso en firma.
 */
export const CONTRATO_OBRERO_CUERPO_DEFAULT = `CONTRATO INDIVIDUAL DE TRABAJO POR OBRA DETERMINADA

Entre {{PATRON_RAZON_SOCIAL}}, Sociedad Mercantil domiciliada en {{PATRON_DOMICILIO}}, Sector {{PATRON_SECTOR}}, Municipio {{PATRON_MUNICIPIO}}, Estado {{PATRON_ESTADO}}, Rif. N° {{PATRON_RIF}}, representada en este acto por el Ciudadano {{REP_LEGAL_NOMBRE}}, {{REP_LEGAL_NACIONALIDAD}}, {{REP_LEGAL_ESTADO_CIVIL}}, mayor de edad, hábil en derecho, de este domicilio, titular de la Cédula de Identidad número {{REP_LEGAL_CEDULA}}, quien a los efectos de este contrato se denominará LA ENTIDAD DE TRABAJO, por una parte y por la otra el ciudadano {{EMPLEADO_NOMBRE_COMPLETO}}, {{EMPLEADO_NACIONALIDAD}}, mayor de edad, hábil en derecho, {{EMPLEADO_ESTADO_CIVIL}}, titular de la cédula de identidad número {{EMPLEADO_CEDULA}}, domiciliado en {{EMPLEADO_DIRECCION}}, Municipio {{EMPLEADO_MUNICIPIO}}, Estado {{EMPLEADO_ESTADO_GEO}}; quien en lo sucesivo se denominará EL TRABAJADOR, se ha convenido en celebrar, como en efecto se celebra, el presente Contrato de Trabajo para una Obra Determinada, conforme a lo establecido en el Artículo 63 de la Ley Orgánica de Trabajo de los Trabajadores y Trabajadoras, y las cláusulas 18 y 19 de la vigente Convención Colectiva de Trabajo para la Rama de la Industria de la Construcción, conexos, afines y similares de la República Bolivariana de Venezuela, el cual se regirá por las Cláusulas que se estipulan a continuación:

PRIMERA: OBJETO. EL TRABAJADOR se obliga a prestar sus servicios personales en el cargo u oficio de {{CONTRATO_CARGO_OFICIO}}, con las funciones inherentes al mismo, en {{CONTRATO_LUGAR_PRESTACION}}. {{CONTRATO_OBJETO}}

SEGUNDA: TIPO Y PLAZO. Se celebra por tiempo {{CONTRATO_TIPO_PLAZO}}, conforme a la normativa aplicable.

TERCERA: JORNADA. La jornada será {{CONTRATO_JORNADA}}.

CUARTA: REMUNERACIÓN. LA ENTIDAD DE TRABAJO pagará a EL TRABAJADOR un salario básico diario de {{CONTRATO_SALARIO_DIARIO_VES}} bolívares ({{CONTRATO_SALARIO_DIARIO_VES_NUM}}), en la forma de pago {{CONTRATO_FORMA_PAGO}}{{CONTRATO_LUGAR_PAGO_LINEA}}.

QUINTA: FECHA DE INGRESO. EL TRABAJADOR ingresará a laborar a partir del {{CONTRATO_FECHA_INGRESO}}.

SEXTA: OBLIGACIONES GENERALES. EL TRABAJADOR se compromete a cumplir el reglamento interno, normas de higiene y seguridad, y las instrucciones legítimas de LA ENTIDAD DE TRABAJO.

SÉPTIMA: CONFIDENCIALIDAD. EL TRABAJADOR guardará confidencialidad respecto de la información técnica y comercial de LA ENTIDAD DE TRABAJO que llegue a conocer con motivo de su labor.

OCTAVA: RESOLUCIÓN DE CONTROVERSIAS. Las partes se someten a mediación de buena fe y, en su defecto, a los tribunales competentes según la ley.

NOVENA: DATOS ADICIONALES DEL EXPEDIENTE. Fecha de nacimiento: {{EMPLEADO_FECHA_NACIMIENTO}}. Lugar de nacimiento: {{EMPLEADO_LUGAR_NACIMIENTO}}. Teléfono celular: {{EMPLEADO_CELULAR}}. Oficio tabulador (referencia): {{CONTRATO_NUMERO_OFICIO_TABULADOR}} — {{CONTRATO_DENOMINACION_GACETA}}.

DÉCIMA: FIRMAS. Leído el presente contrato, las partes lo firman en dos ejemplares del mismo tenor, en {{CONTRATO_FECHA_EMISION}}, en {{CONTRATO_LUGAR_FIRMA}}.

______________________________                    ______________________________
LA ENTIDAD DE TRABAJO                             EL TRABAJADOR
{{PATRON_REPRESENTANTE}}`;
