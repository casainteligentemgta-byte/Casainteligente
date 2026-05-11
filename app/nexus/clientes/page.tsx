import { GlassCard } from '@/components/nexus/GlassCard';
import { Mono } from '@/components/nexus/Mono';
import { NexusAlert } from '@/components/nexus/NexusAlert';
import { NexusSkeletonCard } from '@/components/nexus/NexusSkeleton';
import { db } from '@/lib/db';
import { nexusClients } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { Building2, User } from 'lucide-react';

/** Drizzle/postgres suelen envolver el PostgresError en `cause`; sin esto solo ves "Failed query: …". */
function formatDbErrorChain(e: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let cur: unknown = e;
  for (let depth = 0; cur != null && depth < 10; depth++) {
    if (typeof cur !== 'object') {
      parts.push(String(cur));
      break;
    }
    if (seen.has(cur)) break;
    seen.add(cur);
    const o = cur as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message.trim()) parts.push(o.message.trim());
    if (typeof o.detail === 'string' && o.detail.trim()) parts.push(`Detalle: ${o.detail.trim()}`);
    if (typeof o.hint === 'string' && o.hint.trim()) parts.push(`Sugerencia: ${o.hint.trim()}`);
    if (typeof o.code === 'string' && o.code.trim()) parts.push(`Código Postgres: ${o.code.trim()}`);
    cur = o.cause ?? null;
  }
  return Array.from(new Set(parts)).join('\n\n');
}

function pareceTablaNexusAusente(msg: string): boolean {
  return (
    /42P01/.test(msg) ||
    /undefined_table/i.test(msg) ||
    /relation\s+"?nexus_clients"?/i.test(msg) ||
    /does not exist/i.test(msg) ||
    (/Failed query/i.test(msg) && /nexus_clients/i.test(msg))
  );
}

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
    err = formatDbErrorChain(e);
  }

  const ayudaMigracion011 = err ? pareceTablaNexusAusente(err) : false;

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
          <p className="whitespace-pre-wrap break-words font-mono text-xs text-[var(--nexus-text-muted)]">{err}</p>
          {ayudaMigracion011 ? (
            <p className="mt-3 text-[var(--nexus-text-muted)]">
              La tabla <Mono>nexus_clients</Mono> no existe en esta base. En el mismo proyecto Postgres al que apunta{' '}
              <Mono>DATABASE_URL</Mono>: Supabase → <strong>SQL Editor</strong> → pega y ejecuta{' '}
              <Mono>supabase/migrations/011_nexus_home_schema.sql</Mono> (archivo completo del repo).
            </p>
          ) : (
            <p className="mt-3 text-[var(--nexus-text-muted)]">
              Revisa conexión, credenciales y que <Mono>DATABASE_URL</Mono> apunte al proyecto correcto. Si acabas de
              crear el proyecto, aplica también <Mono>011_nexus_home_schema.sql</Mono> por si el esquema Nexus nunca se
              cargó.
            </p>
          )}
          <p className="mt-2 text-xs text-[var(--nexus-text-dim)]">
            En local: <Mono>npm run verify:db</Mono> (comprueba tablas y avisa si falta Nexus).
          </p>
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
