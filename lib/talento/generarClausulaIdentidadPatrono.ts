import type { CiEntidad, RegistroMercantilCi, RepresentanteMercantilCi } from '@/types/ci-entidad';

/**
 * Entrada flexible: columnas reales de `ci_entidades` o alias legados usados en borradores.
 */
export type EntidadPatronoClausulaInput = Partial<CiEntidad> & {
  nombre_legal?: string | null;
  representante_legal_nombre?: string | null;
  representante_legal_cedula?: string | null;
  representante_legal_cargo?: string | null;
};

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function normalizarRegistroMercantil(raw: unknown): RegistroMercantilCi {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return o && typeof o === 'object' && !Array.isArray(o) ? (o as RegistroMercantilCi) : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as RegistroMercantilCi;
  return {};
}

function primerRepresentanteRm(rm: RegistroMercantilCi): RepresentanteMercantilCi | undefined {
  const arr = rm.representantes;
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const first = arr[0];
  return first && typeof first === 'object' ? first : undefined;
}

function nombreLegalDe(entidad: EntidadPatronoClausulaInput): string {
  return str(entidad.nombre) || str(entidad.nombre_legal);
}

function repNombreDe(entidad: EntidadPatronoClausulaInput): string {
  return str(entidad.rep_legal_nombre) || str(entidad.representante_legal_nombre);
}

function repCedulaDe(entidad: EntidadPatronoClausulaInput): string {
  return str(entidad.rep_legal_cedula) || str(entidad.representante_legal_cedula);
}

function repCargoDe(entidad: EntidadPatronoClausulaInput): string {
  return str(entidad.rep_legal_cargo) || str(entidad.representante_legal_cargo);
}

function formatearFechaRegistroMercantil(fechaIso: string | undefined): string {
  if (!fechaIso?.trim()) return '[FECHA NO REGISTRADA]';
  const d = new Date(`${fechaIso.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '[FECHA NO REGISTRADA]';
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Transforma los datos de la entidad legal en el párrafo de identificación
 * para la Cláusula Primera del contrato de trabajo (patrono / EL PATRONO).
 *
 * Usa `nombre`, `rep_legal_*` y `registro_mercantil` como en `public.ci_entidades`
 * (migración 064). Acepta alias `nombre_legal` y `representante_legal_*` por compatibilidad.
 */
export function generarClausulaIdentidadPatrono(entidad: EntidadPatronoClausulaInput | null | undefined): string {
  if (!entidad || (typeof entidad === 'object' && Object.keys(entidad).length === 0)) {
    return 'ERROR: Datos de entidad no suministrados.';
  }

  const nombreLegal = nombreLegalDe(entidad);
  const rif = str(entidad.rif);

  const rm = normalizarRegistroMercantil(entidad.registro_mercantil);
  const tomo = str(rm.tomo);
  const numero = str(rm.numero);
  const fecha = str(rm.fecha);
  const circunscripcion = str(rm.circunscripcion);
  const domRm = str(rm.domicilio_empresa);
  const direccionFiscal = str(entidad.direccion_fiscal);

  const fechaRegistro = formatearFechaRegistroMercantil(fecha || undefined);

  const repRm = primerRepresentanteRm(rm);
  const repNombre = str(repRm?.nombre) || repNombreDe(entidad);
  const repCedula = str(repRm?.cedula) || repCedulaDe(entidad);
  const repCargo = str(repRm?.cargo) || repCargoDe(entidad);
  const repNacionalidad = str(repRm?.nacionalidad);
  const repEstadoCivil = str(repRm?.estado_civil);
  const repDomicilio = str(repRm?.domicilio);
  const repProfesion = str(repRm?.profesion);
  const repEdad = str(repRm?.edad);
  const fragEdadRep = repEdad ? `, de ${repEdad} años de edad` : ', mayor de edad';

  const bloqueNombre = nombreLegal ? nombreLegal.toUpperCase() : '[NOMBRE LEGAL NO REGISTRADO]';
  const bloqueDom = domRm || direccionFiscal || '[DOMICILIO DE LA EMPRESA NO REGISTRADO]';
  const bloqueCirc = circunscripcion || '[REGISTRO MERCANTIL / CIRCUNSCRIPCIÓN NO REGISTRADA]';
  const bloqueNum = numero || '[NÚMERO]';
  const bloqueTomo = tomo || '[TOMO]';
  const bloqueRif = rif || '[RIF NO REGISTRADO]';
  const bloqueRep = repNombre ? repNombre.toUpperCase() : '[REPRESENTANTE NO REGISTRADO]';
  const bloqueCi = repCedula || '[CÉDULA NO REGISTRADA]';
  const bloqueCargo = repCargo || 'Representante Legal';
  const bloqueNac = repNacionalidad || 'venezolano(a)';
  const fragEstadoCivil = repEstadoCivil ? `, de estado civil ${repEstadoCivil}` : '';
  const fragDomicilioRep = repDomicilio ? `, con domicilio en ${repDomicilio}` : '';
  const fragProfesion = repProfesion ? `, de profesión ${repProfesion}` : '';

  const texto = `
    Entre la sociedad mercantil ${bloqueNombre},
    domiciliada en ${bloqueDom},
    debidamente inscrita ante el Registro Mercantil ${bloqueCirc},
    bajo el Nro. ${bloqueNum}, Tomo ${bloqueTomo},
    de fecha ${fechaRegistro}, titular del Registro de Información Fiscal (RIF) Nro. ${bloqueRif},
    representada en este acto por el ciudadano ${bloqueRep},
    de nacionalidad ${bloqueNac}${fragEdadRep}${fragEstadoCivil}, titular de la cédula de identidad Nro. ${bloqueCi}${fragDomicilioRep}${fragProfesion},
    en su carácter de ${bloqueCargo},
    quien a los efectos de este contrato se denominará "EL PATRONO"...
  `.replace(/\s+/g, ' ').trim();

  return texto;
}
