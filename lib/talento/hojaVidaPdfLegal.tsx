import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { HojaVidaObreroCompleta, SiNo, TrabajoPrevio } from '@/lib/talento/hojaVidaObreroCompleta';
import { etiquetaSiNo } from '@/lib/talento/hojaVidaObreroCompleta';
import {
  HOJA_VIDA_GACETA_NUMERO,
  HOJA_VIDA_GACETA_REFERENCIA,
  HOJA_VIDA_PLANILLA_SUBTITULO,
  HOJA_VIDA_PLANILLA_TITULO,
} from '@/lib/talento/hojaVidaGacetaLayout';
import type { PlanillaPatronoCampos } from '@/lib/talento/planillaPatronoTypes';

export type { PlanillaPatronoCampos } from '@/lib/talento/planillaPatronoTypes';

/** Máximo 2 páginas (una hoja impresa por ambas caras). */
export const legalPdfStyles = StyleSheet.create({
  page: { paddingTop: 5, paddingHorizontal: 18, paddingBottom: 44, fontSize: 7.5, color: '#0f172a', position: 'relative' },
  headerBand: { borderBottomWidth: 2, borderBottomColor: '#000', paddingBottom: 4, marginBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerLeft: { width: '24%', fontSize: 6.5, fontWeight: 700 },
  headerCenter: { width: '52%', textAlign: 'center', fontSize: 5.8, fontWeight: 700, lineHeight: 1.25, paddingHorizontal: 2 },
  headerRight: { width: '24%', textAlign: 'right', fontSize: 7, fontWeight: 700 },
  frame: { borderWidth: 1.2, borderColor: '#111', padding: 5 },
  planillaTitle: { fontSize: 10, fontWeight: 700, textAlign: 'center', letterSpacing: 0.4 },
  planillaSub: { fontSize: 6.5, textAlign: 'center', marginTop: 1, marginBottom: 4, lineHeight: 1.2, color: '#1e293b' },
  employerRow: { flexDirection: 'row', gap: 3, marginBottom: 4 },
  cell: { borderWidth: 1, borderColor: '#000', padding: 2, minHeight: 20 },
  cellLabel: { fontSize: 4.8, fontWeight: 700, textTransform: 'uppercase', color: '#1e293b' },
  cellValue: { fontSize: 6.5, marginTop: 1, lineHeight: 1.15 },
  romanBar: {
    backgroundColor: '#0f172a',
    paddingVertical: 2,
    paddingHorizontal: 3,
    marginTop: 2,
    marginBottom: 2,
  },
  romanText: { color: '#fff', fontSize: 6.8, fontWeight: 700, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  /** Carnet: rectángulo vertical (retrato). */
  photoBox: { width: '15%', borderWidth: 1, borderColor: '#000', minHeight: 96, padding: 2 },
  photoInner: { flex: 1, justifyContent: 'flex-end' },
  /** Cédula: franja apaisada (horizontal). */
  photoCedulaOuter: { borderWidth: 1, borderColor: '#000', padding: 2 },
  photoCedulaSlot: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#000',
    minHeight: 28,
    maxHeight: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  note: { marginTop: 3, fontSize: 5.2, color: '#475569', lineHeight: 1.3 },
  footer: {
    position: 'absolute',
    bottom: 8,
    left: 18,
    right: 18,
    borderTopWidth: 0.75,
    borderTopColor: '#64748b',
    paddingTop: 4,
  },
  footerMain: { fontSize: 5.5, color: '#334155', textAlign: 'center', lineHeight: 1.3 },
  footerSub: { fontSize: 5, color: '#64748b', textAlign: 'center', marginTop: 2 },
  chkLine: { fontSize: 6, marginTop: 1, lineHeight: 1.25 },
  tableHead: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderWidth: 1, borderColor: '#000' },
  tableRow: { flexDirection: 'row', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#000' },
  th: { fontSize: 5, fontWeight: 700, padding: 2, borderRightWidth: 1, borderRightColor: '#000', textTransform: 'uppercase' },
  td: { fontSize: 5.5, padding: 2, borderRightWidth: 1, borderRightColor: '#000', flex: 1 },
  tdLast: { fontSize: 5.5, padding: 2, flex: 1 },
});

/** Alias histórico dentro de este módulo */
const st = legalPdfStyles;

const BLANK = '_______________________________________________';

export function val(s: string | undefined | null): string {
  const t = (s ?? '').trim();
  return t || '—';
}

export function GacetaHeader({ page, total }: { page: number; total: number }) {
  return (
    <View style={st.headerBand}>
      <View style={st.headerRow}>
        <Text style={st.headerLeft}>{HOJA_VIDA_GACETA_NUMERO}</Text>
        <Text style={st.headerCenter}>
          GACETA OFICIAL DE LA REPÚBLICA BOLIVARIANA DE VENEZUELA{'\n'}
          (referencia de expediente — Casa Inteligente)
        </Text>
        <Text style={st.headerRight}>
          {page} / {total}
        </Text>
      </View>
    </View>
  );
}

export function GacetaFooter({ extra }: { extra?: string }) {
  return (
    <View style={st.footer}>
      <Text style={st.footerMain}>{HOJA_VIDA_GACETA_REFERENCIA}</Text>
      <Text style={st.footerSub}>
        Planilla generada por Casa Inteligente. No constituye publicación oficial en Gaceta.
        {extra ? ` ${extra}` : ''}
      </Text>
    </View>
  );
}

export function CellBox({ label, value, flex, w }: { label: string; value: string; flex?: number; w?: string }) {
  return (
    <View style={[st.cell, flex != null ? { flex } : {}, w ? { width: w } : {}]}>
      <Text style={st.cellLabel}>{label}</Text>
      <Text style={st.cellValue}>{val(value)}</Text>
    </View>
  );
}

export function CellBlank({ label, flex, w }: { label: string; flex?: number; w?: string }) {
  const flexStyle = w != null ? {} : { flex: flex ?? 1 };
  return (
    <View style={[st.cell, flexStyle, w ? { width: w } : {}]}>
      <Text style={st.cellLabel}>{label}</Text>
      <Text style={st.cellValue}>{BLANK}</Text>
    </View>
  );
}

export function RomanSection({ code, title }: { code: string; title: string }) {
  return (
    <View style={st.romanBar}>
      <Text style={st.romanText}>
        {code}.- {title}
      </Text>
    </View>
  );
}

export function siNoLabel(v: SiNo): string {
  return etiquetaSiNo(v);
}

export function chkPair(label: string, on: boolean) {
  return `${on ? '[ X ]' : '[   ]'} ${label}`;
}

export type FirmaTrabajadorPdfMeta = {
  imageSrc: string;
  eventId: string;
  capturedAtLabel: string;
};

export type HojaVidaLegalPdfMeta = {
  emitidoEn: string;
  estadoProceso: string;
  rolBuscadoSistema: string;
  cargoCodigo: string;
  cargoNombre: string;
  planillaPatrono?: PlanillaPatronoCampos;
  firmaTrabajador?: FirmaTrabajadorPdfMeta;
};

/** Construye metadatos de firma para el PDF a partir de columnas de `ci_empleados`. */
export function firmaTrabajadorMetaDesdeRow(row: Record<string, unknown>): FirmaTrabajadorPdfMeta | undefined {
  const url = String(row.firma_electronica_url ?? '').trim();
  const idRaw = row.firma_electronica_id;
  const eventId = typeof idRaw === 'string' ? idRaw.trim() : idRaw != null ? String(idRaw).trim() : '';
  const atRaw = row.firma_electronica_at as string | null | undefined;
  if (!url || !eventId) return undefined;
  let capturedAtLabel = '';
  if (atRaw) {
    const d = new Date(atRaw);
    if (!Number.isNaN(d.getTime())) {
      capturedAtLabel = d.toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
    }
  }
  return { imageSrc: url, eventId, capturedAtLabel };
}

function SeccionFirmaHuella({ firma }: { firma?: FirmaTrabajadorPdfMeta }) {
  return (
    <>
      <RomanSection code="XIII" title="Firma y huella del trabajador" />
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
        <View
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#000',
            minHeight: 108,
            padding: 10,
            justifyContent: 'flex-start',
          }}
        >
          <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 52, paddingVertical: 6 }}>
            {firma?.imageSrc ? (
              <Image src={firma.imageSrc} style={{ maxHeight: 44, maxWidth: '92%' }} />
            ) : null}
          </View>
          {firma ? (
            <Text style={{ fontSize: 6, color: '#64748b', marginTop: 8, textAlign: 'center', lineHeight: 1.25 }}>
              {`Firma electrónica capturada vía Casa Inteligente ERP - ID: ${firma.eventId} - Fecha: ${firma.capturedAtLabel}`}
            </Text>
          ) : (
            <Text style={{ fontSize: 6, color: '#94a3b8', marginTop: 10, textAlign: 'center', lineHeight: 1.25 }}>
              Espacio en blanco para firma autógrafa y huella dactilar sobre el papel impreso (sin tapar los datos de la
              planilla).
            </Text>
          )}
        </View>
        <View
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#000',
            minHeight: 108,
            padding: 10,
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 6.2, color: '#0f172a', textAlign: 'center', lineHeight: 1.3 }}>
            Firma y sello húmedo RRHH / Entidad de trabajo
          </Text>
          <Text style={{ fontSize: 5, color: '#94a3b8', marginTop: 32, textAlign: 'center' }}>________________________</Text>
        </View>
      </View>
    </>
  );
}

const TOTAL_PAGES = 2;

export function PatField({
  label,
  value,
  flex,
  w,
}: {
  label: string;
  value?: string | null;
  flex?: number;
  w?: string;
}) {
  const t = (value ?? '').trim();
  if (t) return <CellBox label={label} value={t} flex={flex} w={w} />;
  return <CellBlank label={label} flex={flex} w={w} />;
}

/** Franja del patrono alineada a criterios de planilla de empleo (referencia Gaceta). */
export function PlanillaPatronoStrip({ campos }: { campos?: PlanillaPatronoCampos }) {
  const c = campos ?? {};
  return (
    <>
      <View style={st.employerRow}>
        <PatField label="Nombre o denominación" value={c.entidadNombre} flex={1} />
        <PatField label="RIF" value={c.entidadRif} w="26%" />
        <PatField label="Proyecto / obra (referencia)" value={c.proyectoNombre} w="30%" />
      </View>
      <View style={st.employerRow}>
        <PatField label="Nombre y apellido del representante" value={c.representanteNombreApellido} flex={1} />
        <PatField label="C.I. del representante" value={c.representanteCi} w="24%" />
        <PatField label="Edad del representante" value={c.representanteEdad} w="18%" />
      </View>
      <View style={st.employerRow}>
        <PatField label="Estado civil del representante" value={c.representanteEstadoCivil} w="28%" />
        <PatField label="Cargo del representante" value={c.representanteCargo} flex={1} />
        <PatField label="Nacionalidad del representante" value={c.representanteNacionalidad} w="30%" />
      </View>
      <View style={st.employerRow}>
        <PatField label="Dirección / domicilio de la empresa" value={c.empresaDomicilio} flex={1} />
      </View>
    </>
  );
}

export function HojaDeVidaObreroLegalPdfDoc({
  data,
  meta,
}: {
  data: HojaVidaObreroCompleta;
  meta: HojaVidaLegalPdfMeta;
}) {
  const d = data.datosPersonales;
  const cargoContrato = val(data.contratacion.cargoUOficio) || val(meta.rolBuscadoSistema);
  const apellidos = [d.primerApellido, d.segundoApellido].map((s) => s.trim()).filter(Boolean).join(' ');
  const nombres = [d.primerNombre, d.segundoNombre].map((s) => s.trim()).filter(Boolean).join(' ');

  return (
    <Document>
      <Page size="A4" style={st.page}>
        <GacetaHeader page={1} total={TOTAL_PAGES} />
        <View style={st.frame}>
          <Text style={st.planillaTitle}>{HOJA_VIDA_PLANILLA_TITULO}</Text>
          <Text style={st.planillaSub}>{HOJA_VIDA_PLANILLA_SUBTITULO}</Text>
          <PlanillaPatronoStrip campos={meta.planillaPatrono} />

          <RomanSection code="I" title="Identificación del trabajador" />

          <View style={st.row}>
            <View style={st.photoBox}>
              <Text style={st.cellLabel}>Fotografía tipo carnet (vertical)</Text>
              <View style={st.photoInner}>
                <Text style={{ fontSize: 5.5, color: '#64748b' }}>{d.fotoUrl.trim() ? '(URL en expediente digital)' : '—'}</Text>
              </View>
            </View>
            <View style={{ flex: 1, marginLeft: 4, gap: 0 }}>
              <View style={st.row}>
                <CellBox label="Apellidos" value={apellidos} flex={1} />
              </View>
              <View style={[st.row, { marginTop: -1 }]}>
                <CellBox label="Nombres" value={nombres} flex={1} />
              </View>
              <View style={[st.row, { marginTop: -1 }]}>
                <View style={[st.cell, { flex: 1, flexDirection: 'row', alignItems: 'stretch' }]}>
                  <View style={{ flex: 1, paddingRight: 3 }}>
                    <Text style={st.cellLabel}>Cédula de identidad</Text>
                    <Text style={st.cellValue}>{val(d.cedulaIdentidad)}</Text>
                  </View>
                  <View
                    style={{
                      width: '24%',
                      borderLeftWidth: 1,
                      borderLeftColor: '#000',
                      paddingLeft: 2,
                    }}
                  >
                    <Text style={st.cellLabel}>Edad</Text>
                    <Text style={st.cellValue}>{val(d.edad)}</Text>
                  </View>
                </View>
                <CellBox label="Fecha de nacimiento" value={d.fechaNacimiento} w="36%" />
              </View>
            </View>
          </View>

          <View style={[st.row, { marginTop: -1 }]}>
            <CellBox label="Estado civil" value={d.estadoCivil} w="26%" />
            <CellBox label="Lugar de nacimiento" value={d.lugarNacimiento} flex={1} />
            <CellBox label="País de nacimiento" value={d.paisNacimiento} w="30%" />
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBox label="Nacionalidad" value={d.nacionalidad} flex={1} />
            <CellBox label="Inscripción IVSS" value={siNoLabel(d.inscripcionIvss)} w="22%" />
            <CellBox label="Zurdo" value={siNoLabel(d.zurdo)} w="18%" />
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBox label="Clase de visa" value={d.claseVisa} flex={1} />
            <CellBox label="Validez visa hasta" value={d.visaValidezHasta} w="36%" />
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBox label="Dirección de habitación o domicilio" value={d.direccionDomicilio} flex={1} />
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBox label="Teléfono celular" value={d.celular} flex={1} />
            <CellBox label="Teléfono habitación" value={d.telHabitacion} w="32%" />
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBox label="Correo electrónico" value={d.correoElectronico} flex={1} />
          </View>
          <View style={[st.photoCedulaOuter, { marginTop: -1 }]}>
            <Text style={st.cellLabel}>Fotografía de la cédula (apaisada / horizontal)</Text>
            <View style={st.photoCedulaSlot}>
              <Text style={{ fontSize: 5.5, color: '#64748b' }}>
                {d.fotoCedulaUrl.trim() ? '(URL en expediente digital)' : '—'}
              </Text>
            </View>
          </View>

          <RomanSection code="II" title="Datos de la contratación y certificaciones" />
          <View style={st.row}>
            <CellBox label="Cargo u oficio a desempeñar" value={cargoContrato} flex={1} />
            <CellBox label="Cargo (tabulador / sistema)" value={[meta.cargoCodigo, meta.cargoNombre].filter(Boolean).join(' · ')} w="38%" />
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBox label="Antecedentes penales (según certificado)" value={siNoLabel(data.certificadoAntecedentesPenales.antecedentesPenales)} w="28%" />
            <CellBox label="Expedido por" value={data.certificadoAntecedentesPenales.expedidoPor} flex={1} />
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBox label="Lugar (certificado)" value={data.certificadoAntecedentesPenales.lugar} flex={1} />
            <CellBox label="Fecha de expedición" value={data.certificadoAntecedentesPenales.fechaExpedicion} w="34%" />
          </View>

          <RomanSection code="III" title="Instrucción y capacitación" />
          <View style={st.row}>
            <CellBox label="Sabe leer y escribir" value={siNoLabel(data.instruccionCapacitacion.sabeLeer)} w="28%" />
            <View style={[st.cell, { flex: 1, marginLeft: -1 }]}>
              <Text style={st.cellLabel}>Grado de instrucción (marque)</Text>
              <Text style={st.chkLine}>
                {chkPair('Prim.', data.instruccionCapacitacion.instruccionPrimaria)} {'  '}
                {chkPair('Sec.', data.instruccionCapacitacion.instruccionSecundaria)} {'  '}
                {chkPair('Téc.', data.instruccionCapacitacion.tecnica)} {'  '}
                {chkPair('Sup.', data.instruccionCapacitacion.superior)}
              </Text>
            </View>
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBox label="Profesión u oficio actual" value={data.instruccionCapacitacion.profesionUOficioActual} flex={1} />
          </View>

          <Text style={st.note}>
            Expediente generado el {meta.emitidoEn}. Estado en proceso: {val(meta.estadoProceso)}. Documento de una hoja
            (frente y reverso).
          </Text>
        </View>
        <GacetaFooter />
      </Page>

      <Page size="A4" style={st.page}>
        <GacetaHeader page={2} total={TOTAL_PAGES} />
        <View style={st.frame}>
          <RomanSection code="IV" title="Actividad gremial o sindical" />
          <View style={st.row}>
            <CellBox label="Federación, sindicato o gremio" value={data.actividadGremial.federacionSindicatoGremio} flex={1} />
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBox label="Cargo que ejerce en la organización" value={data.actividadGremial.cargoQueEjerce} flex={1} />
          </View>

          <RomanSection code="V" title="Antecedentes médicos" />
          <View style={st.row}>
            <CellBox label="Examen médico previo" value={siNoLabel(data.antecedentesMedicos.examenMedicoPrevio)} w="22%" />
            <CellBox label="Efectuado por" value={data.antecedentesMedicos.efectuadoPor} w="34%" />
            <CellBox label="Fecha del examen" value={data.antecedentesMedicos.fechaExamenMedico} w="22%" />
            <CellBox label="Tipo de sangre" value={data.antecedentesMedicos.tipoSangre} w="22%" />
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBox label="Enfermedades padecidas" value={data.antecedentesMedicos.enfermedadesPadecidas} flex={1} />
            <CellBox label="Incapacidades físicas o funcionales" value={data.antecedentesMedicos.incapacidadesFisicasOFuncionales} flex={1} />
          </View>

          <RomanSection code="VI" title="Peso y medidas (dotación EPP / uniforme)" />
          <View style={st.row}>
            <CellBox label="Peso (kg)" value={data.pesoMedidas.peso} w="16%" />
            <CellBox label="Estatura (m)" value={data.pesoMedidas.estatura} w="16%" />
            <CellBox label="Talla camisa" value={data.pesoMedidas.tallaCamisa} w="17%" />
            <CellBox label="Talla pantalón" value={data.pesoMedidas.tallaPantalon} w="17%" />
            <CellBox label="Talla bragas" value={data.pesoMedidas.tallaBragas} w="17%" />
            <CellBox label="Nº botas" value={data.pesoMedidas.medidaBotas} w="17%" />
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBox label="Observaciones" value={data.pesoMedidas.observaciones} flex={1} />
          </View>

          <RomanSection code="VII" title="Familiares dependientes a cargo" />
          <View style={st.tableHead}>
            <Text style={[st.th, { width: '5%' }]}>N°</Text>
            <Text style={[st.th, { width: '24%' }]}>Apellidos y nombres</Text>
            <Text style={[st.th, { width: '18%' }]}>Parentesco</Text>
            <Text style={[st.th, { width: '14%' }]}>Fecha nac.</Text>
            <Text style={[st.th, { width: '10%' }]}>N/A</Text>
            <Text style={[st.th, { width: '29%', borderRightWidth: 0 }]}>Observaciones</Text>
          </View>
          {data.familiaresDependientes.map((dep, i) => (
            <View key={i} style={st.tableRow} wrap={false}>
              <Text style={[st.td, { width: '5%', flex: undefined, maxWidth: '5%' }]}>{String(i + 1)}</Text>
              <Text style={[st.td, { width: '24%', flex: undefined }]}>
                {[dep.apellido, dep.nombre].filter((s) => s.trim()).join(', ') || '—'}
              </Text>
              <Text style={[st.td, { width: '18%', flex: undefined }]}>{val(dep.parentesco)}</Text>
              <Text style={[st.td, { width: '14%', flex: undefined }]}>{val(dep.fechaNacimiento)}</Text>
              <Text style={[st.td, { width: '10%', flex: undefined }]}>{dep.noAplica ? 'Sí' : '—'}</Text>
              <Text style={[st.tdLast, { width: '29%', flex: undefined }]}>{val(dep.observaciones)}</Text>
            </View>
          ))}

          <RomanSection code="VIII" title="Experiencia laboral (trabajos previos)" />
          <View style={st.tableHead}>
            <Text style={[st.th, { width: '22%' }]}>Empresa / patrono</Text>
            <Text style={[st.th, { width: '14%' }]}>Lugar</Text>
            <Text style={[st.th, { width: '16%' }]}>Oficio o cargo</Text>
            <Text style={[st.th, { width: '14%' }]}>Duración</Text>
            <Text style={[st.th, { width: '14%' }]}>F. retiro</Text>
            <Text style={[st.th, { width: '20%', borderRightWidth: 0 }]}>Motivo retiro</Text>
          </View>
          {data.trabajosPrevios.map((t: TrabajoPrevio, i: number) => (
            <View key={i} style={st.tableRow} wrap={false}>
              <Text style={[st.td, { width: '22%', flex: undefined }]}>{val(t.empresaPatrono)}</Text>
              <Text style={[st.td, { width: '14%', flex: undefined }]}>{val(t.lugar)}</Text>
              <Text style={[st.td, { width: '16%', flex: undefined }]}>{val(t.oficioOCargo)}</Text>
              <Text style={[st.td, { width: '14%', flex: undefined }]}>{val(t.duracion)}</Text>
              <Text style={[st.td, { width: '14%', flex: undefined }]}>{val(t.fechaRetiro)}</Text>
              <Text style={[st.tdLast, { width: '20%', flex: undefined }]}>{val(t.motivoRetiro)}</Text>
            </View>
          ))}

          <Text style={[st.note, { marginTop: 3 }]}>
            Declaración: la información consignada corresponde a la mejor información del trabajador y será contrastada
            por la entidad de trabajo / RRHH conforme a la LOTTT y a la normativa sectorial aplicable.
          </Text>

          <SeccionFirmaHuella firma={meta.firmaTrabajador} />
        </View>
        <GacetaFooter extra={`Impreso: ${meta.emitidoEn}.`} />
      </Page>
    </Document>
  );
}

const PLANTILLA_TOTAL = 2;

export function HojaDeVidaObreroLegalPlantillaPdfDoc() {
  return (
    <Document>
      <Page size="A4" style={st.page}>
        <GacetaHeader page={1} total={PLANTILLA_TOTAL} />
        <View style={st.frame}>
          <Text style={st.planillaTitle}>{HOJA_VIDA_PLANILLA_TITULO}</Text>
          <Text style={st.planillaSub}>{HOJA_VIDA_PLANILLA_SUBTITULO}</Text>
          <PlanillaPatronoStrip />

          <RomanSection code="I" title="Identificación del trabajador" />
          <View style={st.row}>
            <View style={st.photoBox}>
              <Text style={st.cellLabel}>Fotografía tipo carnet</Text>
              <Text style={{ fontSize: 6, marginTop: 20, color: '#94a3b8' }}>{BLANK}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 4 }}>
              <CellBlank label="Apellidos" flex={1} />
              <View style={[st.row, { marginTop: -1 }]}>
                <CellBlank label="Nombres" flex={1} />
              </View>
              <View style={[st.row, { marginTop: -1 }]}>
                <View style={[st.cell, { flex: 1, flexDirection: 'row', alignItems: 'stretch' }]}>
                  <View style={{ flex: 1, paddingRight: 3 }}>
                    <Text style={st.cellLabel}>Cédula de identidad</Text>
                    <Text style={st.cellValue}>{BLANK}</Text>
                  </View>
                  <View
                    style={{
                      width: '24%',
                      borderLeftWidth: 1,
                      borderLeftColor: '#000',
                      paddingLeft: 2,
                    }}
                  >
                    <Text style={st.cellLabel}>Edad</Text>
                    <Text style={st.cellValue}>{BLANK}</Text>
                  </View>
                </View>
                <CellBlank label="Fecha de nacimiento" w="36%" />
              </View>
            </View>
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBlank label="Estado civil" w="26%" />
            <CellBlank label="Lugar de nacimiento" flex={1} />
            <CellBlank label="País de nacimiento" w="30%" />
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBlank label="Nacionalidad" flex={1} />
            <CellBlank label="Inscripción IVSS" w="22%" />
            <CellBlank label="Zurdo" w="18%" />
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBlank label="Clase de visa" flex={1} />
            <CellBlank label="Validez visa hasta" w="36%" />
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBlank label="Dirección de habitación o domicilio" flex={1} />
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBlank label="Teléfono celular" flex={1} />
            <CellBlank label="Teléfono habitación" w="32%" />
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBlank label="Correo electrónico" flex={1} />
          </View>
          <View style={[st.photoCedulaOuter, { marginTop: -1 }]}>
            <Text style={st.cellLabel}>Fotografía de la cédula (apaisada / horizontal)</Text>
            <View style={st.photoCedulaSlot}>
              <Text style={{ fontSize: 5.5, color: '#94a3b8' }}>{BLANK}</Text>
            </View>
          </View>

          <RomanSection code="II" title="Datos de la contratación y certificaciones" />
          <View style={st.row}>
            <CellBlank label="Cargo u oficio a desempeñar" flex={1} />
            <CellBlank label="Cargo (tabulador)" w="38%" />
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBlank label="Antecedentes penales" w="28%" />
            <CellBlank label="Expedido por" flex={1} />
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBlank label="Lugar" flex={1} />
            <CellBlank label="Fecha de expedición" w="34%" />
          </View>

          <RomanSection code="III" title="Instrucción y capacitación" />
          <View style={st.row}>
            <CellBlank label="Sabe leer y escribir" w="28%" />
            <View style={[st.cell, { flex: 1, marginLeft: -1 }]}>
              <Text style={st.cellLabel}>Grado de instrucción (marque)</Text>
              <Text style={st.chkLine}>[   ] Prim.   [   ] Sec.   [   ] Téc.   [   ] Sup.</Text>
            </View>
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBlank label="Profesión u oficio actual" flex={1} />
          </View>
        </View>
        <GacetaFooter />
      </Page>

      <Page size="A4" style={st.page}>
        <GacetaHeader page={2} total={PLANTILLA_TOTAL} />
        <View style={st.frame}>
          <RomanSection code="IV" title="Actividad gremial o sindical" />
          <CellBlank label="Federación, sindicato o gremio" />
          <View style={{ marginTop: -1 }}>
            <CellBlank label="Cargo que ejerce en la organización" />
          </View>

          <RomanSection code="V" title="Antecedentes médicos" />
          <View style={st.row}>
            <CellBlank label="Examen médico previo" w="22%" />
            <CellBlank label="Efectuado por" w="34%" />
            <CellBlank label="Fecha del examen" w="22%" />
            <CellBlank label="Tipo de sangre" w="22%" />
          </View>
          <View style={[st.row, { marginTop: -1 }]}>
            <CellBlank label="Enfermedades padecidas" flex={1} />
            <CellBlank label="Incapacidades físicas o funcionales" flex={1} />
          </View>

          <RomanSection code="VI" title="Peso y medidas" />
          <View style={st.row}>
            <CellBlank label="Peso (kg)" w="16%" />
            <CellBlank label="Estatura (m)" w="16%" />
            <CellBlank label="Talla camisa" w="17%" />
            <CellBlank label="Talla pantalón" w="17%" />
            <CellBlank label="Talla bragas" w="17%" />
            <CellBlank label="Nº botas" w="17%" />
          </View>
          <View style={{ marginTop: -1 }}>
            <CellBlank label="Observaciones" />
          </View>

          <RomanSection code="VII" title="Familiares dependientes a cargo" />
          <View style={st.tableHead}>
            <Text style={[st.th, { width: '5%' }]}>N°</Text>
            <Text style={[st.th, { width: '24%' }]}>Apellidos y nombres</Text>
            <Text style={[st.th, { width: '18%' }]}>Parentesco</Text>
            <Text style={[st.th, { width: '14%' }]}>Fecha nac.</Text>
            <Text style={[st.th, { width: '10%' }]}>N/A</Text>
            <Text style={[st.th, { width: '29%', borderRightWidth: 0 }]}>Observaciones</Text>
          </View>
          {[1, 2, 3, 4, 5].map((n) => (
            <View key={n} style={st.tableRow} wrap={false}>
              <Text style={[st.td, { width: '5%', flex: undefined }]}>{String(n)}</Text>
              <Text style={[st.td, { width: '24%', flex: undefined }]}>{BLANK}</Text>
              <Text style={[st.td, { width: '18%', flex: undefined }]}>{BLANK}</Text>
              <Text style={[st.td, { width: '14%', flex: undefined }]}>{BLANK}</Text>
              <Text style={[st.td, { width: '10%', flex: undefined }]}>{BLANK}</Text>
              <Text style={[st.tdLast, { width: '29%', flex: undefined }]}>{BLANK}</Text>
            </View>
          ))}

          <RomanSection code="VIII" title="Experiencia laboral (trabajos previos)" />
          <View style={st.tableHead}>
            <Text style={[st.th, { width: '22%' }]}>Empresa / patrono</Text>
            <Text style={[st.th, { width: '14%' }]}>Lugar</Text>
            <Text style={[st.th, { width: '16%' }]}>Oficio o cargo</Text>
            <Text style={[st.th, { width: '14%' }]}>Duración</Text>
            <Text style={[st.th, { width: '14%' }]}>F. retiro</Text>
            <Text style={[st.th, { width: '20%', borderRightWidth: 0 }]}>Motivo retiro</Text>
          </View>
          {[1, 2].map((n) => (
            <View key={n} style={st.tableRow} wrap={false}>
              <Text style={[st.td, { width: '22%', flex: undefined }]}>{BLANK}</Text>
              <Text style={[st.td, { width: '14%', flex: undefined }]}>{BLANK}</Text>
              <Text style={[st.td, { width: '16%', flex: undefined }]}>{BLANK}</Text>
              <Text style={[st.td, { width: '14%', flex: undefined }]}>{BLANK}</Text>
              <Text style={[st.td, { width: '14%', flex: undefined }]}>{BLANK}</Text>
              <Text style={[st.tdLast, { width: '20%', flex: undefined }]}>{BLANK}</Text>
            </View>
          ))}

          <Text style={[st.note, { marginTop: 3 }]}>
            Declaración: la información consignada será contrastada por RRHH conforme a la LOTTT y normativa sectorial.
          </Text>
          <SeccionFirmaHuella />
        </View>
        <GacetaFooter />
      </Page>
    </Document>
  );
}
