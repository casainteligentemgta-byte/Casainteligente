import type {
  ConfrontationRecord,
  RecruitmentAnalysisJson,
  RecruitmentClientEvent,
} from '@/types/recruitment';

export interface RecruitmentSessionState {
  id: string;
  createdAt: number;
  expiresAt: number;
  currentBlock: number;
  turnInBlock: number;
  confrontationsThisBlock: number;
  fraudScore: number;
  history: Array<{ role: 'user' | 'assistant'; content: string; at: number }>;
  events: RecruitmentClientEvent[];
  analyses: RecruitmentAnalysisJson[];
  confrontations: ConfrontationRecord[];
  pendingConfrontation?: { hook: string; sinceTurn: number };
  closed: boolean;
  closeReason?: 'expired' | 'fraud' | 'completed' | 'timeout_inactivity';
  whatsappNotified?: boolean;
}

export function createInitialSession(id: string, now: number, ttlMs: number): RecruitmentSessionState {
  return {
    id,
    createdAt: now,
    expiresAt: now + ttlMs,
    currentBlock: 1,
    turnInBlock: 0,
    confrontationsThisBlock: 0,
    fraudScore: 0,
    history: [],
    events: [],
    analyses: [],
    confrontations: [],
    closed: false,
  };
}
