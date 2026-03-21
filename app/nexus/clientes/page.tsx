import { GlassCard } from '@/components/nexus/GlassCard';
import { Mono } from '@/components/nexus/Mono';
import { NexusAlert } from '@/components/nexus/NexusAlert';
import { NexusSkeletonCard } from '@/components/nexus/NexusSkeleton';
import { db } from '@/lib/db';
import { nexusClients } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { Building2, User } from 'lucide-react';

export default async function NexusClientesPage() {
  if (!db) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Directorio de clientes</h1>
        <NexusAlert variant="info" title="Configura la base de datos">
          Añade <Mono className="text-[var(--nexus-cyan)]">DATABASE_URL</Mono> para listar clientes B2C/B2B e inmuebles.
        </NexusAlert>
      </div>
    );
  }

  let rows: (typeof nexusClients.$inferSelect)[] = [];
  let err: string | null = null;
  try {
    rows = await db.select().from(nexusClients).orderBy(desc(nexusClients.createdAt)).limit(50);
  } catch (e) {
    err = e instanceof Error ? e.message : 'Error al consultar';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Directorio inteligente</h1>
        <p className="mt-1 text-sm text-[var(--nexus-text-muted)]">
          Personas (B2C) y empresas (B2B); cada cliente puede tener múltiples inmuebles (
          <Mono>nexus_client_properties</Mono>).
        </p>
      </div>

      {err ? (
        <NexusAlert variant="error" title="Error de lectura">
          {err}. ¿Ejecutaste la migración <Mono>011_nexus_home_schema.sql</Mono>?
        </NexusAlert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.length === 0 && !err ? (
          <GlassCard>
            <p className="text-[var(--nexus-text-muted)]">Aún no hay registros en nexus_clients.</p>
            <p className="mt-2 text-sm text-[var(--nexus-text-dim)]">
              Usa Drizzle Studio (<Mono>npm run db:studio</Mono>) o inserta datos desde SQL para probar.
            </p>
          </GlassCard>
        ) : null}

        {rows.map((c) => (
          <GlassCard key={c.id} glow={c.type === 'organization'}>
            <div className="flex items-start gap-3">
              <div
                className={`rounded-xl p-2 ${
                  c.type === 'organization'
                    ? 'bg-[rgba(0,242,254,0.12)] text-[var(--nexus-cyan)]'
                    : 'bg-[rgba(0,255,65,0.1)] text-[var(--nexus-green)]'
                }`}
              >
                {c.type === 'organization' ? <Building2 className="h-5 w-5 stroke-[2]" /> : <User className="h-5 w-5 stroke-[2]" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">{c.displayName}</span>
                  <span className="rounded-md border border-[rgba(255,255,255,0.12)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--nexus-text-dim)]">
                    {c.type === 'organization' ? 'B2B' : 'B2C'}
                  </span>
                </div>
                {c.taxId ? (
                  <p className="mt-1 font-mono text-xs text-[var(--nexus-text-muted)]">{c.taxId}</p>
                ) : null}
                {c.email ? <p className="mt-1 text-sm text-[var(--nexus-text-muted)]">{c.email}</p> : null}
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {false ? <NexusSkeletonCard /> : null}
    </div>
  );
}
