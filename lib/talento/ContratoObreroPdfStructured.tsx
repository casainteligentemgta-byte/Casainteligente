import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 50, fontFamily: 'Helvetica', fontSize: 11, lineHeight: 1.6, color: '#000' },
  header: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 25 },
  paragraph: { marginBottom: 12, textAlign: 'justify' },
  bold: { fontWeight: 'bold' },
  signatureSection: { flexDirection: 'row', marginTop: 60, justifyContent: 'space-between' },
  signatureBox: { width: '40%', borderTopWidth: 1, borderColor: '#000', paddingTop: 10, textAlign: 'center' },
  meta: { fontSize: 9, marginBottom: 16, textAlign: 'center', color: '#333' },
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

function fmtMonto(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Salario básico diario para la cláusula cuarta: prioriza monto diario del contrato, si no mensual/30. */
function salarioDiarioParaContrato(dia: number | null | undefined, mensual: number | null | undefined): string {
  if (dia != null && Number.isFinite(Number(dia)) && Number(dia) > 0) return fmtMonto(Number(dia));
  if (mensual != null && Number.isFinite(Number(mensual)) && Number(mensual) > 0) {
    return fmtMonto(Math.round((Number(mensual) / 30) * 100) / 100);
  }
  return '[Monto]';
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

function fmtFechaLargaEs(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  if (!t) return null;
  // ISO YYYY-MM-DD (input type="date" en Configuración → Entidad): evitar desfase UTC.
  const ymd = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = ymd
    ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12, 0, 0)
    : new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
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

/** Texto de la fase técnica para la cláusula primera (prioriza objeto del contrato). */
function faseTecnicaParaClausulaPrimera(
  contrato: ContratoObreroDetallePdf | null | undefined,
  empleado: EmpleadoContratoPdf,
  configNomina: ConfigNominaContratoPdf,
): string {
  const obj = (contrato?.objeto_contrato ?? '').trim();
  if (obj) return obj;
  const tareas = (empleado.tareas_especificas ?? '').trim();
  const lugar = (contrato?.lugar_prestacion_servicio ?? '').trim();
  if (tareas && lugar) return `${tareas} (${lugar})`;
  if (tareas) return tareas;
  if (lugar) return `las labores contratadas en el ámbito de ${lugar}`;
  const funciones = (configNomina.funciones_oficiales ?? '').trim();
  const cargo = (empleado.cargo_nombre ?? '').trim();
  if (funciones && cargo) return `${funciones}, en el cargo de ${cargo}`;
  if (cargo) return cargo.toUpperCase();
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
  /** Razón social para contrato: `nombre_legal` si existe en BD, si no `nombre` (`ci_entidades`). */
  const nombreLegalSociedad = str(entidad.nombre_legal ?? entidad.nombre, '[RAZÓN SOCIAL]');
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
  const duracionSem = str(parametros.duracionSemanasReferencial, '[Semanas]');
  const horarioSem = str(parametros.horarioSemanal, '[Horario, ej: 7:00 a.m. a 4:00 p.m.]');
  const salDiarioTxt = salarioDiarioParaContrato(
    configNomina.salario_basico_diario_ves,
    configNomina.salario_base_mensual,
  );
  const categoriaTabulador = (() => {
    const g = (configNomina.funciones_oficiales ?? '').trim();
    if (g) return g;
    const c = (empleado.cargo_nombre ?? '').trim();
    return c ? c.toUpperCase() : '[Categoría]';
  })();
  const fechaCierreIso = parametros.fechaFirmaContratoIso ?? parametros.fechaIngreso;
  const { dia: diaFirma, mes: mesFirma, anio: anioFirma } = partesFechaCierreFirma(fechaCierreIso);
  const rep = limpiarNombreRepresentanteLegal(
    str(entidad.rep_legal_nombre ?? entidad.representante_legal, '[REPRESENTANTE]'),
  );
  const repCedulaFormato = formatCedulaIdentidad(entidad.rep_legal_cedula);
  /** Circunscripción / oficina RM (`registro_mercantil.circunscripcion`). */
  const rmCircunscripcion = str(entidad.rm_oficina, '[circunscripción]');
  const rmFecha = str(fmtFechaLargaEs(entidad.rm_fecha), '[FECHA NO REGISTRADA]');
  const rmNumero = str(entidad.rm_numero, '[N° NO REGISTRADO]');
  const rmTomo = str(entidad.rm_tomo, '[TOMO NO REGISTRADO]');
  const rifEntidad = str(entidad.rif, '_____________');
  const bloqueIntroClausulas = (
    <>
      <Text style={styles.header}>CONTRATO INDIVIDUAL DE TRABAJO</Text>
      {expedienteId?.trim() ? <Text style={styles.meta}>Expediente: {expedienteId.trim()}</Text> : null}

      <Text style={styles.paragraph}>
        Entre, la sociedad mercantil <Text style={styles.bold}>“{nombreLegalSociedad}”</Text>, inscrita por ante la Oficina
        de <Text style={styles.bold}>"{rmCircunscripcion}"</Text> en fecha <Text style={styles.bold}>"{rmFecha}"</Text>, bajo
        el Nº <Text style={styles.bold}>"{rmNumero}"</Text>, Tomo <Text style={styles.bold}>"{rmTomo}"</Text> de los Libros de
        Registro de Comercio, inscrita en el Registro de Información Fiscal bajo el número:{' '}
        <Text style={styles.bold}>{rifEntidad}</Text>, representada en este acto por su Presidente, ciudadano{' '}
        <Text style={styles.bold}>"{rep}"</Text>, venezolano, mayor de edad, titular de la Cédula de Identidad No{' '}
        <Text style={styles.bold}>{repCedulaFormato}</Text>, quien en lo sucesivo y a los solos efectos del presente contrato
        se denominará EL EMPLEADOR, por una parte y por la otra, el ciudadano <Text style={styles.bold}>"{nombreTrabajador}"</Text>
        , quien es de nacionalidad <Text style={styles.bold}>{nacionalidadTrab}</Text>, mayor de edad, titular de la Cédula de
        Identidad <Text style={styles.bold}>{cedulaTrabFormato}</Text> y domiciliado en{' '}
        <Text style={styles.bold}>"{domicilioTrab}"</Text>, quien a los mismos efectos se denominará EL TRABAJADOR; y en
        virtud de la naturaleza del servicio que prestará EL TRABAJADOR y conforme al carácter especialísimo de la naturaleza
        de los servicios a desempeñarse por parte de él, se ha convenido en celebrar el presente contrato laboral, el cual se
        regirá por las cláusulas siguientes:
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>PRIMERA (OBJETO Y DELIMITACIÓN DE FUNCIONES)</Text>
        {'\n'}
        Este contrato se celebra bajo la modalidad de <Text style={styles.bold}>OBRA DETERMINADA</Text>
        {' (Arts. 75 y 77, literal "a" de la LOTTT) '}para la ejecución exclusiva de la fase técnica:{' '}
        <Text style={styles.bold}>[{partidaFase}]</Text>. La categoría de <Text style={styles.bold}>{oficioStr}</Text> se
        asigna únicamente para la escala del Tabulador de la Construcción, limitando las funciones del TRABAJADOR estrictamente
        a la meta física antes descrita.
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>SEGUNDA (DURACIÓN Y TERMINACIÓN DE LA RELACIÓN)</Text>
        {'\n'}
        La relación de trabajo tiene una duración sujeta exclusivamente a la culminación física de la fase técnica descrita en
        la Cláusula Primera, estimada referencialmente en <Text style={styles.bold}>{duracionSem}</Text>. El vínculo se
        extinguirá de pleno derecho y sin necesidad de preaviso (Art. 75 LOTTT) una vez firmada el Acta de Culminación en el
        Libro de Obra por el Supervisor. Las partes aclaran que la terminación es independiente de la entrega formal del
        inmueble al propietario del proyecto, y que cualquier labor sucesiva requerirá obligatoriamente un nuevo contrato
        escrito.
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>TERCERA (JORNADA, HORARIO Y RENDIMIENTO)</Text>
        {'\n'}
        La jornada será de cuarenta (40) horas semanales de lunes a viernes, de <Text style={styles.bold}>{horarioSem}</Text>,
        con el descanso de ley. EL TRABAJADOR se obliga a mantener el rendimiento pactado en el cronograma y a firmar
        diariamente su avance en el Libro de Obra. El retraso injustificado en las metas de la partida o la negativa a
        registrar su firma constituirá falta grave a sus obligaciones{' '}
        {'(Art. 102, literal "i" de la LOTTT)'}.
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>CUARTA (REMUNERACIÓN Y EXCLUSIÓN SALARIAL)</Text>
        {'\n'}
        Se pagará el salario diario de <Text style={styles.bold}>{salDiarioTxt}</Text>
        {salDiarioTxt === '[Monto]' ? '' : ' VES'} (Tabulador de la Construcción para{' '}
        <Text style={styles.bold}>{categoriaTabulador}</Text>) más Cestaticket de ley (indexado a $40 USD según Gaceta Oficial
        Extraordinaria N° 6.746). Conforme al artículo 133, parágrafo tercero de la LOTTT, cualquier pago adicional
        (rendimiento, asistencia o ajuste por inflación) que exceda el salario básico carece de carácter salarial y no se
        computará para prestaciones ni pasivos laborales.
      </Text>
    </>
  );

  const bloqueClausulas56 = (
    <>
      <Text style={styles.paragraph}>
        <Text style={styles.bold}>QUINTA (ANTICIPOS Y LIQUIDACIÓN PREVENTIVA)</Text>
        {'\n'}
        EL EMPLEADOR registrará mensualmente la garantía de prestaciones (5 días/mes), utilidades y vacaciones. Conforme al
        artículo 144 de la LOTTT, EL TRABAJADOR podrá solicitar mensualmente, mediante escrito firmado de su puño y letra, el
        anticipo de hasta el setenta y cinco por ciento (75%) de lo acumulado para fines de vivienda, salud o educación. Estos
        anticipos se deducirán de la liquidación definitiva al terminar la obra.
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>SEXTA (CUSTODIA Y RESPONSABILIDAD DE ACTIVOS)</Text>
        {'\n'}
        EL TRABAJADOR recibe las herramientas y materiales bajo inventario firmado y asume su custodia. En caso de pérdida o
        daño por negligencia, autoriza expresamente a descontar su valor de reposición de sus pagos semanales o de su
        liquidación (Art. 165 LOTTT). La devolución de los equipos al finalizar la obra es condición obligatoria para el pago
        del finiquito.
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>SÉPTIMA (SEGURIDAD Y CONFIDENCIALIDAD)</Text>
        {'\n'}
        EL TRABAJADOR se obliga al cumplimiento estricto de las normas de la LOPCYMAT y al uso permanente de los equipos de
        protección personal (EPP) asignados. Su negativa injustificada a usarlos se considerará falta grave y causal de despido
        justificado (Art. 102 LOTTT). Asimismo, se obliga a mantener absoluta reserva y confidencialidad sobre planos,
        contraseñas, configuraciones de red y datos de seguridad de los clientes de EL EMPLEADOR; su divulgación o uso no
        autorizado causará despido justificado y acciones legales correspondientes.
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>OCTAVA (DOMICILIO Y JURISDICCIÓN)</Text>
        {'\n'}
        Para todos los efectos derivados de este contrato, las partes eligen como domicilio especial, único y excluyente a la
        ciudad de Pampatar, Estado Nueva Esparta, a la jurisdicción de cuyos tribunales del trabajo declaran expresamente
        someterse.
      </Text>

      <Text style={styles.paragraph}>
        Se firman dos (2) ejemplares de un mismo tenor y a un solo efecto en la ciudad de Pampatar, a los{' '}
        <Text style={styles.bold}>{diaFirma}</Text> días del mes de <Text style={styles.bold}>{mesFirma}</Text> de{' '}
        <Text style={styles.bold}>{anioFirma}</Text>.
      </Text>

      <View style={styles.signatureSection}>
        <View style={styles.signatureBox}>
          <Text style={styles.bold}>POR EL EMPLEADOR</Text>
          <Text>{rep}</Text>
          <Text>{nombreLegalSociedad}</Text>
        </View>
        <View style={styles.signatureBox}>
          <Text style={styles.bold}>EL TRABAJADOR</Text>
          <Text>{nombreTrabajador}</Text>
          <Text>C.I: {cedulaTrabFormato}</Text>
        </View>
      </View>
    </>
  );

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {bloqueIntroClausulas}
      </Page>
      <Page size="LETTER" style={styles.page}>
        {bloqueClausulas56}
      </Page>
    </Document>
  );
}
