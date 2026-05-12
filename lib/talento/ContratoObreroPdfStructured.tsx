import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { fechaLargaRegistroMercantilContratoVe } from '@/lib/talento/registroMercantilCamposPdf';
import { razonSocialPatronoParaContratoPdf } from '@/lib/talento/razonSocialContratoPdf';
import { textoTrasLaPalabraOficinaDe } from '@/lib/talento/textoOficinaRegistroMercantil';
import { formatearUsdContratoPdf } from '@/lib/talento/ingresoSemanalUsdTabuladorConstruccion';
import { TASA_BCV_VES_POR_USD_TABULADOR_2023_06_20 } from '@/lib/nomina/tabuladorSalariosConstruccion2023';

/** Carta US Letter (~792 pt alto); márgenes e interlineado ajustados para encajar el contrato en 2 páginas. */
const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 34,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: '#000',
  },
  /** Primera página: menos aire arriba y entre bloques (comparecencia + PRIMERA–TERCERA). */
  pageFirst: {
    paddingTop: 16,
    paddingBottom: 28,
  },
  header: {
    fontSize: 11.5,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 1.18,
  },
  headerFirst: {
    fontSize: 11,
    marginBottom: 5,
  },
  paragraph: { marginBottom: 6, textAlign: 'justify', lineHeight: 1.28, fontSize: 9.5 },
  paragraphIntro: { marginBottom: 3.5, lineHeight: 1.22 },
  bold: { fontWeight: 'bold' },
  signatureSection: { flexDirection: 'row', marginTop: 14, justifyContent: 'space-between' },
  signatureBox: { width: '48%', borderTopWidth: 1, borderColor: '#000', paddingTop: 6, textAlign: 'center', lineHeight: 1.28 },
  signatureLine: { marginBottom: 2, lineHeight: 1.25, fontSize: 9.5 },
  meta: { fontSize: 8.5, marginBottom: 10, textAlign: 'center', color: '#333', lineHeight: 1.25 },
  metaFirst: { marginBottom: 4 },
  /** Cláusula PRIMERA densa (cabida en carta). */
  clauseDense: { fontSize: 8.6, lineHeight: 1.22, textAlign: 'justify' },
});

export type EntidadContratoPdf = {
  nombre_legal?: string | null;
  nombre?: string | null;
  /** RIF del patrono (`ci_entidades.rif`). */
  rif?: string | null;
  domicilio_fiscal?: string | null;
  direccion_fiscal?: string | null;
  representante_legal?: string | null;
  rep_legal_nombre?: string | null;
  rep_legal_cedula?: string | null;
  rep_legal_cargo?: string | null;
  /** Valor de `registro_mercantil.circunscripcion` (se imprime tras «Oficina de »). */
  rm_oficina?: string | null;
  rm_fecha?: string | null;
  rm_numero?: string | null;
  rm_tomo?: string | null;
};

export type EmpleadoContratoPdf = {
  nombres?: string | null;
  nombre_completo?: string | null;
  nacionalidad?: string | null;
  cedula?: string | null;
  documento?: string | null;
  direccion_domicilio?: string | null;
  direccion_habitacion?: string | null;
  cargo_nombre?: string | null;
  tareas_especificas?: string | null;
};

export type ConfigNominaContratoPdf = {
  funciones_oficiales?: string | null;
  salario_base_mensual?: number | null;
  cestaticket_mensual?: number | null;
  /** Desde `ci_contratos_empleado_obra.salario_basico_diario_ves` cuando existe. */
  salario_basico_diario_ves?: number | null;
};

export type ParametrosContratoPdf = {
  tipoPlazo?: string | null;
  fechaIngreso?: string | null;
  /** Duración referencial (p. ej. «12 semanas»); si falta se imprime el placeholder del modelo. */
  duracionSemanasReferencial?: string | null;
  /** Horario pactado (p. ej. «7:00 a.m. a 4:00 p.m.»). */
  horarioSemanal?: string | null;
  /** Fecha de firma de ejemplares (ISO); si falta se usan placeholders [Día] / [Mes] y año 2026. */
  fechaFirmaContratoIso?: string | null;
  /** Asamblea de voluntad para remuneración consolidada (ISO `YYYY-MM-DD`). */
  fechaAsambleaVoluntadIso?: string | null;
  /** Texto ya formateado, p. ej. «$50,00» para el equivalente USD del ingreso semanal consolidado. */
  ingresoSemanalConsolidadoUsdTexto?: string | null;
  /**
   * Tras «desde el punto de encuentro» en SEXTA (hasta «hasta el sitio…»).
   * Viene de `ci_proyectos.punto_encuentro_transporte_contrato` con fallback al texto histórico.
   */
  textoPuntoEncuentroTransporteSex?: string | null;
  /** USD por mes o fracción en cláusula SEXTA (compensación por culminación); por defecto 100. */
  compensacionCulminacionUsdPorMes?: number | null;
};

/** Datos del contrato de obra para partida / lugar (tabla `ci_contratos_empleado_obra`). */
export type ContratoObreroDetallePdf = {
  objeto_contrato?: string | null;
  lugar_prestacion_servicio?: string | null;
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

/** Día, mes y año en español para el cierre de firma; si no hay fecha ISO válida, placeholders del modelo. */
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
  return { dia: '[Día]', mes: '[Mes]', anio: '2026' };
}

/**
 * Cédula de identidad para el cuerpo del contrato: letra V o E seguida de dígitos, sin guión
 * (p. ej. `V1384818688`), alineado al estilo de actas laborales venezolanas.
 */
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

const PLACEHOLDER_LINEA = '_____________';

/** Lugar de prestación genérico (obra aún sin nombre): no debe imprimirse entre paréntesis en la cláusula primera. */
function esLugarPrestacionPlaceholder(l: string): boolean {
  const t = l.trim().toLowerCase();
  if (!t) return true;
  if (t === 'por definir' || t === 'por definir.' || t === 'sin definir' || t === 'sin especificar') return true;
  if (t === 'tbd' || t === '—' || t === '-' || t === 'n/a') return true;
  return false;
}

function obraDenominadaClausulaTexto(contrato: ContratoObreroDetallePdf | null | undefined): string {
  const l = (contrato?.lugar_prestacion_servicio ?? '').trim();
  if (l.length && !esLugarPrestacionPlaceholder(l)) return l;
  return '________________________________________________________________';
}

function lugarSedeObraClausulaTexto(contrato: ContratoObreroDetallePdf | null | undefined): string {
  const l = (contrato?.lugar_prestacion_servicio ?? '').trim();
  if (l.length && !esLugarPrestacionPlaceholder(l)) return l;
  return '___________________________________________________________________________';
}

function fmtBsVes(n: number): string {
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/** RIF en formato J-XXXXXXXX (contrato). */
function rifPatronoDisplay(rif: string): string {
  const t = (rif ?? '').trim().toUpperCase();
  if (!t || t === '_____________') return 'J-_____________';
  if (/^J[-\s]/.test(t)) return t.replace(/\s+/g, '');
  return `J-${t.replace(/^J/, '').replace(/^[-\s]+/, '')}`;
}

function fmtUsdNumeroPlano(n: number): string {
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/** Evita dígitos de cédula u otros pegados al final del nombre por error de captura (ej. "Ortiz88"). */
function limpiarNombreRepresentanteLegal(n: string): string {
  let t = n.trim().replace(/\s+/g, ' ');
  if (!t) return t;
  // Sufijo numérico largo (cédula sin separador)
  t = t.replace(/\s*\d{7,}\s*$/, '').trim();
  // Dos o más dígitos pegados directamente a una letra al final (ej. …Ortiz88)
  t = t.replace(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])(\d{2,})$/, '$1').trim();
  return t;
}

/**
 * PDF estructurado del contrato obrero (cláusulas fijas + datos de entidad, empleado y nómina).
 * Alternativa a {@link ContratoLaboralObreroPdfDocument} cuando el cuerpo no viene de plantilla Markdown.
 */
export function ContratoObreroPDF({
  expedienteId,
  empleado,
  entidad,
  configNomina,
  parametros,
  contrato,
}: ContratoObreroPdfStructuredProps) {
  /** Razón social: `nombre_legal` → `nombre`; si no hay C.A./S.A./etc., se añade «, C.A.» (patrón legal VE). */
  const nombreLegalSociedad = str(
    razonSocialPatronoParaContratoPdf(entidad.nombre_legal, entidad.nombre),
    '[RAZÓN SOCIAL]',
  );
  const nombreTrabajador = str(empleado.nombres ?? empleado.nombre_completo, '[nombre trabajador]');
  const nacionalidadTrab = str(empleado.nacionalidad, PLACEHOLDER_LINEA);
  const cedulaTrabFormato = formatCedulaIdentidad(empleado.cedula ?? empleado.documento);
  const domicilioTrab = str(
    empleado.direccion_domicilio ?? empleado.direccion_habitacion,
    'dirección domicilio',
  );
  const obraDenomTxt = obraDenominadaClausulaTexto(contrato ?? null);
  const lugarSedeTxt = lugarSedeObraClausulaTexto(contrato ?? null);
  const oficioStr = (() => {
    const c = (empleado.cargo_nombre ?? '').trim();
    return c ? c.toUpperCase() : '[OFICIO]';
  })();
  const fechaCierreIso = parametros.fechaFirmaContratoIso ?? parametros.fechaIngreso;
  const { dia: diaFirma, mes: mesFirma, anio: anioFirma } = partesFechaCierreFirma(fechaCierreIso);
  /** Equivalente USD semanal (tabulador: mes÷4); si no hay dato, guión del modelo para completar a mano. */
  const ingresoSemanalUsdTxt = str(parametros.ingresoSemanalConsolidadoUsdTexto, '$_____');
  const sbDia = configNomina.salario_basico_diario_ves;
  const tieneSb =
    sbDia != null && Number.isFinite(Number(sbDia)) && Number(sbDia) > 0 ? Number(sbDia) : null;
  const salSemBs = tieneSb != null ? Math.round(tieneSb * (30 / 4) * 100) / 100 : null;
  const salDiarioTxt = tieneSb != null ? fmtBsVes(tieneSb) : '__________________';
  const salSemTxt = salSemBs != null ? fmtBsVes(salSemBs) : '__________________';
  const cestaMen = configNomina.cestaticket_mensual;
  const cestaSemUsdNum =
    cestaMen != null &&
    Number.isFinite(Number(cestaMen)) &&
    Number(cestaMen) > 0 &&
    TASA_BCV_VES_POR_USD_TABULADOR_2023_06_20 > 0
      ? Number(cestaMen) / 4 / TASA_BCV_VES_POR_USD_TABULADOR_2023_06_20
      : null;
  const cestaUsdTxt =
    cestaSemUsdNum != null && Number.isFinite(cestaSemUsdNum)
      ? formatearUsdContratoPdf(Math.round(cestaSemUsdNum * 100) / 100)
      : '__________';
  const rep = limpiarNombreRepresentanteLegal(
    str(entidad.rep_legal_nombre ?? entidad.representante_legal, '[REPRESENTANTE]'),
  );
  const repCedulaFormato = formatCedulaIdentidad(entidad.rep_legal_cedula);
  /** Tras «Oficina de »: «Registro Mercantil Segundo de la Circunscripción Judicial…» (`registro_mercantil.circunscripcion`). */
  /** Línea «Registro Mercantil … Estado Nueva Esparta» para la comparecencia (tras «Oficina de »). */
  const oficinaRmContrato = textoTrasLaPalabraOficinaDe(
    str(
      entidad.rm_oficina,
      '',
    ),
  );
  const rmFecha = str(fechaLargaRegistroMercantilContratoVe(entidad.rm_fecha), '[FECHA NO REGISTRADA]');
  const rmNumero = str(entidad.rm_numero, '[N° NO REGISTRADO]');
  const rmTomo = str(entidad.rm_tomo, '[TOMO NO REGISTRADO]');
  const rifEntidadLinea = rifPatronoDisplay(str(entidad.rif, ''));
  const cargoRepresentacion = str(entidad.rep_legal_cargo, 'Presidente');
  const compUsdMes =
    parametros.compensacionCulminacionUsdPorMes != null &&
    Number.isFinite(Number(parametros.compensacionCulminacionUsdPorMes)) &&
    Number(parametros.compensacionCulminacionUsdPorMes) > 0
      ? Number(parametros.compensacionCulminacionUsdPorMes)
      : 100;
  const compUsdMesTxt = fmtUsdNumeroPlano(compUsdMes);

  const bloquePortadaIntro = (
    <>
      <Text style={[styles.header, styles.headerFirst]}>CONTRATO INDIVIDUAL DE TRABAJO</Text>
      {expedienteId?.trim() ? (
        <Text style={[styles.meta, styles.metaFirst]}>Expediente: {expedienteId.trim()}</Text>
      ) : null}

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        Entre, la sociedad mercantil <Text style={styles.bold}>“{nombreLegalSociedad}”</Text>, inscrita por ante la{' '}
        <Text style={styles.bold}>
          Oficina de {oficinaRmContrato}
        </Text>
        , constando en el Tomo <Text style={styles.bold}>{rmTomo}</Text>, bajo el Nº{' '}
        <Text style={styles.bold}>{rmNumero}</Text>, de fecha <Text style={styles.bold}>{rmFecha}</Text>, de los Libros de Registro de Comercio, inscrita en el
        Registro de Información Fiscal bajo el número: <Text style={styles.bold}>{rifEntidadLinea}</Text>, representada en este acto por su{' '}
        <Text style={styles.bold}>{cargoRepresentacion}</Text>, ciudadano <Text style={styles.bold}>"{rep}"</Text>, venezolano, mayor de edad, titular de la
        Cédula de Identidad No <Text style={styles.bold}>{repCedulaFormato}</Text>, quien en lo sucesivo y a los solos efectos del presente contrato se
        denominará <Text style={styles.bold}>EL EMPLEADOR</Text>, por una parte y por la otra, el ciudadano <Text style={styles.bold}>"{nombreTrabajador}"</Text>, quien es de nacionalidad <Text style={styles.bold}>{nacionalidadTrab}</Text>, mayor de edad, titular de la Cédula de Identidad{' '}
        <Text style={styles.bold}>{cedulaTrabFormato}</Text> y domiciliado en <Text style={styles.bold}>"{domicilioTrab}"</Text>, quien a los mismos efectos se
        denominará EL TRABAJADOR; y en virtud de la naturaleza del servicio que prestará EL TRABAJADOR y conforme al carácter especialísimo de la naturaleza de
        los servicios a desempeñarse por parte de él, se ha convenido en celebrar el presente contrato laboral, el cual se regirá por las cláusulas siguientes:
      </Text>
    </>
  );

  const bloqueClausulasPrimeraATercera = (
    <>
      <Text style={[styles.paragraph, styles.paragraphIntro, styles.clauseDense]}>
        <Text style={styles.bold}>PRIMERA: LA ENTIDAD DE TRABAJO</Text>
        {` tiene como objeto, todo lo relacionado con la explotación de actividades comerciales y de la industria de la construcción. La naturaleza de este contrato por obra determinada es para la obra `}
        <Text style={styles.bold}>{obraDenomTxt}</Text>
        {`, y a tales efectos contrata a "EL TRABAJADOR", para que preste sus servicios como `}
        <Text style={styles.bold}>{oficioStr}</Text>
        {` quien como tal, deberá ejecutar las actividades inherentes al cargo para el cual fue contratado; así como cualquier otra actividad que sea asignada dentro de la totalidad de la obra proyectada, cargo éste que se encuentra establecido en el Tabulador de Oficios y Salarios Básicos de la Convención Colectiva de Trabajo de la Industria de la Construcción vigente. EL TRABAJADOR: a) Se compromete a poner al servicio de La Entidad de Trabajo su capacidad normal de trabajo, en forma exclusiva en las funciones propias del cargo contratado y en las labores anexas complementarias del mismo, de conformidad con las órdenes e instrucciones que le imparta La Entidad de Trabajo o sus representantes; b) No prestar directa o indirectamente, servicios laborales a otros empleadores, ni a trabajar por cuenta propia en las funciones inherentes al cargo.`}
        {'\n\n'}
        <Text style={styles.bold}>IDENTIFICACIÓN DEL CARGO:</Text>
        {` EL TRABAJADOR, se compromete a prestar sus servicios a LA ENTIDAD DE TRABAJO, desempeñando el cargo de `}
        <Text style={styles.bold}>{oficioStr}</Text>
        {`. El trabajador, se obliga a realizar las funciones y/o responsabilidades inherentes al cargo, que consisten en realizar las siguientes tareas o actividades laborales:`}
        {'\n\n'}
        {`Cumplir con el horario de trabajo previamente establecido por la entidad de trabajo.`}
        {'\n\n'}
        {`Usar el uniforme, los equipos y accesorios de seguridad, tales como: Guantes, lentes de seguridad, impermeables, botas de goma y/o cualesquiera otra que le exija utilizar la entidad de trabajo, en razón de preservar la salud y seguridad del trabajador.`}
        {'\n\n'}
        {`Debe recibir, procesar y pesar la materia prima.`}
        {'\n\n'}
        {`Mantener ordenada y limpia el área de trabajo que le ha sido asignada.`}
        {'\n\n'}
        {`Cuidar y mantener en buenas condiciones de uso e higiene las maquinarias y las herramientas de trabajo.`}
        {'\n\n'}
        {`Llevar a cabo cualquier otra actividad que le sea ordenada por LA ENTIDAD DE TRABAJO, siempre que esta tarea, esté acorde con sus funciones y no contraríe lo dispuesto en la normativa de la ley vigente LOTTT y la contratación colectiva de la construcción.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>SEGUNDA: (DURACIÓN Y TERMINACIÓN)</Text>
        {'\n'}
        {`La relación de trabajo tiene una duración sujeta exclusivamente a la culminación física de la fase técnica descrita en la Cláusula Primera. El vínculo se extinguirá de pleno derecho y sin necesidad de preaviso (Art. 75 LOTTT) una vez firmada el Acta de Culminación en el Libro de Obra por el Supervisor. Las partes aclaran que la terminación es independiente de la entrega formal del inmueble al propietario.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>TERCERA: (JORNADA, HORARIO Y RENDIMIENTO)</Text>
        {'\n'}
        {`La jornada semanal será de cuarenta (40) horas de trabajo efectivo, distribuidas así: Lunes a Jueves: De 7:00 a.m. a 5:00 p.m. (Con 1 hora de descanso no imputable de 12:00 p.m. a 1:00 p.m.), para 9 horas diarias efectivas. Viernes: De 7:00 a.m. a 11:00 a.m. (Jornada continua de 4 horas efectivas).`}
        {'\n'}
        <Text style={styles.bold}>CONTROL:</Text>
        {` EL TRABAJADOR se obliga a mantener el rendimiento según cronograma y a firmar diariamente su registro de avance en el Libro de Obra. La negativa a firmar constituirá falta grave (Art. 102, literal "i" LOTTT).`}
      </Text>
    </>
  );

  const bloqueClausulasCuartaAOctavaYFirmas = (
    <>
      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>CUARTA: (LUGAR DE TRABAJO Y DIRECCIÓN)</Text>
        {'\n'}
        {'Los servicios se prestarán en la sede de la obra ubicada en: '}
        <Text style={styles.bold}>{lugarSedeTxt}</Text>
        {'. '}
        {'\n'}
        {`LA ENTIDAD DE TRABAJO podrá ejercer su facultad de dirección y exigir el fiel cumplimiento de las metas físicas; dichas exigencias no se considerarán acoso laboral por estar dentro de los límites de la jornada y la ley.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>QUINTA: (INGRESO INTEGRAL INDEXADO)</Text>
        {'\n'}
        {`EL TRABAJADOR devengará los siguientes conceptos pagaderos en Bolívares (Bs.): `}
        {'\n'}
        Salario Diario (Tabulador): Bs. <Text style={styles.bold}>{salDiarioTxt}</Text>
        {'\n'}
        Salario Semanal (Tabulador): Bs. <Text style={styles.bold}>{salSemTxt}</Text>
        {'\n'}
        Bono Alimentación (Cesta Ticket): Equivalente semanal a <Text style={styles.bold}>{cestaUsdTxt}</Text>.
        {'\n'}
        {`Bono Especial de Complemento: De carácter NO SALARIAL (Art. 105 LOTTT), para elevar el Ingreso Familiar Semanal a un total equivalente a: `}
        <Text style={styles.bold}>{ingresoSemanalUsdTxt}</Text>
        {'.'}
        {'\n'}
        {`Todos los pagos se realizarán en Bolívares calculados a la tasa oficial del Banco Central de Venezuela (BCV) del día del pago.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>SEXTA: (COMPENSACIÓN POR CULMINACIÓN)</Text>
        {'\n'}
        <Text style={styles.bold}>PARÁGRAFO ÚNICO:</Text>
        {` Al cierre de la obra o finiquito, el trabajador recibirá una compensación equivalente a: `}
        <Text style={styles.bold}>{compUsdMesTxt}</Text>
        {` USD (pagaderos en Bs. al cambio BCV) por cada mes trabajado o fracción. Este monto liquida de forma integral: prestaciones sociales, vacaciones, utilidades y cualquier otro beneficio derivado de este contrato especial.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>SÉPTIMA: (SEGURIDAD, SALUD Y CONFIDENCIALIDAD)</Text>
        {'\n'}
        {`EL TRABAJADOR declara haber sido notificado de los riesgos de su puesto y se compromete a cumplir con la LOPCYMAT. Asimismo, conviene guardar estricta confidencialidad sobre cualquier información interna de LA ENTIDAD DE TRABAJO.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>OCTAVA: (DOMICILIO Y JURISDICCIÓN)</Text>
        {'\n'}
        {`Para todos los efectos derivados de este contrato, las partes eligen como domicilio especial, único y excluyente a la ciudad de Pampatar, Estado Nueva Esparta, sometiéndose a sus tribunales del trabajo.`}
        {'\n'}
        Se firman dos (2) ejemplares de un mismo tenor y a un solo efecto en la ciudad de Pampatar, a los{' '}
        <Text style={styles.bold}>{diaFirma}</Text> días del mes de <Text style={styles.bold}>{mesFirma}</Text> de{' '}
        <Text style={styles.bold}>{anioFirma}</Text>.
      </Text>

      <View style={styles.signatureSection}>
        <View style={styles.signatureBox}>
          <Text style={[styles.bold, styles.signatureLine]}>POR LA ENTIDAD DE TRABAJO</Text>
          <Text style={[styles.bold, styles.signatureLine]}>REPRESENTANTE LEGAL</Text>
          <Text style={[styles.bold, styles.signatureLine]}>NOMBRE:</Text>
          <Text style={styles.signatureLine}>{rep}</Text>
          <Text style={styles.signatureLine}>C.I. {repCedulaFormato}</Text>
        </View>
        <View style={styles.signatureBox}>
          <Text style={[styles.bold, styles.signatureLine]}>POR EL TRABAJADOR</Text>
          <Text style={[styles.bold, styles.signatureLine]}>NOMBRE:</Text>
          <Text style={styles.signatureLine}>{nombreTrabajador}</Text>
          <Text style={styles.signatureLine}>C.I. {cedulaTrabFormato}</Text>
          <Text style={[styles.signatureLine, { fontSize: 8, marginTop: 4 }]}>(Huella Dactilar)</Text>
        </View>
      </View>
    </>
  );

  return (
    <Document>
      <Page size="LETTER" style={[styles.page, styles.pageFirst]}>
        {bloquePortadaIntro}
        {bloqueClausulasPrimeraATercera}
      </Page>
      <Page size="LETTER" style={styles.page}>
        {bloqueClausulasCuartaAOctavaYFirmas}
      </Page>
    </Document>
  );
}
