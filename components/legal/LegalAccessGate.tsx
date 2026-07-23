'use client';

import Link from 'next/link';
import { Loader2, Scale } from 'lucide-react';
import { useAccesoLegal } from '@/lib/legal/AccesoLegalContext';

/** Bloquea /legal si no hay entitlement ni allowlist de dueño. */
export default function LegalAccessGate({ children }: { children: React.ReactNode }) {
  const acceso = useAccesoLegal();

  if (acceso.loading || acceso.unauthorized) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (acceso.deny) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-amber-500/20 bg-[#0c1018] p-8 text-center">
        <Scale className="mx-auto h-8 w-8 text-amber-400" />
        <h2 className="mt-3 text-lg font-bold text-white">Módulo Abogado</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Acceso restringido. Si contrataste el plan Legal (despacho o estudio), inicia sesión con
          la cuenta autorizada. Casa Inteligente usa el Departamento Legal integrado al CRM.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2">
          <Link
            href="/login?next=/legal"
            className="text-sm font-semibold text-amber-400 hover:text-amber-300"
          >
            Iniciar sesión
          </Link>
          <Link href="/abogado" className="text-xs text-zinc-500 hover:text-zinc-300">
            Conocer el Módulo Abogado →
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
