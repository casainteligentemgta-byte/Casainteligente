/**
 * Regímenes de prestaciones: LOTTT vs Convención colectiva (construcción).
 * Los días se confirman al cargar/usar; el PDF no redefine fórmulas automáticamente.
 */

export type RegimenPrestacionesId = 'lott' | 'cct_construccion' | 'personalizado';

export type RegimenPrestaciones = {
  id: RegimenPrestacionesId;
  label: string;
  descripcion: string;
  dias_utilidades: number;
  dias_bono_vacacional: number;
  referencia: string;
};

/** Art. 131 / 190 LOTTT — mínimos legales. */
export const REGIMEN_LOTT: RegimenPrestaciones = {
  id: 'lott',
  label: 'LOTTT (mínimo legal)',
  descripcion: '30 días utilidades · 15 días bono vacacional',
  dias_utilidades: 30,
  dias_bono_vacacional: 15,
  referencia: 'Arts. 131 y 190 LOTTT',
};

/**
 * Convención colectiva de la construcción (GOE N° 6.752 / 2023) —
 * alineado con CalculadoraLiquidacionConstruccion (Cl. 47 / 48).
 */
export const REGIMEN_CCT_CONSTRUCCION: RegimenPrestaciones = {
  id: 'cct_construccion',
  label: 'CCT Construcción',
  descripcion: '100 días utilidades · 80 días vacaciones+bono (cláusulas CCT)',
  dias_utilidades: 100,
  dias_bono_vacacional: 80,
  referencia: 'Convención colectiva construcción GOE 6.752 (2023)',
};

export const REGIMENES_PRESTACIONES: RegimenPrestaciones[] = [
  REGIMEN_LOTT,
  REGIMEN_CCT_CONSTRUCCION,
];

export function regimenPorId(id: string | null | undefined): RegimenPrestaciones | null {
  return REGIMENES_PRESTACIONES.find((r) => r.id === id) ?? null;
}
