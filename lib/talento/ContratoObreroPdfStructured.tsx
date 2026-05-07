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

export type ContratoObreroPdfStructuredProps = {
  expedienteId?: string | null;
  empleado: EmpleadoContratoPdf;
  entidad: EntidadContratoPdf;
  configNomina: ConfigNominaContratoPdf;
  parametros: ParametrosContratoPdf;
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
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
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
}: ContratoObreroPdfStructuredProps) {
  const envDom = (process.env.NEXT_PUBLIC_PATRON_DOMICILIO ?? '').trim();
  const nombreEntidad = str(entidad.nombre_legal ?? entidad.nombre, 'EL EMPLEADOR').toUpperCase();
  const domicilioEntidad = str(
    entidad.domicilio_fiscal ?? entidad.direccion_fiscal ?? envDom,
    '[domicilio fiscal por registrar]',
  );
  const nombreTrabajador = str(empleado.nombres ?? empleado.nombre_completo, 'EL TRABAJADOR');
  const nacionalidad = str(empleado.nacionalidad, 'venezolana');
  const cedula = str(empleado.cedula ?? empleado.documento, '—');
  const domicilioTrab = str(
    empleado.direccion_domicilio ?? empleado.direccion_habitacion,
    'Nueva Esparta',
  );
  const cargo = str(empleado.cargo_nombre, 'oficio contratado').toUpperCase();
  const funciones =
    str(configNomina.funciones_oficiales, '') ||
    str(empleado.tareas_especificas, '') ||
    'Las estipuladas en el tabulador de oficios vigente';
  const tipoPlazo = (parametros.tipoPlazo ?? 'DETERMINADO').toString().trim().toUpperCase() || 'DETERMINADO';
  const fechaIngreso = str(parametros.fechaIngreso, '[fecha de ingreso]');
  const rep = str(entidad.rep_legal_nombre ?? entidad.representante_legal, 'Representante legal');
  const repCedula = str(entidad.rep_legal_cedula, '[CÉDULA NO REGISTRADA]');
  const repCargo = str(entidad.rep_legal_cargo, 'Presidente');
  const rmOficina = str(entidad.rm_oficina, 'Registro Mercantil correspondiente');
  const rmFecha = str(fmtFechaLargaEs(entidad.rm_fecha), '[FECHA NO REGISTRADA]');
  const rmNumero = str(entidad.rm_numero, '[N° NO REGISTRADO]');
  const rmTomo = str(entidad.rm_tomo, '[TOMO NO REGISTRADO]');
  const salBase = fmtMonto(configNomina.salario_base_mensual);
  const cesta = fmtMonto(configNomina.cestaticket_mensual);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.header}>CONTRATO INDIVIDUAL DE TRABAJO</Text>
        {expedienteId?.trim() ? <Text style={styles.meta}>Expediente: {expedienteId.trim()}</Text> : null}

        <Text style={styles.paragraph}>
          Entre, la sociedad mercantil <Text style={styles.bold}>“{nombreEntidad}”</Text>, inscrita por ante la,{' '}
          <Text style={styles.bold}>“{rmOficina}”</Text>, en fecha <Text style={styles.bold}>“{rmFecha}”</Text>, bajo el Nº{' '}
          <Text style={styles.bold}>“{rmNumero}”</Text>, Tomo <Text style={styles.bold}>“{rmTomo}”</Text> de los Libros de
          Registro de Comercio, representada en este acto por su {repCargo}, ciudadano{' '}
          <Text style={styles.bold}>“{rep}”</Text>, {nacionalidad}, mayor de edad, titular de la Cédula de Identidad No{' '}
          <Text style={styles.bold}>“{repCedula}”</Text>, quien en lo sucesivo y a los solos efectos del presente contrato se
          denominará EL EMPLEADOR.
        </Text>
        <Text style={styles.paragraph}>
          Y por la otra, el(la) ciudadano(a) <Text style={styles.bold}>{nombreTrabajador}</Text>, de nacionalidad {nacionalidad}
          , mayor de edad, hábil en el ejercicio de sus derechos civiles, titular de la cédula de identidad N°{' '}
          <Text style={styles.bold}>{cedula}</Text>, domiciliado(a) en {domicilioTrab}. Ambas partes han convenido celebrar el
          presente contrato individual de trabajo, sujeto a las siguientes cláusulas:
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>PRIMERA: OBJETO.</Text> EL TRABAJADOR se obliga a prestar sus servicios personales en
          el cargo u oficio de <Text style={styles.bold}>{cargo}</Text>, con las funciones inherentes al mismo, tales
          como: &quot;{funciones}&quot;.
        </Text>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>SEGUNDA: TIPO Y PLAZO.</Text> Se celebra por tiempo{' '}
          <Text style={styles.bold}>{tipoPlazo}</Text>, iniciando la prestación de sus servicios a partir del{' '}
          {fechaIngreso}.
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
            <Text>{nombreEntidad}</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.bold}>EL TRABAJADOR</Text>
            <Text>{nombreTrabajador}</Text>
            <Text>C.I: {cedula}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
