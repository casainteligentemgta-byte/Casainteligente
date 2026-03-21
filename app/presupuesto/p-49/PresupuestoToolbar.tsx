'use client';

import Link from 'next/link';

export function PresupuestoToolbar() {
  return (
    <div className="mx-auto max-w-[220mm] px-3 print:hidden">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/presupuestos"
          className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
        >
          ← Volver a presupuestos
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Imprimir / PDF
        </button>
      </div>
    </div>
  );
}
