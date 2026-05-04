import type { PermisologiaCi, RegistroMercantilCi, RepresentanteMercantilCi } from '@/types/ci-entidad';

const RIF_RE = /^[JEVG]-\d{8}-\d$/i;

export function formatRifMascara(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const first = cleaned.match(/^[JEVG]/)?.[0] ?? '';
  const nums = cleaned.replace(/^[JEVG]/, '').replace(/\D/g, '').slice(0, 9);
  if (!first && nums.length === 0) return '';
  const letter = first || 'J';
  if (nums.length === 0) return `${letter}-`;
  if (nums.length <= 8) return `${letter}-${nums}`;
  return `${letter}-${nums.slice(0, 8)}-${nums.slice(8, 9)}`;
}

export function rifEsValido(rif: string): boolean {
  const t = rif.trim();
  if (!t) return true;
  return RIF_RE.test(t);
}

export type ErroresEntidadForm = Partial<Record<'nombre' | 'rif' | 'general', string>>;

export function validarEntidadPatrono(input: {
  nombreLegal: string;
  rif: string;
}): ErroresEntidadForm {
  const out: ErroresEntidadForm = {};
  const nom = input.nombreLegal.trim();
  if (nom.length < 2) out.nombre = 'Indica el nombre legal (mín. 2 caracteres).';
  if (input.rif.trim() && !rifEsValido(input.rif.trim())) {
    out.rif = 'RIF inválido. Use el formato J-12345678-9.';
  }
  return out;
}

function representanteTieneDatos(r: RepresentanteMercantilCi): boolean {
  return Boolean(
    (r.nombre ?? '').trim() ||
      (r.cedula ?? '').trim() ||
      (r.edad ?? '').trim() ||
      (r.estado_civil ?? '').trim() ||
      (r.nacionalidad ?? '').trim() ||
      (r.cargo ?? '').trim() ||
      (r.domicilio ?? '').trim() ||
      (r.profesion ?? '').trim(),
  );
}

function limpiarRepresentante(r: RepresentanteMercantilCi): RepresentanteMercantilCi | null {
  const out: RepresentanteMercantilCi = {
    nombre: r.nombre?.trim() || undefined,
    cedula: r.cedula?.trim() || undefined,
    edad: r.edad?.trim() || undefined,
    estado_civil: r.estado_civil?.trim() || undefined,
    nacionalidad: r.nacionalidad?.trim() || undefined,
    cargo: r.cargo?.trim() || undefined,
    domicilio: r.domicilio?.trim() || undefined,
    profesion: r.profesion?.trim() || undefined,
  };
  return representanteTieneDatos(out) ? out : null;
}

export function registroMercantilDesdeCampos(fields: {
  domicilioEmpresa: string;
  tomo: string;
  numero: string;
  fecha: string;
  circunscripcion: string;
  representantes: RepresentanteMercantilCi[];
}): RegistroMercantilCi {
  const reps = (fields.representantes ?? []).map(limpiarRepresentante).filter(Boolean) as RepresentanteMercantilCi[];
  return {
    domicilio_empresa: fields.domicilioEmpresa.trim() || undefined,
    tomo: fields.tomo.trim() || undefined,
    numero: fields.numero.trim() || undefined,
    fecha: fields.fecha.trim() || undefined,
    circunscripcion: fields.circunscripcion.trim() || undefined,
    representantes: reps.length ? reps : undefined,
  };
}

export function permisologiaDesdeCampos(fields: {
  ivss: string;
  inces: string;
  solvenciaLaboral: string;
}): PermisologiaCi {
  return {
    ivss_vence: fields.ivss.trim() || undefined,
    inces_vence: fields.inces.trim() || undefined,
    solvencia_laboral_vence: fields.solvenciaLaboral.trim() || undefined,
  };
}

/** Días hasta la fecha (solo fecha local); negativo = vencido. null = sin fecha válida. */
export function diasHastaVencimiento(isoDate: string): number | null {
  const t = isoDate.trim();
  if (!t) return null;
  const end = new Date(`${t}T23:59:59`);
  if (Number.isNaN(end.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
}

export function vencimientoAlertaNaranja(isoDate: string): boolean {
  const d = diasHastaVencimiento(isoDate);
  if (d == null) return false;
  return d >= 0 && d < 30;
}
