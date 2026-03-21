import { AlertTriangle } from 'lucide-react';

/** Mensaje de error / aviso con estética neon-glass */
export function NexusAlert({
  variant = 'error',
  title,
  children,
}: {
  variant?: 'error' | 'warn' | 'info';
  title: string;
  children: React.ReactNode;
}) {
  const border =
    variant === 'error'
      ? 'border-[rgba(255,215,0,0.35)]'
      : variant === 'warn'
        ? 'border-[rgba(255,215,0,0.25)]'
        : 'border-[rgba(0,242,254,0.25)]';
  const glow =
    variant === 'error'
      ? 'shadow-[0_0_24px_-8px_rgba(255,215,0,0.35)]'
      : 'shadow-[0_0_20px_-8px_rgba(0,242,254,0.2)]';

  return (
    <div
      role="alert"
      className={`flex gap-3 rounded-2xl border ${border} bg-[rgba(255,255,255,0.04)] p-4 backdrop-blur-[20px] ${glow}`}
    >
      <AlertTriangle
        className={`mt-0.5 h-5 w-5 shrink-0 stroke-[2] ${
          variant === 'error' ? 'text-[var(--nexus-gold)]' : 'text-[var(--nexus-cyan)]'
        }`}
      />
      <div>
        <p className="font-semibold text-white">{title}</p>
        <div className="mt-1 text-sm text-[var(--nexus-text-muted)]">{children}</div>
      </div>
    </div>
  );
}
