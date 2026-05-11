import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { fechaLargaRegistroMercantilContratoVe } from '@/lib/talento/registroMercantilCamposPdf';
import { razonSocialPatronoParaContratoPdf } from '@/lib/talento/razonSocialContratoPdf';
import { textoTrasLaPalabraOficinaDe } from '@/lib/talento/textoOficinaRegistroMercantil';
import { textoPuntoEncuentroTransporteClausulaSex } from '@/lib/talento/puntoEncuentroTransporteClausulaSex';

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
  signatureSection: { flexDirection: 'row', marginTop: 16, justifyContent: 'space-between' },
  signatureBox: { width: '40%', borderTopWidth: 1, borderColor: '#000', paddingTop: 6, textAlign: 'center', lineHeight: 1.28 },
  signatureLine: { marginBottom: 2, lineHeight: 1.25, fontSize: 9.5 },
  meta: { fontSize: 8.5, marginBottom: 10, textAlign: 'center', color: '#333', lineHeight: 1.25 },
  metaFirst: { marginBottom: 4 },
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

/** Texto de la fase técnica para la cláusula primera (prioriza objeto del contrato). Sin corchetes en PDF: solo oficio o texto útil. */
function faseTecnicaParaClausulaPrimera(
  contrato: ContratoObreroDetallePdf | null | undefined,
  empleado: EmpleadoContratoPdf,
  configNomina: ConfigNominaContratoPdf,
): string {
  const obj = (contrato?.objeto_contrato ?? '').trim();
  if (obj) return obj;
  const tareas = (empleado.tareas_especificas ?? '').trim();
  const lugar = (contrato?.lugar_prestacion_servicio ?? '').trim();
  const cargo = (empleado.cargo_nombre ?? '').trim();
  const cargoUp = cargo ? cargo.toUpperCase() : '';

  if (tareas && lugar && !esLugarPrestacionPlaceholder(lugar)) {
    const tNorm = tareas.toUpperCase();
    return tNorm === cargoUp ? `${cargoUp} (${lugar})` : `${tareas} (${lugar})`;
  }
  if (tareas) {
    const tNorm = tareas.toUpperCase();
    if (cargoUp && (tNorm === cargoUp || tNorm.replace(/\s+/g, '') === cargoUp.replace(/\s+/g, ''))) return cargoUp;
    return tareas.toUpperCase();
  }
  if (lugar && !esLugarPrestacionPlaceholder(lugar)) return `las labores contratadas en el ámbito de ${lugar}`;
  const funciones = (configNomina.funciones_oficiales ?? '').trim();
  if (funciones && cargo) return `${funciones}, en el cargo de ${cargo}`;
  if (cargo) return cargoUp;
  return '[PARTIDA / fase técnica — completar]';
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
  const partidaFase = faseTecnicaParaClausulaPrimera(contrato ?? null, empleado, configNomina);
  const oficioStr = (() => {
    const c = (empleado.cargo_nombre ?? '').trim();
    return c ? c.toUpperCase() : '[OFICIO]';
  })();
  const fechaCierreIso = parametros.fechaFirmaContratoIso ?? parametros.fechaIngreso;
  const { dia: diaFirma, mes: mesFirma, anio: anioFirma } = partesFechaCierreFirma(fechaCierreIso);
  /** Equivalente USD semanal (tabulador: mes÷4); si no hay dato, guión del modelo para completar a mano. */
  const ingresoSemanalUsdTxt = str(parametros.ingresoSemanalConsolidadoUsdTexto, '$_____');
  const textoPuntoTransporteSex = textoPuntoEncuentroTransporteClausulaSex(parametros.textoPuntoEncuentroTransporteSex);
  const rep = limpiarNombreRepresentanteLegal(
    str(entidad.rep_legal_nombre ?? entidad.representante_legal, '[REPRESENTANTE]'),
  );
  const repCedulaFormato = formatCedulaIdentidad(entidad.rep_legal_cedula);
  /** Tras «Oficina de »: «Registro Mercantil Segundo de la Circunscripción Judicial…» (`registro_mercantil.circunscripcion`). */
  const oficinaRmContrato = textoTrasLaPalabraOficinaDe(
    str(
      entidad.rm_oficina,
      '',
    ),
  );
  const rmFecha = str(fechaLargaRegistroMercantilContratoVe(entidad.rm_fecha), '[FECHA NO REGISTRADA]');
  const rmNumero = str(entidad.rm_numero, '[N° NO REGISTRADO]');
  const rmTomo = str(entidad.rm_tomo, '[TOMO NO REGISTRADO]');
  const rifEntidad = str(entidad.rif, '_____________');
  const cargoRepresentacion = str(entidad.rep_legal_cargo, 'Presidente');
  const bloqueIntroClausulas = (
    <>
      <Text style={[styles.header, styles.headerFirst]}>CONTRATO INDIVIDUAL DE TRABAJO</Text>
      {expedienteId?.trim() ? (
        <Text style={[styles.meta, styles.metaFirst]}>Expediente: {expedienteId.trim()}</Text>
      ) : null}

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        Entre, la sociedad mercantil <Text style={styles.bold}>“{nombreLegalSociedad}”</Text>, inscrita por ante la Oficina de{' '}
        <Text style={styles.bold}>{oficinaRmContrato}</Text>, constando en el Tomo <Text style={styles.bold}>{rmTomo}</Text>, bajo el Nº{' '}
        <Text style={styles.bold}>{rmNumero}</Text>, de fecha <Text style={styles.bold}>{rmFecha}</Text>, de los Libros de Registro de Comercio, inscrita en el
        Registro de Información Fiscal bajo el número: <Text style={styles.bold}>{rifEntidad}</Text>, representada en este acto por su{' '}
        <Text style={styles.bold}>{cargoRepresentacion}</Text>, ciudadano <Text style={styles.bold}>"{rep}"</Text>, venezolano, mayor de edad, titular de la
        Cédula de Identidad No <Text style={styles.bold}>{repCedulaFormato}</Text>, quien en lo sucesivo y a los solos efectos del presente contrato se
        denominará EL EMPLEADOR, por una parte y por la otra, el ciudadano <Text style={styles.bold}>"{nombreTrabajador}"</Text>, quien es de nacionalidad{' '}
        <Text style={styles.bold}>{nacionalidadTrab}</Text>, mayor de edad, titular de la Cédula de Identidad{' '}
        <Text style={styles.bold}>{cedulaTrabFormato}</Text> y domiciliado en <Text style={styles.bold}>"{domicilioTrab}"</Text>, quien a los mismos efectos se
        denominará EL TRABAJADOR; y en virtud de la naturaleza del servicio que prestará EL TRABAJADOR y conforme al carácter especialísimo de la naturaleza de los servicios a
        desempeñarse por parte de él, se ha convenido en celebrar el presente contrato laboral, el cual se regirá por las cláusulas siguientes:
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>PRIMERA (OBJETO Y DELIMITACIÓN DE FUNCIONES)</Text>
        {'\n'}
        Este contrato se celebra bajo la modalidad de <Text style={styles.bold}>OBRA DETERMINADA</Text>
        {' (Arts. 75 y 77, literal "a" de la LOTTT) '}para la ejecución exclusiva de la fase técnica:{' '}
        <Text style={styles.bold}>{partidaFase}</Text>. La categoría de <Text style={styles.bold}>{oficioStr}</Text> se asigna
        únicamente para la escala del Tabulador de la Construcción, limitando las funciones del TRABAJADOR estrictamente a la
        meta física antes descrita en esta cláusula.
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>SEGUNDA (DURACIÓN Y TERMINACIÓN DE LA RELACIÓN)</Text>
        {'\n'}
        {`La relación de trabajo tiene una duración sujeta exclusivamente a la culminación física de la fase técnica descrita en la Cláusula Primera. El vínculo se extinguirá de pleno derecho y sin necesidad de preaviso (Art. 75 LOTTT) una vez firmada el Acta de Culminación en el Libro de Obra por el Supervisor. Las partes aclaran que la terminación es independiente de la entrega formal del inmueble al propietario del proyecto, y que cualquier labor sucesiva requerirá obligatoriamente un nuevo contrato escrito.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>TERCERA (JORNADA, HORARIO Y TIEMPO DE DESCANSO EFECTIVO)</Text>
        {'\n'}
        {`La jornada semanal de trabajo será de cuarenta (40) horas de trabajo efectivo, distribuidas de la siguiente manera:`}
        {'\n'}
        {`De lunes a jueves: De 7:00 a.m. a 5:00 p.m., disponiendo EL TRABAJADOR de un tiempo de descanso y alimentación de una (1) hora diaria no imputable a la jornada (de 12:00 p.m. a 1:00 p.m.), para un total de nueve (9) horas diarias de trabajo efectivo.`}
        {'\n'}
        {`Los viernes: De 7:00 a.m. a 11:00 a.m. continuas, equivalentes a cuatro (4) horas de trabajo efectivo.`}
        {'\n'}
        {`EL TRABAJADOR se obliga a mantener el rendimiento pactado en el cronograma y a firmar diariamente su avance en el Libro de Obra. El retraso injustificado o la negativa a registrar su firma constituirá falta grave a sus obligaciones (Art. 102, literal "i" de la LOTTT).`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>CUARTA (REMUNERACIÓN CONSOLIDADA Y EXCLUSIÓN SALARIAL)</Text>
        {'\n'}
        Las partes acuerdan libremente, por convenimiento individual, expreso y de mutuo acuerdo, que EL TRABAJADOR percibirá un ingreso semanal consolidado equivalente en Bolívares a{' '}
        <Text style={styles.bold}>{ingresoSemanalUsdTxt}</Text>
        {`, el cual se calculará y pagará estrictamente a la tasa oficial del Banco Central de Venezuela (BCV) vigente para el día del pago efectivo. A los solos efectos legales, este ingreso semanal consolidado se desglosará de la siguiente manera: a) Un salario semanal, el cual constituirá el salario normal de la relación de trabajo y la base única para el cálculo de sus prestaciones sociales; y b) El pago de la alícuota semanal correspondiente al Cestaticket Socialista de Ley (conforme a la Gaceta Oficial Extraordinaria N° 6.746). Con fundamento en el artículo 133, parágrafo tercero de la LOTTT, EL TRABAJADOR acepta expresamente que cualquier cantidad de dinero o beneficio adicional que reciba de EL PATRONO por encima de los dos conceptos antes desglosados (sea por rendimiento, asistencia, incentivos de obra o ajustes extraordinarios por devaluación), carece de carácter salarial. En consecuencia, las partes pactan su exclusión de la base de cálculo de prestaciones sociales y demás conceptos laborales.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>QUINTA (ANTICIPOS MENSUALES Y LIQUIDACIÓN PREVENTIVA)</Text>
        {'\n'}
        {`De conformidad con el artículo 144 de la LOTTT y en ejecución del acuerdo individual alcanzado, EL PATRONO pagará una (1) semana de salario básico correspondiente al adelanto de prestaciones sociales acumulados para los fines de ley de salud, educación o vivienda y otros conceptos laborales.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>SEXTA (TRANSPORTE GRATUITO - BENEFICIO NO REMUNERATIVO)</Text>
        {'\n'}
        Con el único propósito de facilitar la asistencia y resguardar la seguridad de EL TRABAJADOR, EL PATRONO brindará de
        manera gratuita un servicio de transporte diario, de ida y vuelta, desde el punto de encuentro{' '}
        <Text style={styles.bold}>{textoPuntoTransporteSex}</Text>
        {` hasta el sitio donde se ejecute la obra determinada. De conformidad con el artículo 105 de la LOTTT, las partes acuerdan expresamente que este servicio de transporte constituye un beneficio social de carácter no remunerativo, por lo que no forma parte del salario, no tiene carácter salarial en especie, ni se considerará para el cálculo de ningún pasivo o derecho laboral.`}
      </Text>
    </>
  );

  const bloqueClausulasSeptimaANovena = (
    <>
      <Text style={styles.paragraph}>
        <Text style={styles.bold}>SÉPTIMA (SEGURIDAD Y CONFIDENCIALIDAD)</Text>
        {'\n'}
        {`EL TRABAJADOR se obliga al cumplimiento estricto de las normas de la LOPCYMAT y al uso permanente de los equipos de protección personal (EPP) asignados. Su negativa injustificada a usarlos se considerará falta grave y causal de despido justificado (Art. 102 LOTTT). Asimismo, se obliga a mantener absoluta reserva y confidencialidad sobre planos, contraseñas, configuraciones de red y datos de seguridad de los clientes de EL PATRONO; su divulgación o uso no autorizado causará despido justificado y acciones legales correspondientes.`}
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>OCTAVA (DESPIDO JUSTIFICADO Y EXENCIÓN DE INDEMNIZACIÓN)</Text>
        {'\n'}
        {`En el eventual caso de que EL TRABAJADOR sea despedido por causas justificadas, conforme al artículo 102 de la Ley Orgánica del Trabajo o al Reglamento de la misma Ley, por incumplimiento de este contrato laboral, por incumplimiento del Reglamento Interno de la empresa, si lo hubiere, o a los instructivos internos emanados de la misma, poniéndosele fin al presente contrato laboral, LA EMPRESA estará exenta de pagar cantidad alguna de dinero como compensación o indemnización hasta el vencimiento del término natural de este contrato.`}
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>NOVENA (DOMICILIO Y JURISDICCIÓN)</Text>
        {'\n'}
        {`Para todos los efectos derivados de este contrato, las partes eligen como domicilio especial, único y excluyente a la ciudad de Pampatar, Estado Nueva Esparta, a la jurisdicción de cuyos tribunales del trabajo declaran expresamente someterse.`}
        {'\n'}
        Se firman dos (2) ejemplares de un mismo tenor y a un solo efecto en la ciudad de Pampatar, a los{' '}
        <Text style={styles.bold}>{diaFirma}</Text> días del mes de <Text style={styles.bold}>{mesFirma}</Text> de{' '}
        <Text style={styles.bold}>{anioFirma}</Text>.
      </Text>

      <View style={styles.signatureSection}>
        <View style={styles.signatureBox}>
          <Text style={[styles.bold, styles.signatureLine]}>POR EL EMPLEADOR</Text>
          <Text style={styles.signatureLine}>{rep}</Text>
          <Text style={styles.signatureLine}>{nombreLegalSociedad}</Text>
        </View>
        <View style={styles.signatureBox}>
          <Text style={[styles.bold, styles.signatureLine]}>EL TRABAJADOR</Text>
          <Text style={styles.signatureLine}>{nombreTrabajador}</Text>
          <Text style={styles.signatureLine}>C.I: {cedulaTrabFormato}</Text>
        </View>
      </View>
    </>
  );

  return (
    <Document>
      <Page size="LETTER" style={[styles.page, styles.pageFirst]}>
        {bloqueIntroClausulas}
      </Page>
      <Page size="LETTER" style={styles.page}>
        {bloqueClausulasSeptimaANovena}
      </Page>
    </Document>
  );
}
