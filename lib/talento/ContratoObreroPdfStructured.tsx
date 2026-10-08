import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { razonSocialPatronoParaContratoPdf } from '@/lib/talento/razonSocialContratoPdf';
import {
  oficinaRegistroMercantilComparecencia,
} from '@/lib/talento/textoInscripcionRegistroMercantilContrato';
import { fechaLargaRegistroMercantilContratoVe } from '@/lib/talento/registroMercantilCamposPdf';
import { nacionalidadRepresentanteSegunGenero } from '@/lib/talento/nacionalidadRepresentanteSegunGenero';
import { trabajadorFemeninoDesdeEstadoCivil } from '@/lib/talento/cedulaAuth';
import { COMPLEMENTO_ALIMENTACION_SEMANAL_USD } from '@/lib/nomina/reglasPagoObra';
import {
  TABULADOR_HOMOLOGADO_2026_REFERENCIA,
  alimentacionSemanalUsdAnclada,
  nivelDesdeCodigoOficio,
  nivelDesdeSalarioDiario2023,
  salarioDiarioHomologado,
} from '@/lib/nomina/tabuladorHomologado2026';

/**
 * Tipografía del contrato (PDF estándar vía @react-pdf/renderer).
 * Times-Roman ≈ Times New Roman (fuente PDF estándar; no requiere TTF externo).
 * Página: LETTER (hoja carta). Cuerpo 12 pt, interlineado 1.5.
 */
const CONTRATO_PDF_FONT_FAMILY = 'Times-Roman';
/** Negrita en PDF vía familia explícita (anidar `fontWeight` falla en @react-pdf 4.x). */
const CONTRATO_PDF_FONT_BOLD = 'Times-Bold';
const CONTRATO_PDF_FONT_SIZE = 12;
/** Interlineado 1.5 respecto al cuerpo. */
const CONTRATO_PDF_LINE_HEIGHT = 1.5;

const styles = StyleSheet.create({
  page: {
    paddingTop: 54,
    paddingBottom: 54,
    paddingHorizontal: 72,
    fontFamily: CONTRATO_PDF_FONT_FAMILY,
    fontSize: CONTRATO_PDF_FONT_SIZE,
    lineHeight: CONTRATO_PDF_LINE_HEIGHT,
    color: '#000',
  },
  pageFirst: {
    paddingTop: 48,
    paddingBottom: 54,
  },
  header: {
    fontFamily: CONTRATO_PDF_FONT_BOLD,
    fontSize: CONTRATO_PDF_FONT_SIZE,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: CONTRATO_PDF_LINE_HEIGHT,
    color: '#000',
  },
  paragraph: {
    marginBottom: 10,
    textAlign: 'justify',
    lineHeight: CONTRATO_PDF_LINE_HEIGHT,
    fontFamily: CONTRATO_PDF_FONT_FAMILY,
    fontSize: CONTRATO_PDF_FONT_SIZE,
    color: '#000',
  },
  paragraphIntro: { marginBottom: 8, lineHeight: CONTRATO_PDF_LINE_HEIGHT },
  bold: {
    fontFamily: CONTRATO_PDF_FONT_BOLD,
    fontSize: CONTRATO_PDF_FONT_SIZE,
    lineHeight: CONTRATO_PDF_LINE_HEIGHT,
    color: '#000',
  },
  /** Comparecencia: tramo «(El) centro comercial …» en Times normal (no Times-Bold). */
  introComparecenciaRegular: {
    fontFamily: CONTRATO_PDF_FONT_FAMILY,
    fontSize: CONTRATO_PDF_FONT_SIZE,
    lineHeight: CONTRATO_PDF_LINE_HEIGHT,
    color: '#000',
  },
  signatureSection: { flexDirection: 'row', marginTop: 24, justifyContent: 'space-between' },
  signatureBox: { width: '48%', paddingTop: 4, textAlign: 'left', lineHeight: CONTRATO_PDF_LINE_HEIGHT },
  signatureLine: {
    marginBottom: 2,
    lineHeight: CONTRATO_PDF_LINE_HEIGHT,
    fontFamily: CONTRATO_PDF_FONT_FAMILY,
    fontSize: CONTRATO_PDF_FONT_SIZE,
    color: '#000',
  },
  /** Etiquetas «POR LA ENTIDAD…» en negrita sin pisar la fuente con `signatureLine`. */
  signatureLabelBold: {
    marginBottom: 2,
    lineHeight: CONTRATO_PDF_LINE_HEIGHT,
    fontFamily: CONTRATO_PDF_FONT_BOLD,
    fontSize: CONTRATO_PDF_FONT_SIZE,
    color: '#000',
  },
  signUnderline: {
    borderBottomWidth: 1,
    borderColor: '#000',
    width: '100%',
    height: 18,
    marginTop: 4,
    marginBottom: 6,
  },
  meta: {
    fontFamily: CONTRATO_PDF_FONT_FAMILY,
    fontSize: CONTRATO_PDF_FONT_SIZE,
    marginBottom: 12,
    textAlign: 'center',
    color: '#000',
    lineHeight: CONTRATO_PDF_LINE_HEIGHT,
  },
  metaFirst: { marginBottom: 8 },
  /** Misma base tipográfica; bloques de cláusulas con interlineado 1.5. */
  clauseDense: {
    fontFamily: CONTRATO_PDF_FONT_FAMILY,
    fontSize: CONTRATO_PDF_FONT_SIZE,
    lineHeight: CONTRATO_PDF_LINE_HEIGHT,
    textAlign: 'justify',
    color: '#000',
  },
});

export type EntidadContratoPdf = {
  nombre_legal?: string | null;
  nombre?: string | null;
  rif?: string | null;
  domicilio_fiscal?: string | null;
  direccion_fiscal?: string | null;
  /** Opcional: municipio de la sede (comparecencia). Si falta, línea en blanco en el PDF. */
  municipio_fiscal?: string | null;
  /** Opcional: estado de la sede (comparecencia). */
  estado_fiscal?: string | null;
  /** Sector / urbanización del domicilio social según RM (comparecencia: antes de municipio y estado). */
  sector_domicilio_registro?: string | null;
  representante_legal?: string | null;
  rep_legal_nombre?: string | null;
  rep_legal_cedula?: string | null;
  rep_legal_cargo?: string | null;
  /** Opcional: nacionalidad del representante (comparecencia). */
  rep_legal_nacionalidad?: string | null;
  /** Opcional: estado civil del representante (comparecencia). */
  rep_legal_estado_civil?: string | null;
  /** Vía / urbanización del domicilio del representante (comparecencia). */
  rep_legal_domicilio?: string | null;
  /** Municipio de residencia del representante (comparecencia). */
  rep_legal_municipio_residencia?: string | null;
  /** Estado de residencia del representante (comparecencia). */
  rep_legal_estado_residencia?: string | null;
  rm_oficina?: string | null;
  rm_fecha?: string | null;
  rm_numero?: string | null;
  rm_tomo?: string | null;
  /** Si true, «Sra.» en comparecencia; si false/undefined, «Sr.». */
  rep_legal_femenino?: boolean | null;
};

export type EmpleadoContratoPdf = {
  nombres?: string | null;
  nombre_completo?: string | null;
  nacionalidad?: string | null;
  estado_civil?: string | null;
  cedula?: string | null;
  documento?: string | null;
  direccion_domicilio?: string | null;
  direccion_habitacion?: string | null;
  /** Opcional: municipio del domicilio del trabajador (comparecencia). */
  municipio_domicilio?: string | null;
  /** Opcional: estado del domicilio del trabajador (comparecencia). */
  estado_domicilio?: string | null;
  cargo_nombre?: string | null;
  /** Código tabulador (ej. 5.1) para auto-relleno de labores. */
  cargo_codigo?: string | null;
  tareas_especificas?: string | null;
  funciones_oficiales?: string | null;
};

export type ConfigNominaContratoPdf = {
  funciones_oficiales?: string | null;
  salario_base_mensual?: number | null;
  cestaticket_mensual?: number | null;
  salario_basico_diario_ves?: number | null;
};

export type ParametrosContratoPdf = {
  tipoPlazo?: string | null;
  fechaIngreso?: string | null;
  duracionSemanasReferencial?: string | null;
  horarioSemanal?: string | null;
  fechaFirmaContratoIso?: string | null;
  fechaAsambleaVoluntadIso?: string | null;
  ingresoSemanalConsolidadoUsdTexto?: string | null;
  /** Reservado (contratos anteriores). La Cl. SEXTA ya no usa un bono para completar un ingreso semanal. */
  bonoManualUsd?: number | null;
  /** Reservado. El complemento semanal de la Cl. SEXTA es fijo (33 USD) y no usa el arreglo. */
  arregloSemanalUsd?: number | null;
  /** Arreglo de pago mensual (cada cuatro semanas trabajadas). Si viene, agrega su cláusula. */
  arregloMensualUsd?: number | null;
  textoPuntoEncuentroTransporteSex?: string | null;
  compensacionCulminacionUsdPorMes?: number | null;
  /** Ciudad domicilio procesal (cláusula DÉCIMA). Default Pampatar. */
  domicilioProcesalCiudad?: string | null;
};

export type ContratoObreroDetallePdf = {
  objeto_contrato?: string | null;
  lugar_prestacion_servicio?: string | null;
  /** Nombre del proyecto / obra (`ci_proyectos.nombre`) para «obra denominada» en cláusula primera. */
  obra_denominada?: string | null;
};

export type ContratoObreroPdfStructuredProps = {
  expedienteId?: string | null;
  /** Contrato express: cestaticket 40 USD/mes (10 USD/semana) en textos legales, sin derivar USD desde VES del tabulador. */
  esContratoExpress?: boolean;
  empleado: EmpleadoContratoPdf;
  entidad: EntidadContratoPdf;
  configNomina: ConfigNominaContratoPdf;
  parametros: ParametrosContratoPdf;
  contrato?: ContratoObreroDetallePdf | null;
};

function str(v: string | null | undefined, fallback: string): string {
  const t = (v ?? '').trim();
  return t.length ? t : fallback;
}

/** Zona de comparecencia (antes «Sector …»); si no hay dato en entidad, texto fijado para el contrato. */
const ZONA_COMPARECENCIA_PDF_DEFAULT = 'Playa El Angel';

/** Comas “raras” del teclado / copiar-pegar → ASCII para partir el domicilio. */
function normalizarComasDomicilioPdf(s: string): string {
  return s
    .replace(/\uFF0C/g, ',')
    .replace(/\uFE50/g, ',')
    .replace(/\uFE51/g, ',')
    .trim();
}

/** Si falta coma entre el nombre del C.C. y «Sector …», insértala para poder quitar «Sector» y partir negrita. */
function insertComaAntesSectorTrasCentroComercial(s: string): string {
  return s.replace(/\b((?:el\s+)?centro\s+comercial[^,]*?)\s+(sector\b)/gi, '$1, $2');
}

/** Una sola línea: Unicode, espacios raros, comas; luego quita «Sector» (comparecencia). */
function preprocessLineaDomicilioComparecenciaPdf(raw: string): string {
  const oneLine = (raw ?? '')
    .normalize('NFKC')
    .replace(/\uFEFF/g, '')
    .replace(/[\u00A0\u202F\u2007]/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const conComaSector = insertComaAntesSectorTrasCentroComercial(oneLine);
  return quitarPalabraSectorEnDomicilio(normalizarComasDomicilioPdf(conComaSector));
}

function esPrefijoCentroComercialComparecencia(pref: string): boolean {
  return /^(?:el\s+)?centro\s+comercial\b/i.test(pref.trim());
}

type FragmentosDomicilioCentroComercialPdf = {
  textoRegular: string;
  restoBold: string;
  /** Texto antes de «(el) centro comercial» (p. ej. calle); va en negrita si existe. */
  prefijoBold?: string;
};

/**
 * Parte «(El) centro comercial …» (sin negrita) del resto del domicilio (negrita). Tolera texto previo y comas raras.
 */
function fragmentosDomicilioCentroComercial(domPreprocesado: string): FragmentosDomicilioCentroComercialPdf | null {
  const s = domPreprocesado.trim();
  if (!s) return null;

  const direct = s.match(/^((?:el\s+)?centro\s+comercial[^,]*)(,\s*(.+))?$/i);
  if (direct?.[1] && esPrefijoCentroComercialComparecencia(direct[1])) {
    const pref = direct[1].trim();
    const rest = quitarPalabraSectorEnDomicilio((direct[3] ?? '').trim());
    const textoRegular = quitarPalabraSectorEnDomicilio(rest ? `${pref},` : pref);
    return { textoRegular, restoBold: rest };
  }

  const flex = s.match(/^(.*?)(\b(?:el\s+)?centro\s+comercial[^,]*)(,\s*(.+))?$/i);
  if (flex?.[2] && esPrefijoCentroComercialComparecencia(flex[2])) {
    const pfxRaw = (flex[1] ?? '').trim();
    const pref = flex[2].trim();
    const rest = quitarPalabraSectorEnDomicilio((flex[4] ?? '').trim());
    const pfxClean = pfxRaw.length ? quitarPalabraSectorEnDomicilio(pfxRaw).trim() : '';
    const textoRegular = quitarPalabraSectorEnDomicilio(rest ? `${pref},` : pref);
    return {
      prefijoBold: pfxClean.length ? pfxClean : undefined,
      textoRegular,
      restoBold: rest,
    };
  }

  return null;
}

/** Espacios invisibles / guionación que impiden que `\bsector\b` coincida con el texto pegado desde RM/UI. */
function stripInvisiblesDomicilioPdf(s: string): string {
  return s
    .replace(/\u00AD/g, '')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .trim();
}

/** Quita la palabra «Sector» del texto de domicilio o zona (p. ej. «Sector Playa El Angel» → «Playa El Angel»). */
function quitarPalabraSectorEnDomicilio(s: string): string {
  let out = stripInvisiblesDomicilioPdf(s).normalize('NFKC').trim();
  for (let i = 0; i < 8; i++) {
    const next = out
      .replace(/^sector\s+/gi, '')
      .replace(/,?\s*\bsector\b\s*,/gi, ', ')
      .replace(/,?\s*\bsector\b\s+/gi, ', ')
      .replace(/\s+\bsector\b\s*,/gi, ', ')
      .replace(/\s+\bsector\b\s+/gi, ' ')
      .replace(/,\s*\bsector\b\s*$/gi, '')
      .replace(/\bsector\b\s*$/gi, '')
      .replace(/,\s*,+/g, ',')
      .replace(/^\s*,\s*/, '')
      .trim();
    if (next === out) break;
    out = next;
  }
  out = out
    .replace(/\bsector\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*,\s*,+/g, ', ')
    .replace(/^\s*,\s*/, '')
    .replace(/,\s*$/g, '')
    .trim();
  /* Pasada extra: token «sector» tras delimitadores típicos aunque `\b` falle con caracteres raros. */
  for (let i = 0; i < 6; i++) {
    const next = out
      .replace(/(^|[\s,;:'"(\[\{])sector(?=[\s,;:'")\]\}.]|$)/gi, '$1')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s*,\s*,+/g, ', ')
      .replace(/^\s*,\s*/, '')
      .replace(/,\s*$/g, '')
      .trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

function normZonaComparecenciaPdf(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function partesFechaCierreFirma(iso: string | null | undefined): { dia: string; mes: string; anio: string } {
  const t = (iso ?? '').trim();
  const ymd = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12, 0, 0);
    if (!Number.isNaN(d.getTime())) {
      return {
        dia: d.toLocaleDateString('es-VE', { day: 'numeric' }),
        mes: d.toLocaleDateString('es-VE', { month: 'long' }),
        anio: d.toLocaleDateString('es-VE', { year: 'numeric' }),
      };
    }
  }
  return { dia: '________', mes: '____________________', anio: '2026' };
}

function formatCedulaIdentidad(raw: string | null | undefined): string {
  const compact = (raw ?? '').trim().replace(/\s+/g, '');
  if (!compact) return 'V___________';
  const upper = compact.toUpperCase();
  const m = upper.match(/^([VE])(.*)$/);
  if (m) {
    const letra = m[1];
    const digits = m[2].replace(/[^\d]/g, '');
    if (!digits) return `${letra}___________`;
    return `${letra}${digits}`;
  }
  const digitsOnly = upper.replace(/[^\d]/g, '');
  if (digitsOnly) return `V${digitsOnly}`;
  return 'V___________';
}

/** Estilo acta: «V- 12345678» o placeholder. */
function cedulaConGuion(raw: string | null | undefined): string {
  const f = formatCedulaIdentidad(raw);
  if (f === 'V___________' || f === 'E___________') return `${f.charAt(0)}- _______________`;
  const m = f.match(/^([VE])(\d+)$/);
  if (m) return `${m[1]}- ${m[2]}`;
  return f;
}

function esLugarPrestacionPlaceholder(l: string): boolean {
  const t = l.trim().toLowerCase();
  if (!t) return true;
  if (t === 'por definir' || t === 'por definir.' || t === 'sin definir' || t === 'sin especificar') return true;
  if (t === 'tbd' || t === '—' || t === '-' || t === 'n/a') return true;
  return false;
}

function faseTecnicaClausulaPrimera(contrato: ContratoObreroDetallePdf | null | undefined): string {
  const o = (contrato?.objeto_contrato ?? '').trim();
  if (o.length) return o;
  return '_______________________________________________________________________________';
}

function obraDenominadaClausulaPrimera(contrato: ContratoObreroDetallePdf | null | undefined): string {
  const n = (contrato?.obra_denominada ?? '').trim();
  if (n.length) return n;
  return '__________________________________________________';
}

function lugarPrestacionQuinta(contrato: ContratoObreroDetallePdf | null | undefined): string {
  const l = (contrato?.lugar_prestacion_servicio ?? '').trim();
  if (l.length && !esLugarPrestacionPlaceholder(l)) return l;
  return '_______________________________________________________________________________';
}

function fmtBsVes(n: number): string {
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtUsdNumeroPlano(n: number): string {
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function limpiarNombreRepresentanteLegal(n: string): string {
  let t = n.trim().replace(/\s+/g, ' ');
  if (!t) return t;
  t = t.replace(/\s*\d{7,}\s*$/, '').trim();
  t = t.replace(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])(\d{2,})$/, '$1').trim();
  return t;
}

/** Texto tras «establecido» en NOVENA (transporte). */
function fragmentoPuntoEncuentroTransporte(raw: string | null | undefined): string {
  const t0 = (raw ?? '').trim();
  if (!t0) return '_______________________________________________';
  return /^en\s/i.test(t0) ? t0 : `en ${t0}`;
}

function ciudadDomicilioProcesal(raw: string | null | undefined): string {
  const t = (raw ?? '').trim();
  return t || 'Pampatar';
}

export function ContratoObreroPDF({
  expedienteId,
  esContratoExpress: _esContratoExpress = false,
  empleado,
  entidad,
  configNomina,
  parametros,
  contrato,
}: ContratoObreroPdfStructuredProps) {
  void _esContratoExpress;
  const nombreLegalSociedad = str(
    razonSocialPatronoParaContratoPdf(entidad.nombre_legal, entidad.nombre),
    '________________________________________________',
  );
  const nombreTrabajador = str(empleado.nombres ?? empleado.nombre_completo, '__________________________________________________');
  const estadoCivilTrab = str(empleado.estado_civil, 'Soltero');
  const trabFemenino = trabajadorFemeninoDesdeEstadoCivil(estadoCivilTrab);
  const articuloCiudadanoTrab = trabFemenino ? 'la ciudadana' : 'el ciudadano';
  const cedulaTrabGuion = cedulaConGuion(empleado.cedula ?? empleado.documento);
  const faseTecnicaTxt = faseTecnicaClausulaPrimera(contrato ?? null);
  const obraDenomTxt = obraDenominadaClausulaPrimera(contrato ?? null);
  const lugarQuintaTxt = lugarPrestacionQuinta(contrato ?? null);
  const oficioStr = (() => {
    const c = (empleado.cargo_nombre ?? '').trim();
    return c ? c.toUpperCase() : '______________________________';
  })();
  const codigoOficioTxt = (empleado.cargo_codigo ?? '').trim().replace(',', '.');
  const oficioTabuladorTxt = codigoOficioTxt ? `${codigoOficioTxt} ${oficioStr}` : oficioStr;
  const fechaCierreIso = parametros.fechaFirmaContratoIso ?? parametros.fechaIngreso;
  const { dia: diaFirma, mes: mesFirma, anio: anioFirma } = partesFechaCierreFirma(fechaCierreIso);

  const sbMen = configNomina.salario_base_mensual;
  const tieneSbMen =
    sbMen != null && Number.isFinite(Number(sbMen)) && Number(sbMen) > 0 ? Number(sbMen) : null;
  /** Nivel del oficio: código del tabulador (5.1 → 5) o, en datos viejos, el salario diario 2023. */
  const nivelOficio =
    nivelDesdeCodigoOficio(empleado.cargo_codigo) ??
    nivelDesdeSalarioDiario2023(
      configNomina.salario_basico_diario_ves ?? (tieneSbMen != null ? tieneSbMen / 30 : null),
    );
  const salDiarioHomologado = salarioDiarioHomologado(nivelOficio);
  const salDiarioTxt = salDiarioHomologado != null ? fmtBsVes(salDiarioHomologado) : '__________________';
  const salSemanalTxt =
    salDiarioHomologado != null ? fmtBsVes(Math.round(salDiarioHomologado * 7 * 100) / 100) : '__________________';
  const cestaSemanalUsdTxt = `${fmtUsdNumeroPlano(alimentacionSemanalUsdAnclada())} USD`;
  const complementoAlimUsdTxt = `${fmtUsdNumeroPlano(COMPLEMENTO_ALIMENTACION_SEMANAL_USD)} USD`;
  const montoUsdPositivo = (v: number | null | undefined): number | null =>
    v != null && Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v) * 100) / 100 : null;
  const arregloMensualUsdNum = montoUsdPositivo(parametros.arregloMensualUsd);

  const HORARIO_DETALLE_PDF_DEFAULT =
    'de lunes a jueves, de 7:00 a.m. a 12:00 m. y de 1:00 p.m. a 5:00 p.m., y los viernes de 7:00 a.m. a 11:00 a.m.';
  const horarioCuartaDetalle = (parametros.horarioSemanal ?? '').trim() || HORARIO_DETALLE_PDF_DEFAULT;

  const rep = limpiarNombreRepresentanteLegal(
    str(entidad.rep_legal_nombre ?? entidad.representante_legal, '________________________________________________'),
  );
  const repCedulaGuion = cedulaConGuion(entidad.rep_legal_cedula);
  const repCargoLinea = str(entidad.rep_legal_cargo, 'Representante Legal');
  const repArticuloLinea = entidad.rep_legal_femenino ? 'Sra.' : 'Sr.';
  const inscripcionRmLinea = (() => {
    const oficina = oficinaRegistroMercantilComparecencia(entidad.rm_oficina);
    const fecha = fechaLargaRegistroMercantilContratoVe(entidad.rm_fecha) ?? '___';
    const num = str(entidad.rm_numero, '___');
    const tomo = str(entidad.rm_tomo, '___');
    return `inscrita por ante ${oficina}, en fecha ${fecha}, quedando anotada bajo el N° ${num}, Tomo ${tomo},`;
  })();
  const razonComparecencia = nombreLegalSociedad.trim().replace(/\.\s*$/, '');
  const domicilioEmpresa = str(
    entidad.domicilio_fiscal ?? entidad.direccion_fiscal,
    '________________________________________________________________',
  );
  const domicilioComparecenciaPdf = preprocessLineaDomicilioComparecenciaPdf(domicilioEmpresa);
  const phMun = '___________';
  const phEdo = '___________';
  const phRepEc = '____________';
  const municipioEmpresa = str(entidad.municipio_fiscal, phMun);
  const estadoEmpresa = str(entidad.estado_fiscal, phEdo);
  const zonaComparecencia = preprocessLineaDomicilioComparecenciaPdf(
    str(entidad.sector_domicilio_registro, ZONA_COMPARECENCIA_PDF_DEFAULT),
  );
  const zonaPdf = quitarPalabraSectorEnDomicilio(zonaComparecencia).trim();
  const nacionalidadRep = nacionalidadRepresentanteSegunGenero(
    entidad.rep_legal_nacionalidad,
    Boolean(entidad.rep_legal_femenino),
  );
  const estadoCivilRep = str(entidad.rep_legal_estado_civil, phRepEc);
  const nacionalidadTrab = nacionalidadRepresentanteSegunGenero(
    empleado.nacionalidad,
    trabFemenino,
  );
  const repCedulaLinea = str(repCedulaGuion, '_______________');
  /** SÉPTIMA: arreglo mensual pactado; si falta, 90 USD (mismo default de ayudante). */
  const compUsdMesTxt = fmtUsdNumeroPlano(arregloMensualUsdNum ?? 90);
  const puntoEncTransporte = fragmentoPuntoEncuentroTransporte(parametros.textoPuntoEncuentroTransporteSex);
  const ciudadProcesal = ciudadDomicilioProcesal(parametros.domicilioProcesalCiudad);
  const fragDomCentroComercial = fragmentosDomicilioCentroComercial(domicilioComparecenciaPdf);
  const textoRegularDomPdf = fragDomCentroComercial
    ? quitarPalabraSectorEnDomicilio(fragDomCentroComercial.textoRegular).trim()
    : '';
  const restoBoldDomSinSector = fragDomCentroComercial?.restoBold
    ? quitarPalabraSectorEnDomicilio(fragDomCentroComercial.restoBold).trim()
    : '';
  const restoTrasCentroComercial = restoBoldDomSinSector;
  const omitirZonaRepetidaTrasDomicilio =
    Boolean(restoTrasCentroComercial) &&
    normZonaComparecenciaPdf(zonaPdf) === normZonaComparecenciaPdf(quitarPalabraSectorEnDomicilio(restoTrasCentroComercial));

  const bloquePortadaIntro = (
    <>
      <Text style={styles.header}>CONTRATO INDIVIDUAL DE TRABAJO POR OBRA DETERMINADA</Text>
      {expedienteId?.trim() ? (
        <Text style={[styles.meta, styles.metaFirst]}>Expediente: {expedienteId.trim()}</Text>
      ) : null}

      <Text style={[styles.paragraph, styles.paragraphIntro, styles.clauseDense]}>
        Entre <Text style={styles.bold}>{razonComparecencia}</Text>, Sociedad Mercantil domiciliada en{' '}
        {fragDomCentroComercial ? (
          <>
            {fragDomCentroComercial.prefijoBold ? (
              <Text style={styles.bold}>
                {quitarPalabraSectorEnDomicilio(fragDomCentroComercial.prefijoBold)}{' '}
              </Text>
            ) : null}
            <Text style={styles.introComparecenciaRegular}>{textoRegularDomPdf} </Text>
            {restoBoldDomSinSector ? (
              <Text style={styles.bold}>{restoBoldDomSinSector}</Text>
            ) : null}
            {!omitirZonaRepetidaTrasDomicilio && zonaPdf.length ? (
              <>
                , <Text style={styles.bold}>{zonaPdf}</Text>
              </>
            ) : null}
            , Municipio <Text style={styles.bold}>{municipioEmpresa}</Text> del estado{' '}
            <Text style={styles.bold}>{estadoEmpresa}</Text>, {inscripcionRmLinea}{' '}
          </>
        ) : (
          <>
            <Text style={styles.introComparecenciaRegular}>{domicilioComparecenciaPdf}</Text>
            {zonaPdf.length ? (
              <>
                , <Text style={styles.bold}>{zonaPdf}</Text>
              </>
            ) : null}
            , Municipio <Text style={styles.bold}>{municipioEmpresa}</Text> del estado{' '}
            <Text style={styles.bold}>{estadoEmpresa}</Text>, {inscripcionRmLinea}{' '}
          </>
        )}
        representada en este acto por su <Text style={styles.bold}>{repCargoLinea}</Text>{' '}
        <Text style={styles.bold}>{repArticuloLinea}</Text> <Text style={styles.bold}>{rep}</Text>,{' '}
        <Text style={styles.bold}>{nacionalidadRep}</Text>, mayor de edad, hábil en derecho,{' '}
        <Text style={styles.bold}>{estadoCivilRep}</Text>, de este domicilio, titular de la cédula de identidad N°{' '}
        <Text style={styles.bold}>{repCedulaLinea}</Text>, quien a los efectos de este contrato se denominará{' '}
        <Text style={styles.bold}>LA ENTIDAD DE TRABAJO</Text>, por una parte; y por la otra, {articuloCiudadanoTrab}{' '}
        <Text style={styles.bold}>{nombreTrabajador}</Text>, <Text style={styles.bold}>{nacionalidadTrab}</Text>, mayor de edad, hábil en
        derecho, <Text style={styles.bold}>{estadoCivilTrab}</Text>, de este domicilio, titular de la cédula de identidad N°{' '}
        <Text style={styles.bold}>{cedulaTrabGuion}</Text>, quien en lo
        sucesivo se denominará <Text style={styles.bold}>EL TRABAJADOR</Text>, se ha convenido en celebrar el
        presente Contrato de Trabajo para una Obra Determinada, conforme al artículo 63 de la LOTTT y a las Cláusulas 18 y 19 de la
        Convención Colectiva de Trabajo para la Rama de la Industria de la Construcción, el cual se regirá por las cláusulas siguientes:
      </Text>
    </>
  );

  const bloqueClausulasPrimeraACuarta = (
    <>
      <Text style={[styles.paragraph, styles.paragraphIntro, styles.clauseDense]}>
        <Text style={styles.bold}>PRIMERA: OBJETO Y MODALIDAD.</Text>
        {` Este contrato se celebra bajo la modalidad de OBRA DETERMINADA (artículo 63 de la LOTTT y Cláusulas 18 y 19 de la Convención Colectiva), para la ejecución de la fase técnica de: `}
        <Text style={styles.bold}>{faseTecnicaTxt}</Text>
        {`, dentro de la obra denominada: `}
        <Text style={styles.bold}>{obraDenomTxt}</Text>
        {`. LA ENTIDAD DE TRABAJO contrata a EL TRABAJADOR para desempeñar el cargo de `}
        <Text style={styles.bold}>{oficioStr}</Text>
        {`, establecido en el Tabulador de Oficios y Salarios Básicos de la Convención Colectiva. EL TRABAJADOR se obliga a: 1. Poner a disposición su capacidad normal de trabajo durante la jornada, en las labores convenidas y en las anexas o complementarias. 2. Ejecutar las actividades inherentes al cargo. 3. Usar obligatoriamente el uniforme y los equipos de protección (guantes, lentes, botas, etc.) según la LOPCYMAT. 4. Mantener el orden del área asignada y el buen estado de maquinarias y herramientas. 5. No realizar, por cuenta propia o ajena, actividades que compitan con las de LA ENTIDAD DE TRABAJO, ni utilizar en ellas sus equipos, materiales o información.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>SEGUNDA: PERÍODO DE PRUEBA.</Text>
        {` Conforme a la Cláusula 10 de la Convención Colectiva, se acuerda un PERÍODO DE PRUEBA DE TREINTA (30) DÍAS. Durante este lapso, LA ENTIDAD DE TRABAJO apreciará los conocimientos y aptitudes de EL TRABAJADOR. Cualquiera de las partes podrá dar por terminada la relación sin indemnización por despido, y LA ENTIDAD DE TRABAJO pagará los salarios y demás conceptos causados hasta esa fecha.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>TERCERA: DURACIÓN Y TERMINACIÓN.</Text>
        {` La relación de trabajo está sujeta a la culminación física de la fase técnica descrita en la Cláusula Primera. El vínculo terminará con la conclusión de dicha fase, conforme al artículo 63 de la LOTTT y a la Cláusula 19 de la Convención Colectiva, lo que se hará constar en el Acta de Culminación asentada en el Libro de Obra por el Supervisor. La terminación es independiente de la entrega formal del inmueble al propietario. En esa oportunidad, LA ENTIDAD DE TRABAJO pagará a EL TRABAJADOR las prestaciones sociales y demás conceptos que le correspondan, conforme al artículo 142 de la LOTTT y a la Cláusula 51 de la Convención Colectiva.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>CUARTA: JORNADA, HORARIO Y RENDIMIENTO.</Text>
        {` Conforme al artículo 173 de la LOTTT y a la Cláusula 6 de la Convención Colectiva, la jornada semanal será de cuarenta (40) horas de trabajo efectivo: `}
        {horarioCuartaDetalle}{' '}
        <Text style={styles.bold}>CONTROL:</Text>
        {` EL TRABAJADOR debe firmar diariamente su registro de avance en el Libro de Obra. La inobservancia del horario en cuatro (4) oportunidades en un mes, o la negativa a firmar el registro, podrá constituir falta grave a las obligaciones que impone la relación de trabajo, conforme al artículo 79, literal "i", de la LOTTT.`}
      </Text>
    </>
  );

  const bloqueClausulasQuintaANovenaYFirmas = (
    <>
      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>QUINTA: LUGAR DE TRABAJO Y DIRECCIÓN.</Text>
        {` Los servicios se prestarán en: `}
        <Text style={styles.bold}>{lugarQuintaTxt}</Text>
        {`. LA ENTIDAD DE TRABAJO ejercerá su facultad de dirección para el mejor desempeño de la obra; dichas exigencias técnicas y de rendimiento no se considerarán acoso laboral.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>SEXTA: SALARIO Y BENEFICIOS SOCIALES.</Text>
        {` EL TRABAJADOR devengará los siguientes conceptos pagaderos en Bolívares:`}
        {'\n'}
        a.- Bs. <Text style={styles.bold}>{salDiarioTxt}</Text>
        {` diarios por el oficio de `}
        <Text style={styles.bold}>{oficioTabuladorTxt}</Text>
        {` según el Tabulador de Oficios y Salarios Básicos de la Convención Colectiva, con el aumento del cien por ciento (100%), es decir, dos (2) veces dicho salario, equivalente a Bs. `}
        <Text style={styles.bold}>{salSemanalTxt}</Text>
        {` semanales, conforme al ${TABULADOR_HOMOLOGADO_2026_REFERENCIA};`}
        {'\n'}
        b.- Cesta Ticket: el equivalente en Bolívares de <Text style={styles.bold}>{cestaSemanalUsdTxt}</Text>
        {` semanales, a la tasa oficial del BCV del día del pago; y`}
        {'\n'}
        c.- <Text style={styles.bold}>COMPLEMENTO DEL BENEFICIO DE ALIMENTACIÓN (beneficio social de carácter no remunerativo):</Text>
        {` De conformidad con el numeral 2 del artículo 105 de la LOTTT, LA ENTIDAD DE TRABAJO otorgará a EL TRABAJADOR un complemento del Cesta Ticket por la cantidad fija de `}
        <Text style={styles.bold}>{complementoAlimUsdTxt}</Text>
        {` semanales, con la finalidad de coadyuvar a que él y su grupo familiar obtengan una alimentación adecuada frente a la pérdida del poder adquisitivo. Este complemento no es contraprestación del servicio; no depende del oficio, de la productividad ni de la asistencia; no forma parte del salario y no se computará para el cálculo de prestaciones sociales, vacaciones, bono vacacional, utilidades ni ningún otro concepto derivado de la relación de trabajo. Es un beneficio voluntario de LA ENTIDAD DE TRABAJO, que podrá suspenderlo o modificarlo con carácter general para todos sus trabajadores, sin que su pago en semanas anteriores genere derecho adquirido. Cuando el salario o el Cesta Ticket se modifiquen por decreto del Ejecutivo Nacional, por la Convención Colectiva o por actas homologadas, LA ENTIDAD DE TRABAJO podrá revisar, con carácter general, el monto de este complemento. Se pagará en partida separada, identificada en cada recibo como "Complemento del beneficio de alimentación". Todos los pagos se realizarán en Bolívares calculados a la tasa oficial del Banco Central de Venezuela (BCV) del día del pago.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>SÉPTIMA: ANTICIPOS Y COMPLEMENTO ALIMENTARIO CADA CUATRO SEMANAS.</Text>
        {` Cada cuatro (4) semanas trabajadas, LA ENTIDAD DE TRABAJO pagará a EL TRABAJADOR una cantidad equivalente a `}
        <Text style={styles.bold}>{compUsdMesTxt}</Text>
        {` USD, en Bolívares a la tasa oficial del BCV del día del pago, que se imputa en este orden: a) como anticipo de la garantía de prestaciones sociales, a solicitud escrita de EL TRABAJADOR y hasta el setenta y cinco por ciento (75%) de lo acreditado, conforme al artículo 144 de la LOTTT; b) como anticipo de las utilidades de la Cláusula 48 de la Convención Colectiva, que se descontará de lo que corresponda por ese concepto; y c) el remanente, como complemento voluntario del beneficio de alimentación, sin carácter salarial. Al cierre de obra o finiquito se pagará la fracción que corresponda a las semanas trabajadas que no completen un ciclo de cuatro (4). Cada recibo discriminará los conceptos. Las vacaciones y el bono vacacional se pagarán al disfrutarlas o, al terminar la relación, en forma fraccionada, conforme a la LOTTT y a la Cláusula 47 de la Convención Colectiva.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>OCTAVA: ÉTICA Y CONFIDENCIALIDAD.</Text>
        {` EL TRABAJADOR guardará reserva absoluta sobre la información técnica de la obra y se abstendrá de prácticas desleales.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro, styles.clauseDense]}>
        <Text style={styles.bold}>NOVENA: TRANSPORTE GRATUITO (BENEFICIO SOCIAL NO REMUNERATIVO).</Text>
        {` LA ENTIDAD DE TRABAJO brindará de manera gratuita un servicio de transporte diario, de ida y vuelta, desde el punto de encuentro establecido ${puntoEncTransporte} hasta el sitio de la obra. `}
        <Text style={styles.bold}>NATURALEZA JURÍDICA:</Text>
        {` conforme al artículo 105 de la LOTTT, este servicio es un beneficio social de carácter no remunerativo: no forma parte del salario, no es salario en especie y no se computará para prestaciones sociales, vacaciones, utilidades, bonos ni ningún otro concepto laboral. `}
        <Text style={styles.bold}>CONDICIONES:</Text>
        {` su uso es opcional para EL TRABAJADOR y está sujeto a las normas de conducta y seguridad dictadas por la empresa durante el trayecto.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>DÉCIMA: DOMICILIO PROCESAL.</Text>
        {` Las partes eligen como domicilio especial la ciudad de `}
        <Text style={styles.bold}>{ciudadProcesal}</Text>
        {`, Estado Nueva Esparta, sin perjuicio de la competencia que la Ley Orgánica Procesal del Trabajo atribuye a los Tribunales del Trabajo. Se firman dos (2) ejemplares de un mismo tenor y a un solo efecto, en `}
        <Text style={styles.bold}>{ciudadProcesal}</Text>
        {`, a los `}
        <Text style={styles.bold}>{diaFirma}</Text> días del mes de <Text style={styles.bold}>{mesFirma}</Text> del año{' '}
        <Text style={styles.bold}>{anioFirma}</Text>.
      </Text>

      <View style={styles.signatureSection}>
        <View style={styles.signatureBox}>
          <Text style={styles.signatureLabelBold}>POR LA ENTIDAD DE TRABAJO</Text>
          <View style={styles.signUnderline} />
          <Text style={styles.signatureLine}>{rep}</Text>
          <Text style={styles.signatureLine}>C.I. {repCedulaGuion}</Text>
          <Text style={styles.signatureLine}>{repCargoLinea}</Text>
        </View>
        <View style={styles.signatureBox}>
          <Text style={styles.signatureLabelBold}>POR EL TRABAJADOR</Text>
          <View style={styles.signUnderline} />
          <Text style={styles.signatureLine}>{nombreTrabajador}</Text>
          <Text style={styles.signatureLine}>C.I. {cedulaTrabGuion}</Text>
          <Text style={[styles.signatureLine, { marginTop: 2 }]}>(Huella dactilar)</Text>
        </View>
      </View>
    </>
  );

  return (
    <Document>
      <Page size="LETTER" style={[styles.page, styles.pageFirst]} wrap>
        {bloquePortadaIntro}
        {bloqueClausulasPrimeraACuarta}
        {bloqueClausulasQuintaANovenaYFirmas}
      </Page>
    </Document>
  );
}
