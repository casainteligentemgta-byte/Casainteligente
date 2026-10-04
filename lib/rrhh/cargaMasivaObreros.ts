import { CARGOS_OBREROS, cargoPorCodigo, type CargoObrero } from '@/lib/constants/cargosObreros';

/** Fila tal como viene del Excel del administrador (una por obrero). */
export type FilaCargaMasivaEntrada = {
  nombre: string;
  cedula: string;
  oficio: string;
  whatsapp: string;
};

export type FilaCargaMasivaValidada = FilaCargaMasivaEntrada & {
  cedulaNormalizada: string;
  whatsappInternacional: string;
  cargo: CargoObrero | null;
  errores: string[];
};

/** Encabezados de la plantilla (el orden importa solo para la plantilla; la lectura busca por nombre). */
export const ENCABEZADOS_PLANTILLA_CARGA = ['Nombre completo', 'Cédula', 'Oficio (código)', 'WhatsApp'] as const;

function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** «v12345678», «V-12.345.678», «12345678» → «V-12345678». E- se respeta. */
export function normalizarCedula(raw: string): string {
  const t = String(raw ?? '').toUpperCase().replace(/\s+/g, '');
  const m = /^([VE])?-?([\d.]+)$/.exec(t);
  if (!m) return '';
  const num = m[2].replace(/\./g, '');
  if (!/^\d{5,9}$/.test(num)) return '';
  return `${m[1] ?? 'V'}-${num}`;
}

/** Teléfono venezolano a formato internacional para wa.me: «0414-1234567» → «584141234567». */
export function whatsappInternacional(raw: string): string {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('58') && d.length === 12) return d;
  if (d.startsWith('0') && d.length === 11) return `58${d.slice(1)}`;
  if (d.length === 10 && d.startsWith('4')) return `58${d}`;
  return d.length >= 11 && d.length <= 15 ? d : '';
}

/**
 * Oficio desde texto libre: acepta «5,1», «5.1», «5,1 Albañil de 1ra» o la denominación
 * («Albañil de 1ra»). Devuelve el cargo del tabulador o null.
 */
export function resolverOficio(raw: string): CargoObrero | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  const m = /^(\d)\s*[.,]\s*(\d{1,2})\b/.exec(t);
  if (m) {
    const c = cargoPorCodigo(`${m[1]}.${Number(m[2])}`);
    if (c) return c;
  }
  const n = sinAcentos(t).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!n) return null;
  const norm = (s: string) => sinAcentos(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return (
    CARGOS_OBREROS.find((c) => norm(c.nombre) === n) ??
    CARGOS_OBREROS.find((c) => norm(c.nombre).startsWith(n) || n.startsWith(norm(c.nombre))) ??
    null
  );
}

export function validarFilaCarga(f: FilaCargaMasivaEntrada): FilaCargaMasivaValidada {
  const errores: string[] = [];
  const nombre = String(f.nombre ?? '').trim();
  if (nombre.length < 3) errores.push('Falta el nombre');
  const cedulaNormalizada = normalizarCedula(f.cedula);
  if (!cedulaNormalizada) errores.push('Cédula inválida');
  const cargo = resolverOficio(f.oficio);
  if (!cargo) errores.push('Oficio no está en el tabulador');
  const wa = whatsappInternacional(f.whatsapp);
  if (!wa) errores.push('WhatsApp inválido');
  return { ...f, nombre, cedulaNormalizada, whatsappInternacional: wa, cargo, errores };
}

/** Lee las filas de una hoja (objetos por encabezado) buscando columnas por nombre aproximado. */
export function filasDesdeHoja(rows: Record<string, unknown>[]): FilaCargaMasivaEntrada[] {
  const pick = (r: Record<string, unknown>, pred: (h: string) => boolean): string => {
    for (const [k, v] of Object.entries(r)) {
      if (pred(sinAcentos(k))) return String(v ?? '').trim();
    }
    return '';
  };
  return rows
    .map((r) => ({
      nombre: pick(r, (h) => h.includes('nombre')),
      cedula: pick(r, (h) => h.includes('cedula') || h === 'ci' || h.startsWith('c.i')),
      oficio: pick(r, (h) => h.includes('oficio') || h.includes('cargo')),
      whatsapp: pick(r, (h) => h.includes('whatsapp') || h.includes('telefono') || h.includes('celular')),
    }))
    .filter((f) => f.nombre || f.cedula || f.oficio || f.whatsapp);
}

/** Mensaje de WhatsApp con el enlace personal. */
export function mensajeWhatsAppCarga(opts: {
  nombre: string;
  empresa: string;
  obra: string;
  oficio: string;
  enlace: string;
}): string {
  const primerNombre = opts.nombre.trim().split(/\s+/)[0] || '';
  return [
    `Hola ${primerNombre}. Te escribimos de ${opts.empresa || 'la empresa'} por la obra ${opts.obra}.`,
    `Para tu contratación como ${opts.oficio}, llena tu hoja de vida, sube una foto de tu cédula y firma desde este enlace personal (es solo para ti, no lo compartas):`,
    opts.enlace,
    'Al terminar se abre una evaluación corta. El día de la firma del contrato trae tu cédula original.',
  ].join('\n\n');
}

export function enlaceWhatsApp(numeroInternacional: string, mensaje: string): string {
  return `https://wa.me/${numeroInternacional}?text=${encodeURIComponent(mensaje)}`;
}

/** Etiqueta legible del avance del obrero. */
export function etiquetaEstadoProceso(estado: string | null | undefined): string {
  switch ((estado ?? '').trim()) {
    case 'pendiente_cv':
      return 'Enlace enviado · sin hoja de vida';
    case 'cv_completado':
      return 'Hoja de vida lista';
    case 'examen_iniciado':
      return 'Evaluación iniciada';
    case 'examen_completado':
      return 'Evaluación presentada';
    case 'descartado':
      return 'Descartado';
    case 'prospecto_invitado':
      return 'Invitado';
    default:
      return estado?.trim() || 'Sin estado';
  }
}
