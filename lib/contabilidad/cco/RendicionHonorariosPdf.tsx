import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import {
  fechaCorta,
  fmtUsd,
  type GrupoRendicion,
  type MovimientoRendicion,
  type RendicionHonorarios,
  type VersionRendicion,
} from '@/lib/contabilidad/cco/rendicionHonorarios';

/** Con más filas que esto, el detalle se entrega por semana o por mes. */
export const MAX_FILAS_DETALLE_PDF = 800;

const TINTA = '#0F172A';
const GRIS = '#475569';
const LINEA = '#E2E8F0';
const FONDO = '#F1F5F9';

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 44, paddingHorizontal: 34, fontSize: 8.5, fontFamily: 'Helvetica', color: TINTA },
  titulo: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  subtitulo: { fontSize: 9.5, color: GRIS, marginTop: 2 },
  etiquetaInterna: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
  },
  datos: { flexDirection: 'row', marginTop: 10, marginBottom: 12 },
  dato: { flex: 1 },
  datoLabel: { fontSize: 7, color: GRIS, textTransform: 'uppercase' },
  datoValor: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 1 },
  seccion: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 5 },
  resumen: { borderWidth: 0.8, borderColor: LINEA },
  resumenFila: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: LINEA },
  resumenTotal: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 8, backgroundColor: FONDO },
  resumenTexto: { flex: 1, fontSize: 9.5 },
  resumenMonto: { width: 110, textAlign: 'right', fontSize: 9.5 },
  negrita: { fontFamily: 'Helvetica-Bold' },
  th: { flexDirection: 'row', backgroundColor: LINEA, paddingVertical: 4, paddingHorizontal: 3 },
  tr: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 3, borderBottomWidth: 0.5, borderBottomColor: LINEA },
  trTotal: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 3, backgroundColor: FONDO },
  thTexto: { fontFamily: 'Helvetica-Bold', fontSize: 7.5 },
  num: { textAlign: 'right' },
  nota: { fontSize: 8, color: GRIS, marginTop: 6, lineHeight: 1.35 },
  pie: { position: 'absolute', bottom: 20, left: 34, right: 34, flexDirection: 'row', fontSize: 7.5, color: GRIS },
});

type Columna<T> = {
  titulo: string;
  ancho: number | string;
  flex?: number;
  numero?: boolean;
  valor: (fila: T) => string;
};

function celda<T>(c: Columna<T>) {
  return [c.flex ? { flex: c.flex } : { width: c.ancho }, c.numero ? s.num : {}, { paddingRight: c.numero ? 0 : 4 }];
}

function Tabla<T>(props: { columnas: Array<Columna<T>>; filas: T[]; total?: string[]; clave: (f: T, i: number) => string }) {
  return (
    <View>
      <View style={s.th}>
        {props.columnas.map((c) => (
          <Text key={c.titulo} style={[...celda(c), s.thTexto]}>
            {c.titulo}
          </Text>
        ))}
      </View>
      {props.filas.map((f, i) => (
        <View key={props.clave(f, i)} style={s.tr} wrap={false}>
          {props.columnas.map((c) => (
            <Text key={c.titulo} style={celda(c)}>
              {c.valor(f)}
            </Text>
          ))}
        </View>
      ))}
      {props.total ? (
        <View style={s.trTotal} wrap={false}>
          {props.columnas.map((c, i) => (
            <Text key={c.titulo} style={[...celda(c), s.negrita]}>
              {props.total![i] ?? ''}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function corto(texto: string, max: number): string {
  const t = texto.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function columnasGrupo(titulo: string): Array<Columna<GrupoRendicion>> {
  return [
    { titulo, ancho: 0, flex: 1, valor: (g) => corto(g.nombre, 60) },
    { titulo: 'Nº', ancho: 34, numero: true, valor: (g) => String(g.n) },
    { titulo: 'Gastos USD', ancho: 82, numero: true, valor: (g) => fmtUsd(g.gastos) },
    { titulo: 'Honorarios USD', ancho: 82, numero: true, valor: (g) => fmtUsd(g.honorarios) },
    { titulo: 'Total USD', ancho: 82, numero: true, valor: (g) => fmtUsd(g.total) },
  ];
}

export function RendicionHonorariosPdfDocument(props: {
  obra: string;
  cliente: string | null;
  empresa: string;
  version: VersionRendicion;
  generadoAt: string;
  rendicion: RendicionHonorarios;
}) {
  const r = props.rendicion;
  const interna = props.version === 'interna';
  const esObra = r.rango.tipo === 'obra';
  const conDetalle = r.gastos.length <= MAX_FILAS_DETALLE_PDF;
  const pct = fmtUsd(r.pctPactado).replace(/\.00$/, '');
  const corte = r.rango.hasta ?? r.ultimoMovimiento;

  const columnasGasto: Array<Columna<MovimientoRendicion>> = [
    { titulo: 'Fecha', ancho: 48, valor: (g) => fechaCorta(g.fecha) },
    { titulo: 'Proveedor', ancho: 0, flex: 1, valor: (g) => corto(g.proveedor, 34) },
    { titulo: 'Concepto', ancho: 0, flex: 1.5, valor: (g) => corto(g.concepto, 58) },
    { titulo: 'Factura', ancho: 58, valor: (g) => corto(g.factura ?? '—', 14) },
    { titulo: 'Gasto', ancho: 56, numero: true, valor: (g) => fmtUsd(g.baseUsd) },
    { titulo: 'Honor.', ancho: 48, numero: true, valor: (g) => fmtUsd(g.honorariosUsd) },
    { titulo: 'Total', ancho: 56, numero: true, valor: (g) => fmtUsd(g.baseUsd + g.honorariosUsd) },
    ...(interna
      ? [{ titulo: 'Sop.', ancho: 26, numero: true, valor: (g: MovimientoRendicion) => (g.tieneSoporte ? 'Sí' : 'No') }]
      : []),
  ];

  const columnasAporte: Array<Columna<MovimientoRendicion>> = [
    { titulo: 'Fecha', ancho: 52, valor: (a) => fechaCorta(a.fecha) },
    { titulo: 'Origen', ancho: 0, flex: 1, valor: (a) => corto(a.proveedor, 40) },
    { titulo: 'Concepto', ancho: 0, flex: 1.6, valor: (a) => corto(a.concepto, 70) },
    { titulo: 'Forma de pago', ancho: 90, valor: (a) => corto(a.formaPago ?? '—', 22) },
    { titulo: 'Monto USD', ancho: 76, numero: true, valor: (a) => fmtUsd(a.baseUsd) },
  ];

  return (
    <Document title={`Rendición de cuentas · ${props.obra}`} author={props.empresa}>
      <Page size="A4" style={s.page}>
        <Text style={s.titulo}>Rendición de cuentas</Text>
        <Text style={s.subtitulo}>Obra por administración delegada · {props.empresa}</Text>
        {interna ? <Text style={s.etiquetaInterna}>USO INTERNO · NO ENTREGAR AL CLIENTE</Text> : null}

        <View style={s.datos}>
          <View style={s.dato}>
            <Text style={s.datoLabel}>Obra</Text>
            <Text style={s.datoValor}>{corto(props.obra, 46)}</Text>
          </View>
          <View style={s.dato}>
            <Text style={s.datoLabel}>Período</Text>
            <Text style={s.datoValor}>{r.rango.etiqueta}</Text>
          </View>
          <View style={{ width: 120 }}>
            <Text style={s.datoLabel}>{props.cliente ? 'Cliente' : 'Emitida'}</Text>
            <Text style={s.datoValor}>{props.cliente ? corto(props.cliente, 26) : props.generadoAt}</Text>
          </View>
        </View>

        <View style={s.resumen}>
          {!esObra ? (
            <View style={s.resumenFila}>
              <Text style={s.resumenTexto}>Saldo anterior (antes del {fechaCorta(r.rango.desde)})</Text>
              <Text style={s.resumenMonto}>{fmtUsd(r.saldoAnterior)}</Text>
            </View>
          ) : null}
          <View style={s.resumenFila}>
            <Text style={s.resumenTexto}>(+) Aportes recibidos del cliente · {r.periodo.nAportes}</Text>
            <Text style={s.resumenMonto}>{fmtUsd(r.periodo.aportes)}</Text>
          </View>
          <View style={s.resumenFila}>
            <Text style={s.resumenTexto}>(−) Gastos de obra · {r.periodo.nGastos}</Text>
            <Text style={s.resumenMonto}>{fmtUsd(r.periodo.gastos)}</Text>
          </View>
          <View style={s.resumenFila}>
            <Text style={s.resumenTexto}>(−) Honorarios de administración ({pct}% sobre los gastos)</Text>
            <Text style={s.resumenMonto}>{fmtUsd(r.periodo.honorarios)}</Text>
          </View>
          <View style={s.resumenTotal}>
            <Text style={[s.resumenTexto, s.negrita]}>
              {r.saldoFinal >= 0 ? '(=) Saldo a favor del cliente' : '(=) Monto por reponer'} · USD
            </Text>
            <Text style={[s.resumenMonto, s.negrita]}>{fmtUsd(Math.abs(r.saldoFinal))}</Text>
          </View>
        </View>

        {!esObra ? (
          <Text style={s.nota}>
            Acumulado de la obra al {fechaCorta(corte)}: aportes {fmtUsd(r.acumulado.aportes)} · gastos{' '}
            {fmtUsd(r.acumulado.gastos)} · honorarios {fmtUsd(r.acumulado.honorarios)} · saldo{' '}
            {fmtUsd(r.acumulado.saldo)} USD.
          </Text>
        ) : null}

        {r.porMes.length ? (
          <View>
            <Text style={s.seccion}>Mes a mes</Text>
            <Tabla
              clave={(m) => m.periodo}
              filas={r.porMes}
              columnas={[
                { titulo: 'Mes', ancho: 0, flex: 1, valor: (m) => m.etiqueta },
                { titulo: 'Aportes', ancho: 78, numero: true, valor: (m) => fmtUsd(m.aportes) },
                { titulo: 'Gastos', ancho: 78, numero: true, valor: (m) => fmtUsd(m.gastos) },
                { titulo: 'Honorarios', ancho: 72, numero: true, valor: (m) => fmtUsd(m.honorarios) },
                { titulo: 'Total cargado', ancho: 80, numero: true, valor: (m) => fmtUsd(m.total) },
                { titulo: 'Saldo al cierre', ancho: 84, numero: true, valor: (m) => fmtUsd(m.saldo) },
              ]}
            />
          </View>
        ) : null}

        {r.porTipo.length ? (
          <View>
            <Text style={s.seccion}>Gastos por tipo</Text>
            <Tabla
              clave={(g) => g.nombre}
              filas={r.porTipo}
              columnas={columnasGrupo('Tipo de gasto')}
              total={['Total', String(r.periodo.nGastos), fmtUsd(r.periodo.gastos), fmtUsd(r.periodo.honorarios), fmtUsd(r.periodo.total)]}
            />
          </View>
        ) : null}

        {r.aportes.length ? (
          <View>
            <Text style={s.seccion}>Aportes recibidos</Text>
            <Tabla
              clave={(a) => a.id}
              filas={r.aportes}
              columnas={columnasAporte}
              total={['Total', '', '', '', fmtUsd(r.periodo.aportes)]}
            />
          </View>
        ) : null}

        {r.gastos.length && conDetalle ? (
          <View>
            <Text style={s.seccion}>Detalle de gastos</Text>
            <Tabla
              clave={(g) => g.id}
              filas={r.gastos}
              columnas={columnasGasto}
              total={[
                'Total',
                '',
                '',
                '',
                fmtUsd(r.periodo.gastos),
                fmtUsd(r.periodo.honorarios),
                fmtUsd(r.periodo.total),
                ...(interna ? [''] : []),
              ]}
            />
          </View>
        ) : null}

        {r.gastos.length && !conDetalle ? (
          <Text style={s.nota}>
            Este período tiene {r.gastos.length} gastos. El detalle uno por uno se entrega en las rendiciones
            semanales y mensuales.
          </Text>
        ) : null}

        {!r.gastos.length && !r.aportes.length ? (
          <Text style={s.nota}>No hay aportes ni gastos registrados en este período.</Text>
        ) : null}

        {interna ? (
          <View>
            <Text style={s.seccion}>Control interno</Text>
            <View style={s.resumen}>
              {[
                [`Gastos sin factura o soporte adjunto · ${r.control.sinSoporte.n}`, fmtUsd(r.control.sinSoporte.monto)],
                [`Gastos con estado distinto de PAGADO · ${r.control.noPagados.n}`, fmtUsd(r.control.noPagados.monto)],
                [
                  `Gastos sin honorarios guardados (calculados al ${pct}%) · ${r.control.honorariosCalculados.n}`,
                  `${fmtUsd(r.control.honorariosCalculados.monto)} → ${fmtUsd(r.control.honorariosCalculados.honorarios)}`,
                ],
                [`Gastos con un % de honorarios distinto al pactado · ${r.control.pctDistinto.n}`, fmtUsd(r.control.pctDistinto.monto)],
                [`Movimientos sin fecha (solo cuentan en toda la obra) · ${r.control.sinFecha.n}`, fmtUsd(r.control.sinFecha.monto)],
                ['% de honorarios que resulta en el período', `${fmtUsd(r.pctEfectivo)} %`],
              ].map(([texto, monto]) => (
                <View key={texto} style={s.resumenFila} wrap={false}>
                  <Text style={[s.resumenTexto, { fontSize: 8.5 }]}>{texto}</Text>
                  <Text style={[s.resumenMonto, { fontSize: 8.5, width: 150 }]}>{monto}</Text>
                </View>
              ))}
            </View>

            {r.control.proveedores.length ? (
              <View>
                <Text style={s.seccion}>Proveedores con más gasto</Text>
                <Tabla clave={(g) => g.nombre} filas={r.control.proveedores} columnas={columnasGrupo('Proveedor')} />
              </View>
            ) : null}

            {r.porCapitulo.length > 1 ? (
              <View>
                <Text style={s.seccion}>Gastos por capítulo</Text>
                <Tabla clave={(g) => g.nombre} filas={r.porCapitulo} columnas={columnasGrupo('Capítulo')} />
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={s.nota}>
          Montos en dólares (USD). Honorarios = gastos de obra × {pct}%, calculados gasto por gasto. Saldo = aportes
          recibidos − gastos − honorarios.
        </Text>

        <View style={s.pie} fixed>
          <Text style={{ flex: 1 }}>
            {props.empresa} · Control Contable de Obra · Emitida {props.generadoAt}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
