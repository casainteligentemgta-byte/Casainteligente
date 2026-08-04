/**
 * Banco mínimo unificado para evaluación de ingreso del obrero.
 *
 * Mínimo viable (sin lógica numérica): 18
 *   6 color + 3 honestidad + 6 ABC común + 3 oficio
 * Recomendado (con lógica de obra): 21
 *   6 color + 3 lógica + 3 honestidad + 6 ABC + 3 oficio
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
  type PreguntaAbcObrero,
} from '@/lib/talento/preguntasAbcFamiliaObrero';
import type { FamiliaOficioObrero } from '@/lib/talento/familiaOficioObrero';

/** Color: 6 situaciones bastan para perfil dominante. */
export const DISC_UNIFICADA: PreguntaDiscObrero[] = PREGUNTAS_DISC_OBRERO.filter((q) =>
  ['d01', 'd02', 'd04', 'd06', 'd07', 'd09'].includes(q.id),
);

/** Lógica práctica (opcional pero recomendada). */
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

export type BancoEvaluacionUnificada = {
  disc: PreguntaDiscObrero[];
  logica: PreguntaLogicaObrero[];
  confiabilidad: PreguntaConfObrero[];
  abc: PreguntaAbcObrero[];
  familia: FamiliaOficioObrero;
  etiquetaFamilia: string;
  /** Total de pasos en UI. */
  total: number;
  /** Mínimo teórico sin lógica. */
  minimoSinLogica: number;
};

export function bancoEvaluacionUnificadaObrero(opts?: {
  cargo?: string | null;
  rolExamen?: string | null;
  codigoGoE?: string | null;
  /** Si false, omite lógica (mínimo 18). Default true → 21. */
  incluirLogica?: boolean;
}): BancoEvaluacionUnificada {
  const incluirLogica = opts?.incluirLogica !== false;
  const armado = armarPreguntasAbcObrero({
    nucleo: ABC_NUCLEO_UNIFICADA,
    cargo: opts?.cargo,
    rolExamen: opts?.rolExamen,
    codigoGoE: opts?.codigoGoE,
  });
  // Del bloque de oficio (5) nos quedamos con 3.
  const bloqueOficio = armado.preguntas.slice(ABC_NUCLEO_UNIFICADA.length, ABC_NUCLEO_UNIFICADA.length + 3);
  const abc = [...ABC_NUCLEO_UNIFICADA, ...bloqueOficio];
  const logica = incluirLogica ? LOGICA_UNIFICADA : [];
  const total =
    DISC_UNIFICADA.length + logica.length + CONF_UNIFICADA.length + abc.length;

  return {
    disc: DISC_UNIFICADA,
    logica,
    confiabilidad: CONF_UNIFICADA,
    abc,
    familia: armado.familia,
    etiquetaFamilia: armado.etiquetaFamilia,
    total,
    minimoSinLogica:
      DISC_UNIFICADA.length + CONF_UNIFICADA.length + ABC_NUCLEO_UNIFICADA.length + 3,
  };
}

export const TOTAL_MINIMO_SIN_LOGICA = 18;
export const TOTAL_RECOMENDADO = 21;
