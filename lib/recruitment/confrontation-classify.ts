import type { HonestyOutcome } from '@/types/recruitment';

const ADMIT = /\b(tienes raz[oó]n|correcto|me equivoqu[eé]|fue mi error|reconozco|claro que|es verdad)\b/i;
const REDOBLE = /\b(nunca|jam[aá]s|no es cierto|mentira|eso no)\b/i;
const EVASION = /\b(no s[eé]|quiz[aá]|tal vez|depende|m[aá]s o menos|algo as[ií])\b/i;

/** Clasificación ligera; se puede sustituir por otro modelo si hace falta. */
export function classifyConfrontationResponse(text: string): HonestyOutcome {
  const t = text.trim();
  if (t.length < 8) return 'evasion';
  if (REDOBLE.test(t)) return 'redoblo';
  if (ADMIT.test(t)) return 'admitio';
  if (EVASION.test(t)) return 'evasion';
  return 'neutral';
}
