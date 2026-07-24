import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const FacturasCanalClient = dynamic(
  () => import('@/components/contabilidad/FacturasCanalClient'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#050508] text-zinc-500 flex items-center justify-center text-sm">
        Cargando facturas Telegram…
      </div>
    ),
  },
);

export default function FacturasCanalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050508] text-zinc-500 flex items-center justify-center text-sm">
          Cargando facturas Telegram…
        </div>
      }
    >
      <FacturasCanalClient />
    </Suspense>
  );
}
