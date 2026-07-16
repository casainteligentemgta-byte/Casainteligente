import { GlassCard } from '@/components/nexus/GlassCard';
import { Mono } from '@/components/nexus/Mono';

const PHASES = [
  { id: 'cabling', label: 'Cableado', status: 'done' as const },
  { id: 'mounting', label: 'Montaje', status: 'in_progress' as const },
  { id: 'calibration', label: 'Calibración', status: 'pending' as const },
  { id: 'handover', label: 'Entrega', status: 'pending' as const },
];

export default function NexusProyectosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Proyectos de obra</h1>
        <p className="mt-1 text-sm text-[var(--nexus-text-muted)]">
          Contratos firmados vinculados a dirección física. Timeline: cableado → montaje → calibración → entrega.
        </p>
      </div>

      <GlassCard glow>
        <p className="font-mono text-xs uppercase tracking-wider text-[var(--nexus-cyan)]">Demo · Villa Aurora</p>
        <p className="mt-2 text-lg font-semibold text-white">Instalación domótica + CCTV</p>
        <p className="mt-1 font-mono text-sm text-[var(--nexus-text-muted)]">
          Av. Principal, km 4.5 · <Mono className="text-[var(--nexus-green)]">10.4969, -66.8983</Mono>
        </p>

        <div className="relative mt-8">
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-[rgba(255,255,255,0.12)]" aria-hidden />
          <ul className="space-y-6">
            {PHASES.map((p) => (
              <li key={p.id} className="relative flex gap-4 pl-12">
                <span
                  className={`absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-full border-2 font-mono text-xs ${
                    p.status === 'done'
                      ? 'border-[var(--nexus-green)] bg-[rgba(0,255,65,0.12)] text-[var(--nexus-green)]'
                      : p.status === 'in_progress'
                        ? 'border-[var(--nexus-cyan)] bg-[rgba(0,242,254,0.12)] text-[var(--nexus-cyan)] shadow-[0_0_20px_var(--color-primary-glow)]'
                        : 'border-[rgba(255,255,255,0.15)] text-[var(--nexus-text-dim)]'
                  }`}
                >
                  {p.status === 'done' ? '✓' : p.status === 'in_progress' ? '●' : '○'}
                </span>
                <div>
                  <p className="font-medium text-white">{p.label}</p>
                  <p className="text-xs text-[var(--nexus-text-dim)]">
                    {p.status === 'done' ? 'Completado' : p.status === 'in_progress' ? 'En curso' : 'Pendiente'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </GlassCard>
    </div>
  );
}
