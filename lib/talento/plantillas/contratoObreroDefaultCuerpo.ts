/**
 * Plantilla del contrato individual de trabajo (obrero) — obra determinada, CCT construcción.
 * Se inserta en `ci_documento_plantillas` si no existe (ver `ensurePlantillaContratoObrero`).
 * La entidad patrono (razón social, RM, representante) se sustituye desde `ci_entidades` del proyecto.
 * Revise con asesoría legal antes de uso en firma.
 */
export const CONTRATO_OBRERO_HORARIO_CUARTA_DEFAULT =
  'Lunes a Jueves: De 7:00 a.m. a 5:00 p.m. (1 hora de descanso de 12:00 p.m. a 1:00 p.m., no imputable a la jornada). Viernes: De 7:00 a.m. a 11:00 a.m. (Jornada continua).';

export const CONTRATO_OBRERO_CUERPO_DEFAULT = `CONTRATO INDIVIDUAL DE TRABAJO POR OBRA DETERMINADA

Entre {{PATRON_RAZON_SOCIAL}}, sociedad mercantil domiciliada en {{PATRON_DOMICILIO}}, Municipio {{PATRON_MUNICIPIO}} del estado {{PATRON_ESTADO}}, {{PATRON_INSCRIPCION_RM}} representada en este acto por su {{REP_LEGAL_CARGO}} {{REP_LEGAL_ARTICULO_CIUDADANO}} {{REP_LEGAL_NOMBRE}}, {{REP_LEGAL_NACIONALIDAD}}, mayor de edad, hábil en derecho, {{REP_LEGAL_ESTADO_CIVIL}}, de este domicilio, titular de la cédula de Identidad número {{REP_LEGAL_CEDULA}}, quien a los efectos de este contrato se denominará LA ENTIDAD DE TRABAJO, por una parte y por la otra el ciudadano {{EMPLEADO_NOMBRE_COMPLETO}}, {{EMPLEADO_NACIONALIDAD}}, mayor de edad, hábil en derecho, {{EMPLEADO_ESTADO_CIVIL}}, titular de la cédula de identidad número {{EMPLEADO_CEDULA}}, de este domicilio; quien en lo sucesivo se denominará EL TRABAJADOR, se ha convenido en celebrar, como en efecto se celebra, el presente Contrato de Trabajo para una Obra Determinada, conforme a lo establecido en el Artículo 63 de la Ley Orgánica de Trabajo de los Trabajadores y Trabajadoras, y las cláusulas 18 y 19 de la vigente Convención Colectiva de Trabajo para la Rama de la Industria de la Construcción, conexos, afines y similares de la República Bolivariana de Venezuela, el cual se regirá por las Cláusulas que se estipulan a continuación:

PRIMERA: OBJETO Y MODALIDAD. Este contrato se celebra bajo la modalidad de OBRA DETERMINADA (Arts. 63, 75 y 77 literal "a" de la LOTTT), específicamente para la ejecución de la fase técnica de: {{CONTRATO_FASE_TECNICA}}, dentro de la obra denominada: {{OBRA_NOMBRE}}. LA ENTIDAD DE TRABAJO tiene como objeto la explotación de actividades comerciales y de la industria de la construcción, y a tales efectos contrata a EL TRABAJADOR para que desempeñe el cargo de: {{CONTRATO_CARGO_OFICIO}}, cargo establecido en el Tabulador de Oficios y Salarios Básicos de la Convención Colectiva vigente. EL TRABAJADOR se obliga a: 1.- Poner a disposición su capacidad normal de trabajo en forma exclusiva y en las labores anexas complementarias. 2.- Ejecutar las actividades inherentes al cargo, incluyendo recibir, procesar y pesar materia prima cuando sea requerido. 3.- Usar obligatoriamente el uniforme y equipos de protección (guantes, lentes, botas, etc.) según la LOPCYMAT. 4.- Mantener el orden del área asignada y el buen estado de maquinarias y herramientas. 5.- No prestar servicios a otros empleadores ni trabajar por cuenta propia en funciones inherentes al cargo.

SEGUNDA: PERIODO DE PRUEBA. Conforme al Art. 25 del Reglamento de la LOTTT, se acuerda un PERIODO DE PRUEBA DE NOVENTA (90) DÍAS. Durante este lapso, LA ENTIDAD DE TRABAJO apreciará los conocimientos y aptitudes de EL TRABAJADOR. Cualquiera de las partes podrá dar por extinguida la relación sin lugar a indemnización alguna.

TERCERA: DURACIÓN Y TERMINACIÓN. La relación de trabajo está sujeta exclusivamente a la culminación física de la fase técnica descrita en la Cláusula Primera. El vínculo se extinguirá de pleno derecho y sin necesidad de preaviso (Art. 75 LOTTT) una vez firmada el Acta de Culminación en el Libro de Obra por el Supervisor. La terminación es independiente de la entrega formal del inmueble al propietario.

CUARTA: JORNADA, HORARIO Y RENDIMIENTO. La jornada semanal será de cuarenta (40) horas de trabajo efectivo: {{CONTRATO_HORARIO_CUARTA}} CONTROL: EL TRABAJADOR debe firmar diariamente su registro de avance en el Libro de Obra. La inobservancia del horario en 4 oportunidades en un mes o la negativa a firmar el registro constituirá falta grave (Art. 102 literal "i" LOTTT).

QUINTA: LUGAR DE TRABAJO Y DIRECCIÓN. Los servicios se prestarán en: {{CONTRATO_LUGAR_QUINTA}}. LA ENTIDAD DE TRABAJO ejercerá su facultad de dirección para el mejor desempeño de la obra; dichas exigencias técnicas y de rendimiento no se considerarán acoso laboral.

SEXTA: INGRESO INTEGRAL INDEXADO. EL TRABAJADOR devengará los siguientes conceptos pagaderos en Bolívares.
a.- {{CONTRATO_SALARIO_SEMANAL_VES}} (Bs.) por concepto de Salario Semanal según Tabulador;
b.- Cesta Ticket (Indexado): Equivalente a {{CONTRATO_CESTA_TICKET_USD_SEMANAL}} semanales; y
c.- BONO ESPECIAL: (NO Salarial): Según Art. 105 LOTTT y Sentencia 218 del TSJ, para elevar el Ingreso Semanal a un total equivalente a: {{CONTRATO_INGRESO_SEMANAL_USD_TOTAL}}.
Todos los pagos se realizarán en Bolívares calculados a la tasa oficial del Banco Central de Venezuela (BCV) del día del pago.

SÉPTIMA: COMPENSACIÓN POR CULMINACIÓN. PARÁGRAFO ÚNICO: Al cierre de obra o finiquito, se recibirá una compensación de: {{CONTRATO_COMPENSACION_CULMINACION_USD}} USD (a tasa BCV) por cada mes trabajado o fracción. Este monto liquida de forma integral: prestaciones sociales, utilidades, vacaciones y cualquier otro beneficio derivado de este contrato especial y de la Convención Colectiva.

OCTAVA: ÉTICA, CONFIDENCIALIDAD Y JURISDICCIÓN. EL TRABAJADOR, guardará reserva absoluta sobre información técnica y se abstendrá de prácticas desleales.

NOVENA (TRANSPORTE GRATUITO - BENEFICIO SOCIAL NO REMUNERATIVO). Con el firme propósito de facilitar la asistencia, puntualidad y resguardar la seguridad de EL TRABAJADOR, LA ENTIDAD DE TRABAJO brindará de manera gratuita un servicio de transporte diario, de ida y vuelta, desde el punto de encuentro establecido {{OBRA_PUNTO_ENC_TRANSPORTE}} hasta el sitio donde se ejecute la obra determinada. NATURALEZA JURÍDICA: De conformidad con lo establecido en el Artículo 105 de la LOTTT, las partes acuerdan expresamente que este servicio de transporte constituye un beneficio social de carácter no remunerativo. En consecuencia, ambas partes reconocen que: No forma parte del salario bajo ninguna circunstancia. No tiene carácter de salario en especie. No será considerado ni computado para el cálculo de prestaciones sociales, vacaciones, utilidades, bonos ni ningún otro pasivo o derecho laboral derivado de la relación de trabajo. CONDICIONES: El uso de este servicio es opcional para el trabajador y está sujeto al cumplimiento de las normas de conducta y seguridad dictadas por la empresa durante el trayecto.

DECIMA (DOMICILIO PROCESAL). Las partes eligen como domicilio especial la ciudad de {{CONTRATO_DOMICILIO_PROCESAL}}, Estado Nueva Esparta, sometiéndose a sus Tribunales del Trabajo. Se firman dos (2) ejemplares de un mismo tenor y a un solo efecto en la ciudad de Pampatar, a los {{CONTRATO_DIA_FIRMA}} días del mes de {{CONTRATO_MES_FIRMA}} del año {{CONTRATO_ANIO_FIRMA}}.

POR LA ENTIDAD DE TRABAJO                          POR EL TRABAJADOR

_________________                                  ___________________

C.I.: {{REP_LEGAL_CEDULA}}

{{CONTRATO_CARGO_OFICIO}}

_______________________________

C.I.: {{EMPLEADO_CEDULA}}

(Huella Dactilar)`;
