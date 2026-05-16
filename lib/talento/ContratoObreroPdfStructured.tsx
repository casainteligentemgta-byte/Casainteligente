import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { razonSocialPatronoParaContratoPdf } from '@/lib/talento/razonSocialContratoPdf';
import { CESTATICKET_SEMANAL_USD } from '@/lib/nomina/cestaticketLegalUsd';
import { TASA_BCV_VES_POR_USD_TABULADOR_2023_06_20 } from '@/lib/nomina/tabuladorSalariosConstruccion2023';

/**
 * Tipografía unificada del contrato (PDF estándar vía @react-pdf/renderer).
 * Helvetica / Times-Roman / Courier son las fuentes embebidas; para otro cuerpo hay que registrar fuente con Font.register.
 */
const CONTRATO_PDF_FONT_FAMILY = 'Helvetica';
/** Negrita en PDF vía familia explícita (anidar `fontWeight` con Helvetica falla en @react-pdf 4.x). */
const CONTRATO_PDF_FONT_BOLD = 'Helvetica-Bold';
const CONTRATO_PDF_FONT_SIZE = 9.5;

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 32,
    paddingHorizontal: 40,
    fontFamily: CONTRATO_PDF_FONT_FAMILY,
    fontSize: CONTRATO_PDF_FONT_SIZE,
    color: '#000',
  },
  pageFirst: {
    paddingTop: 14,
    paddingBottom: 26,
  },
  header: {
    fontFamily: CONTRATO_PDF_FONT_BOLD,
    fontSize: CONTRATO_PDF_FONT_SIZE,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 1.16,
    color: '#000',
  },
  paragraph: {
    marginBottom: 5,
    textAlign: 'justify',
    lineHeight: 1.26,
    fontFamily: CONTRATO_PDF_FONT_FAMILY,
    fontSize: CONTRATO_PDF_FONT_SIZE,
    color: '#000',
  },
  paragraphIntro: { marginBottom: 3, lineHeight: 1.2 },
  bold: {
    fontFamily: CONTRATO_PDF_FONT_BOLD,
    fontSize: CONTRATO_PDF_FONT_SIZE,
    lineHeight: 1.22,
    color: '#000',
  },
  /** Comparecencia: tramo «(El) centro comercial …» en Helvetica normal (no Helvetica-Bold). */
  introComparecenciaRegular: {
    fontFamily: CONTRATO_PDF_FONT_FAMILY,
    fontSize: CONTRATO_PDF_FONT_SIZE,
    lineHeight: 1.22,
    color: '#000',
  },
  signatureSection: { flexDirection: 'row', marginTop: 12, justifyContent: 'space-between' },
  signatureBox: { width: '48%', paddingTop: 4, textAlign: 'left', lineHeight: 1.22 },
  signatureLine: {
    marginBottom: 1,
    lineHeight: 1.2,
    fontFamily: CONTRATO_PDF_FONT_FAMILY,
    fontSize: CONTRATO_PDF_FONT_SIZE,
    color: '#000',
  },
  /** Etiquetas «POR LA ENTIDAD…» en negrita sin pisar la fuente con `signatureLine`. */
  signatureLabelBold: {
    marginBottom: 1,
    lineHeight: 1.2,
    fontFamily: CONTRATO_PDF_FONT_BOLD,
    fontSize: CONTRATO_PDF_FONT_SIZE,
    color: '#000',
  },
  signUnderline: {
    borderBottomWidth: 1,
    borderColor: '#000',
    width: '100%',
    height: 14,
    marginTop: 2,
    marginBottom: 4,
  },
  meta: {
    fontFamily: CONTRATO_PDF_FONT_FAMILY,
    fontSize: CONTRATO_PDF_FONT_SIZE,
    marginBottom: 8,
    textAlign: 'center',
    color: '#000',
    lineHeight: 1.22,
  },
  metaFirst: { marginBottom: 3 },
  /** Misma base tipográfica; solo ajusta interlineado en bloques largos (sin reducir cuerpo). */
  clauseDense: {
    fontFamily: CONTRATO_PDF_FONT_FAMILY,
    fontSize: CONTRATO_PDF_FONT_SIZE,
    lineHeight: 1.22,
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
  /** Si true, «la ciudadana» en comparecencia; si false/undefined, «el ciudadano». */
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
  tareas_especificas?: string | null;
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
  /** Bono especial no salarial en USD (express u otros flujos); se suma al ingreso tabulador en cláusula SEXTA. */
  bonoManualUsd?: number | null;
  textoPuntoEncuentroTransporteSex?: string | null;
  compensacionCulminacionUsdPorMes?: number | null;
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

const PLACEHOLDER_LINEA = '_____________';

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

function rifPatronoDisplay(rif: string): string {
  const t = (rif ?? '').trim().toUpperCase();
  if (!t || t === '_____________') return '________________________';
  if (/^J[-\s]/.test(t)) return t.replace(/\s+/g, '');
  return `J-${t.replace(/^J/, '').replace(/^[-\s]+/, '')}`;
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
  const t = t0 || 'el sector Jorge Coll (Municipio Maneiro)';
  return /^en\s/i.test(t) ? t : `en ${t}`;
}

/** Número USD positivo desde el texto de ingreso semanal tabulador (en-US, es-VE o plano). */
function tryParseUsdNumberDesdeTextoIngresoParam(raw: string | null | undefined): number | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  if (/_{2,}/.test(t) && !/\d/.test(t)) return null;
  let s = t
    .replace(/\s*usd\s*$/i, '')
    .replace(/^\$\s*/, '')
    .replace(/\$/g, '')
    .trim();
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let norm = s;
  if (lastComma >= 0 && lastDot >= 0) {
    norm = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0 && lastDot < 0) {
    const parts = s.split(',');
    norm =
      parts.length === 2 && parts[1].length <= 2
        ? `${parts[0].replace(/\./g, '')}.${parts[1]}`
        : s.replace(/,/g, '');
  } else {
    norm = s.replace(/,/g, '');
  }
  const n = Number.parseFloat(norm);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function ContratoObreroPDF({
  expedienteId,
  esContratoExpress = false,
  empleado,
  entidad,
  configNomina,
  parametros,
  contrato,
}: ContratoObreroPdfStructuredProps) {
  const nombreLegalSociedad = str(
    razonSocialPatronoParaContratoPdf(entidad.nombre_legal, entidad.nombre),
    '________________________________________________',
  );
  const nombreTrabajador = str(empleado.nombres ?? empleado.nombre_completo, '__________________________________________________');
  const estadoCivilTrab = str(empleado.estado_civil, '_______________');
  const cedulaTrabGuion = cedulaConGuion(empleado.cedula ?? empleado.documento);
  const domicilioTrab = str(
    empleado.direccion_domicilio ?? empleado.direccion_habitacion,
    '______________________________________________________________',
  );
  const faseTecnicaTxt = faseTecnicaClausulaPrimera(contrato ?? null);
  const obraDenomTxt = obraDenominadaClausulaPrimera(contrato ?? null);
  const lugarQuintaTxt = lugarPrestacionQuinta(contrato ?? null);
  const oficioStr = (() => {
    const c = (empleado.cargo_nombre ?? '').trim();
    return c ? c.toUpperCase() : '______________________________';
  })();
  const fechaCierreIso = parametros.fechaFirmaContratoIso ?? parametros.fechaIngreso;
  const { dia: diaFirma, mes: mesFirma, anio: anioFirma } = partesFechaCierreFirma(fechaCierreIso);

  const sbMen = configNomina.salario_base_mensual;
  const tieneSbMen =
    sbMen != null && Number.isFinite(Number(sbMen)) && Number(sbMen) > 0 ? Number(sbMen) : null;
  const salSemanalTxt = tieneSbMen != null ? fmtBsVes(tieneSbMen / 4) : '__________________';
  const cestaMen = configNomina.cestaticket_mensual;
  const cestaSemUsdNum =
    !esContratoExpress &&
    cestaMen != null &&
    Number.isFinite(Number(cestaMen)) &&
    Number(cestaMen) > 0 &&
    TASA_BCV_VES_POR_USD_TABULADOR_2023_06_20 > 0
      ? Number(cestaMen) / 4 / TASA_BCV_VES_POR_USD_TABULADOR_2023_06_20
      : null;
  const cestaUsdPlanoTxt = esContratoExpress
    ? `${fmtUsdNumeroPlano(CESTATICKET_SEMANAL_USD)} USD`
    : cestaSemUsdNum != null && Number.isFinite(cestaSemUsdNum)
      ? `${fmtUsdNumeroPlano(Math.round(cestaSemUsdNum * 100) / 100)} USD`
      : '10 USD';
  const ingresoSemanalBaseUsdNum = tryParseUsdNumberDesdeTextoIngresoParam(
    parametros.ingresoSemanalConsolidadoUsdTexto,
  );
  const bonoManualUsdNum =
    parametros.bonoManualUsd != null && Number.isFinite(Number(parametros.bonoManualUsd))
      ? Math.max(0, Number(parametros.bonoManualUsd))
      : 0;
  /** Total en cláusula SEXTA (BONO ESPECIAL): tabulador + bono manual en USD. */
  const totalIngresoSemanalUsdClausulaSexTxt =
    ingresoSemanalBaseUsdNum != null || bonoManualUsdNum > 0
      ? `${fmtUsdNumeroPlano((ingresoSemanalBaseUsdNum ?? 0) + bonoManualUsdNum)} USD`
      : '__________ USD';

  const HORARIO_DETALLE_PDF_DEFAULT =
    'Lunes a Jueves: De 7:00 a.m. a 5:00 p.m. (1 hora de descanso de 12:00 p.m. a 1:00 p.m., no imputable a la jornada). Viernes: De 7:00 a.m. a 11:00 a.m. (Jornada continua). ';
  const horarioCuartaDetalle = (parametros.horarioSemanal ?? '').trim() || HORARIO_DETALLE_PDF_DEFAULT;

  const rep = limpiarNombreRepresentanteLegal(
    str(entidad.rep_legal_nombre ?? entidad.representante_legal, '________________________________________________'),
  );
  const repCedulaGuion = cedulaConGuion(entidad.rep_legal_cedula);
  const rifEntidadLinea = rifPatronoDisplay(str(entidad.rif, ''));
  const razonComparecencia = nombreLegalSociedad.trim().replace(/\.\s*$/, '');
  const domicilioEmpresa = str(
    entidad.domicilio_fiscal ?? entidad.direccion_fiscal,
    '________________________________________________________________',
  );
  const domicilioComparecenciaPdf = preprocessLineaDomicilioComparecenciaPdf(domicilioEmpresa);
  const phMun = '___________';
  const phEdo = '___________';
  const phRepNat = '________________';
  const phRepEc = '____________';
  const municipioEmpresa = str(entidad.municipio_fiscal, phMun);
  const estadoEmpresa = str(entidad.estado_fiscal, phEdo);
  const zonaComparecencia = preprocessLineaDomicilioComparecenciaPdf(
    str(entidad.sector_domicilio_registro, ZONA_COMPARECENCIA_PDF_DEFAULT),
  );
  const zonaPdf = quitarPalabraSectorEnDomicilio(zonaComparecencia).trim();
  const nacionalidadRep = str(entidad.rep_legal_nacionalidad, phRepNat);
  const estadoCivilRep = str(entidad.rep_legal_estado_civil, phRepEc);
  const nacionalidadTrab = str(empleado.nacionalidad, '__________');
  const repCedulaLinea = str(repCedulaGuion, '_______________');
  const compUsdMes =
    parametros.compensacionCulminacionUsdPorMes != null &&
    Number.isFinite(Number(parametros.compensacionCulminacionUsdPorMes)) &&
    Number(parametros.compensacionCulminacionUsdPorMes) > 0
      ? Number(parametros.compensacionCulminacionUsdPorMes)
      : 100;
  const compUsdMesTxt = fmtUsdNumeroPlano(compUsdMes);
  const puntoEncTransporte = fragmentoPuntoEncuentroTransporte(parametros.textoPuntoEncuentroTransporteSex);
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
            , Municipio <Text style={styles.bold}>{municipioEmpresa}</Text>, Estado{' '}
            <Text style={styles.bold}>{estadoEmpresa}</Text>, Rif. N° <Text style={styles.bold}>{rifEntidadLinea}</Text>
          </>
        ) : (
          <>
            <Text style={styles.introComparecenciaRegular}>{domicilioComparecenciaPdf}</Text>
            {zonaPdf.length ? (
              <>
                , <Text style={styles.bold}>{zonaPdf}</Text>
              </>
            ) : null}
            , Municipio <Text style={styles.bold}>{municipioEmpresa}</Text>, Estado <Text style={styles.bold}>{estadoEmpresa}</Text>, Rif. N°{' '}
            <Text style={styles.bold}>{rifEntidadLinea}</Text>
          </>
        )}
        , representada en este acto por <Text style={styles.bold}>{rep}</Text>,{' '}
        <Text style={styles.bold}>{nacionalidadRep}</Text>, mayor de edad, <Text style={styles.bold}>{estadoCivilRep}</Text>, hábil en
        derecho, titular de la cédula de Identidad número <Text style={styles.bold}>{repCedulaLinea}</Text> y de este domicilio, quien a
        los efectos de este contrato se denominará <Text style={styles.bold}>LA ENTIDAD DE TRABAJO</Text>, por una parte y por la otra
        el ciudadano <Text style={styles.bold}>{nombreTrabajador}</Text>, <Text style={styles.bold}>{nacionalidadTrab}</Text>, mayor de
        edad, <Text style={styles.bold}>{estadoCivilTrab}</Text>, hábil en derecho, titular de la cédula de identidad número{' '}
        <Text style={styles.bold}>{cedulaTrabGuion}</Text>, domiciliado en <Text style={styles.bold}>{domicilioTrab}</Text>; quien en lo
        sucesivo se denominará <Text style={styles.bold}>EL TRABAJADOR</Text>, se ha convenido en celebrar, como en efecto se celebra, el
        presente Contrato de Trabajo para una Obra Determinada, conforme a lo establecido en el Artículo 63 de la Ley Orgánica de Trabajo de
        los Trabajadores y Trabajadoras, y las cláusulas 18 y 19 de la vigente Convención Colectiva de Trabajo para la Rama de la Industria de
        la Construcción, conexos, afines y similares de la República Bolivariana de Venezuela, el cual se regirá por las Cláusulas que se
        estipulan a continuación:
      </Text>
    </>
  );

  const bloqueClausulasPrimeraACuarta = (
    <>
      <Text style={[styles.paragraph, styles.paragraphIntro, styles.clauseDense]}>
        <Text style={styles.bold}>PRIMERA: OBJETO Y MODALIDAD.</Text>
        {` Este contrato se celebra bajo la modalidad de OBRA DETERMINADA (Arts. 63, 75 y 77 literal "a" de la LOTTT), específicamente para la ejecución de la fase técnica de: `}
        <Text style={styles.bold}>{faseTecnicaTxt}</Text>
        {`, dentro de la obra denominada: `}
        <Text style={styles.bold}>{obraDenomTxt}</Text>
        {`. LA ENTIDAD DE TRABAJO tiene como objeto la explotación de actividades comerciales y de la industria de la construcción, y a tales efectos contrata a EL TRABAJADOR para que desempeñe el cargo de: `}
        <Text style={styles.bold}>{oficioStr}</Text>
        {`, cargo establecido en el Tabulador de Oficios y Salarios Básicos de la Convención Colectiva vigente. EL TRABAJADOR se obliga a: 1.- Poner a disposición su capacidad normal de trabajo en forma exclusiva y en las labores anexas complementarias. 2.- Ejecutar las actividades inherentes al cargo, incluyendo recibir, procesar y pesar materia prima cuando sea requerido. 3.- Usar obligatoriamente el uniforme y equipos de protección (guantes, lentes, botas, etc.) según la LOPCYMAT. 4.- Mantener el orden del área asignada y el buen estado de maquinarias y herramientas. 5.- No prestar servicios a otros empleadores ni trabajar por cuenta propia en funciones inherentes al cargo.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>SEGUNDA: PERIODO DE PRUEBA.</Text>
        {` Conforme al Art. 25 del Reglamento de la LOTTT, se acuerda un PERIODO DE PRUEBA DE NOVENTA (90) DÍAS. Durante este lapso, LA ENTIDAD DE TRABAJO apreciará los conocimientos y aptitudes de EL TRABAJADOR. Cualquiera de las partes podrá dar por extinguida la relación sin lugar a indemnización alguna.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>TERCERA: DURACIÓN Y TERMINACIÓN.</Text>
        {` La relación de trabajo está sujeta exclusivamente a la culminación física de la fase técnica descrita en la Cláusula Primera. El vínculo se extinguirá de pleno derecho y sin necesidad de preaviso (Art. 75 LOTTT) una vez firmada el Acta de Culminación en el Libro de Obra por el Supervisor. La terminación es independiente de la entrega formal del inmueble al propietario.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>CUARTA: JORNADA, HORARIO Y RENDIMIENTO.</Text>
        {` La jornada semanal será de cuarenta (40) horas de trabajo efectivo: `}
        {horarioCuartaDetalle}{' '}
        <Text style={styles.bold}>CONTROL:</Text>
        {` EL TRABAJADOR debe firmar diariamente su registro de avance en el Libro de Obra. La inobservancia del horario en 4 oportunidades en un mes o la negativa a firmar el registro constituirá falta grave (Art. 102 literal "i" LOTTT).`}
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
        <Text style={styles.bold}>SEXTA: INGRESO INTEGRAL INDEXADO.</Text>
        {` EL TRABAJADOR devengará los siguientes conceptos pagaderos en Bolívares. `}
        {'\n'}
        a.- <Text style={styles.bold}>{salSemanalTxt}</Text>
        {` (Bs.) por concepto de Salario Semanal según Tabulador; `}
        {'\n'}
        b.- Cesta Ticket (Indexado): Equivalente a <Text style={styles.bold}>{cestaUsdPlanoTxt}</Text> semanales; y
        {'\n'}
        c.- <Text style={styles.bold}>BONO ESPECIAL: (NO Salarial):</Text>
        {` Según Art. 105 LOTTT y Sentencia 218 del TSJ, para elevar el Ingreso Semanal a un total equivalente a: `}
        <Text style={styles.bold}>{totalIngresoSemanalUsdClausulaSexTxt}</Text>
        {'. '}
        {`Todos los pagos se realizarán en Bolívares calculados a la tasa oficial del Banco Central de Venezuela (BCV) del día del pago.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro]}>
        <Text style={styles.bold}>SÉPTIMA: COMPENSACIÓN POR CULMINACIÓN.</Text>
        {` `}
        <Text style={styles.bold}>PARÁGRAFO ÚNICO:</Text>
        {` Al cierre de obra o finiquito, se recibirá una compensación de: `}
        <Text style={styles.bold}>{compUsdMesTxt}</Text>
        {` USD (a tasa BCV) por cada mes trabajado o fracción. Este monto liquida de forma integral: prestaciones sociales, utilidades, vacaciones y cualquier otro beneficio derivado de este contrato especial y de la Convención Colectiva.`}
      </Text>

      <Text style={[styles.paragraph, styles.paragraphIntro, styles.clauseDense]}>
        <Text style={styles.bold}>OCTAVA: ÉTICA, CONFIDENCIALIDAD Y JURISDICCIÓN.</Text>
        {` EL TRABAJADOR, guardará reserva absoluta sobre información técnica y se abstendrá de prácticas desleales. `}
        {'\n\n'}
        <Text style={styles.bold}>NOVENA (TRANSPORTE GRATUITO - BENEFICIO SOCIAL NO REMUNERATIVO).</Text>
        {` Con el firme propósito de facilitar la asistencia, puntualidad y resguardar la seguridad de EL TRABAJADOR, LA ENTIDAD DE TRABAJO brindará de manera gratuita un servicio de transporte diario, de ida y vuelta, desde el punto de encuentro establecido ${puntoEncTransporte} hasta el sitio donde se ejecute la obra determinada. `}
        <Text style={styles.bold}>NATURALEZA JURÍDICA:</Text>
        {` De conformidad con lo establecido en el Artículo 105 de la LOTTT, las partes acuerdan expresamente que este servicio de transporte constituye un beneficio social de carácter no remunerativo. En consecuencia, ambas partes reconocen que: No forma parte del salario bajo ninguna circunstancia. No tiene carácter de salario en especie. No será considerado ni computado para el cálculo de prestaciones sociales, vacaciones, utilidades, bonos ni ningún otro pasivo o derecho laboral derivado de la relación de trabajo. `}
        <Text style={styles.bold}>CONDICIONES:</Text>
        {` El uso de este servicio es opcional para el trabajador y está sujeto al cumplimiento de las normas de conducta y seguridad dictadas por la empresa durante el trayecto.`}
        {'\n\n'}
        <Text style={styles.bold}>DECIMA (DOMICILIO PROCESAL).</Text>
        {` Las partes eligen como domicilio especial la ciudad de Pampatar, Estado Nueva Esparta, sometiéndose a sus Tribunales del Trabajo. Se firman dos (2) ejemplares de un mismo tenor y a un solo efecto en la ciudad de Pampatar, a los `}
        <Text style={styles.bold}>{diaFirma}</Text> días del mes de <Text style={styles.bold}>{mesFirma}</Text> del año{' '}
        <Text style={styles.bold}>{anioFirma}</Text>.
      </Text>

      <View style={styles.signatureSection}>
        <View style={styles.signatureBox}>
          <Text style={styles.signatureLabelBold}>POR LA ENTIDAD DE TRABAJO</Text>
          <View style={styles.signUnderline} />
          <Text style={styles.signatureLabelBold}>REPRESENTANTE LEGAL</Text>
          <Text style={styles.signatureLabelBold}>NOMBRE:</Text>
          <Text style={styles.signatureLine}>{rep}</Text>
          <Text style={styles.signatureLine}>C.I. {repCedulaGuion}</Text>
        </View>
        <View style={styles.signatureBox}>
          <Text style={styles.signatureLabelBold}>POR EL TRABAJADOR</Text>
          <View style={styles.signUnderline} />
          <Text style={styles.signatureLabelBold}>NOMBRE:</Text>
          <Text style={styles.signatureLine}>{nombreTrabajador}</Text>
          <Text style={styles.signatureLine}>C.I. {cedulaTrabGuion}</Text>
          <Text style={[styles.signatureLine, { marginTop: 2 }]}>(Huella Dactilar)</Text>
        </View>
      </View>
    </>
  );

  return (
    <Document>
      <Page size="LETTER" style={[styles.page, styles.pageFirst]}>
        {bloquePortadaIntro}
        {bloqueClausulasPrimeraACuarta}
      </Page>
      <Page size="LETTER" style={styles.page}>
        {bloqueClausulasQuintaANovenaYFirmas}
      </Page>
    </Document>
  );
}
