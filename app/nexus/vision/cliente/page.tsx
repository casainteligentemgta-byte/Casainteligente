'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'

const NetVisionClienteView = dynamic(
  () => import('@/components/netvision/NetVisionClienteView'),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-[var(--nexus-text-muted)]">
        Cargando vista cliente…
      </div>
    ),
  },
)

export default function NetVisionClientePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--nexus-text-muted)]">
          Cargando vista cliente…
        </div>
      }
    >
      <NetVisionClienteView />
    </Suspense>
  )
}
