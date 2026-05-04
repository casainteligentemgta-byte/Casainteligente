'use client';

import { Suspense, useMemo } from 'react';
import { useParams } from 'next/navigation';
import RegistroPorNeedCliente from '@/app/registro/RegistroPorNeedCliente';

function RegistroPorTokenInner() {
  const params = useParams();
  const token = useMemo(() => String(params?.token ?? '').trim(), [params?.token]);
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F] px-4 text-sm text-red-300">
        Enlace inválido.
      </div>
    );
  }
  return <RegistroPorNeedCliente captacionToken={token} />;
}

export default function RegistroCaptacionTokenPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F] text-sm text-zinc-400">Cargando…</div>
      }
    >
      <RegistroPorTokenInner />
    </Suspense>
  );
}
