/**
 * Plantilla inicial del contrato individual de trabajo (obrero).
 * Se inserta en `ci_documento_plantillas` si no existe (ver `ensurePlantillaContratoObrero`).
 * Revise con asesoría legal antes de uso en firma.
 */
export const CONTRATO_OBRERO_CUERPO_DEFAULT = `CONTRATO INDIVIDUAL DE TRABAJO

ENTRE {{PATRON_NOMBRE}}, domiciliada en {{PATRON_DOMICILIO}}, de aquí en adelante "EL PATRONO", por una parte, y el(la) ciudadano(a) {{EMPLEADO_NOMBRE_COMPLETO}}, de nacionalidad {{EMPLEADO_NACIONALIDAD}}, mayor de edad, hábil en el ejercicio de sus derechos civiles, titular de la cédula de identidad N° {{EMPLEADO_CEDULA}}, domiciliado(a) en {{EMPLEADO_DIRECCION}}, en adelante "EL TRABAJADOR", por la otra parte, han convenido celebrar el presente contrato individual de trabajo, sujeto a las siguientes cláusulas:

PRIMERA: OBJETO. EL TRABAJADOR se obliga a prestar sus servicios personales en el cargo u oficio de {{CONTRATO_CARGO_OFICIO}}, con las funciones inherentes al mismo, en {{CONTRATO_LUGAR_PRESTACION}}. {{CONTRATO_OBJETO}}

SEGUNDA: TIPO Y PLAZO. Se celebra por tiempo {{CONTRATO_TIPO_PLAZO}}, conforme a la normativa aplicable.

TERCERA: JORNADA. La jornada será {{CONTRATO_JORNADA}}.

CUARTA: REMUNERACIÓN. EL PATRONO pagará a EL TRABAJADOR un salario básico diario de {{CONTRATO_SALARIO_DIARIO_VES}} bolívares ({{CONTRATO_SALARIO_DIARIO_VES_NUM}}), en la forma de pago {{CONTRATO_FORMA_PAGO}}{{CONTRATO_LUGAR_PAGO_LINEA}}.

QUINTA: FECHA DE INGRESO. EL TRABAJADOR ingresará a laborar a partir del {{CONTRATO_FECHA_INGRESO}}.

SEXTA: OBLIGACIONES GENERALES. EL TRABAJADOR se compromete a cumplir el reglamento interno, normas de higiene y seguridad, y las instrucciones legítimas de EL PATRONO.

SÉPTIMA: CONFIDENCIALIDAD. EL TRABAJADOR guardará confidencialidad respecto de la información técnica y comercial de EL PATRONO que llegue a conocer con motivo de su labor.

OCTAVA: RESOLUCIÓN DE CONTROVERSIAS. Las partes se someten a mediación de buena fe y, en su defecto, a los tribunales competentes según la ley.

NOVENA: DATOS ADICIONALES DEL EXPEDIENTE. Estado civil: {{EMPLEADO_ESTADO_CIVIL}}. Fecha de nacimiento: {{EMPLEADO_FECHA_NACIMIENTO}}. Lugar de nacimiento: {{EMPLEADO_LUGAR_NACIMIENTO}}. Teléfono celular: {{EMPLEADO_CELULAR}}. Oficio tabulador (referencia): {{CONTRATO_NUMERO_OFICIO_TABULADOR}} — {{CONTRATO_DENOMINACION_GACETA}}.

DÉCIMA: FIRMAS. Leído el presente contrato, las partes lo firman en dos ejemplares del mismo tenor, en {{CONTRATO_FECHA_EMISION}}, en {{CONTRATO_LUGAR_FIRMA}}.

______________________________                    ______________________________
EL PATRONO                                        EL TRABAJADOR
{{PATRON_REPRESENTANTE}}`;
