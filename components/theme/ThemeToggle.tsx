'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import type { CiTheme } from '@/lib/theme';

const OPTIONS: { id: CiTheme; label: string; hint: string; Icon: typeof Sun }[] = [
  {
    id: 'light',
    label: 'Claro',
    hint: 'Fondo blanco · estilo CCO',
    Icon: Sun,
  },
  {
    id: 'dark',
    label: 'Oscuro',
    hint: 'Tema actual de la app',
    Icon: Moon,
  },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Tema de la aplicación"
      className="grid grid-cols-2 gap-2"
    >
      {OPTIONS.map(({ id, label, hint, Icon }) => {
        const active = theme === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(id)}
            className="flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition-colors"
            style={{
              borderColor: active ? 'var(--ios-blue)' : 'var(--separator)',
              background: active ? 'var(--theme-option-active-bg)' : 'var(--bg-secondary)',
              boxShadow: active ? '0 0 0 1px var(--ios-blue)' : 'none',
            }}
          >
            <span className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--label-primary)' }}>
              <Icon size={16} strokeWidth={2.25} aria-hidden />
              {label}
            </span>
            <span className="text-[11px] leading-snug" style={{ color: 'var(--label-tertiary)' }}>
              {hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
