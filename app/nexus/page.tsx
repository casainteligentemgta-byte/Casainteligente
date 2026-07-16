import { GlassCardMotion } from '@/components/nexus/GlassCard';
import { Mono } from '@/components/nexus/Mono';
import { NexusAlert } from '@/components/nexus/NexusAlert';
import { db } from '@/lib/db';
import { NEXUS_MODULES } from '@/lib/nexus/modules';
import Link from 'next/link';

export default async function NexusDashboardPage() {
  const dbOk = !!db;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">Panel Nexus Home</h1>
        <p className="mt-1 text-[var(--nexus-text-muted)]">
          ERP/CRM para operación en escritorio y revisión en campo (tablet).
        </p>
      </div>

      {!dbOk ? (
        <NexusAlert variant="warn" title="Base de datos no conectada">
          Configura <Mono className="text-[var(--nexus-cyan)]">DATABASE_URL</Mono> en{' '}
          <Mono className="text-[var(--nexus-cyan)]">.env.local</Mono> (PostgreSQL / Supabase). Luego ejecuta{' '}
          <Mono className="text-[var(--nexus-green)]">npm run db:push</Mono> o aplica la migración SQL{' '}
          <Mono>011_nexus_home_schema.sql</Mono>.
        </NexusAlert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {NEXUS_MODULES.filter((m) => m.href !== '/nexus').map((m, i) => (
          <Link key={m.href} href={m.href}>
            <GlassCardMotion delay={i * 0.05} className="h-full cursor-pointer transition-transform hover:scale-[1.01]">
              <p className="font-[family-name:var(--font-nexus-mono)] text-[10px] uppercase tracking-widest text-[var(--nexus-cyan)]">
                {m.group}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">{m.label}</h2>
              <p className="mt-1 text-sm text-[var(--nexus-text-muted)]">{m.description}</p>
            </GlassCardMotion>
          </Link>
        ))}
      </div>

      <GlassCardMotion>
        <h3 className="text-sm font-semibold text-white">Estado del stack</h3>
        <ul className="mt-3 space-y-2 font-mono text-xs text-[var(--nexus-text-muted)]">
          <li>
            Drizzle ORM:{' '}
            <Mono className={dbOk ? 'text-[var(--nexus-green)]' : 'text-[var(--nexus-gold)]'}>
              {dbOk ? 'conectado' : 'sin DATABASE_URL'}
            </Mono>
          </li>
          <li>
            Tablas:{' '}
            <Mono className="text-[var(--nexus-cyan)]">nexus_*</Mono> (prefijo aislado del CRM legado)
          </li>
        </ul>
      </GlassCardMotion>
    </div>
  );
}
