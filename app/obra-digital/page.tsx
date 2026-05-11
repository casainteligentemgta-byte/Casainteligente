import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function ObraDigitalIndexPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from('obra_digital_labor_contracts')
    .select('id,worker_name,worker_ci,contract_status,oficio,created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="min-h-screen bg-[#0a0a0b] px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Expediente de obra digital</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Contratos bajo LOTTT: estados estrictos, documentos escaneados con firma y huella, anticipos bloqueados en
              base de datos.
            </p>
          </div>
          <Link
            href="/obra-digital/nuevo"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Nuevo expediente
          </Link>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-200">
            {error.message} — Aplica la migración <code className="text-red-100">113_obra_digital_expediente_laboral.sql</code> en
            Supabase.
          </p>
        ) : !rows?.length ? (
          <p className="text-sm text-zinc-500">No hay contratos. Crea uno con «Nuevo expediente».</p>
        ) : (
          <ul className="space-y-2">
            {(rows as Array<{ id: string; worker_name: string; worker_ci: string; contract_status: string; oficio: string }>).map(
              (r) => (
                <li key={r.id}>
                  <Link
                    href={`/obra-digital/expediente/${r.id}`}
                    className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 transition hover:border-zinc-600 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium text-white">{r.worker_name}</span>
                    <span className="text-sm text-zinc-400">
                      CI {r.worker_ci} · {r.oficio} ·{' '}
                      <span className="font-mono text-emerald-300">{r.contract_status}</span>
                    </span>
                  </Link>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
