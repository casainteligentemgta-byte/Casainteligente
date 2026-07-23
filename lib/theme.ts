/** Tema visual global de Casa Inteligente (claro ≈ CCO / oscuro actual). */

export const CI_THEME_STORAGE_KEY = 'ci-theme-v1';

export type CiTheme = 'light' | 'dark';

export function isCiTheme(value: unknown): value is CiTheme {
  return value === 'light' || value === 'dark';
}

export function readStoredTheme(): CiTheme | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CI_THEME_STORAGE_KEY);
    return isCiTheme(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Aplica tema en <html> (data-theme + clase .dark para Tailwind). */
export function applyThemeToDocument(theme: CiTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}
