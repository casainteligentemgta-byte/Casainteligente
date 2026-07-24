'use client';

import dynamic from 'next/dynamic';

const NexusVisionArchitectClient = dynamic(
  () => import('@/components/nexus/NexusVisionArchitectClient'),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-[var(--nexus-text-muted)]">
        Cargando NetVision Pro…
      </div>
    ),
  },
);

export default function NexusVisionPage() {
  return <NexusVisionArchitectClient />;
}
