'use client';

import ThemeToggle from '@/components/theme/ThemeToggle';

export default function AjustesPage() {
  return (
    <div
      className="min-h-screen px-5 pb-28 pt-10"
      style={{ background: 'var(--bg-primary)', color: 'var(--label-primary)' }}
    >
      <div className="mx-auto w-full max-w-md">
        <div
          className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl"
          style={{ background: 'var(--bg-tertiary)' }}
        >
          <svg width="32" height="32" viewBox="0 0 40 40" fill="none" aria-hidden>
            <circle cx="20" cy="20" r="5" stroke="var(--label-tertiary)" strokeWidth="2" />
            <path
              d="M20 6v4M20 30v4M6 20h4M30 20h4M9.515 9.515l2.828 2.828M27.657 27.657l2.828 2.828M9.515 30.485l2.828-2.828M27.657 12.343l2.828-2.828"
              stroke="var(--label-tertiary)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h1 className="mb-1 text-2xl font-bold" style={{ color: 'var(--label-primary)' }}>
          Ajustes
        </h1>
        <p className="mb-8 text-sm" style={{ color: 'var(--label-secondary)' }}>
          Preferencias de la interfaz
        </p>

        <section
          className="rounded-2xl border p-4"
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--separator)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h2 className="mb-1 text-sm font-bold" style={{ color: 'var(--label-primary)' }}>
            Apariencia
          </h2>
          <p className="mb-4 text-xs leading-relaxed" style={{ color: 'var(--label-tertiary)' }}>
            El modo claro usa el mismo estilo de fondo que CCO. Pantallas con colores fijos se irán
            adaptando poco a poco.
          </p>
          <ThemeToggle />
        </section>
      </div>
    </div>
  );
}
