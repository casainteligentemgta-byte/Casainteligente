import { Document, Page, StyleSheet, Text, View, Image } from '@react-pdf/renderer';
import type { DatosCarnetDigital } from '@/lib/rrhh/carnetDigital';
import { etiquetaVigenciaCarnet } from '@/lib/rrhh/carnetDigital';

/** Tamaño aproximado ISO ID-1 en puntos (85.6 × 53.98 mm). */
const W = 243;
const H = 153;

const styles = StyleSheet.create({
  page: {
    width: W,
    height: H,
    backgroundColor: '#0a0a0b',
    color: '#f4f4f5',
    padding: 10,
    fontFamily: 'Helvetica',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { fontSize: 7, color: '#fcd34d', textTransform: 'uppercase', letterSpacing: 1.2 },
  title: { fontSize: 11, fontWeight: 700, marginTop: 2, color: '#fff' },
  code: {
    fontSize: 8,
    fontFamily: 'Courier',
    color: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b66',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  body: { flexDirection: 'row', marginTop: 8, gap: 8 },
  foto: { width: 52, height: 66, borderColor: '#3f3f46', objectFit: 'cover' },
  fotoBox: {
    width: 52,
    height: 66,
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#52525b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: { fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 2 },
  line: { fontSize: 8, color: '#d4d4d8', marginBottom: 1 },
  muted: { fontSize: 7, color: '#a1a1aa' },
  foot: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#ffffff22',
    paddingTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export function CarnetDigitalPdfDocument({ datos }: { datos: DatosCarnetDigital }) {
  return (
    <Document title={`Carnet ${datos.codigo}`} author="Casa Inteligente RRHH">
      <Page size={{ width: W, height: H }} style={styles.page}>
        <View style={styles.row}>
          <View>
            <Text style={styles.brand}>Casa Inteligente</Text>
            <Text style={styles.title}>Carnet de obra</Text>
          </View>
          <Text style={styles.code}>{datos.codigo}</Text>
        </View>
        <View style={styles.body}>
          {datos.fotoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image
            <Image src={datos.fotoUrl} style={styles.foto} />
          ) : (
            <View style={styles.fotoBox}>
              <Text style={styles.muted}>Sin foto</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{datos.nombre}</Text>
            <Text style={styles.line}>C.I. {datos.cedula || '—'}</Text>
            <Text style={styles.line}>{datos.oficio || '—'}</Text>
            {datos.obraNombre ? <Text style={styles.muted}>Obra: {datos.obraNombre}</Text> : null}
            {datos.entidadNombre ? <Text style={styles.muted}>{datos.entidadNombre}</Text> : null}
          </View>
        </View>
        <View style={styles.foot}>
          <View>
            <Text style={styles.muted}>{etiquetaVigenciaCarnet(datos.vigenteHasta)}</Text>
            {datos.sangre ? <Text style={styles.muted}>Sangre: {datos.sangre}</Text> : null}
          </View>
          <Text style={styles.muted}>
            {new Date(datos.emitidoAt).toLocaleDateString('es-VE')}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
