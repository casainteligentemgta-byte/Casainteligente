/**
 * Pipeline unificado RRHH de obra (Venezuela).
 *
 * Dos puertas → un expediente:
 *   Nuevo:  Plaza → HV/Test → Informe → OK humano → Contrato → Nómina → Egreso
 *   Banca:  Plaza → Oferta/acepta → (test si falta) → OK → Contrato → Nómina → Egreso
 *
 * Rol (examen) ≠ oficio del tabulador (salario/contrato).
 */

import type { RrhhAlcanceMode } from '@/lib/rrhh/rrhhAlcance';
import type { EmpleadoEstadosInput } from '@/lib/rrhh/empleadoEstados';
import { leerEmpleadoEstados } from '@/lib/rrhh/empleadoEstados';

/** Etapa canónica del obrero en el flujo RRHH. */
export type RrhhEtapaPipeline =
  | 'plaza'
  | 'postulado'
  | 'evaluado'
  | 'aprobado_humano'
  | 'rechazado'
  | 'ofertado'
  | 'acepto_plaza'
  | 'contratado'
  | 'en_nomina'
  | 'egresado'
  | 'banca_disponible'
  | 'desconocido';

export type RrhhPuertaIngreso = 'nuevo' | 'banca';

export type RrhhPasoFlujo = {
  id: string;
  label: string;
  href: string;
  /** Alcances donde el paso es primario. */
  alcances: RrhhAlcanceMode[];
  /** Puertas que usan este paso (vacío = ambas / N/A). */
  puertas?: RrhhPuertaIngreso[];
  ayuda?: string;
};

/**
 * Pasos del puente unificado (hub + navegación operativa).
 * Obra opera plazas/contratos; Dirección cierra evaluación, nómina y egreso.
 */
export const RRHH_PIPELINE_PASOS: RrhhPasoFlujo[] = [
  {
    id: 'plaza',
    label: '1. Plaza',
    href: '/rrhh/solicitud-personal',
    alcances: ['obra'],
    ayuda: 'Solicite oficios del tabulador (cantidad por obra).',
  },
  {
    id: 'candidato',
    label: '2. Candidato',
    href: '/rrhh/gestion-personal',
    alcances: ['obra'],
    puertas: ['nuevo', 'banca'],
    ayuda: 'Nuevo: link HV/test. Banca: ofertar plaza y pedir aceptación.',
  },
  {
    id: 'banca',
    label: '2b. Banca',
    href: '/rrhh/banca',
    alcances: ['entidad'],
    puertas: ['banca'],
    ayuda: 'Obreros disponibles para ofertar a una plaza.',
  },
  {
    id: 'evaluacion',
    label: '3. Evaluación',
    href: '/rrhh/reclutamiento',
    alcances: ['entidad', 'obra'],
    ayuda: 'Test por rol + semáforo. OK humano antes de contratar.',
  },
  {
    id: 'contrato',
    label: '4. Contrato',
    href: '/rrhh/express',
    alcances: ['obra'],
    ayuda:
      'Generar PDF → firmar (obrero + compañía) → cargar escaneo firmado → formalizar. Luego carnet digital.',
  },
  {
    id: 'carnet',
    label: '4b. Carnet',
    href: '/rrhh/carnet',
    alcances: ['entidad', 'obra'],
    ayuda: 'Carnet digital del obrero contratado (foto, oficio, obra, QR).',
  },
  {
    id: 'expediente',
    label: '5. Expediente',
    href: '/rrhh/hojas-vida/archivo',
    alcances: ['entidad', 'obra'],
    ayuda: 'Archivo del trabajador y documentos.',
  },
  {
    id: 'nomina',
    label: '6. Nómina',
    href: '/rrhh/nomina',
    alcances: ['entidad'],
    ayuda: 'Periodos semanales, recibos y parafiscales.',
  },
  {
    id: 'egreso',
    label: '7. Egreso',
    href: '/rrhh/liquidaciones',
    alcances: ['entidad'],
    ayuda: 'Liquidación LOTTT, PS, finiquito y cartas.',
  },
];

export const RRHH_ETAPA_LABEL: Record<RrhhEtapaPipeline, string> = {
  plaza: 'Plaza abierta',
  postulado: 'Postulado (HV/test)',
  evaluado: 'Evaluado (pendiente OK)',
  aprobado_humano: 'Aprobado RRHH',
  rechazado: 'Rechazado',
  ofertado: 'Oferta enviada',
  acepto_plaza: 'Aceptó plaza',
  contratado: 'Contratado',
  en_nomina: 'En nómina',
  egresado: 'Egresado',
  banca_disponible: 'En banca',
  desconocido: 'En proceso',
};

function norm(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase();
}

export type EmpleadoPipelineInput = EmpleadoEstadosInput & {
  /** Si tiene contrato obra firmado / express formalizado. */
  tiene_contrato?: boolean | null;
  /** Si aparece en un periodo de nómina activo. */
  en_nomina?: boolean | null;
  /** Oferta de plaza pendiente de respuesta (futuro / metadata). */
  oferta_pendiente?: boolean | null;
  /** Obrador aceptó la oferta. */
  oferta_aceptada?: boolean | null;
};

/**
 * Deriva la etapa del pipeline a partir de campos existentes (sin migración).
 * Prioridad: egreso → nómina → contrato → rechazo → aprobación → oferta → evaluación → postulación → banca.
 */
export function derivarEtapaPipeline(row: EmpleadoPipelineInput): RrhhEtapaPipeline {
  const s = leerEmpleadoEstados(row);
  const proceso = norm(s.proceso);
  const evaluacion = norm(s.evaluacion);

  if (proceso.includes('egres') || proceso.includes('liquid') || proceso === 'finiquito') {
    return 'egresado';
  }
  if (row.en_nomina) return 'en_nomina';
  if (row.tiene_contrato || s.disponibilidad === 'asignado') return 'contratado';

  // Solo rechazo humano (aptitud). El semáforo rojo queda en «evaluado» hasta OK RRHH.
  if (s.aptitud === 'rechazado') {
    return 'rechazado';
  }

  if (row.oferta_aceptada) return 'acepto_plaza';
  if (row.oferta_pendiente) return 'ofertado';

  if (s.aptitud === 'aprobado' || s.aptitud === 'aprobado_con_observaciones') {
    if (s.disponibilidad === 'disponible') return 'banca_disponible';
    return 'aprobado_humano';
  }

  if (
    evaluacion === 'completado' ||
    evaluacion === 'evaluado' ||
    norm(s.semaforo) === 'verde' ||
    norm(s.semaforo) === 'amarillo' ||
    norm(s.semaforo) === 'rojo'
  ) {
    return 'evaluado';
  }

  if (
    proceso === 'cv_completado' ||
    proceso.includes('postul') ||
    s.aptitud === 'evaluacion_pendiente' ||
    s.disponibilidad === 'pendiente'
  ) {
    return 'postulado';
  }

  if (s.disponibilidad === 'disponible') return 'banca_disponible';

  return 'desconocido';
}

export function etiquetaEtapaPipeline(row: EmpleadoPipelineInput): string {
  return RRHH_ETAPA_LABEL[derivarEtapaPipeline(row)];
}

/** ¿Puede ofertar plaza desde banca? Aprobado + disponible. */
export function puedeOfertarDesdeBanca(row: EmpleadoPipelineInput & { rol_examen?: string | null }): boolean {
  if ((row.rol_examen ?? '').trim().toLowerCase() !== 'obrero') return false;
  const etapa = derivarEtapaPipeline(row);
  return etapa === 'banca_disponible' || etapa === 'aprobado_humano';
}

/** Mensaje WhatsApp: oferta de plaza (banca → obrero). */
export function mensajeWhatsAppOfertaPlaza(opts: {
  nombreObrero: string;
  oficio: string;
  obraNombre?: string | null;
  linkRespuesta?: string | null;
}): string {
  const nombre = opts.nombreObrero.trim() || 'trabajador';
  const oficio = opts.oficio.trim() || 'el oficio solicitado';
  const obra = (opts.obraNombre ?? '').trim();
  const link = (opts.linkRespuesta ?? '').trim();
  const donde = obra ? ` en la obra ${obra}` : '';
  let msg =
    `Hola ${nombre}, desde Casa Inteligente RRHH le ofrecemos una plaza de ${oficio}${donde}. ` +
    `¿Está disponible y acepta el oficio? Responda SÍ (acepto) o NO (no disponible).`;
  if (link) msg += ` Más información: ${link}`;
  return msg;
}

/** Mensaje WhatsApp: link HV/test (puerta nuevo). */
export function mensajeWhatsAppCandidatoNuevo(opts: {
  oficio: string;
  linkHv: string;
  obraNombre?: string | null;
}): string {
  const oficio = opts.oficio.trim() || 'obra';
  const obra = (opts.obraNombre ?? '').trim();
  const donde = obra ? ` (${obra})` : '';
  return (
    `Hola, hay una plaza de ${oficio}${donde}. ` +
    `Complete su hoja de vida y evaluación en este enlace: ${opts.linkHv.trim()}`
  );
}
