/**
 * Banco unificado de ingreso del obrero (21 preguntas).
 * 6 color + 3 lógica + 3 honestidad + 6 ABC común + 3 oficio.
 */

import {
  PREGUNTAS_CONFIABILIDAD_OBRERO,
  PREGUNTAS_DISC_OBRERO,
  PREGUNTAS_LOGICA_OBRERO,
  type PreguntaConfObrero,
  type PreguntaDiscObrero,
  type PreguntaLogicaObrero,
} from '@/lib/talento/evaluacionObrero';
import { PREGUNTAS_OBRERO_NUCLEO, type PreguntaObrero } from '@/lib/talento/exam';
import {
  armarPreguntasAbcObrero,
  CHOFER_EXTRA,
  type PreguntaAbcObrero,
} from '@/lib/talento/preguntasAbcFamiliaObrero';
import {
  trackEvaluacionObrero,
  etiquetaTrackEvaluacion,
  type FamiliaOficioObrero,
  type TrackEvaluacionObrero,
} from '@/lib/talento/familiaOficioObrero';

/** Color: 6 situaciones bastan para perfil dominante. */
export const DISC_UNIFICADA: PreguntaDiscObrero[] = PREGUNTAS_DISC_OBRERO.filter((q) =>
  ['d01', 'd02', 'd04', 'd06', 'd07', 'd09'].includes(q.id),
);

/** Lógica práctica de obra. */
export const LOGICA_UNIFICADA: PreguntaLogicaObrero[] = PREGUNTAS_LOGICA_OBRERO.filter((q) =>
  ['l02', 'l04', 'l05'].includes(q.id),
);

/** Honestidad / integridad. */
export const CONF_UNIFICADA: PreguntaConfObrero[] = PREGUNTAS_CONFIABILIDAD_OBRERO.filter((q) =>
  ['c01', 'c02', 'c03'].includes(q.id),
);

/** ABC común: seguridad + responsabilidad críticas. */
const IDS_ABC_NUCLEO_MIN = ['obr_01', 'obr_02', 'obr_03', 'obr_07', 'obr_09', 'obr_10'] as const;

export const ABC_NUCLEO_UNIFICADA: PreguntaObrero[] = PREGUNTAS_OBRERO_NUCLEO.filter((q) =>
  (IDS_ABC_NUCLEO_MIN as readonly string[]).includes(q.id),
);

/**
 * Chofer: del núcleo solo quedan las de responsabilidad (material dañado, gente rara).
 * Las de arnés, cables y EPP son de obra y no miden a un conductor.
 */
const IDS_ABC_NUCLEO_CHOFER = ['obr_09', 'obr_10'] as const;

export const ABC_NUCLEO_CHOFER: PreguntaObrero[] = PREGUNTAS_OBRERO_NUCLEO.filter((q) =>
  (IDS_ABC_NUCLEO_CHOFER as readonly string[]).includes(q.id),
);

export type BancoEvaluacionUnificada = {
  disc: PreguntaDiscObrero[];
  logica: PreguntaLogicaObrero[];
  confiabilidad: PreguntaConfObrero[];
  abc: PreguntaAbcObrero[];
  familia: FamiliaOficioObrero;
  etiquetaFamilia: string;
  track: TrackEvaluacionObrero;
  etiquetaTrack: string;
  /** Total de pasos en UI (21; chofer 25). */
  total: number;
};

export function bancoEvaluacionUnificadaObrero(opts?: {
  cargo?: string | null;
  rolExamen?: string | null;
  codigoGoE?: string | null;
}): BancoEvaluacionUnificada {
  const track = trackEvaluacionObrero({
    cargo: opts?.cargo,
    rolExamen: opts?.rolExamen,
    codigoGoE: opts?.codigoGoE,
  });
  const armado = armarPreguntasAbcObrero({
    nucleo: ABC_NUCLEO_UNIFICADA,
    cargo: opts?.cargo,
    rolExamen: opts?.rolExamen,
    codigoGoE: opts?.codigoGoE,
  });
  const bloqueFamilia = armado.preguntas.slice(ABC_NUCLEO_UNIFICADA.length);
  // Del bloque de oficio (5) nos quedamos con 3. El chofer usa su núcleo propio,
  // los 5 de oficio y su bloque adicional.
  const abc =
    armado.familia === 'chofer'
      ? [...ABC_NUCLEO_CHOFER, ...bloqueFamilia.slice(0, 5), ...CHOFER_EXTRA]
      : [...ABC_NUCLEO_UNIFICADA, ...bloqueFamilia.slice(0, 3)];
  const total =
    DISC_UNIFICADA.length + LOGICA_UNIFICADA.length + CONF_UNIFICADA.length + abc.length;

  return {
    disc: DISC_UNIFICADA,
    logica: LOGICA_UNIFICADA,
    confiabilidad: CONF_UNIFICADA,
    abc,
    familia: armado.familia,
    etiquetaFamilia: armado.etiquetaFamilia,
    track,
    etiquetaTrack: etiquetaTrackEvaluacion(track),
    total,
  };
}

/** Total de la evaluación unificada (todas las familias salvo chofer). */
export const TOTAL_EVALUACION_UNIFICADA = 21;

/** Total para chofer: 6 color + 3 lógica + 3 honestidad + 2 núcleo + 5 oficio + 6 propios. */
export const TOTAL_EVALUACION_UNIFICADA_CHOFER =
  DISC_UNIFICADA.length +
  LOGICA_UNIFICADA.length +
  CONF_UNIFICADA.length +
  ABC_NUCLEO_CHOFER.length +
  5 +
  CHOFER_EXTRA.length;
