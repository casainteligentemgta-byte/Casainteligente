/** Flag en app_metadata (no editable por el usuario). */
export const MUST_CHANGE_PASSWORD_KEY = 'must_change_password' as const;

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGIT = '23456789';
const SYMBOL = '!@#$%&*?';
const ALL = UPPER + LOWER + DIGIT + SYMBOL;

/**
 * Genera una clave aleatoria de un solo uso (servidor).
 * Nunca uses claves fijas como 12345678.
 */
export function generateOneTimePassword(length = 14): string {
  const size = Math.max(12, Math.min(32, length));
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);

  const chars: string[] = [
    UPPER[bytes[0]! % UPPER.length]!,
    LOWER[bytes[1]! % LOWER.length]!,
    DIGIT[bytes[2]! % DIGIT.length]!,
    SYMBOL[bytes[3]! % SYMBOL.length]!,
  ];
  for (let i = 4; i < size; i++) {
    chars.push(ALL[bytes[i]! % ALL.length]!);
  }
  // Mezcla Fisher–Yates con bytes restantes
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[i % bytes.length]! % (i + 1);
    const tmp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = tmp;
  }
  return chars.join('');
}

/** Valida una clave elegida por el usuario (cambio obligatorio / reset propio). */
export function validarNuevaPassword(password: string): string | null {
  const p = password.trim();
  if (p.length < 10) return 'La clave debe tener al menos 10 caracteres';
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) {
    return 'La clave debe incluir letras y números';
  }
  if (p === '12345678' || p.toLowerCase() === 'password' || p.toLowerCase() === 'casa1234') {
    return 'Esa clave es demasiado predecible. Elige otra.';
  }
  return null;
}

export function debeCambiarPassword(
  appMetadata: Record<string, unknown> | undefined | null,
): boolean {
  if (!appMetadata) return false;
  return appMetadata[MUST_CHANGE_PASSWORD_KEY] === true;
}
