import type { RecruitmentAnalysisJson } from '@/types/recruitment';
import { MAX_CONFRONTATIONS_PER_BLOCK } from '@/lib/recruitment/constants';
import type { RecruitmentSessionState } from '@/lib/recruitment/session-state';

export interface PolicyDecision {
  triggerConfrontation: boolean;
  confrontationHook?: string;
}

/**
 * Decide si se dispara el guion de confrontación según señales y cupo por bloque.
 */
export function shouldConfront(
  state: RecruitmentSessionState,
  analysis: RecruitmentAnalysisJson,
): PolicyDecision {
  const underLimit = state.confrontationsThisBlock < MAX_CONFRONTATIONS_PER_BLOCK;
  const signals = analysis.signals;
  const hasHook = Boolean(analysis.signals.confrontationHook?.trim());
  const hasSignal = signals.contradictionDetected || signals.evasionDetected;
  const triggerConfrontation = underLimit && hasSignal && hasHook;

  return {
    triggerConfrontation,
    confrontationHook: triggerConfrontation ? analysis.signals.confrontationHook : undefined,
  };
}
