import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  h1: { fontSize: 14, marginBottom: 8 },
  p: { marginBottom: 6, lineHeight: 1.35 },
  table: { marginTop: 12, borderWidth: 1, borderColor: '#333' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#444' },
  cell: { flex: 1, padding: 6 },
  th: { fontWeight: 'bold', backgroundColor: '#eee' },
});

export type LibroObraSemanalProps = {
  workerName: string;
  workerCi: string;
  oficio: string;
  month: number;
  year: number;
  weekOfMonth: number;
  luloPartidaMeta: string;
  generatedAt: string;
};

export function LibroObraSemanalPdfDocument(props: LibroObraSemanalProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Libro de obra semanal (registro)</Text>
        <Text style={styles.p}>
          Trabajador: <Text style={{ fontWeight: 'bold' }}>{props.workerName}</Text> — CI{' '}
          <Text style={{ fontWeight: 'bold' }}>{props.workerCi}</Text> — Oficio: {props.oficio}
        </Text>
        <Text style={styles.p}>
          Periodo: semana {props.weekOfMonth} de {props.month}/{props.year} — Meta / partida: {props.luloPartidaMeta}
        </Text>
        <Text style={[styles.p, { fontSize: 8, color: '#555' }]}>
          Imprimir, completar en obra, firmar y sellar con huella; luego escanear y cargar en el expediente digital como
          LIBRO_OBRA_SEMANAL.
        </Text>
        <View style={styles.table}>
          <View style={[styles.row, styles.th]}>
            <Text style={styles.cell}>Día</Text>
            <Text style={styles.cell}>Actividad / ubicación</Text>
            <Text style={styles.cell}>Avance / observación</Text>
          </View>
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d) => (
            <View key={d} style={styles.row}>
              <Text style={styles.cell}>{d}</Text>
              <Text style={styles.cell}> </Text>
              <Text style={styles.cell}> </Text>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 36 }}>
          <Text>______________________________</Text>
          <Text>Firma del trabajador</Text>
          <Text style={{ marginTop: 12 }}>______________________________</Text>
          <Text>Huella dactilar</Text>
          <Text style={{ marginTop: 16 }}>______________________________</Text>
          <Text>Firma supervisor de obra</Text>
        </View>
        <Text style={{ marginTop: 20, fontSize: 8, color: '#444' }}>Generado: {props.generatedAt}</Text>
      </Page>
    </Document>
  );
}
