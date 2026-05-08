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
};

export type ParametrosContratoPdf = {
  tipoPlazo?: string | null;
  fechaIngreso?: string | null;
};

/** Datos del contrato de obra para cláusulas primera y segunda (tabla `ci_contratos_empleado_obra`). */
export type ContratoObreroDetallePdf = {
  objeto_contrato?: string | null;
  lugar_prestacion_servicio?: string | null;
  /** Sustituye el texto entre corchetes tras «suscripción del»; si falta, se usa el modelo legal por defecto. */
  documento_culminacion?: string | null;
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

const DOC_CULMINACION_DEFECTO =
  'Acta de Culminación / Visto Bueno del Ingeniero Residente / Reporte de Conformidad';

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
  if (cargo) return `las labores propias del oficio de ${cargo}`;
  return '[descripción de la fase técnica]';
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
  parametros: _parametros,
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
  const faseTecnica = faseTecnicaParaClausulaPrimera(contrato ?? null, empleado, configNomina);
  const docCulminacion = str(contrato?.documento_culminacion, DOC_CULMINACION_DEFECTO);
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
  const salBase = fmtMonto(configNomina.salario_base_mensual);
  const cesta = fmtMonto(configNomina.cestaticket_mensual);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
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
          , quien es de nacionalidad <Text style={styles.bold}>{nacionalidadTrab}</Text>, mayor de edad, titular de la Cédula
          de Identidad <Text style={styles.bold}>{cedulaTrabFormato}</Text> y domiciliado en{' '}
          <Text style={styles.bold}>"{domicilioTrab}"</Text>, quien a los mismos efectos se denominará EL TRABAJADOR; y en
          virtud de la naturaleza del servicio que prestará EL TRABAJADOR y conforme al carácter especialísimo de la naturaleza
          de los servicios a desempeñarse por parte de él, se ha convenido en celebrar el presente contrato laboral, el cual se
          regirá por las cláusulas siguientes:
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>CLÁUSULA PRIMERA (Del Objeto y Naturaleza Exclusiva):</Text> EL PATRONO contrata los
          servicios de EL TRABAJADOR para ejecutar exclusiva y excluyentemente la fase técnica correspondiente a:{' '}
          <Text style={styles.bold}>{faseTecnica}</Text>. Esta labor constituye una{' '}
          <Text style={styles.bold}>OBRA DETERMINADA</Text>, cuya naturaleza exige su culminación, de estricta conformidad
          con lo previsto en el artículo 75 y 77{' '}
          {'(literal "a")'} de la Ley Orgánica del Trabajo, los Trabajadores y las Trabajadoras (LOTTT).
          EL TRABAJADOR reconoce y acepta que su contratación se limita a esta fase técnica, prohibiéndosele ejecutar labores
          ajenas a las aquí descritas.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>CLÁUSULA SEGUNDA (De la Terminación de Pleno Derecho):</Text> El presente contrato
          finalizará de pleno derecho y cesarán las obligaciones entre las partes el día exacto en que la fase técnica
          descrita en la Cláusula Primera sea concluida. La culminación de la fase técnica se considerará materializada
          mediante la suscripción del <Text style={styles.bold}>[{docCulminacion}]</Text>. Al extinguirse la relación por
          conclusión de la obra determinada, no habrá lugar a preaviso, calificación de despido ni indemnización por despido
          injustificado (Art. 92 LOTTT), procediéndose únicamente a la liquidación de las prestaciones sociales adquiridas.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>TERCERA: JORNADA Y REMUNERACIÓN.</Text> EL TRABAJADOR cumplirá la jornada legal
          establecida. EL EMPLEADOR pagará un salario base de <Text style={styles.bold}>{salBase} VES</Text> mensuales,
          más el beneficio de Cestaticket por <Text style={styles.bold}>{cesta} VES</Text>, pagaderos de forma quincenal
          mediante transferencia bancaria.
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
      </Page>
    </Document>
  );
}
