/** Especialidades de planos de obra (arquitectura, estructura, etc.). */

export const DISCIPLINAS_PLANO = [
  { id: 'arquitectonico', label: 'Arquitectónico', prefijo: 'ARQ' },
  { id: 'estructural', label: 'Estructural', prefijo: 'EST' },
  { id: 'electrico', label: 'Eléctrico', prefijo: 'ELE' },
  { id: 'sanitario', label: 'Sanitario', prefijo: 'SAN' },
  { id: 'bomberos', label: 'Bomberos', prefijo: 'BOM' },
  { id: 'mecanico', label: 'Mecánico', prefijo: 'MEC' },
  { id: 'especificaciones', label: 'Especificaciones', prefijo: 'ESP' },
  { id: 'otro', label: 'Otro', prefijo: 'OTR' },
] as const;

export type DisciplinaPlanoId = (typeof DISCIPLINAS_PLANO)[number]['id'];

export function disciplinaPlanoPorId(id: string | null | undefined): (typeof DISCIPLINAS_PLANO)[number] {
  const found = DISCIPLINAS_PLANO.find((d) => d.id === id);
  return found ?? DISCIPLINAS_PLANO[DISCIPLINAS_PLANO.length - 1]!;
}

/** Infieren disciplina desde el código (ARQ-01, EST-03, …). */
export function inferirDisciplinaDesdeCodigo(codigo: string): DisciplinaPlanoId {
  const head = codigo.trim().toUpperCase().split(/[-_\s]/)[0] ?? '';
  const byPrefijo = DISCIPLINAS_PLANO.find((d) => d.prefijo === head);
  if (byPrefijo) return byPrefijo.id;
  return 'otro';
}

export function etiquetaDisciplinaPlano(id: DisciplinaPlanoId): string {
  return disciplinaPlanoPorId(id).label;
}
