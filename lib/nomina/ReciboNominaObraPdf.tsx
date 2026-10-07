import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ResultadoSemanaObra } from '@/lib/nomina/calcularSemanaObra';
import { REFERENCIA_ACTA_HOMOLOGACION } from '@/lib/nomina/reglasPagoObra';

export type MetaReciboNomina = {
  cara: 'legal' | 'patio' | 'adelanto';
  empresa: string;
  obra: string;
  trabajadorNombre: string;
  trabajadorCedula: string;
  semanaInicio: string;
  semanaFin: string;
  solicitudTexto?: string;
  firmanteNombre?: string;
};

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Times-Roman', fontSize: 11, color: '#111' },
  h1: { fontFamily: 'Times-Bold', fontSize: 14, textAlign: 'center', marginBottom: 6 },
  h2: { fontFamily: 'Times-Bold', fontSize: 11, textAlign: 'center', marginBottom: 12 },
  meta: { fontSize: 10, marginBottom: 3, lineHeight: 1.4 },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
    paddingVertical: 5,
  },
  colConc: { width: '58%' },
  colUsd: { width: '20%', textAlign: 'right' },
  colVes: { width: '22%', textAlign: 'right' },
  head: { fontFamily: 'Times-Bold', fontSize: 9, textTransform: 'uppercase', marginTop: 10 },
  total: { fontFamily: 'Times-Bold', marginTop: 8, fontSize: 11 },
  nota: { marginTop: 10, fontSize: 8, lineHeight: 1.35, color: '#333' },
  firma: { marginTop: 28, flexDirection: 'row', justifyContent: 'space-between' },
  cajaFirma: { width: '45%', textAlign: 'center', fontSize: 9 },
  linea: { marginTop: 36, borderTopWidth: 0.8, borderTopColor: '#000', paddingTop: 4 },
});

function fmtUsd(n: number) {
  return `USD ${n.toFixed(2)}`;
}
function fmtVes(n: number) {
  return `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtFecha(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function titulo(cara: MetaReciboNomina['cara']) {
  if (cara === 'legal') return 'RECIBO DE PAGO — CARA LEGAL';
  if (cara === 'patio') return 'RECIBO DE PAGO — CARA DE PATIO';
  return 'ADELANTO DE PRESTACIONES SOCIALES';
}

export function ReciboNominaObraPdf({
  meta,
  calc,
}: {
  meta: MetaReciboNomina;
  calc: ResultadoSemanaObra;
}) {
  const lineas = meta.cara === 'patio' ? calc.lineasPatio : calc.lineasLegal;
  const esAdelanto = meta.cara === 'adelanto' || calc.tipo === 'adelanto_prestaciones';

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.h1}>{meta.empresa || 'Entidad de trabajo'}</Text>
        <Text style={styles.h2}>{titulo(meta.cara)}</Text>

        <Text style={styles.meta}>Obra: {meta.obra}</Text>
        <Text style={styles.meta}>
          Trabajador: {meta.trabajadorNombre} — C.I. {meta.trabajadorCedula}
        </Text>
        <Text style={styles.meta}>
          Semana: {fmtFecha(meta.semanaInicio)} al {fmtFecha(meta.semanaFin)}
        </Text>
        <Text style={styles.meta}>
          Oficio (tabulador homologado): {calc.oficio.codigo} {calc.oficio.denominacion} ·
          diario Bs. {calc.oficio.diarioVes.toFixed(2)}
        </Text>
        <Text style={styles.meta}>
          Clase de patio: {calc.clase === 'ayudante' ? 'Ayudante (USD 90)' : 'Clasificado / de 1ra (USD 117)'}
          {calc.tipo === 'semanal'
            ? ` · Días laborados: ${calc.diasLaborados} · Días pagados (Cl. 8): ${calc.diasPagados}`
            : ' · Quinta semana (cada 4 trabajadas)'}
        </Text>
        <Text style={styles.meta}>
          Tasa BCV del pago: {calc.tasaBcvPago.toFixed(4)} Bs/USD
          {calc.tipo === 'semanal' ? ` · Anclaje cesta: ${calc.tasaAnclaCestaBcv.toFixed(4)} Bs/USD` : ''}
        </Text>

        <View style={[styles.row, styles.head]}>
          <Text style={styles.colConc}>Concepto</Text>
          <Text style={styles.colUsd}>USD</Text>
          <Text style={styles.colVes}>Bolívares</Text>
        </View>
        {lineas.map((l) => (
          <View key={l.codigo} style={styles.row}>
            <Text style={styles.colConc}>{l.concepto}</Text>
            <Text style={styles.colUsd}>{fmtUsd(l.usd)}</Text>
            <Text style={styles.colVes}>{fmtVes(l.ves)}</Text>
          </View>
        ))}
        <Text style={styles.total}>
          TOTAL A PAGAR: {fmtUsd(calc.totalUsd)}  =  {fmtVes(calc.totalVes)}
        </Text>

        {meta.cara === 'legal' && calc.tipo === 'semanal' ? (
          <Text style={styles.nota}>
            Cara legal (Cl. 46 / art. 106 LOTTT). El salario básico corresponde al tabulador del{' '}
            {REFERENCIA_ACTA_HOMOLOGACION}. La cesta ticket está incluida en el sobre de patio y no
            tiene carácter salarial (Cl. 20). Los descansos se pagan según la Cláusula 8.
            {calc.aplicaPisoLegal ? ' Este viernes rige el piso legal (tabulador + cesta) por superar el sobre pactado.' : ''}
          </Text>
        ) : null}

        {meta.cara === 'patio' ? (
          <Text style={styles.nota}>
            Cara de patio: sobre acordado con el sindicato (ayudante USD 90 / clasificado USD 117),
            cesta ticket incluida y anclada al dólar. El pago se hace en bolívares al BCV del día.
            Un solo pago; esta cara y la legal describen el mismo dinero.
          </Text>
        ) : null}

        {esAdelanto ? (
          <Text style={styles.nota}>
            Solicitud de adelanto de prestaciones sociales conforme al artículo 144 de la LOTTT.
            La cesta ticket no se duplica (ya se pagó dentro de las cuatro semanas). El saldo de
            garantía (Cl. 50) se debita por la porción de prestaciones; el resto queda a cuenta de
            beneficios convencionales.{'\n\n'}
            {meta.solicitudTexto?.trim()
              ? `Declaración: ${meta.solicitudTexto.trim()}`
              : 'El trabajador declara haber solicitado por escrito este adelanto.'}
          </Text>
        ) : null}

        <View style={styles.firma}>
          <View style={styles.cajaFirma}>
            <Text style={styles.linea}>Entidad de trabajo</Text>
          </View>
          <View style={styles.cajaFirma}>
            <Text style={styles.linea}>
              {meta.firmanteNombre || meta.trabajadorNombre}
              {'\n'}Trabajador — C.I. {meta.trabajadorCedula}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
