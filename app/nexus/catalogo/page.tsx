import { GlassCard } from '@/components/nexus/GlassCard';
import { Mono } from '@/components/nexus/Mono';
import { NexusAlert } from '@/components/nexus/NexusAlert';
import { db } from '@/lib/db';
import { nexusCatalogItems } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export default async function NexusCatalogoPage() {
  if (!db) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Catálogo maestro</h1>
        <NexusAlert variant="info" title="Sin conexión ORM">
          Configura <Mono className="text-[var(--nexus-cyan)]">DATABASE_URL</Mono> para CRUD de hardware y servicios.
        </NexusAlert>
      </div>
    );
  }

  let rows: (typeof nexusCatalogItems.$inferSelect)[] = [];
  let err: string | null = null;
  try {
    rows = await db.select().from(nexusCatalogItems).orderBy(desc(nexusCatalogItems.updatedAt)).limit(100);
  } catch (e) {
    err = e instanceof Error ? e.message : 'Error';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Catálogo maestro</h1>
          <p className="mt-1 text-sm text-[var(--nexus-text-muted)]">
            Hardware con <Mono>SKU</Mono> y stock; servicios (instalación, cloud) sin stock obligatorio.
          </p>
        </div>
        <p className="font-mono text-xs text-[var(--nexus-text-dim)]">
          CRUD UI: siguiente iteración · datos vía DB
        </p>
      </div>

      {err ? (
        <NexusAlert variant="error" title="Error de catálogo">
          {err}
        </NexusAlert>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] backdrop-blur-[20px]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.08)] text-[10px] uppercase tracking-wider text-[var(--nexus-text-dim)]">
              <th className="p-4">Tipo</th>
              <th className="p-4 font-mono">SKU</th>
              <th className="p-4">Nombre</th>
              <th className="p-4 text-right font-mono">Precio</th>
              <th className="p-4 text-right font-mono">Stock</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !err ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-[var(--nexus-text-muted)]">
                  Sin ítems. Inserta en <Mono>nexus_catalog_items</Mono> o usa{' '}
                  <Mono className="text-[var(--nexus-green)]">db:studio</Mono>.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(0,242,254,0.04)]">
                <td className="p-4">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                      r.kind === 'hardware'
                        ? 'bg-[rgba(0,242,254,0.12)] text-[var(--nexus-cyan)]'
                        : 'bg-[rgba(255,215,0,0.1)] text-[var(--nexus-gold)]'
                    }`}
                  >
                    {r.kind}
                  </span>
                </td>
                <td className="p-4 font-mono text-xs text-[var(--nexus-cyan)]">{r.sku}</td>
                <td className="p-4 text-white">{r.name}</td>
                <td className="p-4 text-right font-mono text-[var(--nexus-green)]">
                  {r.currency} {r.unitPrice}
                </td>
                <td className="p-4 text-right font-mono text-[var(--nexus-text-muted)]">
                  {r.stockQty == null ? '—' : r.stockQty}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
