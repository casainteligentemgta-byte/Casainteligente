import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const ConfirmarCompraTelegramClient = dynamic(
  () => import('@/components/contabilidad/ConfirmarCompraTelegramClient'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#050508] text-zinc-500 flex items-center justify-center text-sm">
        Cargando…
      </div>
    ),
  },
);

type Props = {
  params: { id: string };
};

export default function ConfirmarCompraTelegramPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050508] text-zinc-500 flex items-center justify-center text-sm">
          Cargando…
        </div>
      }
    >
      <ConfirmarCompraTelegramClient pendingId={params.id} />
    </Suspense>
  );
}
