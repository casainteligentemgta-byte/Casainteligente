import { Suspense } from 'react';
import RrhhShell from '@/components/rrhh/RrhhShell';

export default function RrhhLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen px-4 py-6 text-sm text-zinc-500">Cargando RRHH…</div>}>
      <RrhhShell>{children}</RrhhShell>
    </Suspense>
  );
}
