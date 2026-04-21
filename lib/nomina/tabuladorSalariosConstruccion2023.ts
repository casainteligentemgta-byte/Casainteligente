/**
 * Jornal diario en bolívares (VES) por **nivel salarial** (1–9) del tabulador anexo
 * «Oficios y Salarios» — Convención Colectiva Construcción homologada 20-06-2023 (GOE 6.752).
 *
 * Cifras transcritas del documento de referencia «TABULADOR OFICIAL CONTRATO 2023 Y EQUIV»
 * (Scribd 685277901), que indica equivalencia en USD a tasa BCV **27,25 Bs/$** al 20-06-2023:
 * USD/día por nivel: 3,33 · 3,61 · 3,76 · 4,04 · 4,44 · 4,47 · 4,71 · 5,18 · 5,33
 * → Bs/día publicados en esa tabla: 90,72 · 98,48 · 102,40 · 110,21 · 120,93 · 121,84 · 128,32 · 141,28 · 145,17
 *
 * La gaceta en 16 páginas (datalaing) no incluye la grilla numérica en texto seleccionable;
 * este anexo es el mismo instrumento citado en la convención (Tabulador de Oficios y Salarios).
 */

/** Salario básico diario oficial del tabulador (VES), índice = nivel 1…9 */
export const SALARIO_BASICO_DIARIO_VES_POR_NIVEL: readonly number[] = [
  90.72, 98.48, 102.4, 110.21, 120.93, 121.84, 128.32, 141.28, 145.17,
];

/** Equivalencia USD/día en la misma fuente (solo documentación / cruce con BCV 27,25). */
export const SALARIO_BASICO_DIARIO_USD_REF_POR_NIVEL: readonly number[] = [
  3.33, 3.61, 3.76, 4.04, 4.44, 4.47, 4.71, 5.18, 5.33,
];

export const TASA_BCV_VES_POR_USD_TABULADOR_2023_06_20 = 27.25;
