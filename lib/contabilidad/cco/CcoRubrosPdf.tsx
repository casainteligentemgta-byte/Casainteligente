import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: 'Helvetica', color: '#0F172A' },
  title: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  sub: { fontSize: 10, color: '#475569', marginBottom: 14 },
  prov: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginTop: 12,
    marginBottom: 6,
    backgroundColor: '#F1F5F9',
    padding: 6,
  },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#E2E8F0', paddingVertical: 4 },
  th: { flexDirection: 'row', backgroundColor: '#E2E8F0', paddingVertical: 5, marginBottom: 2 },
  cDesc: { flex: 2.4 },
  cNum: { flex: 1, textAlign: 'right' },
  cPct: { width: 42, textAlign: 'right' },
  footer: { marginTop: 18, fontSize: 8, color: '#64748B' },
  total: { marginTop: 8, fontFamily: 'Helvetica-Bold', fontSize: 10 },
});

export type CcoRubroPdfLinea = {
  descripcion: string;
  costoTotal: number;
  pagado: number;
  saldo: number;
  pct: number;
};

export type CcoRubroPdfProveedor = {
  proveedor: string;
  lineas: CcoRubroPdfLinea[];
  totalCosto: number;
  totalPagado: number;
  totalSaldo: number;
};

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CcoRubrosPdfDocument(props: {
  obra: string;
  generadoAt: string;
  proveedores: CcoRubroPdfProveedor[];
}) {
  const granCosto = props.proveedores.reduce((a, p) => a + p.totalCosto, 0);
  const granPagado = props.proveedores.reduce((a, p) => a + p.totalPagado, 0);
  const granSaldo = props.proveedores.reduce((a, p) => a + p.totalSaldo, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>CCO · Rubros por subcontratista</Text>
        <Text style={styles.sub}>
          Obra: {props.obra} · Generado: {props.generadoAt}
        </Text>

        {props.proveedores.map((p) => (
          <View key={p.proveedor} wrap={false}>
            <Text style={styles.prov}>{p.proveedor}</Text>
            <View style={styles.th}>
              <Text style={styles.cDesc}>Contrato</Text>
              <Text style={styles.cNum}>Costo</Text>
              <Text style={styles.cNum}>Pagado</Text>
              <Text style={styles.cNum}>Saldo</Text>
              <Text style={styles.cPct}>%</Text>
            </View>
            {p.lineas.map((l, i) => (
              <View key={`${p.proveedor}-${i}`} style={styles.row}>
                <Text style={styles.cDesc}>{l.descripcion.slice(0, 55)}</Text>
                <Text style={styles.cNum}>{fmt(l.costoTotal)}</Text>
                <Text style={styles.cNum}>{fmt(l.pagado)}</Text>
                <Text style={styles.cNum}>{fmt(l.saldo)}</Text>
                <Text style={styles.cPct}>{l.pct.toFixed(0)}</Text>
              </View>
            ))}
            <Text style={styles.total}>
              Subtotal · Costo {fmt(p.totalCosto)} · Pagado {fmt(p.totalPagado)} · Saldo {fmt(p.totalSaldo)}
            </Text>
          </View>
        ))}

        <Text style={[styles.total, { marginTop: 16 }]}>
          TOTAL OBRA · Costo {fmt(granCosto)} · Pagado {fmt(granPagado)} · Saldo {fmt(granSaldo)}
        </Text>
        <Text style={styles.footer}>Casa Inteligente · Control Contable de Obra V4</Text>
      </Page>
    </Document>
  );
}
