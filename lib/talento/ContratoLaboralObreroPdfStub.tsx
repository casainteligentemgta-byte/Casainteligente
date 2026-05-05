import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const st = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', lineHeight: 1.35 },
  h1: { fontSize: 13, marginBottom: 10, textAlign: 'center', fontWeight: 700 },
  meta: { fontSize: 8, marginBottom: 8, color: '#475569' },
  p: { marginBottom: 4, textAlign: 'justify' },
  pie: { marginTop: 14, fontSize: 8, color: '#64748b', fontStyle: 'italic' },
});

export type ContratoLaboralObreroPdfDocumentProps = {
  expedienteId: string;
  titulo: string;
  /** Texto completo ya sustituido (puede contener marcadores [… COMPLETAR …]). */
  cuerpoTexto: string;
  pieLegal?: string | null;
};

/**
 * PDF del contrato obrero a partir de plantilla biblioteca + datos expediente.
 */
export function ContratoLaboralObreroPdfDocument(props: ContratoLaboralObreroPdfDocumentProps) {
  const { expedienteId, titulo, cuerpoTexto, pieLegal } = props;
  const bloques = (cuerpoTexto ?? '')
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={st.page} wrap>
        <Text style={st.h1}>{titulo}</Text>
        <Text style={st.meta}>
          Expediente: {expedienteId.slice(0, 8)}… · Generado desde biblioteca de documentos
        </Text>
        {bloques.length ? (
          bloques.map((b, i) => (
            <Text key={i} style={st.p}>
              {b}
            </Text>
          ))
        ) : (
          <Text style={st.p}>—</Text>
        )}
        {pieLegal ? (
          <View style={{ marginTop: 12 }}>
            <Text style={st.pie}>{pieLegal}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
