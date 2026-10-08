import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import {
  FINALIDADES_ANTICIPO,
  type FinalidadAnticipo,
} from '@/lib/nomina/finalidadAnticipo';

/**
 * Formulario de solicitud de anticipo de la garantía de prestaciones sociales
 * (art. 144 LOTTT; Cl. 50 de la Convención; Cl. SÉPTIMA a) del contrato).
 * Se imprime, el trabajador marca la finalidad, firma y pone su huella; se archiva con el soporte.
 */
export type DatosSolicitudAnticipo = {
  empresa: string;
  obra: string;
  trabajadorNombre: string;
  trabajadorCedula: string;
  /** Fecha de la solicitud (ISO). */
  fechaIso: string;
  /** Garantía acreditada en el ciclo de cuatro semanas (Bs.). */
  garantiaCicloVes: number;
  /** Monto que se pide como anticipo (Bs.), máx. 75% de lo acreditado. */
  anticipoVes: number;
  tasaBcv: number;
  /** Si ya se eligió en el sistema, sale marcada; si no, el trabajador la marca a mano. */
  finalidad?: FinalidadAnticipo | null;
};

const s = StyleSheet.create({
  page: { padding: 44, fontFamily: 'Times-Roman', fontSize: 11, color: '#111', lineHeight: 1.4 },
  h1: { fontFamily: 'Times-Bold', fontSize: 13, textAlign: 'center' },
  h2: { fontFamily: 'Times-Bold', fontSize: 11, textAlign: 'center', marginBottom: 14 },
  p: { marginBottom: 8, textAlign: 'justify' },
  b: { fontFamily: 'Times-Bold' },
  dato: { marginBottom: 3, fontSize: 10.5 },
  caja: { borderWidth: 0.8, borderColor: '#000', padding: 8, marginVertical: 8 },
  fila: { flexDirection: 'row', marginBottom: 5 },
  check: { width: 26, fontFamily: 'Times-Bold' },
  opcion: { flex: 1 },
  linea: { borderBottomWidth: 0.6, borderBottomColor: '#000', height: 16, marginBottom: 6 },
  nota: { fontSize: 8.5, color: '#333', marginTop: 6, textAlign: 'justify' },
  firmas: { marginTop: 30, flexDirection: 'row', justifyContent: 'space-between' },
  cajaFirma: { width: '30%', textAlign: 'center', fontSize: 9 },
  lineaFirma: { marginTop: 40, borderTopWidth: 0.8, borderTopColor: '#000', paddingTop: 4 },
  huella: { width: '22%', height: 70, borderWidth: 0.8, borderColor: '#000', fontSize: 8, textAlign: 'center', paddingTop: 56 },
});

function fmtVes(n: number) {
  return `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtUsd(n: number) {
  return `USD ${n.toFixed(2)}`;
}
function fmtFecha(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export function SolicitudAnticipoPrestacionesPdf({ datos }: { datos: DatosSolicitudAnticipo }) {
  const usd = datos.tasaBcv > 0 ? datos.anticipoVes / datos.tasaBcv : 0;
  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <Text style={s.h1}>{datos.empresa || 'Entidad de trabajo'}</Text>
        <Text style={s.h2}>
          SOLICITUD DE ANTICIPO DE LA GARANTÍA DE PRESTACIONES SOCIALES{'\n'}(Artículo 144 de la LOTTT)
        </Text>

        <Text style={s.dato}>Lugar y fecha: Pampatar, {fmtFecha(datos.fechaIso)}</Text>
        <Text style={s.dato}>Obra: {datos.obra}</Text>
        <Text style={s.dato}>
          Trabajador: {datos.trabajadorNombre} — C.I. {datos.trabajadorCedula}
        </Text>

        <Text style={[s.p, { marginTop: 10 }]}>
          Yo, <Text style={s.b}>{datos.trabajadorNombre}</Text>, titular de la cédula de identidad N°{' '}
          <Text style={s.b}>{datos.trabajadorCedula}</Text>, solicito a LA ENTIDAD DE TRABAJO, conforme al
          artículo 144 de la Ley Orgánica del Trabajo, los Trabajadores y las Trabajadoras, a la Cláusula 50
          de la Convención Colectiva de la Industria de la Construcción y a la Cláusula SÉPTIMA, literal a),
          de mi contrato de trabajo, un anticipo de la garantía de mis prestaciones sociales por la cantidad
          de <Text style={s.b}>{fmtVes(datos.anticipoVes)}</Text> (equivalente a {fmtUsd(usd)} a la tasa
          oficial del BCV de {datos.tasaBcv.toFixed(4)} Bs/USD), que no excede del setenta y cinco por
          ciento (75%) de lo acreditado a mi favor en el ciclo ({fmtVes(datos.garantiaCicloVes)}).
        </Text>

        <Text style={[s.p, s.b]}>El anticipo lo destinaré a (marque una):</Text>
        <View style={s.caja}>
          {FINALIDADES_ANTICIPO.map((f) => (
            <View key={f.valor} style={s.fila}>
              <Text style={s.check}>{datos.finalidad === f.valor ? '[ X ]' : '[   ]'}</Text>
              <Text style={s.opcion}>
                {f.literal}. {f.texto}
              </Text>
            </View>
          ))}
        </View>

        <Text style={s.p}>Breve descripción del destino (obra, institución educativa, centro de salud, etc.):</Text>
        <View style={s.linea} />
        <View style={s.linea} />

        <Text style={s.p}>
          Declaro que la información suministrada es cierta, que me comprometo a consignar el soporte del
          destino del anticipo cuando LA ENTIDAD DE TRABAJO lo requiera, y que la cantidad recibida se
          descontará de la garantía de mis prestaciones sociales. Esta solicitud la hago de forma libre y
          voluntaria.
        </Text>

        <Text style={s.nota}>
          Artículo 144 LOTTT: el trabajador tiene derecho a recibir un anticipo de hasta el setenta y cinco
          por ciento (75%) de lo depositado o acreditado como garantía de sus prestaciones sociales para
          satisfacer obligaciones derivadas de vivienda, liberación de hipoteca o gravamen sobre vivienda de
          su propiedad, educación, o gastos de atención médica y hospitalaria, para él o ella y su familia.
        </Text>

        <View style={s.firmas}>
          <View style={s.cajaFirma}>
            <Text style={s.lineaFirma}>
              {datos.trabajadorNombre}
              {'\n'}C.I. {datos.trabajadorCedula}
              {'\n'}EL TRABAJADOR
            </Text>
          </View>
          <Text style={s.huella}>Huella dactilar</Text>
          <View style={s.cajaFirma}>
            <Text style={s.lineaFirma}>
              Recibido por{'\n'}LA ENTIDAD DE TRABAJO{'\n'}Fecha: ____/____/______
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
