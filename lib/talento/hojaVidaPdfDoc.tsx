import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, color: '#0f172a' },
  h1: { fontSize: 18, marginBottom: 4, fontWeight: 700 },
  sub: { fontSize: 10, color: '#64748b', marginBottom: 16 },
  row: { flexDirection: 'row', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 6 },
  k: { width: '32%', fontWeight: 700, fontSize: 10, color: '#334155' },
  v: { flex: 1, fontSize: 10 },
  note: { marginTop: 20, fontSize: 9, color: '#64748b', lineHeight: 1.4 },
});

export type HojaDeVidaPdfData = {
  nombre: string;
  documento: string;
  telefono: string;
  rolBuscado: string;
  tallaCamisa: string;
  tallaBotas: string;
  estadoProceso: string;
  fotoCedulaUrl: string;
  emitidoEn: string;
};

export function HojaDeVidaPdfDoc({ data }: { data: HojaDeVidaPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Hoja de vida — Talento operativo</Text>
        <Text style={styles.sub}>CASA INTELIGENTE · Registro candidato obrero</Text>
        <View style={styles.row}>
          <Text style={styles.k}>Nombre</Text>
          <Text style={styles.v}>{data.nombre}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.k}>Cédula / documento</Text>
          <Text style={styles.v}>{data.documento}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.k}>Teléfono</Text>
          <Text style={styles.v}>{data.telefono}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.k}>Cargo / vacante</Text>
          <Text style={styles.v}>{data.rolBuscado}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.k}>Talla camisa</Text>
          <Text style={styles.v}>{data.tallaCamisa}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.k}>Nº botas</Text>
          <Text style={styles.v}>{data.tallaBotas}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.k}>Estado en proceso</Text>
          <Text style={styles.v}>{data.estadoProceso}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.k}>Foto cédula (URL)</Text>
          <Text style={styles.v}>{data.fotoCedulaUrl || '—'}</Text>
        </View>
        <Text style={styles.note}>
          Documento generado el {data.emitidoEn}. Datos del registro por enlace seguro. Orden del proceso: primero la
          evaluación (prueba); el contrato de trabajo no procede antes de esa evaluación y la decisión de RRHH.
        </Text>
      </Page>
    </Document>
  );
}
