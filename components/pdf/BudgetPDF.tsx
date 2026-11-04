import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { PRESUPUESTO_BRAND, textoMetodosPago } from '@/lib/presupuesto/brand';
import type { BudgetPdfData } from '@/lib/presupuesto/pdfDatos';
import {
  etiquetaIva,
  formatearBsPresupuesto,
  formatearUsdPresupuesto,
} from '@/lib/presupuesto/iva';

export type { BudgetPdfData, BudgetPdfItem } from '@/lib/presupuesto/pdfDatos';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1C1C1E',
  },
  sidebar: {
    width: 200,
    backgroundColor: '#ECECF1',
    padding: 20,
    height: '100%',
  },
  main: {
    flex: 1,
    padding: 40,
  },
  logoContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 10,
  },
  companyName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111111',
  },
  companySub: {
    fontSize: 7,
    color: '#0088CC',
    fontWeight: 'bold',
    marginTop: 2,
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#D4D4D8',
    paddingBottom: 2,
    marginTop: 20,
  },
  infoText: {
    fontSize: 9,
    color: '#18181B',
    marginBottom: 2,
  },
  infoLabel: {
    fontSize: 8,
    color: '#52525B',
    marginBottom: 1,
  },
  totalPagar: {
    marginTop: 'auto',
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 10,
    color: '#52525B',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F4F4F5',
    padding: 8,
    borderRadius: 2,
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F4F4F5',
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'flex-start',
  },
  colDesc: { flex: 1 },
  colPrice: { width: 60, textAlign: 'right' },
  colQty: { width: 40, textAlign: 'right' },
  colTotal: { width: 60, textAlign: 'right' },
  itemTitle: { fontSize: 9, fontWeight: 'bold', color: '#18181B' },
  itemDesc: { fontSize: 7, color: '#71717A', marginTop: 2 },
  itemDisc: { fontSize: 7, color: '#C2410C', marginTop: 1 },
  totalsSection: {
    alignSelf: 'flex-end',
    width: 200,
    marginTop: 20,
    marginBottom: 40,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    marginTop: 4,
  },
  footer: {
    marginTop: 'auto',
  },
  thanks: {
    fontSize: 14,
    color: '#A1A1AA',
    marginBottom: 10,
  },
  thanksBlue: {
    color: '#00AEEF',
  },
  termsTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  termsText: {
    fontSize: 8,
    color: '#71717A',
    lineHeight: 1.4,
  },
  refBs: {
    fontSize: 7,
    color: '#71717A',
    marginTop: 6,
    textAlign: 'right',
  },
});

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function numeroDoc(numero: string): string {
  const t = String(numero ?? '').trim();
  if (!t) return 'P-—';
  return /^p-/i.test(t) ? t : `P-${t}`;
}

export const BudgetPDF = ({ data }: { data: BudgetPdfData }) => {
  const nro = numeroDoc(data.numero);
  const logoOk = Boolean(data.logoSrc && /^https?:\/\//i.test(data.logoSrc));
  return (
    <Document title={`Presupuesto ${nro}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.sidebar}>
          <View style={styles.logoContainer}>
            {logoOk ? <Image src={data.logoSrc as string} style={styles.logo} /> : null}
            <Text style={styles.companyName}>CASA INTELIGENTE</Text>
            <Text style={styles.companySub}>TECNOLOGÍA Y SEGURIDAD</Text>
          </View>

          <View>
            <Text style={styles.sectionTitle}>Preparado para</Text>
            <Text style={styles.itemTitle}>{data.cliente || 'Cliente'}</Text>
            {data.rif ? <Text style={styles.infoLabel}>{data.rif}</Text> : null}
            {data.telefono ? <Text style={styles.infoLabel}>{data.telefono}</Text> : null}
            {data.email ? <Text style={styles.infoLabel}>{data.email}</Text> : null}
          </View>

          <View>
            <Text style={styles.sectionTitle}>Presupuesto detallado</Text>
            <Text style={styles.infoLabel}>Presupuesto Nº:</Text>
            <Text style={styles.infoText}>{nro}</Text>
            <Text style={styles.infoLabel}>Fecha:</Text>
            <Text style={styles.infoText}>{data.fecha}</Text>
          </View>

          {data.showZelle !== false && (
            <View>
              <Text style={styles.sectionTitle}>Métodos de pago</Text>
              <Text style={styles.infoLabel}>{textoMetodosPago()}</Text>
            </View>
          )}

          <View style={styles.totalPagar}>
            <Text style={styles.totalLabel}>Total a pagar</Text>
            <Text style={styles.totalAmount}>USD {formatearUsdPresupuesto(data.totalConIva)}</Text>
          </View>

          <View>
            <Text style={styles.sectionTitle}>Oficina</Text>
            <Text style={styles.infoLabel}>Isla de Margarita, Venezuela</Text>
            <Text style={styles.infoLabel}>RIF {PRESUPUESTO_BRAND.rifEmpresa}</Text>
          </View>
        </View>

        <View style={styles.main}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colDesc, { fontWeight: 'bold' }]}>Descripción</Text>
            <Text style={[styles.colPrice, { fontWeight: 'bold' }]}>P. unit.</Text>
            <Text style={[styles.colQty, { fontWeight: 'bold' }]}>Cant.</Text>
            <Text style={[styles.colTotal, { fontWeight: 'bold' }]}>Total</Text>
          </View>

          {data.items.map((item, idx) => (
            <View key={idx} style={styles.tableRow}>
              <View style={styles.colDesc}>
                <Text style={styles.itemTitle}>{item.nombre}</Text>
                {item.descripcion ? <Text style={styles.itemDesc}>{item.descripcion}</Text> : null}
                {item.discount > 0 ? (
                  <Text style={styles.itemDisc}>Desc. {item.discount}%</Text>
                ) : null}
              </View>
              <Text style={styles.colPrice}>${fmt(item.unitPrice)}</Text>
              <Text style={styles.colQty}>{item.qty}</Text>
              <Text style={[styles.colTotal, { fontWeight: 'bold' }]}>${fmt(item.lineTotal)}</Text>
            </View>
          ))}

          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text style={styles.infoLabel}>Subtotal</Text>
              <Text style={styles.itemTitle}>${fmt(data.subtotal)}</Text>
            </View>
            {data.descuentoTotal > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.infoLabel}>Descuentos</Text>
                <Text style={styles.itemTitle}>-${fmt(data.descuentoTotal)}</Text>
              </View>
            ) : null}
            <View style={styles.totalRow}>
              <Text style={styles.infoLabel}>{etiquetaIva(data.ivaPct)}</Text>
              <Text style={styles.itemTitle}>${fmt(data.ivaMonto)}</Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={{ fontWeight: 'bold', fontSize: 11 }}>TOTAL CON IVA</Text>
              <Text style={{ fontWeight: 'bold', fontSize: 11 }}>${fmt(data.totalConIva)}</Text>
            </View>
            {data.totalBs != null && data.tasaBcv ? (
              <Text style={styles.refBs}>
                Referencial: {formatearBsPresupuesto(data.totalBs)} · BCV {fmt(data.tasaBcv)} Bs/USD
                {data.tasaBcvFecha ? ` · ${data.tasaBcvFecha}` : ''}
              </Text>
            ) : null}
          </View>

          <View style={styles.footer}>
            <Text style={styles.thanks}>
              Gracias {'\n'}
              <Text style={styles.thanksBlue}>por preferirnos</Text>
            </Text>
            <Text style={styles.termsTitle}>Términos y condiciones</Text>
            <Text style={styles.termsText}>
              {data.notas
                ? data.notas
                : PRESUPUESTO_BRAND.condicionesDefault.replace(/\s+/g, ' ').trim()}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
