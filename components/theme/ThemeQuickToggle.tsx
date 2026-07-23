'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

/** Botón compacto para alternar claro/oscuro (p. ej. cabecera de Inicio). */
export default function ThemeQuickToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isLight ? 'Cambiar a oscuro' : 'Cambiar a claro'}
      aria-label={isLight ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors landscape:h-8 landscape:w-8 ${className}`}
      style={{
        background: isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.08)',
        border: isLight ? '1px solid rgba(15, 23, 42, 0.12)' : '1px solid rgba(255, 255, 255, 0.15)',
        color: isLight ? '#0f172a' : '#fafafa',
      }}
    >
      {isLight ? <Moon size={16} strokeWidth={2.25} aria-hidden /> : <Sun size={16} strokeWidth={2.25} aria-hidden />}
    </button>
  );
}
