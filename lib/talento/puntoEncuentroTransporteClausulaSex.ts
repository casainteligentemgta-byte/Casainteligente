/** Fragmento entre «desde el punto de encuentro» y «hasta el sitio…» en la cláusula SEXTA del contrato. */
export const PUNTO_ENC_TRANSPORTE_CLAUSULA_SEXTA_DEFAULT =
  'en el sector Jorge Coll (Municipio Maneiro)';

export function textoPuntoEncuentroTransporteClausulaSex(raw: string | null | undefined): string {
  const t = typeof raw === 'string' ? raw.trim() : '';
  return t || PUNTO_ENC_TRANSPORTE_CLAUSULA_SEXTA_DEFAULT;
}
