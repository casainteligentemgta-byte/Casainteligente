import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const st = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  h1: { fontSize: 14, marginBottom: 12, textAlign: 'center' },
  p: { marginBottom: 6, lineHeight: 1.4 },
  box: { borderWidth: 1, borderColor: '#94a3b8', padding: 8, marginTop: 12 },
});

export type ContratoLaboralObreroPdfStubProps = {
  contratoId: string;
  nombreEmpleado: string;
  documento: string;
  textoLegalResumen: string;
  notaPlantilla: string;
};

/**
 * PDF provisional hasta que se integre la plantilla legal definitiva (Gaceta / LOTTT).
 */
export function ContratoLaboralObreroPdfDocument(props: ContratoLaboralObreroPdfStubProps) {
  const { contratoId, nombreEmpleado, documento, textoLegalResumen, notaPlantilla } = props;
  const preview = textoLegalResumen.length > 2800 ? `${textoLegalResumen.slice(0, 2800)}…` : textoLegalResumen;

  return (
    <Document>
      <Page size="A4" style={st.page}>
        <Text style={st.h1}>CONTRATO DE TRABAJO (BORRADOR / PREVISUALIZACIÓN)</Text>
        <Text style={st.p}>
          Expediente contrato: <Text style={{ fontWeight: 700 }}>{contratoId}</Text>
        </Text>
        <Text style={st.p}>
          Trabajador: {nombreEmpleado} — Documento: {documento || '—'}
        </Text>
        <View style={st.box}>
          <Text style={{ ...st.p, fontWeight: 700 }}>Texto legal (extracto del registro)</Text>
          <Text style={{ ...st.p, fontSize: 8 }}>{preview}</Text>
        </View>
        <View style={{ marginTop: 20 }}>
          <Text style={{ ...st.p, fontSize: 9, color: '#475569' }}>{notaPlantilla}</Text>
        </View>
      </Page>
    </Document>
  );
}
