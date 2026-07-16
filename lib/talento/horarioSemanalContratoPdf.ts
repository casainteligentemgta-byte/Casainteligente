/**
 * Texto de horario semanal para contratos PDF: prioriza dato del contrato, luego default del proyecto,
 * y por último una frase según la jornada (diurna / nocturna / mixta).
 */

/** Cuando no hay horario en contrato ni en proyecto (jornada diurna): coincide con la cláusula TERCERA del PDF. */
export const HORARIO_JORNADA_TERCERA_CONTRATO_PDF_DEFAULT =
  'De lunes a jueves, de 7:00 a.m. a 5:00 p.m. y los viernes de 7:00 a.m. a 12:00 p.m.';

export function textoHorarioDesdeJornadaContrato(jornada: string | null | undefined): string {
  const t = (jornada ?? '').trim().toLowerCase();
  if (t === 'nocturna' || t === 'nocturno') {
    return '7:00 p.m. a 7:00 a.m. (cuadrante nocturno según supervisión de obra)';
  }
  if (t === 'mixta' || t === 'mixto') {
    return 'cuadrante rotativo mixto según planificación de la supervisión de obra';
  }
  return HORARIO_JORNADA_TERCERA_CONTRATO_PDF_DEFAULT;
}

export function resolverTextoHorarioSemanalObra(opts: {
  horarioContrato?: string | null;
  horarioProyectoDefault?: string | null;
  jornadaTrabajo?: string | null;
}): string {
  const a = (opts.horarioContrato ?? '').trim();
  if (a) return a;
  const b = (opts.horarioProyectoDefault ?? '').trim();
  if (b) return b;
  return textoHorarioDesdeJornadaContrato(opts.jornadaTrabajo);
}
