import type {
  CeoDashboardPayload,
  ConfrontationRecord,
  RecruitmentAnalysisJson,
  SemaphoreLevel,
} from '@/types/recruitment';
import type { RecruitmentSessionState } from '@/lib/recruitment/session-state';

function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1];
}

function semaphoreFrom(
  integrityRisk: number,
  confrontations: number,
): { level: SemaphoreLevel; label: string } {
  if (integrityRisk >= 0.65 || confrontations >= 4) {
    return { level: 'red', label: 'Revisión humana prioritaria' };
  }
  if (integrityRisk >= 0.4 || confrontations >= 2) {
    return { level: 'yellow', label: 'Contraste adicional recomendado' };
  }
  return { level: 'green', label: 'Perfil alineado a primera vista' };
}

function gmaScoreFromAnalyses(analyses: RecruitmentAnalysisJson[]): number {
  const scores = analyses
    .map((a) => a.gma?.scoreOutOf5)
    .filter((n): n is number => typeof n === 'number' && !Number.isNaN(n));
  if (scores.length === 0) return 0;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

/**
 * Construye el payload para el dashboard del CEO al cerrar o consultar sesión.
 */
export function buildCeoPayload(
  state: RecruitmentSessionState,
  analyses: RecruitmentAnalysisJson[],
): CeoDashboardPayload {
  const analysis = last(analyses) ?? null;
  const integrity = analysis?.integrity ?? {
    riskScore: 0.35,
    dimensions: { operativa: 0.35, honestidad: 0.35, consistencia: 0.35 },
  };
  const disc = analysis?.disc ?? {
    dominant: 'mixed' as const,
    scores: { D: 0.25, I: 0.25, S: 0.25, C: 0.25 },
  };
  const confrontations = state.confrontations.length;
  const sem = semaphoreFrom(integrity.riskScore, confrontations);

  const summaryParts: string[] = [];
  const admitted = state.confrontations.filter((c) => c.outcome === 'admitio').length;
  const doubled = state.confrontations.filter((c) => c.outcome === 'redoblo').length;
  const evasion = state.confrontations.filter((c) => c.outcome === 'evasion').length;
  if (admitted) summaryParts.push(`${admitted} confrontación(es) con admisión`);
  if (doubled) summaryParts.push(`${doubled} re-doble`);
  if (evasion) summaryParts.push(`${evasion} evasión(es)`);
  const summary = summaryParts.length ? summaryParts.join(' · ') : 'Sin confrontaciones registradas';

  return {
    sessionId: state.id,
    ...(state.needId
      ? { vacancy: { needId: state.needId, ...(state.needTitle ? { needTitle: state.needTitle } : {}) } }
      : {}),
    closedAt: new Date().toISOString(),
    semaphore: sem,
    disc,
    integrity,
    gma: {
      scoreOutOf5: gmaScoreFromAnalyses(analyses),
      disclaimer: 'GMA es apoyo; no sustituye pruebas psicométricas validadas.',
    },
    honesty: {
      confrontations,
      summary,
      records: state.confrontations as ConfrontationRecord[],
    },
    lastAnalysis: analysis,
  };
}
