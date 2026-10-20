/**
 * Flujo «examen primero» por vacante (`recruitment_needs.examen_primero`):
 * datos básicos → evaluación unificada → hoja de vida (solo si el semáforo no es rojo).
 *
 * El flujo clásico (hoja de vida → evaluación) no cambia cuando la columna es false.
 */

import { urlEvaluacionUnificada, urlOnboardingHv } from '@/lib/talento/flujoHvEvaluacion';

/** Datos mínimos que pide el enlace antes de la evaluación (el esquema está en examenPrimeroSchema.ts). */
export type DatosBasicosExamenPrimero = {
  token: string;
  primerNombre: string;
  primerApellido: string;
  cedula: string;
  celular: string;
  correo: string;
};

/** «Pérez, Juan» como el resto de `ci_empleados.nombre_completo`. */
export function nombreCompletoBasico(d: Pick<DatosBasicosExamenPrimero, 'primerNombre' | 'primerApellido'>): string {
  return `${d.primerApellido.trim()}, ${d.primerNombre.trim()}`.replace(/\s+/g, ' ').trim();
}

/** Solo dígitos de la cédula, para comparar postulaciones repetidas. */
export function cedulaComparable(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '');
}

export type SemaforoEvaluacion = 'verde' | 'amarillo' | 'rojo' | null | undefined;

/** Verde y amarillo siguen a la hoja de vida; rojo se detiene y queda para RRHH. */
export function apruebaParaHojaVida(semaforo: SemaforoEvaluacion): boolean {
  return semaforo === 'verde' || semaforo === 'amarillo';
}

/** Siguiente paso tras los datos básicos. */
export function urlEvaluacionExamenPrimero(token: string, baseUrl = ''): string {
  return urlEvaluacionUnificada(token, baseUrl);
}

/** Hoja de vida completa del mismo expediente (mismo token). */
export function urlHojaVidaExamenPrimero(token: string, baseUrl = ''): string {
  return urlOnboardingHv(token, baseUrl);
}

/**
 * ¿Puede abrir la hoja de vida este expediente?
 * Solo aplica a vacantes con examen primero; el resto siempre puede.
 */
export function bloqueoHojaVidaExamenPrimero(opts: {
  examenPrimero: boolean;
  estatusEvaluacion?: string | null;
  semaforo?: SemaforoEvaluacion;
}): string | null {
  if (!opts.examenPrimero) return null;
  if (opts.estatusEvaluacion !== 'completado') {
    return 'Primero completa la evaluación con el enlace que recibiste.';
  }
  if (!apruebaParaHojaVida(opts.semaforo)) {
    return 'Gracias por completar la evaluación. El equipo de Reclutamiento revisará tu resultado y te contactará.';
  }
  return null;
}
