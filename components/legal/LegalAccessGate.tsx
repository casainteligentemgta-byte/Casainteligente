'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Scale } from 'lucide-react';
import { apiUrl } from '@/lib/http/apiUrl';

/** Bloquea /legal si no hay entitlement ni allowlist de dueño. */
export default function LegalAccessGate({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<'loading' | 'ok' | 'deny'>('loading');

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(apiUrl('/api/legal/acceso'), {
          credentials: 'include',
          cache: 'no-store',
        });
        if (cancel) return;
        if (res.status === 401) {
          window.location.href = `/login?next=${encodeURIComponent('/legal')}`;
          return;
        }
        const data = (await res.json()) as { acceso?: boolean };
        setEstado(data.acceso ? 'ok' : 'deny');
      } catch {
        if (!cancel) setEstado('deny');
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  if (estado === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (estado === 'deny') {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-amber-500/20 bg-[#0c1018] p-8 text-center">
        <Scale className="mx-auto h-8 w-8 text-amber-400" />
        <h2 className="mt-3 text-lg font-bold text-white">Departamento Legal</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Este módulo es de acceso restringido. Si contrataste el plan Legal, inicia sesión con la
          cuenta autorizada.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-amber-400 hover:text-amber-300">
          ← Volver al CRM
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
