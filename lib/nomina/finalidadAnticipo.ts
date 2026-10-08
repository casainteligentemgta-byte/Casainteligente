/**
 * Finalidades por las que el trabajador puede pedir un anticipo de la garantía de prestaciones
 * sociales (artículo 144 de la LOTTT). Sin una de ellas el anticipo es impugnable.
 */
export type FinalidadAnticipo = 'vivienda' | 'hipoteca' | 'educacion' | 'salud';

export const FINALIDADES_ANTICIPO: readonly { valor: FinalidadAnticipo; literal: string; texto: string }[] = [
  {
    valor: 'vivienda',
    literal: '1',
    texto: 'Construcción, adquisición, mejora o reparación de vivienda para mí y mi familia.',
  },
  {
    valor: 'hipoteca',
    literal: '2',
    texto: 'Liberación de hipoteca o de cualquier otro gravamen sobre vivienda de mi propiedad.',
  },
  {
    valor: 'educacion',
    literal: '3',
    texto: 'Inversión en educación para mí o mi familia.',
  },
  {
    valor: 'salud',
    literal: '4',
    texto: 'Gastos por atención médica y hospitalaria para mí o mi familia.',
  },
];

export function esFinalidadAnticipo(v: unknown): v is FinalidadAnticipo {
  return FINALIDADES_ANTICIPO.some((f) => f.valor === v);
}

export function textoFinalidadAnticipo(v: FinalidadAnticipo | null | undefined): string | null {
  return FINALIDADES_ANTICIPO.find((f) => f.valor === v)?.texto ?? null;
}

/** Texto de la solicitud que se guarda con el anticipo (incluye la finalidad elegida). */
export function solicitudAnticipoConFinalidad(base: string, finalidad: FinalidadAnticipo): string {
  const t = textoFinalidadAnticipo(finalidad);
  return `${base.trim()} Finalidad (art. 144 LOTTT): ${t}`;
}
