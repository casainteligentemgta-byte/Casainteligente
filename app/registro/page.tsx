'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import RegistroLegacyPrjRole from '@/app/registro/RegistroLegacyPrjRole';
import RegistroPorNeedCliente from '@/app/registro/RegistroPorNeedCliente';

function uuidOk(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

function RegistroEntry() {
  const searchParams = useSearchParams();
  const need = (searchParams.get('need') ?? '').trim();
  if (uuidOk(need)) {
    return <RegistroPorNeedCliente needId={need} />;
  }
  return <RegistroLegacyPrjRole />;
}

export default function RegistroPublicoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F] text-sm text-zinc-400">Cargando…</div>
      }
    >
      <RegistroEntry />
    </Suspense>
  );
}
