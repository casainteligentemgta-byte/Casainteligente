import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Register fonts if needed
// Font.register({ family: 'Inter', src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2' });

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
        textAlign: 'center',
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
        alignItems: 'center',
    },
    colDesc: { flex: 1 },
    colPrice: { width: 60, textAlign: 'right' },
    colQty: { width: 40, textAlign: 'right' },
    colTotal: { width: 60, textAlign: 'right' },
    itemTitle: { fontSize: 9, fontWeight: 'bold', color: '#18181B' },
    itemCat: { fontSize: 7, color: '#A1A1AA' },
    itemImage: { width: 20, height: 20, marginRight: 8, borderRadius: 2 },
    totalsSection: {
        alignSelf: 'flex-end',
        width: 180,
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
    }
});

interface PreviewItem {
    nombre: string;
    categoria: string | null;
    qty: number;
    unitPrice: number;
    discount: number;
    costo: number | null;
    image_url?: string | null;
}

interface BudgetData {
    cliente: string;
    rif: string;
    notas: string;
    items: PreviewItem[];
    subtotal: number;
    totalCost: number;
    totalProfit: number;
    marginPct: number;
    showZelle: boolean;
    fecha: string;
    numero: string;
    telefono?: string;
    email?: string;
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const lineTotal = (item: PreviewItem) => item.unitPrice * (1 - item.discount / 100) * item.qty;

export const BudgetPDF = ({ data }: { data: BudgetData }) => (
    <Document title={`Presupuesto PR-${data.numero}`}>
        <Page size="A4" style={styles.page}>
            {/* Sidebar */}
            <View style={styles.sidebar}>
                <View style={styles.logoContainer}>
                    {/* Note: In PDF, local paths or base64 are needed for images. 
                        /logo-original.jpg might not work if not absolute or if dev server is tricky.
                        We'll try the full URL if possible or just assume it works in the target env. */}
                    <Image src="/logo-original.jpg" style={styles.logo} />
                    <Text style={styles.companyName}>CASA INTELIGENTE</Text>
                    <Text style={styles.companySub}>TECNOLOGÍA Y SEGURIDAD</Text>
                </View>

                <View>
                    <Text style={styles.sectionTitle}>Preparado para</Text>
                    <Text style={styles.itemTitle}>{data.cliente}</Text>
                    {data.rif ? <Text style={styles.infoLabel}>{data.rif}</Text> : null}
                    {data.telefono ? <Text style={styles.infoLabel}>{data.telefono}</Text> : null}
                    {data.email ? <Text style={styles.infoLabel}>{data.email}</Text> : null}
                </View>

                <View>
                    <Text style={styles.sectionTitle}>Presupuesto Detallado</Text>
                    <Text style={styles.infoLabel}>Presupuesto Nº:</Text>
                    <Text style={styles.infoText}>PR-{data.numero}</Text>
                    <Text style={styles.infoLabel}>Fecha:</Text>
                    <Text style={styles.infoText}>{data.fecha}</Text>
                </View>

                {data.showZelle !== false && (
                    <View>
                        <Text style={styles.sectionTitle}>Métodos de Pago</Text>
                        <Text style={styles.itemTitle}>Zelle:</Text>
                        <Text style={styles.infoLabel}>casainteligentemgta@gmail.com</Text>
                        <Text style={styles.itemTitle}>Banesco:</Text>
                        <Text style={styles.infoLabel}>Cta. Corriente Nº 01340563388563303880</Text>
                        <Text style={styles.infoLabel}>Luis Vicente Mata</Text>
                        <Text style={styles.infoLabel}>C.I. V-13848186</Text>
                    </View>
                )}

                <View style={styles.totalPagar}>
                    <Text style={styles.totalLabel}>Total Pagar</Text>
                    <Text style={styles.totalAmount}>USD: ${fmt(data.subtotal)}</Text>
                </View>

                <View>
                    <Text style={styles.sectionTitle}>Oficina</Text>
                    <Text style={styles.infoLabel}>Isla de Margarita, Venezuela</Text>
                    <Text style={styles.infoLabel}>RIF J-407035258</Text>
                </View>
            </View>

            {/* Main Content */}
            <View style={styles.main}>
                <View style={styles.tableHeader}>
                    <Text style={[styles.colDesc, { fontWeight: 'bold' }]}>Descripciones</Text>
                    <Text style={[styles.colPrice, { fontWeight: 'bold' }]}>Precio Unit.</Text>
                    <Text style={[styles.colQty, { fontWeight: 'bold' }]}>Cant.</Text>
                    <Text style={[styles.colTotal, { fontWeight: 'bold' }]}>Total</Text>
                </View>

                {data.items.map((item, idx) => (
                    <View key={idx} style={styles.tableRow}>
                        <View style={[styles.colDesc, { flexDirection: 'row', alignItems: 'center' }]}>
                            {item.image_url ? <Image src={item.image_url} style={styles.itemImage} /> : null}
                            <View>
                                <Text style={styles.itemTitle}>
                                    {item.nombre.charAt(0).toUpperCase() + item.nombre.slice(1).toLowerCase()}
                                </Text>
                                {item.categoria ? <Text style={styles.itemCat}>{item.categoria}</Text> : null}
                            </View>
                        </View>
                        <Text style={styles.colPrice}>${fmt(item.unitPrice)}</Text>
                        <Text style={styles.colQty}>{item.qty}</Text>
                        <Text style={[styles.colTotal, { fontWeight: 'bold' }]}>${fmt(lineTotal(item))}</Text>
                    </View>
                ))}

                <View style={styles.totalsSection}>
                    <View style={styles.totalRow}>
                        <Text style={styles.infoLabel}>Sub Total</Text>
                        <Text style={styles.itemTitle}>${fmt(data.subtotal)}</Text>
                    </View>
                    <View style={styles.totalRow}>
                        <Text style={styles.infoLabel}>Impuestos (Exento)</Text>
                        <Text style={styles.itemTitle}>$0.00</Text>
                    </View>
                    <View style={styles.grandTotalRow}>
                        <Text style={{ fontWeight: 'bold', fontSize: 11 }}>GRAN TOTAL</Text>
                        <Text style={{ fontWeight: 'bold', fontSize: 11 }}>${fmt(data.subtotal)}</Text>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.thanks}>Gracias {'\n'}<Text style={styles.thanksBlue}>Por Preferirnos !</Text></Text>
                    <Text style={styles.termsTitle}>Términos & Condiciones</Text>
                    <Text style={styles.termsText}>
                        {data.notas ? data.notas : 'Los precios descritos tienen vigencia de 3 días hábiles. Requerido anticipo del 80% para iniciar, saldo contra valuaciones. Materiales e insumos sujetos a disponibilidad en inventario.'}
                    </Text>
                </View>
            </View>
        </Page>
    </Document>
);

