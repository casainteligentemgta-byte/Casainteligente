import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ResumenSolicitadosPayload } from '@/lib/rrhh/loadResumenSolicitadosOficios';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#111' },
  h1: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  sub: { fontSize: 9, color: '#555', marginBottom: 16, lineHeight: 1.4 },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 4,
    marginBottom: 4,
    fontWeight: 'bold',
    fontSize: 8,
    textTransform: 'uppercase',
    color: '#444',
  },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#eee', paddingVertical: 6 },
  colOficio: { width: '58%' },
  colNum: { width: '21%', textAlign: 'right' },
  colSol: { width: '21%', textAlign: 'right' },
  nombreOficio: { fontSize: 8, color: '#666', marginTop: 2 },
  totals: { marginTop: 14, fontSize: 9 },
  footer: { position: 'absolute', bottom: 28, left: 40, right: 40, fontSize: 8, color: '#888', textAlign: 'center' },
});

function fmtFecha(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-VE', { dateStyle: 'long', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function ResumenSolicitadosOficiosPdf(payload: ResumenSolicitadosPayload) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.h1}>Resumen por oficio — personal solicitado</Text>
        <Text style={styles.sub}>
          {payload.alcanceNombre}
          {'\n'}
          Generado: {fmtFecha(payload.generadoAt)} · {payload.totalPlazas} plaza(s) ·{' '}
          {payload.solicitudesPendientes} solicitud(es) pendiente(s)
        </Text>

        <View style={styles.tableHeader}>
          <Text style={styles.colOficio}>Oficio (tabulador GOE)</Text>
          <Text style={styles.colNum}>Plazas</Text>
          <Text style={styles.colSol}>Solicitudes</Text>
        </View>

        {payload.filas.length === 0 ? (
          <Text style={{ fontSize: 9, color: '#666' }}>Sin solicitudes pendientes en este alcance.</Text>
        ) : (
          payload.filas.map((row) => (
            <View key={row.codigo} style={styles.row}>
              <View style={styles.colOficio}>
                <Text style={{ fontWeight: 'bold' }}>{row.codigo}</Text>
                {row.nombre ? <Text style={styles.nombreOficio}>{row.nombre}</Text> : null}
              </View>
              <Text style={styles.colNum}>{String(row.plazas)}</Text>
              <Text style={styles.colSol}>{String(row.solicitudes)}</Text>
            </View>
          ))
        )}

        <Text style={styles.totals}>
          Total plazas: {payload.totalPlazas} · Oficios distintos: {payload.filas.length}
        </Text>

        <Text style={styles.footer} fixed>
          Casa Inteligente — RRHH / Gestión de personal
        </Text>
      </Page>
    </Document>
  );
}
