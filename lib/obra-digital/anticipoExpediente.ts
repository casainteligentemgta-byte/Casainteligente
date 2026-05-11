/**
 * Fase A — checklist de anticipo mensual (espejo de reglas BD para UI).
 */

export type ObraDigitalDocLike = {
  doc_type: string;
  reference_month: number | null;
  reference_year: number | null;
  escaneo_firma_visible: boolean;
  escaneo_huella_visible: boolean;
};

export type AdvanceLike = {
  month: number;
  year: number;
  status: string;
};

export function advanceKey(year: number, month: number) {
  return `${year}-${month}`;
}

/** Escaneo ANTICIPO_MENSUAL con mismo mes/año y cotejo firma+huella (requerido por BD para LISTO/PAGADO). */
export function tieneAnticipoEscaneoValido(docs: ObraDigitalDocLike[], month: number, year: number) {
  return docs.some(
    (d) =>
      d.doc_type === 'ANTICIPO_MENSUAL' &&
      d.reference_month === month &&
      d.reference_year === year &&
      d.escaneo_firma_visible &&
      d.escaneo_huella_visible,
  );
}

/** Libro semanal con cotejo en el mismo mes/año operativo (recomendación de expediente; no bloquea BD). */
export function tieneLibroSemanalRecomendado(docs: ObraDigitalDocLike[], month: number, year: number) {
  return docs.some(
    (d) =>
      d.doc_type === 'LIBRO_OBRA_SEMANAL' &&
      d.reference_month === month &&
      d.reference_year === year &&
      d.escaneo_firma_visible &&
      d.escaneo_huella_visible,
  );
}

export function diagnosticoAnticipoPorPeriodo(docs: ObraDigitalDocLike[], advances: AdvanceLike[]) {
  const map: Record<string, { escaneoAnticipoValido: boolean; libroSemanalRecomendado: boolean }> = {};
  for (const a of advances) {
    const k = advanceKey(a.year, a.month);
    map[k] = {
      escaneoAnticipoValido: tieneAnticipoEscaneoValido(docs, a.month, a.year),
      libroSemanalRecomendado: tieneLibroSemanalRecomendado(docs, a.month, a.year),
    };
  }
  return map;
}
