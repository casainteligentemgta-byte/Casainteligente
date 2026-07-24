/**
 * Metadata canónica de fragmentos en ci_legal_knowledge (RAG legal).
 *
 * Ejemplo:
 * {
 *   "categoria": "laboral",
 *   "tipo": "ley",
 *   "jurisdiccion": "venezuela",
 *   "fecha_vigencia": "2026-07-16",
 *   "referencia": "Art. 142 LOTTT"
 * }
 */

export const LEGAL_CATEGORIAS = [
  'laboral',
  'civil',
  'mercantil',
  'tributario',
  'corporativo',
  'internacional',
] as const;

export const LEGAL_CATEGORIA_LABELS: Record<(typeof LEGAL_CATEGORIAS)[number], string> = {
  laboral: 'Laboral',
  civil: 'Civil',
  mercantil: 'Mercantil',
  tributario: 'Tributario',
  corporativo: 'Corporativo',
  internacional: 'Internacional',
};

export const LEGAL_TIPOS = [
  'ley',
  'jurisprudencia',
  'doctrina',
  'contrato_modelo',
] as const;

export const LEGAL_JURISDICCIONES = [
  'venezuela',
  'internacional',
  'extranjera',
] as const;

export type LegalCategoria = (typeof LEGAL_CATEGORIAS)[number];
export type LegalTipo = (typeof LEGAL_TIPOS)[number];
export type LegalJurisdiccion = (typeof LEGAL_JURISDICCIONES)[number];

export type LegalKnowledgeMetadata = {
  categoria: LegalCategoria;
  tipo: LegalTipo;
  jurisdiccion: LegalJurisdiccion;
  /** ISO date YYYY-MM-DD */
  fecha_vigencia: string | null;
  /** Ej. "Art. 142 LOTTT" */
  referencia: string | null;
  source?: string | null;
  capitulo?: string | null;
};

/** Ejemplo doctrina / libro (ingesta PDF Obligaciones Legales). */
export const LEGAL_METADATA_EJEMPLO: LegalKnowledgeMetadata = {
  categoria: 'laboral',
  tipo: 'doctrina',
  jurisdiccion: 'venezuela',
  fecha_vigencia: '2026-07-16',
  referencia: 'Libro Frederick Cabrera',
};

/** Ejemplo artículo de ley. */
export const LEGAL_METADATA_EJEMPLO_LEY: LegalKnowledgeMetadata = {
  categoria: 'laboral',
  tipo: 'ley',
  jurisdiccion: 'venezuela',
  fecha_vigencia: '2026-07-16',
  referencia: 'Art. 142 LOTTT',
};

export function esLegalCategoria(v: unknown): v is LegalCategoria {
  return typeof v === 'string' && (LEGAL_CATEGORIAS as readonly string[]).includes(v);
}

export function esLegalTipo(v: unknown): v is LegalTipo {
  return typeof v === 'string' && (LEGAL_TIPOS as readonly string[]).includes(v);
}

export function esLegalJurisdiccion(v: unknown): v is LegalJurisdiccion {
  return typeof v === 'string' && (LEGAL_JURISDICCIONES as readonly string[]).includes(v);
}

export function etiquetaCategoriaLegal(categoria: string | null | undefined): string {
  if (!categoria) return 'Sin categoría';
  if (esLegalCategoria(categoria)) return LEGAL_CATEGORIA_LABELS[categoria];
  return categoria;
}

export function normalizarLegalKnowledgeMetadata(
  raw: Partial<LegalKnowledgeMetadata> | Record<string, unknown> | null | undefined,
): LegalKnowledgeMetadata {
  const r = raw ?? {};
  const fecha =
    typeof r.fecha_vigencia === 'string' && /^\d{4}-\d{2}-\d{2}/.test(r.fecha_vigencia)
      ? r.fecha_vigencia.slice(0, 10)
      : null;
  return {
    categoria: esLegalCategoria(r.categoria) ? r.categoria : 'laboral',
    tipo: esLegalTipo(r.tipo) ? r.tipo : 'ley',
    jurisdiccion: esLegalJurisdiccion(r.jurisdiccion) ? r.jurisdiccion : 'venezuela',
    fecha_vigencia: fecha,
    referencia:
      typeof r.referencia === 'string' && r.referencia.trim()
        ? r.referencia.trim()
        : null,
    source: typeof r.source === 'string' ? r.source : null,
    capitulo: typeof r.capitulo === 'string' ? r.capitulo : null,
  };
}
