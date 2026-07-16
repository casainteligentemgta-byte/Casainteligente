'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NEXUS_MODULES } from '@/lib/nexus/modules';
import { GlowIcon } from '@/components/nexus/GlowIcon';
import { cn } from '@/lib/utils';

const groups: Record<string, string> = {
  core: 'Operación',
  commercial: 'Comercial',
  field: 'Campo',
  concept: 'Visión',
};

export function NexusSidebar() {
  const pathname = usePathname();
  const byGroup = NEXUS_MODULES.reduce<Record<string, typeof NEXUS_MODULES>>((acc, m) => {
    (acc[m.group] ??= []).push(m);
    return acc;
  }, {});

  return (
    <aside
      className={cn(
        'hidden w-64 shrink-0 flex-col border-r border-[rgba(255,255,255,0.08)] bg-[rgba(10,11,16,0.75)] backdrop-blur-[20px] lg:flex',
        'min-h-screen pt-6 pb-8',
      )}
    >
      <div className="px-5 pb-6">
        <Link href="/nexus" className="block">
          <p className="font-[family-name:var(--font-nexus-mono)] text-xs uppercase tracking-[0.2em] text-[var(--nexus-cyan)]">
            Nexus
          </p>
          <p className="mt-1 text-lg font-bold tracking-tight text-white">Home</p>
          <p className="text-xs text-[var(--nexus-text-muted)]">Domótica de lujo</p>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3">
        {(['core', 'commercial', 'concept'] as const).map((g) => (
          <div key={g}>
            <p className="mb-2 px-2 font-[family-name:var(--font-nexus-mono)] text-[10px] font-medium uppercase tracking-wider text-[var(--nexus-text-dim)]">
              {groups[g]}
            </p>
            <ul className="space-y-0.5">
              {(byGroup[g] ?? []).map((m) => {
                const active = pathname === m.href || (m.href !== '/nexus' && pathname.startsWith(m.href));
                return (
                  <li key={m.href}>
                    <Link
                      href={m.href}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
                        active
                          ? 'bg-[rgba(0,242,254,0.12)] text-[var(--nexus-cyan)] shadow-[inset_0_0_0_1px_rgba(0,242,254,0.25)]'
                          : 'text-[var(--nexus-text-muted)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white',
                      )}
                    >
                      <GlowIcon icon={m.icon} size={18} />
                      <span className="font-medium">{m.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="mt-auto border-t border-[rgba(255,255,255,0.06)] px-5 pt-4">
        <Link
          href="/"
          className="text-xs text-[var(--nexus-text-dim)] transition-colors hover:text-[var(--nexus-cyan)]"
        >
          ← CRM Casa Inteligente
        </Link>
      </div>
    </aside>
  );
}
