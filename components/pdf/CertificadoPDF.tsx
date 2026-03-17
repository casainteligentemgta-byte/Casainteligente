'use client';

import { useState } from 'react';
import { 
  Document, Page, Text, View, StyleSheet, PDFViewer, 
  pdf 
} from '@react-pdf/renderer';
import { FileText, MessageCircle, X, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#334155' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40, borderBottom: '2px solid #3b82f6', paddingBottom: 15 },
  logoContainer: { width: 150 },
  titleBox: { alignItems: 'flex-start' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  subTitle: { fontSize: 12, color: '#64748b' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', backgroundColor: '#f8fafc', padding: 6, marginBottom: 10, borderLeft: '4px solid #3b82f6' },
  clientText: { marginBottom: 4, fontSize: 11 },
  table: { width: 'auto', borderStyle: 'solid', borderWidth: 1, borderColor: '#cbd5e1', borderRightWidth: 0, borderBottomWidth: 0, marginBottom: 20 },
  tableRow: { flexDirection: 'row' },
  tableHeader: { backgroundColor: '#f1f5f9', fontWeight: 'bold' },
  tableCol: { width: '20%', borderStyle: 'solid', borderWidth: 1, borderColor: '#cbd5e1', borderLeftWidth: 0, borderTopWidth: 0 },
  tableCell: { margin: 5, fontSize: 9 },
  footer: { marginTop: 30, paddingTop: 15, borderTop: '1px solid #e2e8f0' },
  footerTitle: { fontSize: 12, fontWeight: 'bold', color: '#0f172a', marginBottom: 5 },
  footerText: { fontSize: 9, color: '#64748b', lineHeight: 1.5, textAlign: 'justify' },
  signature: { marginTop: 50, width: 200, borderTop: '1px solid #94a3b8', textAlign: 'center', paddingTop: 5, alignSelf: 'flex-end', fontSize: 10 }
});

const PlantillaCertificado = ({ cliente, equipos, proyecto }: { cliente: any, equipos: any[], proyecto: any }) => (
  <Document>
    <Page size="LETTER" style={styles.page}>
      
      <View style={styles.header}>
        <View style={styles.titleBox}>
          <Text style={styles.title}>CERTIFICADO DE</Text>
          <Text style={styles.title}>INSTALACIÓN Y GARANTÍA</Text>
          <Text style={styles.subTitle}>Folio: PROY-{proyecto.id.split('-')[0].toUpperCase()}</Text>
          <Text style={styles.subTitle}>Fecha: {new Date().toLocaleDateString('es-MX')}</Text>
        </View>
        <View style={styles.logoContainer}>
          <Text style={{fontSize: 20, fontWeight: 'black', color: '#2563eb', textAlign:'right'}}>CASA INTELIGENTE</Text>
          <Text style={{fontSize: 9, color: '#64748b', textAlign:'right'}}>Tecnología y Seguridad</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. DATOS DEL CLIENTE (TITULAR)</Text>
        <Text style={styles.clientText}><Text style={{fontWeight: 'bold'}}>Nombre / Razón Social:</Text> {cliente.nombre}</Text>
        <Text style={styles.clientText}><Text style={{fontWeight: 'bold'}}>Proyecto Instalado:</Text> {proyecto.nombre}</Text>
        <Text style={styles.clientText}><Text style={{fontWeight: 'bold'}}>Dirección de Instalación:</Text> {cliente.direccion}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. DETALLE DE EQUIPOS Y SERIALES (ACTIVOS)</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <View style={styles.tableCol}><Text style={styles.tableCell}>EQUIPO</Text></View>
            <View style={styles.tableCol}><Text style={styles.tableCell}>MARCA</Text></View>
            <View style={styles.tableCol}><Text style={styles.tableCell}>MODELO</Text></View>
            <View style={styles.tableCol}><Text style={styles.tableCell}>NÚM. SERIAL</Text></View>
            <View style={styles.tableCol}><Text style={styles.tableCell}>GARANTÍA</Text></View>
          </View>
          {equipos.map((eq, i) => (
            <View style={styles.tableRow} key={i}>
              <View style={styles.tableCol}><Text style={styles.tableCell}>{eq.equipo_nombre}</Text></View>
              <View style={styles.tableCol}><Text style={styles.tableCell}>{eq.marca || 'N/A'}</Text></View>
              <View style={styles.tableCol}><Text style={styles.tableCell}>{eq.modelo || 'N/A'}</Text></View>
              <View style={styles.tableCol}><Text style={styles.tableCell}>{eq.numero_serial}</Text></View>
              <View style={styles.tableCol}><Text style={styles.tableCell}>12 Meses</Text></View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerTitle}>3. TÉRMINOS Y RECOMENDACIONES DE MANTENIMIENTO</Text>
        <Text style={styles.footerText}>
          A) La garantía cubre exclusivamente defectos de fabricación por el periodo especificado en la tabla superior. No cubre variaciones de voltaje, descargas eléctricas, humedad excesiva, vandalismo o manipulación de los dispositivos por personal no autorizado por Casa Inteligente.
        </Text>
        <Text style={styles.footerText}>
          B) Se recomienda encarecidamente la conexión de NVRs, Routers y Cámaras principales a un sistema UPS (No-Break) para garantizar la continuidad del sistema de seguridad y vida útil de los discos duros.
        </Text>
        <Text style={styles.footerText}>
          C) Limpie los domos de las cámaras cada 3 meses exclusivamente con paños de microfibra y soluciones libres de alcohol para evitar opacidad en la visión nocturna (IR). En caso de duda técnica, su línea directa de soporte es el correo soporte@casainteligente.com.
        </Text>

        <Text style={styles.signature}>Firma del Técnico Instalador</Text>
      </View>

    </Page>
  </Document>
);

export default function CertificadoGenerador({ idProyecto }: { idProyecto: string }) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  
  const [proyectoData, setProyectoData] = useState<any>(null);
  const [clienteData, setClienteData] = useState<any>(null);
  const [equiposData, setEquiposData] = useState<any[]>([]);

  const supabase = createClient();

  const prepararYAbrirCertificado = async () => {
    setCargandoDatos(true);
    setModalAbierto(true); 

    try {
       const { data: proy } = await supabase.from('tb_proyectos').select('*').eq('id', idProyecto).single();
       if(proy) setProyectoData(proy);

       const { data: eqs } = await supabase.from('tb_detalle_tecnico').select('*').eq('id_proyecto', idProyecto);
       setEquiposData(eqs && eqs.length > 0 ? eqs : [
         { equipo_nombre: 'Cámara Bala IP 4MP', marca: 'Dahua', modelo: 'IPC-HFW', numero_serial: '3K0162BPAZ' },
         { equipo_nombre: 'NVR 8 Ch WizSense', marca: 'Dahua', modelo: 'NVR2108HS', numero_serial: '8J0445CPBZ' }
       ]);

       const clienteSharePointRawMock = {
         id: proy?.id_cliente || 'b53a9250...',
         nombre: 'Lic. Andrés Mercado (Empresa)',
         direccion: 'Boulevard Puerta de Hierro 5153, Oficina 402',
         telefono: '525541238901'
       };
       setClienteData(clienteSharePointRawMock);

    } catch (error) {
       console.error("Error armando PDF:", error);
    } finally {
       setCargandoDatos(false);
    }
  };

  const enviarPorWhatsApp = async () => {
     if(!clienteData) return;
     const pdfBlob = await pdf(<PlantillaCertificado cliente={clienteData} equipos={equiposData} proyecto={proyectoData} />).toBlob();
     
     const fileUrl = URL.createObjectURL(pdfBlob);
     
     const mensaje = encodeURIComponent(`Hola ${clienteData.nombre}, tu proyecto ha sido finalizado exitosamente. Adjuntamos tu Certificado de Instalación y Garantía. Puedes descargarlo aquí: [Ingresa el link público subido a tu Storage]`);
     const numeroLimpio = clienteData.telefono.replace(/[\s+]/g, '');
     
     window.open(`https://wa.me/${numeroLimpio}?text=${mensaje}`, '_blank');
  };

  return (
    <>
      <button 
        onClick={prepararYAbrirCertificado}
        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold shadow-md transition-all group"
      >
        <FileText className="w-5 h-5 group-hover:scale-110 transition-transform" />
        Generar Certificado PDF
      </button>

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-950 w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            
            <div className="h-16 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
               <div>
                 <h2 className="font-bold text-lg dark:text-white">Pre-visualización de Certificado</h2>
                 <p className="text-xs text-slate-500 font-mono">Dcto_Garantia_PROY.pdf</p>
               </div>
               
               <div className="flex items-center gap-3">
                 {!cargandoDatos && (
                    <button 
                      onClick={enviarPorWhatsApp}
                      className="hidden sm:flex items-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" /> Enviar PDF (WhatsApp)
                    </button>
                 )}
                 <button onClick={() => setModalAbierto(false)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-full transition-colors">
                   <X className="w-6 h-6" />
                 </button>
               </div>
            </div>

            <div className="flex-1 bg-slate-200 dark:bg-slate-800 p-2 sm:p-6 overflow-hidden">
               {cargandoDatos ? (
                  <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                     <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                     <p className="text-slate-500 dark:text-slate-400 font-medium">Buscando seriales y datos técnicos...</p>
                  </div>
               ) : (
                  <PDFViewer width="100%" height="100%" className="rounded-lg shadow-xl border-none">
                     <PlantillaCertificado cliente={clienteData} equipos={equiposData} proyecto={proyectoData} />
                  </PDFViewer>
               )}
            </div>
            
          </div>
        </div>
      )}
    </>
  );
}
