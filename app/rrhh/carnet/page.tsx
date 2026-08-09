import { Suspense } from 'react';
import RrhhCarnetClient from '@/components/rrhh/carnet/RrhhCarnetClient';

export const dynamic = 'force-dynamic';

export default function RrhhCarnetPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Cargando carnet…</p>}>
      <RrhhCarnetClient />
    </Suspense>
  );
}
