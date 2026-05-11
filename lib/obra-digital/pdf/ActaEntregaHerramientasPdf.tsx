import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  h1: { fontSize: 14, marginBottom: 10 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: 4, marginTop: 8 },
  cell: { flex: 1 },
  row: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#ccc' },
});

export type ActaToolRow = { toolName: string; serialNumber: string; status: string };

export type ActaEntregaProps = {
  workerName: string;
  workerCi: string;
  oficio: string;
  tools: ActaToolRow[];
  generatedAt: string;
};

export function ActaEntregaHerramientasPdfDocument(props: ActaEntregaProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Acta de entrega de herramientas y equipos</Text>
        <Text style={{ marginBottom: 8 }}>
          Yo, <Text style={{ fontWeight: 'bold' }}>{props.workerName}</Text>, titular de la cédula de identidad Nº{' '}
          <Text style={{ fontWeight: 'bold' }}>{props.workerCi}</Text>, con oficio de <Text style={{ fontWeight: 'bold' }}>{props.oficio}</Text>, recibo en custodia los bienes detallados, obligándome a su devolución en buen estado salvo desgaste natural por el uso en obra.
        </Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.cell, { fontWeight: 'bold' }]}>Herramienta</Text>
          <Text style={[styles.cell, { fontWeight: 'bold' }]}>Serial</Text>
          <Text style={[styles.cell, { fontWeight: 'bold' }]}>Estado</Text>
        </View>
        {props.tools.length === 0 ? (
          <Text style={{ marginTop: 8, color: '#666' }}>Sin herramientas en custodia registradas.</Text>
        ) : (
          props.tools.map((t, i) => (
            <View key={i} style={styles.row} wrap={false}>
              <Text style={styles.cell}>{t.toolName}</Text>
              <Text style={styles.cell}>{t.serialNumber}</Text>
              <Text style={styles.cell}>{t.status}</Text>
            </View>
          ))
        )}
        <View style={{ marginTop: 32 }}>
          <Text>______________________________</Text>
          <Text>Firma del trabajador</Text>
          <Text style={{ marginTop: 12 }}>______________________________</Text>
          <Text>Huella dactilar</Text>
        </View>
        <Text style={{ marginTop: 20, fontSize: 8, color: '#444' }}>Generado: {props.generatedAt}</Text>
      </Page>
    </Document>
  );
}
