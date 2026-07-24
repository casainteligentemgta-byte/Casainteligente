import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  h1: { fontSize: 16, marginBottom: 12 },
  row: { marginBottom: 6 },
  label: { fontWeight: 'bold' },
});

export type FichaLaboralProps = {
  workerName: string;
  workerCi: string;
  oficio: string;
  salaryPerDay: string;
  luloPartidaMeta: string;
  contractStatus: string;
  generatedAt: string;
};

export function FichaLaboralObraDigitalPdfDocument(props: FichaLaboralProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Ficha laboral — Expediente de obra digital (LOTTT)</Text>
        <View style={styles.row}>
          <Text>
            <Text style={styles.label}>Trabajador: </Text>
            {props.workerName}
          </Text>
        </View>
        <View style={styles.row}>
          <Text>
            <Text style={styles.label}>Cédula: </Text>
            {props.workerCi}
          </Text>
        </View>
        <View style={styles.row}>
          <Text>
            <Text style={styles.label}>Oficio: </Text>
            {props.oficio}
          </Text>
        </View>
        <View style={styles.row}>
          <Text>
            <Text style={styles.label}>Salario básico diario (VES): </Text>
            {props.salaryPerDay}
          </Text>
        </View>
        <View style={styles.row}>
          <Text>
            <Text style={styles.label}>Meta / partida (LULO): </Text>
            {props.luloPartidaMeta}
          </Text>
        </View>
        <View style={styles.row}>
          <Text>
            <Text style={styles.label}>Estado del contrato: </Text>
            {props.contractStatus}
          </Text>
        </View>
        <View style={[styles.row, { marginTop: 16 }]}>
          <Text style={{ fontSize: 8, color: '#444' }}>
            Documento generado el {props.generatedAt}. Debe acompañarse de soportes escaneados con firma y huella donde
            corresponda.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
