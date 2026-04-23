import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        fontFamily: 'Helvetica',
        padding: 40,
        fontSize: 11,
        color: '#1C1C1E',
        lineHeight: 1.5,
    },
    header: {
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5EA',
        paddingBottom: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 12,
        color: '#8E8E93',
        textAlign: 'center',
    },
    section: {
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 15,
        marginBottom: 5,
        backgroundColor: '#F2F2F7',
        padding: 5,
    },
    text: {
        marginBottom: 5,
        textAlign: 'justify',
    },
    bold: {
        fontWeight: 'bold',
    },
    footer: {
        position: 'absolute',
        bottom: 40,
        left: 40,
        right: 40,
        textAlign: 'center',
        color: '#8E8E93',
        fontSize: 9,
        borderTopWidth: 1,
        borderTopColor: '#E5E5EA',
        paddingTop: 10,
    },
    signatures: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 50,
    },
    signatureBlock: {
        width: '45%',
        borderTopWidth: 1,
        borderTopColor: '#000000',
        paddingTop: 5,
        textAlign: 'center',
    },
    digitalStamp: {
        marginTop: 10,
        fontSize: 9,
        color: '#34C759',
        textAlign: 'center',
        borderWidth: 1,
        borderColor: '#34C759',
        padding: 5,
        borderRadius: 4,
    }
});

interface ContractPDFProps {
    nombre: string;
    cedula: string;
    telefono: string;
    cargo: string;
    direccion: string;
    fecha: string;
    digitalSignature?: string;
}

export const ContractPDF: React.FC<ContractPDFProps> = ({ 
    nombre, 
    cedula, 
    telefono, 
    cargo, 
    direccion, 
    fecha,
    digitalSignature 
}) => (
    <Document>
        <Page size="A4" style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.title}>CONTRATO INDIVIDUAL DE TRABAJO</Text>
                <Text style={styles.subtitle}>Casa Inteligente C.A.</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.text}>
                    Entre la empresa <Text style={styles.bold}>Casa Inteligente C.A.</Text>, en lo sucesivo "EL EMPLEADOR", 
                    y por la otra parte, el(la) ciudadano(a) <Text style={styles.bold}>{nombre}</Text>, titular de la Cédula 
                    de Identidad Nro. <Text style={styles.bold}>{cedula}</Text>, domiciliado(a) en <Text style={styles.bold}>{direccion}</Text>, 
                    y número telefónico de contacto <Text style={styles.bold}>{telefono}</Text>, en lo sucesivo "EL TRABAJADOR", 
                    se ha convenido en celebrar el presente Contrato de Trabajo de acuerdo a las siguientes cláusulas:
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>PRIMERA: OBJETO Y CARGO</Text>
                <Text style={styles.text}>
                    EL TRABAJADOR prestará sus servicios a EL EMPLEADOR desempeñando el cargo de <Text style={styles.bold}>{cargo}</Text>, 
                    ejecutando todas las labores inherentes al mismo y cualquier otra vinculada que EL EMPLEADOR le asigne de manera lícita y razonable.
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>SEGUNDA: REMUNERACIÓN</Text>
                <Text style={styles.text}>
                    EL EMPLEADOR pagará a EL TRABAJADOR, por la prestación de sus servicios, la remuneración estipulada en los tabuladores 
                    salariales vigentes correspondientes a su cargo, pagaderos mediante depósitos bancarios o según acuerdo entre las partes.
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>TERCERA: JORNADA</Text>
                <Text style={styles.text}>
                    La jornada de trabajo será la estipulada por la legislación vigente, respetando los horarios administrativos y operativos 
                    que EL EMPLEADOR defina según las necesidades del servicio.
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.text}>
                    En señal de conformidad y aceptación digital de todos los términos de este contrato, se firma electrónicamente a los <Text style={styles.bold}>{fecha}</Text>.
                </Text>
            </View>

            <View style={styles.signatures}>
                <View style={styles.signatureBlock}>
                    <Text>Por EL EMPLEADOR</Text>
                    <Text style={{ fontSize: 9, marginTop: 5, color: '#8E8E93' }}>Representante Legal</Text>
                </View>
                <View style={styles.signatureBlock}>
                    <Text>Por EL TRABAJADOR</Text>
                    <Text style={{ fontSize: 9, marginTop: 5, color: '#8E8E93' }}>{nombre}</Text>
                    {digitalSignature && (
                        <Text style={styles.digitalStamp}>
                            ✓ Aceptación Digital Registrada{'\n'}
                            Ref: {digitalSignature}
                        </Text>
                    )}
                </View>
            </View>

            <Text style={styles.footer}>
                Documento generado electrónicamente por Sistema Casa Inteligente. Válido para expediente RRHH.
            </Text>
        </Page>
    </Document>
);
