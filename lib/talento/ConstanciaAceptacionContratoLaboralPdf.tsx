import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica', fontSize: 11, color: '#111' },
  h1: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  p: { marginBottom: 10, lineHeight: 1.45, textAlign: 'justify' },
  label: { fontWeight: 'bold' },
  footer: { marginTop: 28, fontSize: 9, color: '#444', textAlign: 'center' },
});

export type ConstanciaAceptacionContratoLaboralPdfProps = {
  nombreTrabajador: string;
  documento: string;
  contratoId: string;
  expedienteRef: string;
  aceptadoEnIso: string;
  ipCliente: string | null;
};

export function ConstanciaAceptacionContratoLaboralPdf({
  nombreTrabajador,
  documento,
  contratoId,
  expedienteRef,
  aceptadoEnIso,
  ipCliente,
}: ConstanciaAceptacionContratoLaboralPdfProps) {
  const fechaTxt = (() => {
    try {
      const d = new Date(aceptadoEnIso);
      if (Number.isNaN(d.getTime())) return aceptadoEnIso;
      return d.toLocaleString('es-VE', { dateStyle: 'long', timeStyle: 'short' });
    } catch {
      return aceptadoEnIso;
    }
  })();

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.h1}>CONSTANCIA DE ACEPTACIÓN ELECTRÓNICA DEL CONTRATO</Text>
        <Text style={styles.p}>
          Quien suscribe, <Text style={styles.label}>{nombreTrabajador}</Text>, identificado(a) con documento de
          identidad <Text style={styles.label}>{documento}</Text>, declara haber accedido al enlace seguro facilitado
          por el empleador, haber revisado el texto del contrato individual de trabajo asociado al expediente{' '}
          <Text style={styles.label}>{expedienteRef}</Text> (referencia interna del sistema) e identificador de
          contrato <Text style={styles.label}>{contratoId}</Text>, y manifestar su{' '}
          <Text style={styles.label}>aceptación expresa y consciente</Text> de su contenido mediante la opción
          «aceptar de forma electrónica» habilitada en la aplicación, con los efectos previstos en la normativa laboral
          vigente y en la política interna de la empresa.
        </Text>
        <Text style={styles.p}>
          La presente constancia se emite de forma automática con fines probatorios y de archivo, sin sustituir la
          firma autógrafa y la huella dactilar en el ejemplar impreso del contrato, la cual deberá completarse según las
          instrucciones de Recursos Humanos.
        </Text>
        <View style={{ marginTop: 16 }}>
          <Text style={styles.p}>
            <Text style={styles.label}>Fecha y hora de registro de la aceptación:</Text> {fechaTxt}
          </Text>
          {ipCliente ? (
            <Text style={styles.p}>
              <Text style={styles.label}>Dirección IP registrada (referencial):</Text> {ipCliente}
            </Text>
          ) : null}
        </View>
        <Text style={styles.footer}>
          Documento generado electrónicamente — no requiere firma en esta hoja para surtir efectos de constancia de
          aceptación digital.
        </Text>
      </Page>
    </Document>
  );
}
