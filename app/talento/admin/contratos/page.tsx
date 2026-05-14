'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

/**
 * Página principal de Contratos.
 * Redirige automáticamente a la nueva interfaz Fast-List (Contratos Express).
 */
export default function ContratosAdminRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/talento/admin/contratos/fast-list');
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <RefreshCw className="size-10 text-amber-500 animate-spin" />
          <div className="absolute -inset-4 border border-amber-500/20 rounded-full animate-ping" />
        </div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] animate-pulse">
          Redireccionando a Contratos Express...
        </p>
      </div>
    </div>
  );
}
