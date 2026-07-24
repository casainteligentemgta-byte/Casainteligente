import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  h1: { fontSize: 14, marginBottom: 12 },
  p: { marginBottom: 8, lineHeight: 1.4 },
});

export type CartaAnticipoProps = {
  workerName: string;
  workerCi: string;
  month: number;
  year: number;
  calculatedAccrued: string;
  maxAdvanceAllowed: string;
  generatedAt: string;
};

export function CartaSolicitudAnticipoPdfDocument(props: CartaAnticipoProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Carta de solicitud de anticipo mensual</Text>
        <Text style={styles.p}>
          Quien suscribe, <Text style={{ fontWeight: 'bold' }}>{props.workerName}</Text>, venezolano(a), titular de la
          cédula de identidad Nº <Text style={{ fontWeight: 'bold' }}>{props.workerCi}</Text>, solicita a la empresa el
          pago del anticipo correspondiente al periodo <Text style={{ fontWeight: 'bold' }}>{props.month}/{props.year}</Text>
          , conforme a la normativa laboral aplicable y al acuerdo de obra.
        </Text>
        <View style={styles.p}>
          <Text style={{ fontWeight: 'bold' }}>Conceptos (referencia contable):</Text>
          <Text>• Acumulado devengado referencial del periodo: {props.calculatedAccrued} VES</Text>
          <Text>• Máximo anticipo autorizado (75%): {props.maxAdvanceAllowed} VES</Text>
        </View>
        <Text style={styles.p}>
          El trabajador declara haber leído las condiciones y se compromete a firmar el soporte físico correspondiente
          para autorización del pago.
        </Text>
        <View style={{ marginTop: 40 }}>
          <Text>______________________________</Text>
          <Text>Firma del trabajador</Text>
          <Text style={{ marginTop: 12 }}>______________________________</Text>
          <Text>Huella dactilar</Text>
        </View>
        <Text style={{ marginTop: 24, fontSize: 8, color: '#444' }}>Generado: {props.generatedAt}</Text>
      </Page>
    </Document>
  );
}
