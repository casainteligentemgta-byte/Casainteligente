import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { razonSocialPatronoParaContratoPdf } from '@/lib/talento/razonSocialContratoPdf';
import { TASA_BCV_VES_POR_USD_TABULADOR_2023_06_20 } from '@/lib/nomina/tabuladorSalariosConstruccion2023';

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 32,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: '#000',
  },
  pageFirst: {
    paddingTop: 14,
    paddingBottom: 26,
  },
  header: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 1.16,
  },
  paragraph: { marginBottom: 5, textAlign: 'justify', lineHeight: 1.26, fontSize: 9.5 },
  paragraphIntro: { marginBottom: 3, lineHeight: 1.2 },
  bold: { fontWeight: 'bold' },
  signatureSection: { flexDirection: 'row', marginTop: 12, justifyContent: 'space-between' },
  signatureBox: { width: '48%', paddingTop: 4, textAlign: 'left', lineHeight: 1.22 },
  signatureLine: { marginBottom: 1, lineHeight: 1.2, fontSize: 9 },
  signUnderline: {
    borderBottomWidth: 1,
    borderColor: '#000',
    width: '100%',
    height: 14,
    marginTop: 2,
    marginBottom: 4,
  },
  meta: { fontSize: 8.5, marginBottom: 8, textAlign: 'center', color: '#333', lineHeight: 1.22 },
  metaFirst: { marginBottom: 3 },
  clauseDense: { fontSize: 8.4, lineHeight: 1.18, textAlign: 'justify' },
});

export type EntidadContratoPdf = {
  nombre_legal?: string | null;
  nombre?: string | null;
  rif?: string | null;
  domicilio_fiscal?: string | null;
  direccion_fiscal?: string | null;
  /** Opcional: municipio de la sede (comparecencia). Si falta, línea en blanco en el PDF. */
  municipio_fiscal?: string | null;
  /** Opcional: estado de la sede (comparecencia). */
  estado_fiscal?: string | null;
  representante_legal?: string | null;
  rep_legal_nombre?: string | null;
  rep_legal_cedula?: string | null;
  rep_legal_cargo?: string | null;
  /** Opcional: nacionalidad del representante (comparecencia). */
  rep_legal_nacionalidad?: string | null;
  /** Opcional: estado civil del representante (comparecencia). */
  rep_legal_estado_civil?: string | null;
  rm_oficina?: string | null;
  rm_fecha?: string | null;
  rm_numero?: string | null;
  rm_tomo?: string | null;
};

export type EmpleadoContratoPdf = {
  nombres?: string | null;
  nombre_completo?: string | null;
  nacionalidad?: string | null;
  estado_civil?: string | null;
  cedula?: string | null;
  documento?: string | null;
  direccion_domicilio?: string | null;
  direccion_habitacion?: string | null;
  /** Opcional: municipio del domicilio del trabajador (comparecencia). */
  municipio_domicilio?: string | null;
  /** Opcional: estado del domicilio del trabajador (comparecencia). */
  estado_domicilio?: string | null;
  cargo_nombre?: string | null;
  tareas_especificas?: string | null;
};

export type ConfigNominaContratoPdf = {
  funciones_oficiales?: string | null;
  salario_base_mensual?: number | null;
  cestaticket_mensual?: number | null;
  salario_basico_diario_ves?: number | null;
};

export type ParametrosContratoPdf = {
  tipoPlazo?: string | null;
  fechaIngreso?: string | null;
  duracionSemanasReferencial?: string | null;
  horarioSemanal?: string | null;
  fechaFirmaContratoIso?: string | null;
  fechaAsambleaVoluntadIso?: string | null;
  ingresoSemanalConsolidadoUsdTexto?: string | null;
  textoPuntoEncuentroTransporteSex?: string | null;
  compensacionCulminacionUsdPorMes?: number | null;
};

export type ContratoObreroDetallePdf = {
  objeto_contrato?: string | null;
  lugar_prestacion_servicio?: string | null;
  /** Nombre del proyecto / obra (`ci_proyectos.nombre`) para «obra denominada» en cláusula primera. */
  obra_denominada?: string | null;
};

export type ContratoObreroPdfStructuredProps = {
  expedienteId?: string | null;
  empleado: EmpleadoContratoPdf;
  entidad: EntidadContratoPdf;
  configNomina: ConfigNominaContratoPdf;
  parametros: ParametrosContratoPdf;
  contrato?: ContratoObreroDetallePdf | null;
};

function str(v: string | null | undefined, fallback: string): string {
  const t = (v ?? '').trim();
  return t.length ? t : fallback;
}

function partesFechaCierreFirma(iso: string | null | undefined): { dia: string; mes: string; anio: string } {
  const t = (iso ?? '').trim();
  const ymd = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12, 0, 0);
    if (!Number.isNaN(d.getTime())) {
      return {
        dia: d.toLocaleDateString('es-VE', { day: 'numeric' }),
        mes: d.toLocaleDateString('es-VE', { month: 'long' }),
        anio: d.toLocaleDateString('es-VE', { year: 'numeric' }),
      };
    }
  }
  return { dia: '________', mes: '____________________', anio: '2026' };
}

function formatCedulaIdentidad(raw: string | null | undefined): string {
  const compact = (raw ?? '').trim().replace(/\s+/g, '');
  if (!compact) return 'V___________';
  const upper = compact.toUpperCase();
  const m = upper.match(/^([VE])(.*)$/);
  if (m) {
    const letra = m[1];
    const digits = m[2].replace(/[^\d]/g, '');
    if (!digits) return `${letra}___________`;
    return `${letra}${digits}`;
  }
  const digitsOnly = upper.replace(/[^\d]/g, '');
  if (digitsOnly) return `V${digitsOnly}`;
  return 'V___________';
}

/** Estilo acta: «V- 12345678» o placeholder. */
function cedulaConGuion(raw: string | null | undefined): string {
  const f = formatCedulaIdentidad(raw);
  if (f === 'V___________' || f === 'E___________') return `${f.charAt(0)}- _______________`;
  const m = f.match(/^([VE])(\d+)$/);
  if (m) return `${m[1]}- ${m[2]}`;
  return f;
}

const PLACEHOLDER_LINEA = '_____________';

function esLugarPrestacionPlaceholder(l: string): boolean {
  const t = l.trim().toLowerCase();
  if (!t) return true;
  if (t === 'por definir' || t === 'por definir.' || t === 'sin definir' || t === 'sin especificar') return true;
  if (t === 'tbd' || t === '—' || t === '-' || t === 'n/a') return true;
  return false;
}

function faseTecnicaClausulaPrimera(contrato: ContratoObreroDetallePdf | null | undefined): string {
  const o = (contrato?.objeto_contrato ?? '').trim();
  if (o.length) return o;
  return '_______________________________________________________________________________';
}

function obraDenominadaClausulaPrimera(contrato: ContratoObreroDetallePdf | null | undefined): string {
  const n = (contrato?.obra_denominada ?? '').trim();
  if (n.length) return n;
  return '__________________________________________________';
}

function lugarPrestacionQuinta(contrato: ContratoObreroDetallePdf | null | undefined): string {
  const l = (contrato?.lugar_prestacion_servicio ?? '').trim();
  if (l.length && !esLugarPrestacionPlaceholder(l)) return l;
  return '_______________________________________________________________________________';
}

function fmtBsVes(n: number): string {
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function rifPatronoDisplay(rif: string): string {
  const t = (rif ?? '').trim().toUpperCase();
  if (!t || t === '_____________') return '________________________';
  if (/^J[-\s]/.test(t)) return t.replace(/\s+/g, '');
  return `J-${t.replace(/^J/, '').replace(/^[-\s]+/, '')}`;
}

function fmtUsdNumeroPlano(n: number): string {
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function limpiarNombreRepresentanteLegal(n: string): string {
  let t = n.trim().replace(/\s+/g, ' ');
  if (!t) return t;
  t = t.replace(/\s*\d{7,}\s*$/, '').trim();
  t = t.replace(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])(\d{2,})$/, '$1').trim();
  return t;
}

/** Texto tras «establecido» en NOVENA (transporte). */
function fragmentoPuntoEncuentroTransporte(raw: string | null | undefined): string {
  const t0 = (raw ?? '').trim();
  const t = t0 || 'el sector Jorge Coll (Municipio Maneiro)';
  return /^en\s/i.test(t) ? t : `en ${t}`;
}

function ingresoSemanalUsdPlanoDesdeParam(raw: string | null | undefined): string {
  const t = (raw ?? '').trim();
  if (!t) return '__________ USD';
  if (/usd/i.test(t)) return t;
  const sinMoneda = t.replace(/^\$\s*/, '').trim();
  let n = Number.parseFloat(sinMoneda.replace(',', '.'));
  if (Number.isFinite(n) && n > 0) return `${fmtUsdNumeroPlano(n)} USD`;
  const compact = sinMoneda.replace(/[^\d,.-]/g, '');
  if (compact.includes(',') && !compact.includes('.')) {
    n = Number.parseFloat(compact.replace(/\./g, '').replace(',', '.'));
  } else if (compact.includes('.')) {
    n = Number.parseFloat(compact.replace(/,/g, ''));
  } else {
    n = Number.parseFloat(compact);
  }
  if (Number.isFinite(n) && n > 0) return `${fmtUsdNumeroPlano(n)} USD`;
  return `${sinMoneda} USD`;
}

export function ContratoObreroPDF({
  expedienteId,
  empleado,
  entidad,
  configNomina,
  parametros,
  contrato,
}: ContratoObreroPdfStructuredProps) {
  const nombreLegalSociedad = str(
    razonSocialPatronoParaContratoPdf(entidad.nombre_legal, entidad.nombre),
    '________________________________________________',
  );
  const nombreTrabajador = str(empleado.nombres ?? empleado.nombre_completo, '__________________________________________________');
  const estadoCivilTrab = str(empleado.estado_civil, '_______________');
  const cedulaTrabGuion = cedulaConGuion(empleado.cedula ?? empleado.documento);
  const domicilioTrab = str(
    empleado.direccion_domicilio ?? empleado.direccion_habitacion,
    '______________________________________________________________',
  );
  const faseTecnicaTxt = faseTecnicaClausulaPrimera(contrato ?? null);
  const obraDenomTxt = obraDenominadaClausulaPrimera(contrato ?? null);
  const lugarQuintaTxt = lugarPrestacionQuinta(contrato ?? null);
  const oficioStr = (() => {
    const c = (empleado.cargo_nombre ?? '').trim();
    return c ? c.toUpperCase() : '______________________________';
  })();
  const fechaCierreIso = parametros.fechaFirmaContratoIso ?? parametros.fechaIngreso;
  const { dia: diaFirma, mes: mesFirma, anio: anioFirma } = partesFechaCierreFirma(fechaCierreIso);

  const sbDia = configNomina.salario_basico_diario_ves;
  const tieneSb =
    sbDia != null && Number.isFinite(Number(sbDia)) && Number(sbDia) > 0 ? Number(sbDia) : null;
  const salDiarioTxt = tieneSb != null ? fmtBsVes(tieneSb) : '__________________';
  const cestaMen = configNomina.cestaticket_mensual;
  const cestaSemUsdNum =
    cestaMen != null &&
    Number.isFinite(Number(cestaMen)) &&
    Number(cestaMen) > 0 &&
    TASA_BCV_VES_POR_USD_TABULADOR_2023_06_20 > 0
      ? Number(cestaMen) / 4 / TASA_BCV_VES_POR_USD_TABULADOR_2023_06_20
      : null;
  const cestaUsdPlanoTxt =
    cestaSemUsdNum != null && Number.isFinite(cestaSemUsdNum)
      ? `${fmtUsdNumeroPlano(Math.round(cestaSemUsdNum * 100) / 100)} USD`
      : '10 USD';
  const ingresoSemanalUsdPlanoTxt = ingresoSemanalUsdPlanoDesdeParam(parametros.ingresoSemanalConsolidadoUsdTexto);

  const rep = limpiarNombreRepresentanteLegal(
    str(entidad.rep_legal_nombre ?? entidad.representante_legal, '________________________________________________'),
  );
  const repCedulaGuion = cedulaConGuion(entidad.rep_legal_cedula);
  const rifEntidadLinea = rifPatronoDisplay(str(entidad.rif, ''));
  const razonComparecencia = nombreLegalSociedad.trim().replace(/\.\s*$/, '');
  const domicilioEmpresa = str(
    entidad.domicilio_fiscal ?? entidad.direccion_fiscal,
    '________________________________________________________________',
  );
  const phMun = '___________';
  const phEdo = '___________';
  const phRepNat = '________________';
  const phRepEc = '____________';
  const municipioEmpresa = str(entidad.municipio_fiscal, phMun);
  const estadoEmpresa = str(entidad.estado_fiscal, phEdo);
  const nacionalidadRep = str(entidad.rep_legal_nacionalidad, phRepNat);
  const estadoCivilRep = str(entidad.rep_legal_estado_civil, phRepEc);
  const nacionalidadTrab = str(empleado.nacionalidad, '__________');
  const municipioTrab = str(empleado.municipio_domicilio, phMun);
  const estadoTrabPdf = str(empleado.estado_domicilio, phEdo);
  const repCedulaLinea = str(repCedulaGuion, '_______________');
  const compUsdMes =
    parametros.compensacionCulminacionUsdPorMes != null &&
    Number.isFinite(Number(parametros.compensacionCulminacionUsdPorMes)) &&
    Number(parametros.compensacionCulminacionUsdPorMes) > 0
      ? Number(parametros.compensacionCulminacionUsdPorMes)
      : 100;
  const compUsdMesTxt = fmtUsdNumeroPlano(compUsdMes);
  const puntoEncTransporte = fragmentoPuntoEncuentroTransporte(parametros.textoPuntoEncuentroTransporteSex);

  const bloquePortadaIntro = (
    <>
      <Text style={styles.header}>CONTRATO INDIVIDUAL DE TRABAJO POR OBRA DETERMINADA</Text>
      {expedienteId?.trim() ? (
        <Text style={[styles.meta, styles.metaFirst]}>Expediente: {expedienteId.trim()}</Text>
      ) : null}

      <Text style={[styles.paragraph, styles.paragraphIntro, styles.clauseDense]}>
        Entre <Text style={styles.bold}>{razonComparecencia}</Text>, Sociedad Mercantil domiciliada en{' '}
        <Text style={styles.bold}>{domicilioEmpresa}</Text>, Municipio <Text style={styles.bold}>{municipioEmpresa}</Text>
        , Estado <Text style={styles.bold}>{estadoEmpresa}</Text>, Rif. N° <Text style={styles.bold}>{rifEntidadLinea}</Text>
        , representada en este acto por el Ciudadano <Text style={styles.bold}>{rep}</Text>,{' '}
        <Text style={styles.bold}>{nacionalidadRep}</Text>, <Text style={styles.bold}>{estadoCivilRep}</Text>, mayor de
        edad, hábil en derecho, de este domicilio, titular de la Cédula de Identidad número{' '}
        <Text style={styles.bold}>{repCedulaLinea}</Text>, quien a los efectos de este contrato se denominará{' '}
        <Text style={styles.bold}>LA ENTIDAD DE TRABAJO</Text>, por una parte y por la otra el ciudadano{' '}
        <Text style={styles.bold}>{nombreTrabajador}</Text>, <Text style={styles.bold}>{nacionalidadTrab}</Text>, mayor
        de edad, hábil en derecho, <Text style={styles.bold}>{estadoCivilTrab}</Text>, titular de la cédula de identidad
        número <Text style={styles.bold}>{cedulaTrabGuion}</Text>, domiciliado en{' '}
        <Text style={styles.bold}>{domicilioTrab}</Text>, Municipio <Text style={styles.bold}>{municipioTrab}</Text>,
        Estado <Text style={styles.bold}>{estadoTrabPdf}</Text>
        ; quien en lo sucesivo se denominará <Text style={styles.bold}>EL TRABAJADOR</Text>, se ha convenido en
        celebrar, como en efecto se celebra, el presente Contrato de Trabajo para una Obra Determinada, conforme a lo
        establecido en el Artículo 63 de la Ley Orgánica de Trabajo de los Trabajadores y Trabajadoras, y las cláusulas
        18 y 19 de la vigente Convención Colectiva de Trabajo para la Rama de la Industria de la Construcción, conexos,
        afines y similares de la República Bolivariana de Venezuela, el cual se regirá por las Cláusulas que se
        estipulan a continuación:
      </Text>
    </>
  );

  const bloqueClausulasPrimeraACuarta = (
    <>
      <Text style={[styles.paragraph, styles.paragraphIntro, styles.clauseDense]}>
        <Text style={styles.bold}>PRIMERA: OBJETO Y MODALIDAD</Text>
        {'\n'}
        {`Este contrato se celebra bajo la modalidad de OBRA DETERMINADA (Arts. 63, 75 y 77 literal "a" de la LOTTT), específicamente para la ejecución de la fase técnica de: `}
        <Text style={styles.bold}>{faseTecnicaTxt}</Text>
        {` dentro de la obra denominada: `}
        <Text style={styles.bold}>{obraDenomTxt}</Text>
        {`. LA ENTIDAD DE TRABAJO tiene como objeto la explotación de actividades comerciales y de la industria de la construcción, y a tales efectos contrata a EL TRABAJADOR para que desempeñe el cargo de: `}
        <Text style={styles.bold}>{oficioStr}</Text>
        {`, cargo establecido en el Tabulador de Oficios y Salarios Básicos de la Convención Colectiva vigente. EL TRABAJADOR se obliga a: Poner a disposición su capacidad normal de trabajo en forma exclusiva y en las labores anexas complementarias. Ejecutar las actividades inherentes al cargo, incluyendo recibir, procesar y pesar materia prima cuando sea requerido. Usar obligatoriamente el uniforme y equipos de protección (guantes, lentes, botas, etc.) según la LOPCYMAT. Mantener el orden del área asignada y el buen estado de maquinarias y herramientas. No prestar servicios a otros empleadores ni trabajar por cuenta propia en funciones inherentes al cargo.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>SEGUNDA: PERIODO DE PRUEBA</Text>
        {'\n'}
        {`Conforme al Art. 25 del Reglamento de la LOTTT, se acuerda un PERIODO DE PRUEBA DE NOVENTA (90) DÍAS. Durante este lapso, LA ENTIDAD DE TRABAJO apreciará los conocimientos y aptitudes de EL TRABAJADOR. Cualquiera de las partes podrá dar por extinguida la relación sin lugar a indemnización alguna.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>TERCERA: DURACIÓN Y TERMINACIÓN</Text>
        {'\n'}
        {`La relación de trabajo está sujeta exclusivamente a la culminación física de la fase técnica descrita en la Cláusula Primera. El vínculo se extinguirá de pleno derecho y sin necesidad de preaviso (Art. 75 LOTTT) una vez firmada la Acta de Culminación en el Libro de Obra por el Supervisor. La terminación es independiente de la entrega formal del inmueble al propietario.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>CUARTA: JORNADA, HORARIO Y RENDIMIENTO</Text>
        {'\n'}
        {`La jornada semanal será de cuarenta (40) horas de trabajo efectivo: Lunes a Jueves: De 7:00 a.m. a 5:00 p.m. (1 hora de descanso de 12:00 p.m. a 1:00 p.m., no imputable a la jornada). Viernes: De 7:00 a.m. a 11:00 a.m. (Jornada continua). `}
        <Text style={styles.bold}>CONTROL:</Text>
        {` EL TRABAJADOR debe firmar diariamente su registro de avance en el Libro de Obra. La inobservancia del horario en 4 oportunidades en un mes o la negativa a firmar el registro constituirá falta grave (Art. 102 literal "i" LOTTT).`}
      </Text>
    </>
  );

  const bloqueClausulasQuintaANovenaYFirmas = (
    <>
      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>QUINTA: LUGAR DE TRABAJO Y DIRECCIÓN</Text>
        {'\n'}
        {'Los servicios se prestarán en: '}
        <Text style={styles.bold}>{lugarQuintaTxt}</Text>
        {'. LA ENTIDAD DE TRABAJO ejercerá su facultad de dirección para el mejor desempeño de la obra; dichas exigencias técnicas y de rendimiento no se considerarán acoso laboral.'}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>SEXTA: INGRESO INTEGRAL INDEXADO</Text>
        {'\n'}
        {`EL TRABAJADOR devengará los siguientes conceptos pagaderos en Bolívares:`}
        {'\n'}
        a.- <Text style={styles.bold}>{salDiarioTxt}</Text>
        {` (Bs.) por concepto de Salario Diario según Tabulador, `}
        {'\n'}
        b.- Cesta Ticket (Indexado): Equivalente semanal a <Text style={styles.bold}>{cestaUsdPlanoTxt}</Text>.
        {'\n'}
        <Text style={styles.bold}>BONO ESPECIAL: (NO Salarial):</Text>
        {` Según Art. 105 LOTTT y Sentencia 218 del TSJ, para elevar el Ingreso Semanal a un total equivalente a: `}
        <Text style={styles.bold}>{ingresoSemanalUsdPlanoTxt}</Text>
        {'. '}
        {'\n'}
        {`Todos los pagos se realizarán en Bolívares calculados a la tasa oficial del Banco Central de Venezuela (BCV) del día del pago.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>SÉPTIMA: COMPENSACIÓN POR CULMINACIÓN</Text>
        {'\n'}
        <Text style={styles.bold}>PARÁGRAFO ÚNICO:</Text>
        {` Al cierre de obra o finiquito, se recibirá una compensación de: `}
        <Text style={styles.bold}>{compUsdMesTxt}</Text>
        {` USD (a tasa BCV) por cada mes trabajado o fracción. Este monto liquida de forma integral: prestaciones sociales, utilidades, vacaciones y cualquier otro beneficio derivado de este contrato especial.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro, styles.clauseDense]}>
        <Text style={styles.bold}>OCTAVA: ÉTICA, CONFIDENCIALIDAD Y JURISDICCIÓN</Text>
        {'\n'}
        {`EL TRABAJADOR guardará reserva absoluta sobre información técnica y se abstendrá de prácticas desleales. `}
        {'\n\n'}
        <Text style={styles.bold}>NOVENA (TRANSPORTE GRATUITO - BENEFICIO SOCIAL NO REMUNERATIVO)</Text>
        {'\n'}
        <Text style={styles.bold}>OBJETO:</Text>
        {` Con el firme propósito de facilitar la asistencia, puntualidad y resguardar la seguridad de EL TRABAJADOR, LA ENTIDAD DE TRABAJO brindará de manera gratuita un servicio de transporte diario, de ida y vuelta, desde el punto de encuentro establecido ${puntoEncTransporte} hasta el sitio donde se ejecute la obra determinada. `}
        {'\n'}
        <Text style={styles.bold}>NATURALEZA JURÍDICA:</Text>
        {` De conformidad con lo establecido en el Artículo 105 de la LOTTT, las partes acuerdan expresamente que este servicio de transporte constituye un beneficio social de carácter no remunerativo. En consecuencia, ambas partes reconocen que: No forma parte del salario bajo ninguna circunstancia. No tiene carácter de salario en especie. No será considerado ni computado para el cálculo de prestaciones sociales, vacaciones, utilidades, bonos ni ningún otro pasivo o derecho laboral derivado de la relación de trabajo. `}
        {'\n'}
        <Text style={styles.bold}>CONDICIONES:</Text>
        {` El uso de este servicio es opcional para el trabajador y está sujeto al cumplimiento de las normas de conducta y seguridad dictadas por la empresa durante el trayecto. `}
        {'\n\n'}
        {`Las partes eligen como domicilio especial la ciudad de Pampatar, Estado Nueva Esparta, sometiéndose a sus Tribunales del Trabajo. `}
        {'\n'}
        Se firman dos (2) ejemplares de un mismo tenor y a un solo efecto en la ciudad de Pampatar, a los{' '}
        <Text style={styles.bold}>{diaFirma}</Text> días del mes de <Text style={styles.bold}>{mesFirma}</Text> de{' '}
        <Text style={styles.bold}>{anioFirma}</Text>.
      </Text>

      <View style={styles.signatureSection}>
        <View style={styles.signatureBox}>
          <Text style={[styles.bold, styles.signatureLine]}>POR LA ENTIDAD DE TRABAJO</Text>
          <View style={styles.signUnderline} />
          <Text style={[styles.bold, styles.signatureLine]}>REPRESENTANTE LEGAL</Text>
          <Text style={[styles.bold, styles.signatureLine]}>NOMBRE:</Text>
          <Text style={styles.signatureLine}>{rep}</Text>
          <Text style={styles.signatureLine}>C.I. {repCedulaGuion}</Text>
        </View>
        <View style={styles.signatureBox}>
          <Text style={[styles.bold, styles.signatureLine]}>POR EL TRABAJADOR</Text>
          <View style={styles.signUnderline} />
          <Text style={[styles.bold, styles.signatureLine]}>NOMBRE:</Text>
          <Text style={styles.signatureLine}>{nombreTrabajador}</Text>
          <Text style={styles.signatureLine}>C.I. {cedulaTrabGuion}</Text>
          <Text style={[styles.signatureLine, { fontSize: 8, marginTop: 2 }]}>(Huella Dactilar)</Text>
        </View>
      </View>
    </>
  );

  return (
    <Document>
      <Page size="LETTER" style={[styles.page, styles.pageFirst]}>
        {bloquePortadaIntro}
        {bloqueClausulasPrimeraACuarta}
      </Page>
      <Page size="LETTER" style={styles.page}>
        {bloqueClausulasQuintaANovenaYFirmas}
      </Page>
    </Document>
  );
}
