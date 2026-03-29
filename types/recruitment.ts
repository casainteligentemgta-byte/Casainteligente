/**
 * Contratos públicos del flujo de reclutamiento no lineal (DISC / integridad / GMA).
 * El motor y Gemini devuelven JSON alineado a estos tipos.
 */

export type DiscDominant = 'D' | 'I' | 'S' | 'C' | 'mixed';

export type IntegrityDimension = 'operativa' | 'honestidad' | 'consistencia';

export interface IntegrityAssessment {
  /** 0–1, riesgo global (no diagnóstico clínico; apoyo a la decisión humana) */
  riskScore: number;
  dimensions: Partial<Record<IntegrityDimension, number>>;
  notes?: string;
}

export interface GmaItemScore {
  itemId: number;
  correct: boolean;
}

export interface RecruitmentAnalysisJson {
  turnIndex: number;
  disc: {
    dominant: DiscDominant;
    scores: { D: number; I: number; S: number; C: number };
  };
  integrity: IntegrityAssessment;
  /** Señales para el motor de políticas (contradicciones, evasión, etc.) */
  signals: {
    contradictionDetected: boolean;
    evasionDetected: boolean;
    /** Texto breve para el guion de confrontación si aplica */
    confrontationHook?: string;
  };
  gma?: {
    items: GmaItemScore[];
    /** Nota sobre 5 si hay ítems evaluados en este turno */
    scoreOutOf5?: number;
  };
  /** Siguiente pregunta sugerida al candidato (si no hay confrontación forzada) */
  assistantReply?: string;
}

export type HonestyOutcome = 'admitio' | 'redoblo' | 'evasion' | 'neutral';

export interface ConfrontationRecord {
  at: number;
  blockIndex: number;
  hook: string;
  candidateResponse?: string;
  outcome: HonestyOutcome;
}

export type SemaphoreLevel = 'green' | 'yellow' | 'red';

export interface CeoDashboardPayload {
  sessionId: string;
  closedAt: string;
  semaphore: {
    level: SemaphoreLevel;
    label: string;
  };
  disc: RecruitmentAnalysisJson['disc'];
  integrity: IntegrityAssessment;
  gma: { scoreOutOf5: number; disclaimer: string };
  honesty: {
    confrontations: number;
    summary: string;
    records: ConfrontationRecord[];
  };
  /** Último JSON consolidado de análisis */
  lastAnalysis: RecruitmentAnalysisJson | null;
}

export type RecruitmentClientEventType =
  | 'blur'
  | 'focus'
  | 'copy'
  | 'paste'
  | 'visibility_hidden'
  | 'visibility_visible';

export interface RecruitmentClientEvent {
  type: RecruitmentClientEventType;
  at: number;
  meta?: Record<string, unknown>;
}
